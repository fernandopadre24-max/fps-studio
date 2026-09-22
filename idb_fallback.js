// ============================================================
// IDB_FALLBACK — persistência local via IndexedDB
// ============================================================
// Camada de dados 100% local (IndexedDB) com a MESMA interface
// do DB_SERVICE (service.js). Quando o backend /api não está no
// ar, o app.js troca o DB_SERVICE por este fallback, então
// Serviço, Material, Cliente, Pedido, Movimentação, Chat e MP3
// (biblioteca) continuam sendo ARMAZENADOS no navegador.

const IDB_NAME = 'fps-studio';
const IDB_VERSION = 1;
let dbHandle = null;   // handle global de IndexedDB

// ---------- helpers internos (promises) ----------
function idbOpen() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('dados')) {
                db.createObjectStore('dados');
            }
        };
        req.onsuccess = () => { dbHandle = req.result; resolve(dbHandle); };
        req.onerror = () => reject(req.error);
    });
}

function idbGet(chave) {
    return new Promise((resolve, reject) => {
        if (!dbHandle) return reject(new Error('IndexedDB fechado'));
        const tx = dbHandle.transaction('dados', 'readonly');
        const req = tx.objectStore('dados').get(chave);
        req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
        req.onerror = () => reject(req.error);
    });
}

function idbSet(chave, valor) {
    return new Promise((resolve, reject) => {
        if (!dbHandle) return reject(new Error('IndexedDB fechado'));
        const tx = dbHandle.transaction('dados', 'readwrite');
        tx.objectStore('dados').put(valor, chave);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}

// Blocos = coleções inteiras (arrays), gravados como um valor só.
// Dupla persistência: IndexedDB + localStorage (espelho).
// Mesmo que o IDB falhe em silêncio, os dados ficam no localStorage.
function idbCarregarBloco(nome, fallback) {
    const padrao = (fallback || []);
    return idbGet('bloco_' + nome).then(v => {
        if (v && Array.isArray(v)) return v;
        try {
            const ls = localStorage.getItem('bloco_' + nome);
            if (ls) {
                const parsed = JSON.parse(ls);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (e) { /* ls indisponível/corrompido */ }
        return padrao;
    }).catch(() => {
        try {
            const ls = localStorage.getItem('bloco_' + nome);
            if (ls) {
                const parsed = JSON.parse(ls);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (e2) { /* ignore */ }
        return padrao;
    });
}
function idbSalvarBloco(nome, arr) {
    const a = Array.isArray(arr) ? arr : [];
    try { localStorage.setItem('bloco_' + nome, JSON.stringify(a)); } catch (e) { /* quota ok p/ dados básicos */ }
    return idbSet('bloco_' + nome, a).then(() => ({ ok: true })).catch(() => ({ ok: true, fallback: 'ls' }));
}

// Lista nomes de bloco (para percorrer chats)
function idbListarBlocos() {
    return new Promise((resolve) => {
        if (!dbHandle) return resolve([]);
        const tx = dbHandle.transaction('dados', 'readonly');
        const req = tx.objectStore('dados').getAllKeys();
        req.onsuccess = () => resolve((req.result || []).map(String));
        req.onerror = () => resolve([]);
    });
}

// ---------- objeto com a MESMA interface do DB_SERVICE ----------
const IDB_SERVICE = {

    async init() {
        try { await idbOpen(); return true; }
        catch (e) { console.warn('[IDB] falha ao abrir:', e); return false; }
    },
    async seedAll() {},

    // ---------- SERVIÇOS ----------
    async getServicos() { return idbCarregarBloco('servicos', []); },
    async addServico(d) {
        d.id = d.id || 'sv_' + Date.now();
        const arr = await idbCarregarBloco('servicos', []);
        arr.push(d);
        await idbSalvarBloco('servicos', arr);
        return { id: d.id };
    },
    async updateServico(id, d) {
        const arr = await idbCarregarBloco('servicos', []);
        const i = arr.findIndex(x => (String(x.id) === String(id)));
        if (i >= 0) { arr[i] = { ...arr[i], ...d }; await idbSalvarBloco('servicos', arr); }
        return { ok: true };
    },
    async deleteServico(id) {
        const arr = await idbCarregarBloco('servicos', []);
        await idbSalvarBloco('servicos', arr.filter(x => (String(x.id) !== String(id))));
        return { ok: true };
    },

    // ---------- MATERIAIS ----------
    async getMateriais() { return idbCarregarBloco('materiais', []); },
    async addMaterial(d) {
        d.id = d.id || 'mt_' + Date.now();
        const arr = await idbCarregarBloco('materiais', []);
        arr.push(d);
        await idbSalvarBloco('materiais', arr);
        return { id: d.id };
    },
    async updateMaterial(id, d) {
        const arr = await idbCarregarBloco('materiais', []);
        const i = arr.findIndex(x => (String(x.id) === String(id)));
        if (i >= 0) { arr[i] = { ...arr[i], ...d }; await idbSalvarBloco('materiais', arr); }
        return { ok: true };
    },
    async deleteMaterial(id) {
        const arr = await idbCarregarBloco('materiais', []);
        await idbSalvarBloco('materiais', arr.filter(x => (String(x.id) !== String(id))));
        return { ok: true };
    },

    // ---------- CLIENTES ----------
    async getClientes() { return idbCarregarBloco('clientes', []); },
    async addCliente(d) {
        d.id = d.id || 'cl_' + Date.now();
        const arr = await idbCarregarBloco('clientes', []);
        arr.push(d);
        await idbSalvarBloco('clientes', arr);
        return { id: d.id };
    },
    async updateCliente(id, d) {
        const arr = await idbCarregarBloco('clientes', []);
        const i = arr.findIndex(x => (String(x.id) === String(id)));
        if (i >= 0) { arr[i] = { ...arr[i], ...d }; await idbSalvarBloco('clientes', arr); }
        return { ok: true };
    },
    async deleteCliente(id) {
        const arr = await idbCarregarBloco('clientes', []);
        await idbSalvarBloco('clientes', arr.filter(x => (String(x.id) !== String(id))));
        return { ok: true };
    },

    // ---------- PEDIDOS ----------
    async getPedidos() { return idbCarregarBloco('pedidos', []); },
    async addPedido(d) {
        d.id = d.id || 'pd_' + Date.now();
        const arr = await idbCarregarBloco('pedidos', []);
        arr.push(d);
        await idbSalvarBloco('pedidos', arr);
        return { id: d.id };
    },
    async updatePedido(id, d) {
        const arr = await idbCarregarBloco('pedidos', []);
        const i = arr.findIndex(x => (String(x.id) === String(id)));
        if (i >= 0) { arr[i] = { ...arr[i], ...d }; await idbSalvarBloco('pedidos', arr); }
        return { ok: true };
    },
    async deletePedido(id) {
        const arr = await idbCarregarBloco('pedidos', []);
        await idbSalvarBloco('pedidos', arr.filter(x => (String(x.id) !== String(id))));
        return { ok: true };
    },

    // ---------- MOVIMENTAÇÕES ----------
    async getMovimentacoes() { return idbCarregarBloco('movimentacoes', []); },
    async addMovimentacao(d) {
        d.id = d.id || 'mv_' + Date.now();
        const arr = await idbCarregarBloco('movimentacoes', []);
        arr.push(d);
        await idbSalvarBloco('movimentacoes', arr);
        return { id: d.id };
    },
    async updateMovimentacao(id, d) {
        const arr = await idbCarregarBloco('movimentacoes', []);
        const i = arr.findIndex(x => (String(x.id) === String(id)));
        if (i >= 0) { arr[i] = { ...arr[i], ...d }; await idbSalvarBloco('movimentacoes', arr); }
        return { ok: true };
    },
    async deleteMovimentacao(id) {
        const arr = await idbCarregarBloco('movimentacoes', []);
        await idbSalvarBloco('movimentacoes', arr.filter(x => (String(x.id) !== String(id))));
        return { ok: true };
    },

    // ---------- CHAT ----------
    async getChat(clienteId) {
        const chave = 'bloco_chat_' + (clienteId || 'geral');
        return idbCarregarBloco(chave, []);
    },
    async sendMessage(d) {
        const chave = 'bloco_chat_' + (d.clienteId || 'geral');
        d.id = d.id || 'msg_' + Date.now();
        const arr = await idbCarregarBloco(chave, []);
        arr.push(d);
        await idbSalvarBloco(chave, arr);
        return { id: d.id };
    },
    async updateMessage(id, d) {
        const nomes = (await idbListarBlocos()).filter(n => n.startsWith('bloco_chat_'));
        for (const nome of nomes) {
            const arr = await idbCarregarBloco(nome, []);
            const i = arr.findIndex(x => (String(x.id) === String(id)));
            if (i >= 0) { arr[i] = { ...arr[i], ...d }; await idbSalvarBloco(nome, arr); return { ok: true }; }
        }
        return { ok: true };
    },

    // ---------- BIBLIOTECA (MP3) ----------
    async getBiblioteca(clienteId) {
        const arr = await idbCarregarBloco('biblioteca', []);
        if (!clienteId) return arr;
        return arr.filter(b => (String(b.clienteId) === String(clienteId)));
    },
    async addBiblioteca(d) {
        d.id = d.id || 'bib_' + Date.now();
        const arr = await idbCarregarBloco('biblioteca', []);
        arr.push(d);
        await idbSalvarBloco('biblioteca', arr);
        return { id: d.id };
    },
    async updateBiblioteca(id, d) {
        const arr = await idbCarregarBloco('biblioteca', []);
        const i = arr.findIndex(x => (String(x.id) === String(id)));
        if (i >= 0) { arr[i] = { ...arr[i], ...d }; await idbSalvarBloco('biblioteca', arr); }
        return { ok: true };
    },
    async deleteBiblioteca(id) {
        const arr = await idbCarregarBloco('biblioteca', []);
        await idbSalvarBloco('biblioteca', arr.filter(x => (String(x.id) !== String(id))));
        return { ok: true };
    },

    // ---------- CONFIG ----------
    async getConfig() { return (await idbGet('config')) || {}; },
    async saveConfig(d) { await idbSet('config', d); return { ok: true }; },

    // ---------- BACKUP ----------
    async exportBackup() {
        const tabelas = ['servicos','materiais','clientes','pedidos','movimentacoes','biblioteca'];
        const out = {};
        for (const t of tabelas) out[t] = await idbCarregarBloco(t, []);
        out.config = (await idbGet('config')) || {};
        return out;
    },
    async importBackup(d) {
        const tabelas = ['servicos','materiais','clientes','pedidos','movimentacoes','biblioteca'];
        for (const t of tabelas) {
            if (d && Array.isArray(d[t])) await idbSalvarBloco(t, d[t]);
        }
        if (d && d.config) await idbSet('config', d.config);
        return { ok: true };
    }
};

// Expõe globalmente para o app.js consultar
window.IDB_SERVICE = IDB_SERVICE;
window.IDB_FALLBACK_READY = true;

// ============================================================
// FIM — idb_fallback.js
// ============================================================
