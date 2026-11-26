import { fiberLabels, fiberState, flowPaths, format } from "./flow.js";
import { drawGraph } from "./graph.js";

const API = window.OPTIC_API_URL || "http://localhost:3000/api";
const byId = id => document.getElementById(id);
const workspace = byId("workspace");
const dialog = byId("capacity-dialog");
const capacityForm = byId("edit-capacity");
const presentation = byId("presentation");
const fullscreen = byId("fullscreen");
const linkUrl = id => `/links/${encodeURIComponent(id)}`;
const connection = link => `${link.source} → ${link.target}`;

let state;
let busy = false;
let selectedFiber;
let selectedPath;
let editingFiber;
let edges;

function status(message, error = false) {
  byId("status").textContent = message;
  byId("status").classList.toggle("error", error);
}

// Toda edição devolve o estado completo, então os indicadores e o mapa
// sempre são atualizados juntos a partir da mesma resposta.
async function request(path, method = "GET", body, message = "") {
  if (busy) return false;
  busy = true;
  byId("reload").disabled = true;
  workspace.setAttribute("aria-busy", "true");
  status("Atualizando rede…");
  try {
    const response = await fetch(API + path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const next = await response.json();
    if (!response.ok) throw new Error(next.error || `Erro HTTP ${response.status}`);
    state = next;
    if (method !== "GET") selectedPath = undefined;
    render();
    status(message);
    return true;
  } catch (error) {
    status(error instanceof TypeError ? `Confira se o back-end está rodando em ${API} e recarregue os dados.` : error.message, true);
    return false;
  } finally {
    busy = false;
    byId("reload").disabled = false;
    workspace.disabled = !state;
    workspace.removeAttribute("aria-busy");
  }
}

function button(label, action, className = "") {
  const control = document.createElement("button");
  control.type = "button";
  control.textContent = label;
  control.className = className;
  control.addEventListener("click", action);
  return control;
}

function options(id, values, selected, label) {
  const select = byId(id);
  select.replaceChildren(...values.map(value => new Option(label(value), value.id)));
  if (values.some(value => value.id === selected)) select.value = selected;
}

function highlight() {
  for (const [id, edge] of edges) {
    edge.classList.toggle("muted", Boolean(selectedPath && !selectedPath.links.includes(id) && selectedFiber !== id));
    edge.classList.toggle("selected", selectedFiber === id);
    edge.setAttribute("aria-pressed", selectedFiber === id);
  }
}

function selectFiber(id) {
  selectedFiber = id;
  const link = state.links.find(item => item.id === id);
  byId("fiber-select").value = id ?? "";
  byId("fiber-status").textContent = link
    ? `${fiberLabels[fiberState(link)]} · ${format(link.flow)} / ${format(link.capacity)} Gbps`
    : "Nenhuma fibra selecionada.";
  byId("toggle").hidden = !link;
  if (link) byId("toggle").textContent = link.active ? "Romper fibra" : "Restaurar fibra";
  highlight();
}

function renderPaths() {
  const list = byId("paths");
  const paths = flowPaths(state);
  selectedPath = paths.find(path => JSON.stringify(path.links) === JSON.stringify(selectedPath?.links));
  list.replaceChildren(...paths.map(path => {
    const control = button(`${path.nodes.join(" → ")} · ${format(path.amount)} Gbps`, () => {
      selectedPath = selectedPath === path ? undefined : path;
      for (const item of list.children) item.setAttribute("aria-pressed", item === control && Boolean(selectedPath));
      highlight();
    });
    control.setAttribute("aria-pressed", selectedPath === path);
    return control;
  }));
  if (!paths.length) list.textContent = "Nenhum caminho transporta fluxo neste trajeto.";
}

function inventoryItem(label, ...actions) {
  const row = document.createElement("li");
  const text = document.createElement("span");
  text.textContent = label;
  row.append(text, ...actions);
  return row;
}

function remove(path, label) {
  if (!busy && confirm(`Remover ${label}?`)) request(path, "DELETE", undefined, "Rede atualizada.");
}

function renderInventory() {
  byId("nodes").replaceChildren(...state.nodes.map(node => {
    const label = [node.id, node.name, node.sector].filter(Boolean).join(" · ");
    if ([state.source, state.sink].includes(node.id)) {
      return inventoryItem(`${label} · ${node.id === state.source ? "Origem" : "Destino"}`);
    }
    return inventoryItem(label, button("Remover", () => remove(`/nodes/${encodeURIComponent(node.id)}`, `${node.id} e suas fibras`)));
  }));
  byId("links").replaceChildren(...state.links.map(link => inventoryItem(
    `${link.id} · ${connection(link)} · ${format(link.capacity)} Gbps`,
    button("Capacidade", () => {
      if (busy) return;
      editingFiber = link.id;
      byId("capacity-title").textContent = `Capacidade de ${link.id}`;
      capacityForm.elements.capacity.value = link.capacity;
      dialog.showModal();
    }),
    button("Remover", () => remove(linkUrl(link.id), link.id))
  )));
}

function render() {
  const { nodes, links, source, sink, currentMaxFlow, baselineMaxFlow, minCutCapacity, minCutLinks } = state;
  byId("flow").textContent = format(currentMaxFlow);
  byId("trajectory").textContent = `${source} → ${sink}`;
  byId("baseline").textContent = format(baselineMaxFlow);
  byId("comparison").textContent = baselineMaxFlow > 0 ? `${state.resiliencePct}% da referência no cenário atual` : "Referência igual a zero";
  byId("cut-capacity").textContent = format(minCutCapacity);
  byId("cut-count").textContent = `${minCutLinks.length} ${minCutLinks.length === 1 ? "fibra no corte" : "fibras no corte"}`;
  byId("counts").textContent = `${nodes.length} dispositivos · ${links.length} fibras`;

  const deviceLabel = node => `${node.id} · ${node.name}`;
  options("source", nodes, source, deviceLabel);
  options("sink", nodes, sink, deviceLabel);
  options("link-source", nodes, byId("link-source").value || source, deviceLabel);
  options("link-target", nodes, byId("link-target").value || sink, deviceLabel);
  options("fiber-select", links, selectedFiber, link => `${link.id} · ${connection(link)}`);
  byId("fiber-select").prepend(new Option("Selecione uma fibra", ""));
  edges = drawGraph(byId("graph"), state, selectFiber);
  renderPaths();
  selectFiber(edges.has(selectedFiber) ? selectedFiber : undefined);

  const cutList = byId("cut-links");
  cutList.replaceChildren(...minCutLinks.map(link =>
    button(`${link.id} · ${connection(link)} · ${format(link.capacity)} Gbps`, () => selectFiber(link.id), "cut-item")
  ));
  if (!minCutLinks.length) cutList.textContent = "Nenhuma fibra ativa cruza o corte.";
  renderInventory();
}

function onSubmit(id, action) {
  byId(id).addEventListener("submit", event => {
    event.preventDefault();
    if (!busy) action(Object.fromEntries(new FormData(event.currentTarget)), event.currentTarget);
  });
}

onSubmit("endpoints", data => {
  if (data.source === data.sink) return status("Escolha dispositivos diferentes para a origem e o destino.", true);
  request("/endpoints", "PATCH", data, "Trajeto atualizado.");
});
onSubmit("add-node", async (data, form) => {
  if (await request("/nodes", "POST", { ...data, role: "switch" }, "Dispositivo adicionado.")) form.reset();
});
onSubmit("add-link", async (data, form) => {
  if (data.source === data.target) return status("Uma fibra precisa conectar dispositivos diferentes.", true);
  if (await request("/links", "POST", data, "Fibra adicionada.")) {
    form.reset();
    byId("link-source").value = data.source;
    byId("link-target").value = data.target;
  }
});
onSubmit("edit-capacity", async data => {
  const input = capacityForm.elements.capacity;
  input.setCustomValidity("");
  const saved = await request(linkUrl(editingFiber) + "/capacity", "PATCH", data, "Capacidade atualizada.");
  if (saved) dialog.close();
  else if (dialog.open) {
    input.setCustomValidity(byId("status").textContent);
    input.reportValidity();
  }
});
capacityForm.elements.capacity.addEventListener("input", event => event.target.setCustomValidity(""));
dialog.addEventListener("close", () => capacityForm.elements.capacity.setCustomValidity(""));
byId("cancel-capacity").onclick = () => dialog.close();
byId("fiber-select").onchange = event => selectFiber(event.target.value);
byId("toggle").onclick = () => request(linkUrl(selectedFiber) + "/toggle", "POST", undefined, "Fibra atualizada. Fluxo e corte recalculados.");
byId("restore").onclick = () => request("/reset-fibers", "POST", undefined, "Todas as fibras foram restauradas.");
byId("reference").onclick = () => request("/recalculate-baseline", "POST", undefined, "Referência atualizada.");
byId("reset").onclick = () => {
  if (!busy && confirm("Restaurar o cenário inicial e descartar as alterações da topologia?")) {
    request("/reset-seed", "POST", undefined, "Cenário inicial restaurado.");
  }
};
byId("reload").onclick = () => request("/state");

function syncFullscreen() {
  const active = document.fullscreenElement === presentation || presentation.classList.contains("presentation-expanded");
  fullscreen.textContent = active ? "Sair da tela cheia" : "Tela cheia";
  fullscreen.setAttribute("aria-pressed", String(active));
}

fullscreen.addEventListener("click", async () => {
  if (document.fullscreenElement === presentation) {
    await document.exitFullscreen();
  } else if (presentation.classList.contains("presentation-expanded")) {
    presentation.classList.remove("presentation-expanded");
  } else {
    try {
      await presentation.requestFullscreen();
    } catch {
      // Mantém o modo de apresentação disponível em navegadores que bloqueiam a tela cheia.
      presentation.classList.add("presentation-expanded");
    }
  }
  syncFullscreen();
  fullscreen.focus({ preventScroll: true });
});

document.addEventListener("fullscreenchange", syncFullscreen);
document.addEventListener("keydown", event => {
  if (event.key !== "Escape" || !presentation.classList.contains("presentation-expanded")) return;
  presentation.classList.remove("presentation-expanded");
  syncFullscreen();
  fullscreen.focus({ preventScroll: true });
});

request("/state");
