// CDP tracing for the perf guards: what the renderer's main thread painted
// (by node), laid out and ran frames for during a window. Counts, not times.
const SAME_FRAME_US = 5000; // Paint events of one node this close are one frame's paints
const CATEGORIES = ["devtools.timeline", "disabled-by-default-devtools.timeline", "blink", "cc", "toplevel"];

// Runs `action(page)` under a trace and returns { paints, layouts, frames, byNode, events, main }.
//   events   every raw trace event; main: the CrRendererMain thread's events
//   paints   Paint events on the renderer main thread, all nodes
//   layouts  Layout events on the renderer main thread
//   frames   requestAnimationFrame callbacks that ran while `action` did
//   hits     labels of the nodes counted in a selector, for the failure message
//   repeats  Map of `selectors[i]` -> repaints inside it: for each node, the frames it was painted
//            in beyond the first (events less than SAME_FRAME_US apart are one frame). A node's first
//            paint in the trace is when it first comes into view, whenever that happens on a loaded
//            machine; a repaint is the regression.
//   byNode   Map of `selectors[i]` -> Paint events whose node is inside one of that selector
//            (`closest`), plus "(no node)" and "(other)" buckets
// The page needs to be loaded already. `selectors` is a list of CSS selectors.
export async function trace(page, action, { selectors = [] } = {}) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("DOM.enable");
    await session.send("DOM.getDocument", { depth: -1 });
    const events = [];
    session.on("Tracing.dataCollected", (e) => events.push(...e.value));
    const complete = new Promise((r) => session.once("Tracing.tracingComplete", r));
    await page.evaluate(() => {
      window.__traceFrames = 0;
      const tick = () => { window.__traceFrames++; window.__traceRaf = requestAnimationFrame(tick); };
      window.__traceRaf = requestAnimationFrame(tick);
    });
    await session.send("Tracing.start", { traceConfig: { includedCategories: CATEGORIES } });
    await action(page);
    const frames = await page.evaluate(() => { cancelAnimationFrame(window.__traceRaf); return window.__traceFrames; });
    await session.send("Tracing.end");
    await complete;

    const threads = {};
    for (const e of events) if (e.name === "thread_name") threads[e.pid + ":" + e.tid] = e.args.name;
    const main = events.filter((e) => threads[e.pid + ":" + e.tid] === "CrRendererMain");
    const paintEvents = main.filter((e) => e.name === "Paint");
    const layouts = main.filter((e) => e.name === "Layout" && e.ph === "X").length;

    const perNode = new Map();
    const repaintsOf = new Map(); // nodeId -> paint frames beyond its first
    const lastTs = new Map();
    for (const e of [...paintEvents].sort((a, b) => a.ts - b.ts)) {
      const id = e.args?.data?.nodeId || 0;
      perNode.set(id, (perNode.get(id) || 0) + 1);
      if (lastTs.has(id) && e.ts - lastTs.get(id) >= SAME_FRAME_US) repaintsOf.set(id, (repaintsOf.get(id) || 0) + 1);
      lastTs.set(id, e.ts);
    }
    const repeats = new Map(selectors.map((s) => [s, 0]));
    const byNode = new Map([["(no node)", perNode.get(0) || 0], ["(other)", 0], ...selectors.map((s) => [s, 0])]);
    const hits = [];
    const ids = [...perNode.keys()].filter(Boolean);
    for (const id of ids) {
      let hit = null;
      try {
        const { object } = await session.send("DOM.resolveNode", { backendNodeId: id });
        const { result } = await session.send("Runtime.callFunctionOn", {
          objectId: object.objectId,
          returnByValue: true,
          functionDeclaration: `function (sels) {
            const el = this.nodeType === 1 ? this : this.parentElement;
            const label = el ? el.tagName.toLowerCase() + (el.className && el.className.baseVal === undefined ? "." + String(el.className).trim().split(/\\s+/).join(".") : "") : "?";
            return { label, hit: el ? sels.find((s) => el.closest(s)) || null : null };
          }`,
          arguments: [{ value: selectors }],
        });
        hit = result.value;
      } catch (err) {
        hit = null; // node gone by the time the trace ended
        try { const d = await session.send("DOM.describeNode", { backendNodeId: id }); hit = { label: "?" + d.node.nodeName + "(" + err.message.slice(0, 40) + ")", hit: null }; } catch (e2) { hit = { label: "?gone " + e2.message.slice(0, 30), hit: null }; }
      }
      const key = hit?.hit ?? "(other)";
      byNode.set(key, byNode.get(key) + perNode.get(id));
      if (repeats.has(key)) repeats.set(key, repeats.get(key) + (repaintsOf.get(id) || 0));
      if (hit) (hit.hit ? hits : (byNode.others ??= [])).push(`${perNode.get(id)}x ${hit.label}`);
    }
    return { paints: paintEvents.length, layouts, frames, byNode, repeats, others: byNode.others ?? [], hits, events, main };
  } finally {
    await session.detach().catch(() => {});
  }
}

export const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)];

