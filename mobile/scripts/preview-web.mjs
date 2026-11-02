import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
const root = resolve("dist");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
};
createServer(async (req, res) => {
  try {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405).end();
      return;
    }
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    let file = resolve(root, `.${pathname}`);
    if (relative(root, file).startsWith("..")) {
      res.writeHead(403).end();
      return;
    }
    if (pathname === "/" || !extname(pathname))
      file = resolve(root, "index.html");
    if (!(await stat(file)).isFile()) {
      res.writeHead(404).end();
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(8084, "127.0.0.1", () =>
  console.log("Mobile production preview: http://127.0.0.1:8084"),
);
