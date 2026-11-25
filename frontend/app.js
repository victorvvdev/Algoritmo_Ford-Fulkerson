const API_URL = "http://localhost:3000/api";
const SVG_NS = "http://www.w3.org/2000/svg";

const DEFAULT_POSITIONS = {
  D1: { x: 85, y: 205 },
  D2: { x: 255, y: 85 },
  D3: { x: 255, y: 205 },
  D4: { x: 255, y: 325 },
  D5: { x: 470, y: 185 },
  D6: { x: 470, y: 75 },
  D7: { x: 470, y: 310 },
  D8: { x: 650, y: 125 },
  D9: { x: 660, y: 295 },
  D10: { x: 815, y: 205 }
};

const nodeCoords = new Map();
let latestState = null;
let activeDragId = null;

function notify(text, isError = false) {
  const el = document.getElementById("status-msg");
  el.textContent = text;
  el.classList.toggle("error", isError);
}

async function callApi(endpoint, method = "GET", payload = null) {
  const options = {
    method,
    headers: { "Content-Type": "application/json" }
  };
  if (payload !== null) {
    options.body = JSON.stringify(payload);
  }
  const response = await fetch(`${API_URL}${endpoint}`, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Erro ao comunicar com o servidor.");
  }
  return data;
}

function syncCoords(nodes) {
  const ids = new Set(nodes.map((n) => n.id));
  for (const existing of nodeCoords.keys()) {
    if (!ids.has(existing)) {
      nodeCoords.delete(existing);
    }
  }

  nodes.forEach((node, idx) => {
    if (nodeCoords.has(node.id)) return;
    if (DEFAULT_POSITIONS[node.id]) {
      nodeCoords.set(node.id, { ...DEFAULT_POSITIONS[node.id] });
    } else {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      nodeCoords.set(node.id, {
        x: 180 + col * 165,
        y: 80 + row * 105
      });
    }
  });
}

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, val] of Object.entries(attrs)) {
    el.setAttribute(key, String(val));
  }
  return el;
}

function pointerToSvg(svg, clientX, clientY) {
  const rect = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  return {
    x: Math.max(42, Math.min(vb.width - 42, ((clientX - rect.left) / rect.width) * vb.width)),
    y: Math.max(32, Math.min(vb.height - 36, ((clientY - rect.top) / rect.height) * vb.height))
  };
}

function drawGraph(state) {
  const svg = document.getElementById("graph-svg");
  svg.innerHTML = "";

  const defs = svgEl("defs");
  const marker = svgEl("marker", {
    id: "fiber-arrow",
    viewBox: "0 0 10 10",
    refX: "22",
    refY: "5",
    markerWidth: "5.5",
    markerHeight: "5.5",
    orient: "auto-start-reverse"
  });
  marker.appendChild(svgEl("path", { d: "M 0 1.5 L 10 5 L 0 8.5 z", fill: "#64748b" }));
  defs.appendChild(marker);
  svg.appendChild(defs);

  // Arestas (fibras ópticas)
  for (const link of state.links) {
    const a = nodeCoords.get(link.source);
    const b = nodeCoords.get(link.target);
    if (!a || !b) continue;

    let color = "#38bdf8";
    let width = Math.max(1.8, Math.min(4.2, link.capacity / 16));
    let dash = "none";

    if (!link.active) {
      color = "#ef4444";
      width = 1.8;
      dash = "5 4";
    } else if (link.inMinCut) {
      color = "#eab308";
      width = Math.max(2.6, width);
    } else if (link.flow > 0) {
      color = "#22c55e";
    }

    const group = svgEl("g", { class: "edge-hit" });
    group.addEventListener("click", () => toggleFiber(link.id));

    group.appendChild(
      svgEl("line", {
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        stroke: "transparent",
        "stroke-width": 14
      })
    );

    group.appendChild(
      svgEl("line", {
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        stroke: color,
        "stroke-width": width,
        "stroke-dasharray": dash,
        "marker-end": "url(#fiber-arrow)"
      })
    );

    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const tag = !link.active
      ? `${link.id} · OFF`
      : `${link.id} ${link.flow}/${link.capacity}G${link.inMinCut ? " · CORTE" : ""}`;

    const pillW = Math.max(54, tag.length * 6.2 + 10);
    const pillH = 16;

    group.appendChild(
      svgEl("rect", {
        x: mx - pillW / 2,
        y: my - pillH / 2,
        width: pillW,
        height: pillH,
        rx: 4,
        class: "edge-label-bg",
        stroke: !link.active ? "#ef4444" : link.inMinCut ? "#eab308" : "#334566"
      })
    );

    const label = svgEl("text", {
      x: mx,
      y: my,
      class: "edge-label-text"
    });
    label.textContent = tag;
    group.appendChild(label);

    svg.appendChild(group);
  }

  // Vértices (dispositivos)
  for (const node of state.nodes) {
    const pos = nodeCoords.get(node.id);
    if (!pos) continue;

    const isSource = node.id === state.source;
    const isSink = node.id === state.sink;

    let fill = "#1e3a5f";
    let stroke = "#60a5fa";
    if (isSource) {
      fill = "#0e4a6e";
      stroke = "#38bdf8";
    } else if (isSink) {
      fill = "#14532d";
      stroke = "#4ade80";
    }

    const g = svgEl("g", { class: "node-hit" });
    g.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      activeDragId = node.id;
      g.setPointerCapture(e.pointerId);
    });

    g.addEventListener("pointermove", (e) => {
      if (activeDragId !== node.id) return;
      nodeCoords.set(node.id, pointerToSvg(svg, e.clientX, e.clientY));
      drawGraph(latestState);
    });

    g.addEventListener("pointerup", () => {
      activeDragId = null;
    });

    g.appendChild(
      svgEl("circle", {
        cx: pos.x,
        cy: pos.y,
        r: 17,
        fill,
        stroke,
        "stroke-width": 2
      })
    );

    const idTxt = svgEl("text", {
      x: pos.x,
      y: pos.y,
      class: "node-id-text"
    });
    idTxt.textContent = node.id;
    g.appendChild(idTxt);

    const capTxt = svgEl("text", {
      x: pos.x,
      y: pos.y + 27,
      class: "node-caption-text"
    });
    const suffix = isSource ? " [S]" : isSink ? " [T]" : "";
    capTxt.textContent = `${node.name}${suffix}`;
    g.appendChild(capTxt);

    svg.appendChild(g);
  }
}

function renderAll(state) {
  latestState = state;
  syncCoords(state.nodes);

  document.getElementById("m-flow").textContent = `${state.currentMaxFlow} Gbps`;
  document.getElementById("m-baseline").textContent = `${state.baselineMaxFlow} Gbps`;
  document.getElementById("m-resilience").textContent = `${state.resiliencePct}%`;
  document.getElementById("m-mincut").textContent = `${state.minCutCapacity} Gbps`;

  document.getElementById("count-nodes").textContent = state.totalDevices;
  document.getElementById("count-links").textContent = state.totalLinks;

  const options = state.nodes
    .map((n) => `<option value="${n.id}">${n.id} — ${n.name}</option>`)
    .join("");

  const selSource = document.getElementById("sel-source");
  const selSink = document.getElementById("sel-sink");
  const linkSource = document.getElementById("link-source");
  const linkTarget = document.getElementById("link-target");

  selSource.innerHTML = options;
  selSink.innerHTML = options;
  linkSource.innerHTML = options;
  linkTarget.innerHTML = options;

  selSource.value = state.source;
  selSink.value = state.sink;

  document.getElementById("tbody-nodes").innerHTML = state.nodes
    .map((n) => {
      const role =
        n.id === state.source ? "Origem (S)" : n.id === state.sink ? "Destino (T)" : n.role;
      const removable = n.id !== state.source && n.id !== state.sink;
      return `
        <tr>
          <td><strong>${n.id}</strong></td>
          <td>${n.name}</td>
          <td>${n.sector || "-"}</td>
          <td>${role}</td>
          <td>
            ${
              removable
                ? `<button type="button" class="btn btn-danger btn-xs" data-del-node="${n.id}">Remover</button>`
                : "-"
            }
          </td>
        </tr>
      `;
    })
    .join("");

  document.getElementById("tbody-links").innerHTML = state.links
    .map((l) => {
      const statusPill = l.active
        ? `<span class="pill pill-ok">Ativa</span>`
        : `<span class="pill pill-broken">Rompida</span>`;
      const cutPill = l.inMinCut
        ? `<span class="pill pill-cut">Sim (${l.capacity}G)</span>`
        : "Não";

      return `
        <tr>
          <td><strong>${l.id}</strong></td>
          <td>${l.source} → ${l.target}</td>
          <td>${l.flow} / ${l.capacity} Gbps</td>
          <td>${statusPill}</td>
          <td>${cutPill}</td>
          <td class="actions-cell">
            <button type="button" class="btn btn-secondary btn-xs" data-toggle-link="${l.id}">
              ${l.active ? "Romper" : "Restaurar"}
            </button>
            <button type="button" class="btn btn-ghost btn-xs" data-cap-link="${l.id}">Cap.</button>
            <button type="button" class="btn btn-danger btn-xs" data-del-link="${l.id}">Excluir</button>
          </td>
        </tr>
      `;
    })
    .join("");

  drawGraph(state);
}

async function toggleFiber(linkId) {
  try {
    const state = await callApi(`/links/${encodeURIComponent(linkId)}/toggle`, "POST");
    renderAll(state);
    notify(`Fibra ${linkId} atualizada.`);
  } catch (err) {
    notify(err.message, true);
  }
}

async function boot() {
  try {
    const state = await callApi("/state");
    renderAll(state);
    notify("Rede sincronizada com o back-end.");
  } catch (err) {
    notify(`Erro de conexão com o back-end: ${err.message}`, true);
  }
}

document.getElementById("form-endpoints").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const source = document.getElementById("sel-source").value;
    const sink = document.getElementById("sel-sink").value;
    const state = await callApi("/endpoints", "PATCH", { source, sink });
    renderAll(state);
    notify(`Origem/Destino definidos para ${source} → ${sink}.`);
  } catch (err) {
    notify(err.message, true);
  }
});

document.getElementById("btn-recalc-base").addEventListener("click", async () => {
  try {
    const state = await callApi("/recalculate-baseline", "POST");
    renderAll(state);
    notify("Fluxo nominal base atualizado.");
  } catch (err) {
    notify(err.message, true);
  }
});

document.getElementById("form-node").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const id = document.getElementById("node-id").value.trim();
    const name = document.getElementById("node-name").value.trim();
    const sector = document.getElementById("node-sector").value.trim();
    const state = await callApi("/nodes", "POST", { id, name, sector, role: "switch" });
    renderAll(state);
    e.target.reset();
    notify(`Dispositivo ${id} adicionado.`);
  } catch (err) {
    notify(err.message, true);
  }
});

document.getElementById("form-link").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const id = document.getElementById("link-id").value.trim();
    const source = document.getElementById("link-source").value;
    const target = document.getElementById("link-target").value;
    const capacity = Number(document.getElementById("link-cap").value);
    const state = await callApi("/links", "POST", { id, source, target, capacity });
    renderAll(state);
    e.target.reset();
    notify(`Fibra ${id} adicionada.`);
  } catch (err) {
    notify(err.message, true);
  }
});

document.getElementById("tbody-nodes").addEventListener("click", async (e) => {
  const nodeId = e.target.getAttribute("data-del-node");
  if (!nodeId) return;
  try {
    const state = await callApi(`/nodes/${encodeURIComponent(nodeId)}`, "DELETE");
    renderAll(state);
    notify(`Dispositivo ${nodeId} removido.`);
  } catch (err) {
    notify(err.message, true);
  }
});

document.getElementById("tbody-links").addEventListener("click", async (e) => {
  const toggleId = e.target.getAttribute("data-toggle-link");
  const capId = e.target.getAttribute("data-cap-link");
  const delId = e.target.getAttribute("data-del-link");

  try {
    if (toggleId) {
      await toggleFiber(toggleId);
    } else if (capId) {
      const current = latestState?.links.find((item) => item.id === capId);
      const val = prompt(
        `Nova capacidade em Gbps para ${capId}:`,
        current ? String(current.capacity) : "20"
      );
      if (val === null) return;
      const capacity = Number(val);
      const state = await callApi(
        `/links/${encodeURIComponent(capId)}/capacity`,
        "PATCH",
        { capacity }
      );
      renderAll(state);
      notify(`Capacidade de ${capId} alterada para ${capacity} Gbps.`);
    } else if (delId) {
      const state = await callApi(`/links/${encodeURIComponent(delId)}`, "DELETE");
      renderAll(state);
      notify(`Fibra ${delId} excluída.`);
    }
  } catch (err) {
    notify(err.message, true);
  }
});

document.getElementById("btn-reset-fibers").addEventListener("click", async () => {
  try {
    const state = await callApi("/reset-fibers", "POST");
    renderAll(state);
    notify("Todas as fibras restauradas.");
  } catch (err) {
    notify(err.message, true);
  }
});

document.getElementById("btn-reset-seed").addEventListener("click", async () => {
  try {
    const state = await callApi("/reset-seed", "POST");
    renderAll(state);
    notify("Topologia inicial restaurada.");
  } catch (err) {
    notify(err.message, true);
  }
});

boot();