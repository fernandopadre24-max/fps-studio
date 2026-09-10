// FPS STUDIO - API SERVICE (SQLite)
// ============================================
// Camada de acesso via API REST ao SQLite

const API_BASE = '/api';

async function apiCall(action, method = 'GET', body = null, params = {}) {
    let url = `${API_BASE}/${action}`;
    const qp = [];
    if (params.id) qp.push(`id=${params.id}`);
    if (params.clienteId) qp.push(`clienteId=${params.clienteId}`);
    if (qp.length) url += '?' + qp.join('&');

    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

const DB_SERVICE = {

    // SERVIÇOS
    async getServicos() { return apiCall('servicos'); },
    async addServico(d) { return apiCall('servicos', 'POST', d); },
    async updateServico(id, d) { return apiCall('servicos', 'PUT', d, { id }); },
    async deleteServico(id) { return apiCall('servicos', 'DELETE', null, { id }); },

    // MATERIAIS
    async getMateriais() { return apiCall('materiais'); },
    async addMaterial(d) { return apiCall('materiais', 'POST', d); },
    async updateMaterial(id, d) { return apiCall('materiais', 'PUT', d, { id }); },
    async deleteMaterial(id) { return apiCall('materiais', 'DELETE', null, { id }); },

    // CLIENTES
    async getClientes() { return apiCall('clientes'); },
    async addCliente(d) { return apiCall('clientes', 'POST', d); },
    async updateCliente(id, d) { return apiCall('clientes', 'PUT', d, { id }); },
    async deleteCliente(id) { return apiCall('clientes', 'DELETE', null, { id }); },

    // PEDIDOS
    async getPedidos() { return apiCall('pedidos'); },
    async addPedido(d) { return apiCall('pedidos', 'POST', d); },
    async updatePedido(id, d) { return apiCall('pedidos', 'PUT', d, { id }); },
    async deletePedido(id) { return apiCall('pedidos', 'DELETE', null, { id }); },

    // MOVIMENTAÇÕES
    async getMovimentacoes() { return apiCall('movimentacoes'); },
    async addMovimentacao(d) { return apiCall('movimentacoes', 'POST', d); },
    async updateMovimentacao(id, d) { return apiCall('movimentacoes', 'PUT', d, { id }); },
    async deleteMovimentacao(id) { return apiCall('movimentacoes', 'DELETE', null, { id }); },

    // CHAT
    async getChat(clienteId) { return apiCall('chat', 'GET', null, { clienteId }); },
    async sendMessage(d) { return apiCall('chat', 'POST', d); },
    async updateMessage(id, d) { return apiCall('chat', 'PUT', d, { id }); },

    // INIT (não precisa de seed, o db.js já faz)
    async init() {
        try {
            const res = await fetch(`${API_BASE}/servicos`);
            return res.ok;
        } catch { return false; }
    },
    async seedAll() {}
};
