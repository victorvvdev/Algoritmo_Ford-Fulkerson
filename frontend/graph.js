import { fiberLabels, fiberState, format } from "./flow.js";

const seedPositions = new Map(Object.entries({
  D1: [60, 220], D2: [255, 70], D3: [255, 220], D4: [255, 380],
  D5: [500, 350], D6: [500, 70], D7: [500, 200], D8: [735, 150],
  D9: [935, 270], D10: [1100, 270]
}));
const graphWidth = 1160;
const graphHeight = 490;

function element(tag, attributes, content) {
  const item = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attributes)) item.setAttribute(key, value);
  if (content !== undefined) item.textContent = content;
  return item;
}

export function drawGraph(svg, state, selectFiber) {
  const extra = state.nodes.filter(node => !seedPositions.has(node.id));
  const positions = new Map(seedPositions);
  extra.forEach((node, index) => positions.set(node.id, [
    80 + index % 6 * 195, graphHeight + 42 + Math.floor(index / 6) * 110
  ]));
  svg.setAttribute("viewBox", `0 0 ${graphWidth} ${graphHeight + Math.ceil(extra.length / 6) * 110}`);

  const defs = element("defs", {});
  for (const name of Object.keys(fiberLabels)) {
    const marker = element("marker", { id: `arrow-${name}`, viewBox: "0 0 10 10", refX: 9, refY: 5,
      markerUnits: "userSpaceOnUse", markerWidth: 14, markerHeight: 14, orient: "auto" });
    marker.append(element("path", { d: "M0 0L10 5L0 10Z", class: name }));
    defs.append(marker);
  }

  // Agrupa conexões paralelas e opostas para desenhá-las sem sobreposição exata.
  const pairs = new Map();
  for (const link of state.links) {
    const key = JSON.stringify([link.source, link.target].sort());
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key).push(link);
  }
  const edges = new Map();
  for (const pair of pairs.values()) {
    pair.forEach((link, index) => {
      const [x1, y1] = positions.get(link.source);
      const [x2, y2] = positions.get(link.target);
      const length = Math.hypot(x2 - x1, y2 - y1);
      const ux = (x2 - x1) / length;
      const uy = (y2 - y1) / length;
      const direction = link.source < link.target ? 1 : -1;
      // A ligação direta entre o terceiro andar e o storage contorna os nós centrais.
      const bypass = link.source === "D4" && link.target === "D8" ? 310 : 0;
      const bend = bypass + (index - (pair.length - 1) / 2) * 85 * direction;
      const cx = (x1 + x2) / 2 - uy * bend;
      const cy = (y1 + y2) / 2 + ux * bend;
      const startDistance = Math.hypot(cx - x1, cy - y1);
      const endDistance = Math.hypot(cx - x2, cy - y2);
      const sx = x1 + (cx - x1) / startDistance * 23;
      const sy = y1 + (cy - y1) / startDistance * 23;
      const ex = x2 + (cx - x2) / endDistance * 26;
      const ey = y2 + (cy - y2) / endDistance * 26;
      const d = `M${sx} ${sy} Q${cx} ${cy} ${ex} ${ey}`;
      const name = fiberState(link);
      const group = element("g", { class: `edge ${name}`, tabindex: 0, role: "button", "aria-pressed": false,
        "aria-label": `${link.id}, ${link.source} para ${link.target}, ${fiberLabels[name]}, ${format(link.flow)} de ${format(link.capacity)} Gbps` });
      group.append(
        element("path", { d, class: "hit" }),
        element("path", { d, class: "line", "marker-end": `url(#arrow-${name})` }),
        element("text", { x: (sx + 2 * cx + ex) / 4, y: (sy + 2 * cy + ey) / 4 - 8 },
          `${link.id} · ${format(link.flow)}/${format(link.capacity)}`)
      );
      group.addEventListener("click", () => selectFiber(link.id));
      group.addEventListener("keydown", event => {
        if (!["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        selectFiber(link.id);
      });
      edges.set(link.id, group);
    });
  }

  const nodes = state.nodes.map(node => {
    const [x, y] = positions.get(node.id);
    const role = node.id === state.source ? "Origem" : node.id === state.sink ? "Destino" : "";
    const group = element("g", { class: role ? "node endpoint" : "node" });
    group.append(element("title", {}, node.name), element("circle", { cx: x, cy: y, r: 22 }),
      element("text", { x, y: y + 5 }, node.id.length > 6 ? node.id.slice(0, 5) + "…" : node.id));
    if (role) group.append(element("text", { x, y: y + 43, class: "node-role" }, role));
    return group;
  });
  svg.replaceChildren(defs, ...edges.values(), ...nodes);
  return edges;
}
