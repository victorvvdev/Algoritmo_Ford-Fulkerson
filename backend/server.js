const http = require("node:http");
const { OpticNetworkSim } = require("./opticNetworkEngine");
const { companyGraph10Devices } = require("./companyNetworkGraph");

const sim = new OpticNetworkSim(companyGraph10Devices);

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString("utf-8");
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("JSON inválido na requisição."));
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  try {
    if (req.method === "GET" && pathname === "/api/state") {
      return sendJson(res, 200, sim.getTelemetry());
    }

    if (req.method === "POST" && pathname === "/api/reset-fibers") {
      return sendJson(res, 200, sim.resetFibers());
    }

    if (req.method === "POST" && pathname === "/api/reset-seed") {
      return sendJson(res, 200, sim.restoreInitialSeed());
    }

    if (req.method === "POST" && pathname === "/api/recalculate-baseline") {
      return sendJson(res, 200, sim.recalculateBaseline());
    }

    if (req.method === "PATCH" && pathname === "/api/endpoints") {
      const body = await readJsonBody(req);
      return sendJson(res, 200, sim.setEndpoints(body.source, body.sink));
    }

    if (req.method === "POST" && pathname === "/api/nodes") {
      const body = await readJsonBody(req);
      return sendJson(res, 201, sim.addNode(body));
    }

    const delNodeMatch = pathname.match(/^\/api\/nodes\/([^/]+)$/);
    if (req.method === "DELETE" && delNodeMatch) {
      return sendJson(res, 200, sim.removeNode(decodeURIComponent(delNodeMatch[1])));
    }

    if (req.method === "POST" && pathname === "/api/links") {
      const body = await readJsonBody(req);
      return sendJson(res, 201, sim.addLink(body));
    }

    const delLinkMatch = pathname.match(/^\/api\/links\/([^/]+)$/);
    if (req.method === "DELETE" && delLinkMatch) {
      return sendJson(res, 200, sim.removeLink(decodeURIComponent(delLinkMatch[1])));
    }

    const toggleLinkMatch = pathname.match(/^\/api\/links\/([^/]+)\/toggle$/);
    if (req.method === "POST" && toggleLinkMatch) {
      return sendJson(res, 200, sim.toggleLink(decodeURIComponent(toggleLinkMatch[1])));
    }

    const capLinkMatch = pathname.match(/^\/api\/links\/([^/]+)\/capacity$/);
    if (req.method === "PATCH" && capLinkMatch) {
      const body = await readJsonBody(req);
      return sendJson(
        res,
        200,
        sim.setLinkCapacity(decodeURIComponent(capLinkMatch[1]), body.capacity)
      );
    }

    return sendJson(res, 404, { error: "Rota não encontrada." });
  } catch (err) {
    return sendJson(res, 400, { error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`OpticNetworkSim API rodando em http://localhost:${PORT}`);
});