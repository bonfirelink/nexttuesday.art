// Pixel measurements on a <canvas>, read in the page. Positions come back in CSS px,
// in viewport coordinates (the canvas's rect offset plus the pixel position scaled
// by the canvas's CSS-to-backing-store ratio).

/**
 * Alpha-weighted centroid and bounding box of the pixels whose alpha exceeds `alphaMin`.
 * Returns { n, cx, cy, bx, by, bw, bh, rect } (bx/by: bounding-box centre; bw/bh: its size).
 */
export function canvasInk(page, selector, { alphaMin = 40 } = {}) {
  return page.evaluate(
    ([sel, alphaMin]) => {
      const c = document.querySelector(sel);
      const W = c.width, H = c.height;
      const d = c.getContext("2d").getImageData(0, 0, W, H).data;
      let n = 0, sx = 0, sy = 0, x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1;
      for (let j = 0; j < H; j++)
        for (let i = 0; i < W; i++) {
          if (d[(j * W + i) * 4 + 3] <= alphaMin) continue;
          n++; sx += i; sy += j;
          if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j;
        }
      const r = c.getBoundingClientRect(), k = r.width / W;
      if (!n) return { n: 0, rect: r.toJSON() };
      return {
        n,
        cx: r.left + (sx / n) * k, cy: r.top + (sy / n) * k,
        bx: r.left + ((x0 + x1 + 1) / 2) * k, by: r.top + ((y0 + y1 + 1) / 2) * k,
        bw: (x1 - x0 + 1) * k, bh: (y1 - y0 + 1) * k,
        rect: r.toJSON(),
      };
    },
    [selector, alphaMin]
  );
}

/** A cheap fingerprint of the canvas's pixels; two equal values mean an unchanged canvas. */
export function canvasFingerprint(page, selector) {
  return page.evaluate((sel) => {
    const c = document.querySelector(sel);
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let h = 2166136261;
    for (let i = 0; i < d.length; i += 4) h = Math.imul(h ^ d[i + 3] ^ (d[i] << 8), 16777619);
    return h >>> 0;
  }, selector);
}
