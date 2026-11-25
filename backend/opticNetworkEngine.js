class OpticNetworkSim {
  constructor(graphData) {
    this.initialSeed = structuredClone(graphData);
    this.loadGraph(graphData);
  }

  loadGraph(graphData) {
    if (!graphData || typeof graphData !== "object") {
      throw new Error("Dados do grafo inválidos.");
    }

    const prevState = this.nodes
      ? {
          source: this.source,
          sink: this.sink,
          nodes: structuredClone(this.nodes),
          links: structuredClone(this.links),
          baselineMaxFlow: this.baselineMaxFlow
        }
      : null;

    try {
      this.source = String(graphData.source || "").trim();
      this.sink = String(graphData.sink || "").trim();
      this.nodes = Array.isArray(graphData.nodes)
        ? graphData.nodes.map((n) => this._normalizeNode(n))
        : [];
      this.links = Array.isArray(graphData.links)
        ? graphData.links.map((l) => this._normalizeLink(l))
        : [];

      this.validateGraph();
      this.baselineMaxFlow = this.computeMaxFlow().maxFlow;
      return this.getTelemetry();
    } catch (err) {
      if (prevState) {
        this.source = prevState.source;
        this.sink = prevState.sink;
        this.nodes = prevState.nodes;
        this.links = prevState.links;
        this.baselineMaxFlow = prevState.baselineMaxFlow;
      }
      throw err;
    }
  }

  restoreInitialSeed() {
    return this.loadGraph(structuredClone(this.initialSeed));
  }

  _normalizeNode(node) {
    if (!node || typeof node.id !== "string" || !node.id.trim()) {
      throw new Error("Todo dispositivo precisa ter um 'id' não vazio.");
    }
    const id = node.id.trim();
    const name =
      typeof node.name === "string" && node.name.trim() ? node.name.trim() : id;
    const sector = typeof node.sector === "string" ? node.sector.trim() : "";
    const role = typeof node.role === "string" && node.role.trim() ? node.role.trim() : "device";
    return { id, name, sector, role };
  }

  _normalizeLink(link) {
    if (!link || typeof link.id !== "string" || !link.id.trim()) {
      throw new Error("Toda fibra precisa ter um 'id' não vazio.");
    }
    const capacity = Number(link.capacity);
    if (!Number.isFinite(capacity) || capacity < 0) {
      throw new Error(`Capacidade inválida na fibra "${link.id}". Use número >= 0.`);
    }
    return {
      id: link.id.trim(),
      source: String(link.source || "").trim(),
      target: String(link.target || "").trim(),
      capacity,
      active: link.active !== undefined ? Boolean(link.active) : true
    };
  }

  validateGraph() {
    if (!this.source || !this.sink) {
      throw new Error("Origem (source) e destino (sink) são obrigatórios.");
    }
    if (this.source === this.sink) {
      throw new Error("Origem e destino não podem ser o mesmo dispositivo.");
    }

    const nodeIds = new Set();
    for (const node of this.nodes) {
      if (nodeIds.has(node.id)) {
        throw new Error(`ID de dispositivo duplicado: "${node.id}".`);
      }
      nodeIds.add(node.id);
    }

    if (!nodeIds.has(this.source)) {
      throw new Error(`Dispositivo de origem "${this.source}" não encontrado.`);
    }
    if (!nodeIds.has(this.sink)) {
      throw new Error(`Dispositivo de destino "${this.sink}" não encontrado.`);
    }

    const linkIds = new Set();
    for (const link of this.links) {
      if (linkIds.has(link.id)) {
        throw new Error(`ID de fibra duplicado: "${link.id}".`);
      }
      linkIds.add(link.id);

      if (!nodeIds.has(link.source) || !nodeIds.has(link.target)) {
        throw new Error(
          `Fibra "${link.id}" referencia dispositivo inexistente (${link.source} -> ${link.target}).`
        );
      }
      if (link.source === link.target) {
        throw new Error(`Fibra "${link.id}" não pode conectar um dispositivo a ele mesmo.`);
      }
    }
  }

  addNode(nodeData) {
    const normalized = this._normalizeNode(nodeData);
    if (this.nodes.some((n) => n.id === normalized.id)) {
      throw new Error(`Já existe um dispositivo com id "${normalized.id}".`);
    }
    this.nodes.push(normalized);
    return this.getTelemetry();
  }

  removeNode(nodeId) {
    const id = String(nodeId || "").trim();
    if (id === this.source || id === this.sink) {
      throw new Error(
        `Não é possível remover "${id}" enquanto for origem ou destino.`
      );
    }
    const idx = this.nodes.findIndex((n) => n.id === id);
    if (idx === -1) {
      throw new Error(`Dispositivo "${id}" não encontrado.`);
    }
    this.nodes.splice(idx, 1);
    this.links = this.links.filter((l) => l.source !== id && l.target !== id);
    return this.getTelemetry();
  }

  addLink(linkData) {
    const normalized = this._normalizeLink(linkData);
    if (this.links.some((l) => l.id === normalized.id)) {
      throw new Error(`Já existe uma fibra com id "${normalized.id}".`);
    }
    this.links.push(normalized);
    try {
      this.validateGraph();
      return this.getTelemetry();
    } catch (err) {
      this.links.pop();
      throw err;
    }
  }

  removeLink(linkId) {
    const id = String(linkId || "").trim();
    const idx = this.links.findIndex((l) => l.id === id);
    if (idx === -1) {
      throw new Error(`Fibra "${id}" não encontrada.`);
    }
    this.links.splice(idx, 1);
    return this.getTelemetry();
  }

  toggleLink(linkId) {
    const link = this.links.find((l) => l.id === linkId);
    if (!link) {
      throw new Error(`Fibra "${linkId}" não encontrada.`);
    }
    link.active = !link.active;
    return this.getTelemetry();
  }

  setLinkCapacity(linkId, capacityGbps) {
    const link = this.links.find((l) => l.id === linkId);
    if (!link) {
      throw new Error(`Fibra "${linkId}" não encontrada.`);
    }
    const cap = Number(capacityGbps);
    if (!Number.isFinite(cap) || cap < 0) {
      throw new Error("Capacidade deve ser um número maior ou igual a zero.");
    }
    link.capacity = cap;
    return this.getTelemetry();
  }

  setEndpoints(sourceId, sinkId) {
    const prevSource = this.source;
    const prevSink = this.sink;
    this.source = String(sourceId || "").trim();
    this.sink = String(sinkId || "").trim();
    try {
      this.validateGraph();
      this.baselineMaxFlow = this.computeMaxFlow().maxFlow;
      return this.getTelemetry();
    } catch (err) {
      this.source = prevSource;
      this.sink = prevSink;
      throw err;
    }
  }

  recalculateBaseline() {
    this.baselineMaxFlow = this.computeMaxFlow().maxFlow;
    return this.getTelemetry();
  }

  resetFibers() {
    for (const link of this.links) {
      link.active = true;
    }
    return this.getTelemetry();
  }

  /**
   * Algoritmo de Ford-Fulkerson (com BFS na rede residual para achar caminhos aumentantes)
   * e identificação do Corte Mínimo (S, T).
   */
  computeMaxFlow() {
    const adj = {};
    for (const node of this.nodes) {
      adj[node.id] = [];
    }

    const linkById = new Map(this.links.map((l) => [l.id, l]));

    for (const link of this.links) {
      if (!link.active || link.capacity <= 0) continue;

      const fwdEdge = {
        to: link.target,
        revIndex: null,
        residualCap: link.capacity,
        linkId: link.id,
        isReverse: false
      };

      const revEdge = {
        to: link.source,
        revIndex: null,
        residualCap: 0,
        linkId: link.id,
        isReverse: true
      };

      fwdEdge.revIndex = adj[link.target].length;
      revEdge.revIndex = adj[link.source].length;

      adj[link.source].push(fwdEdge);
      adj[link.target].push(revEdge);
    }

    let maxFlow = 0;

    while (true) {
      const parent = {};
      const visited = new Set([this.source]);
      const queue = [this.source];

      while (queue.length > 0 && !visited.has(this.sink)) {
        const u = queue.shift();
        for (const edge of adj[u]) {
          if (!visited.has(edge.to) && edge.residualCap > 0) {
            visited.add(edge.to);
            parent[edge.to] = { from: u, edge };
            queue.push(edge.to);
          }
        }
      }

      if (!visited.has(this.sink)) {
        break;
      }

      let bottleneck = Infinity;
      let curr = this.sink;
      while (curr !== this.source) {
        const step = parent[curr];
        if (step.edge.residualCap < bottleneck) {
          bottleneck = step.edge.residualCap;
        }
        curr = step.from;
      }

      curr = this.sink;
      while (curr !== this.source) {
        const step = parent[curr];
        const fwd = step.edge;
        const rev = adj[fwd.to][fwd.revIndex];

        fwd.residualCap -= bottleneck;
        rev.residualCap += bottleneck;

        curr = step.from;
      }

      maxFlow += bottleneck;
    }

    const flowByLink = {};
    for (const link of this.links) {
      flowByLink[link.id] = 0;
    }

    for (const u of Object.keys(adj)) {
      for (const edge of adj[u]) {
        if (!edge.isReverse && edge.linkId) {
          const original = linkById.get(edge.linkId);
          if (original) {
            flowByLink[edge.linkId] = original.capacity - edge.residualCap;
          }
        }
      }
    }

    // Conjunto A = nós alcançáveis a partir de `source` com capacidade residual > 0
    const reachableFromSource = new Set([this.source]);
    const cutQueue = [this.source];

    while (cutQueue.length > 0) {
      const u = cutQueue.shift();
      for (const edge of adj[u]) {
        if (!reachableFromSource.has(edge.to) && edge.residualCap > 0) {
          reachableFromSource.add(edge.to);
          cutQueue.push(edge.to);
        }
      }
    }

    const minCutLinks = this.links
      .filter(
        (link) =>
          link.active &&
          reachableFromSource.has(link.source) &&
          !reachableFromSource.has(link.target)
      )
      .map((link) => ({
        id: link.id,
        source: link.source,
        target: link.target,
        capacity: link.capacity
      }));

    const minCutCapacity = minCutLinks.reduce((acc, l) => acc + l.capacity, 0);

    return {
      maxFlow,
      flowByLink,
      minCutLinks,
      minCutCapacity
    };
  }

  getTelemetry() {
    const flowResult = this.computeMaxFlow();
    const resiliencePct =
      this.baselineMaxFlow > 0
        ? Math.round((flowResult.maxFlow / this.baselineMaxFlow) * 100)
        : flowResult.maxFlow > 0
          ? 100
          : 0;

    const linksDetail = this.links.map((link) => ({
      ...link,
      flow: flowResult.flowByLink[link.id] || 0,
      inMinCut: flowResult.minCutLinks.some((mc) => mc.id === link.id)
    }));

    return {
      source: this.source,
      sink: this.sink,
      totalDevices: this.nodes.length,
      totalLinks: this.links.length,
      baselineMaxFlow: this.baselineMaxFlow,
      currentMaxFlow: flowResult.maxFlow,
      resiliencePct,
      minCutCapacity: flowResult.minCutCapacity,
      minCutLinks: flowResult.minCutLinks,
      nodes: this.nodes,
      links: linksDetail
    };
  }
}

module.exports = { OpticNetworkSim };