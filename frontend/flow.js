// Extrai rotas do fluxo final da API. Cada iteração esgota ao menos
// uma fibra; fluxos em ciclos ficam fora das rotas origem–destino.
export function flowPaths({ source, sink, links }) {
  const outgoing = new Map();
  const remaining = new Map();
  for (const link of links) {
    if (!link.active || link.flow <= 0) continue;
    if (!outgoing.has(link.source)) outgoing.set(link.source, []);
    outgoing.get(link.source).push(link);
    remaining.set(link.id, link.flow);
  }

  const paths = [];
  while (true) {
    const parent = new Map([[source, null]]);
    const queue = [source];
    for (let index = 0; index < queue.length && !parent.has(sink); index++) {
      for (const link of outgoing.get(queue[index]) ?? []) {
        if (parent.has(link.target) || remaining.get(link.id) <= 0) continue;
        parent.set(link.target, link);
        queue.push(link.target);
      }
    }
    if (!parent.has(sink)) return paths;

    const fibers = [];
    for (let node = sink; node !== source;) {
      const link = parent.get(node);
      fibers.push(link);
      node = link.source;
    }
    const amount = fibers.reduce((min, link) => Math.min(min, remaining.get(link.id)), Infinity);
    for (const link of fibers) remaining.set(link.id, remaining.get(link.id) - amount);
    fibers.reverse();
    paths.push({ amount, nodes: [source, ...fibers.map(link => link.target)], links: fibers.map(link => link.id) });
  }
}

const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const small = new Intl.NumberFormat("pt-BR", { maximumSignificantDigits: 3 });
export const format = value => (value > 0 && value < 0.001 ? small : number).format(value);

export function fiberState(link) {
  if (!link.active) return "broken";
  if (link.inMinCut) return "cut";
  if (link.flow > 0 && link.flow === link.capacity) return "saturated";
  return link.flow > 0 ? "flowing" : "idle";
}

export const fiberLabels = {
  broken: "Rompida",
  cut: "Corte mínimo",
  saturated: "Saturada",
  flowing: "Com fluxo",
  idle: "Sem fluxo"
};
