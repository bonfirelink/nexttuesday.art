// A GitHub-Pages-like static server for the checkout's site/ folder.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

export const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../site");

export function startServer(root = SITE) {
  const notFound = fs.readFileSync(path.join(root, "404.html"));
  const server = http.createServer((req, res) => {
    const headers = { "Cache-Control": "no-store" };
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
    } catch {
      res.writeHead(400, headers).end();
      return;
    }
    const file = path.join(root, pathname);
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403, headers).end();
      return;
    }
    let stat = null;
    try { stat = fs.statSync(file); } catch {}
    if (stat?.isDirectory()) {
      if (!pathname.endsWith("/")) {
        const q = new URL(req.url, "http://x").search;
        res.writeHead(301, { ...headers, Location: pathname + "/" + q }).end();
        return;
      }
      const index = path.join(file, "index.html");
      if (fs.existsSync(index)) {
        res.writeHead(200, { ...headers, "Content-Type": MIME[".html"] });
        res.end(req.method === "HEAD" ? undefined : fs.readFileSync(index));
        return;
      }
      stat = null;
    }
    if (stat?.isFile()) {
      const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
      res.writeHead(200, { ...headers, "Content-Type": type, "Content-Length": stat.size });
      res.end(req.method === "HEAD" ? undefined : fs.readFileSync(file));
      return;
    }
    res.writeHead(404, { ...headers, "Content-Type": MIME[".html"] });
    res.end(req.method === "HEAD" ? undefined : notFound);
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }),
      })
    )
  );
}
