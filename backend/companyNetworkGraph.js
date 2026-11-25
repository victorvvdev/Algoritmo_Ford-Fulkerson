const companyGraph10Devices = {
  source: "D1",
  sink: "D10",
  nodes: [
    { id: "D1", name: "Core Switch MDF", sector: "Sala de Servidores", role: "source" },
    { id: "D2", name: "Switch Distribuição 1º Andar", sector: "1º Andar", role: "switch" },
    { id: "D3", name: "Switch Distribuição 2º Andar", sector: "2º Andar", role: "switch" },
    { id: "D4", name: "Switch Distribuição 3º Andar", sector: "3º Andar", role: "switch" },
    { id: "D5", name: "Switch Acesso Engenharia", sector: "2º Andar - Eng", role: "switch" },
    { id: "D6", name: "Switch Acesso Operações", sector: "1º Andar - Ops", role: "switch" },
    { id: "D7", name: "Servidor de Aplicação ERP", sector: "Data Center Local", role: "server" },
    { id: "D8", name: "Switch Agregação Storage", sector: "Data Center Local", role: "switch" },
    { id: "D9", name: "Switch Borda Backup", sector: "Sala Cofre", role: "switch" },
    { id: "D10", name: "Storage SAN / Backup Crítico", sector: "Sala Cofre", role: "sink" }
  ],
  links: [
    { id: "F1", source: "D1", target: "D2", capacity: 40 },
    { id: "F2", source: "D1", target: "D3", capacity: 40 },
    { id: "F3", source: "D1", target: "D4", capacity: 25 },
    { id: "F4", source: "D2", target: "D6", capacity: 25 },
    { id: "F5", source: "D2", target: "D7", capacity: 20 },
    { id: "F6", source: "D3", target: "D5", capacity: 30 },
    { id: "F7", source: "D3", target: "D7", capacity: 25 },
    { id: "F8", source: "D4", target: "D5", capacity: 15 },
    { id: "F9", source: "D4", target: "D8", capacity: 20 },
    { id: "F10", source: "D6", target: "D8", capacity: 25 },
    { id: "F11", source: "D5", target: "D8", capacity: 30 },
    { id: "F12", source: "D7", target: "D8", capacity: 35 },
    { id: "F13", source: "D8", target: "D9", capacity: 50 },
    { id: "F14", source: "D7", target: "D9", capacity: 20 },
    { id: "F15", source: "D9", target: "D10", capacity: 60 }
  ]
};

module.exports = { companyGraph10Devices };