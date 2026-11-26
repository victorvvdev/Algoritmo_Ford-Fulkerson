"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const PORT = Number(process.env.FRONTEND_PORT || 5173);
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8", Allow: "GET, HEAD" });
    return res.end("Método não permitido.");
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Endereço inválido.");
  }

  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(ROOT, `.${requested}`);
  if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Acesso negado.");
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      const status = error.code === "ENOENT" || error.code === "EISDIR" ? 404 : 500;
      res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end(status === 404 ? "Arquivo não encontrado." : "Erro ao ler o arquivo.");
    }
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(req.method === "HEAD" ? undefined : content);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`OpticNetworkSim front-end em http://localhost:${PORT}`);
  console.log("API esperada em http://localhost:3000/api (inicie o back-end em outro terminal).");
});
