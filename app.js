

const TEMAS_PRESET = {
    padrao: { primary: '#6c5ce7', dark: '#4834d4', light: '#a29bfe', grad1: '#0c0c1d', grad2: '#1a1a3e', grad3: '#2d1b69' },
    ocean: { primary: '#0984e3', dark: '#0769b8', light: '#74b9ff', grad1: '#000000', grad2: '#0b162c', grad3: '#15315e' },
    forest: { primary: '#00b894', dark: '#009276', light: '#55efc4', grad1: '#001a14', grad2: '#003328', grad3: '#004d3c' },
    sunset: { primary: '#e17055', dark: '#cc5c43', light: '#fab1a0', grad1: '#2d110d', grad2: '#4a1b14', grad3: '#6a261c' }
};

const CONFIG_DEFAULT = {
    appTitle: 'FPS Studio',
    tema: 'padrao',
    primaryColor: '#6c5ce7',
    fonte: 'Inter',
    fontSize: 'medium',
    darkPadrao: true,
    studio: {
        nome: '',
        telefone: '',
        email: '',
        instagram: '',
        endereco: '',
        pixChave: '',
        pixTipo: '',
        pixBeneficiario: ''
    }
};

let APP_CONFIG = null;

let usingIDB = false;
let currentChatClient = null;
let selectedPedidoId = null;
let selectedPagamentoValor = 0;
const dashFiltros = { periodo: 'todos', tipo: 'todos', busca: '' };
const ordemPedidoStage = ['pendente', 'em_andamento', 'concluido'];
const AUDIO_BASE64_LIMIT = 3500000;
const PAYLOAD_AUDIO_LIMIT = 4000000;
let _chatAudioObjectUrls = [];


let currentUser = null;
let DB = {
    servicos: [],
    materiais: [],
    clientes: [],
    pedidos: [],
    movimentacoes: [],
    chats: {},
    config: {},
    bibliotecas: [],
    nextId: { servico: 1, material: 1, cliente: 1, pedido: 1, movimentacao: 1 }
};

function initNextIds() {
    if (!DB.nextId) DB.nextId = { servico: 1, material: 1, cliente: 1, pedido: 1, movimentacao: 1 };
    const maxId = (arr) => (arr || []).reduce((max, item) => Math.max(max, parseInt(item.id) || 0), 0);
    DB.nextId.servico = Math.max(DB.nextId.servico || 1, maxId(DB.servicos) + 1);
    DB.nextId.material = Math.max(DB.nextId.material || 1, maxId(DB.materiais) + 1);
    DB.nextId.cliente = Math.max(DB.nextId.cliente || 1, maxId(DB.clientes) + 1);
    DB.nextId.pedido = Math.max(DB.nextId.pedido || 1, maxId(DB.pedidos) + 1);
    DB.nextId.movimentacao = Math.max(DB.nextId.movimentacao || 1, maxId(DB.movimentacoes) + 1);
}
let DBReady = false;
let clientesExpandidos = new Set();
let pedidosExpandidos = new Set();
let currentChatCliente = null;


function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const pageId = this.getAttribute('data-page');
            if(!pageId) return;
            
            // Remove active class from sibling nav items
            const parentNav = this.closest('.sidebar-nav') || this.closest('.bottom-nav');
            if (parentNav) {
                parentNav.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            }
            this.classList.add('active');
            
            // Remove active class from pages inside the same container
            const pageEl = document.getElementById(pageId);
            if (pageEl) {
                const container = pageEl.closest('.main-content');
                if (container) {
                    container.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
                }
                pageEl.classList.add('active');
            }
            
            if (window.innerWidth <= 768) {
                const sidebar = this.closest('.sidebar');
                if (sidebar) sidebar.classList.add('collapsed');
            }
            
            // Call specific render functions based on page
            if(pageId === 'adminHome') renderAdminDashboard();
            if(pageId === 'adminServicos') renderServicos();
            if(pageId === 'adminMateriais') renderMateriais();
            if(pageId === 'adminPedidos') renderPedidos();
            if(pageId === 'adminFinanceiro') renderMovimentacoes();
            if(pageId === 'adminBiblioteca') renderBiblioteca();
            if(pageId === 'adminBibliotecas') renderBibliotecas();
            if(pageId === 'adminChat') renderChatList();
            if(pageId === 'adminClientes') renderClientes();
            if(pageId === 'adminConfig') preencherFormConfig();
            
            if(pageId === 'clientHome') renderClientDashboard();
            if(pageId === 'clientServicos') renderServicosClient();
            if(pageId === 'clientMateriais') renderMateriaisClient();
            if(pageId === 'clientPedidos') renderPedidosClient();
            if(pageId === 'clientChat') renderClientChat();
            
        });
    });
}

document.addEventListener("DOMContentLoaded", () => { init(); setupNavigation(); });

function salvarSessao() {
    try {
        if (currentUser) {
            sessionStorage.setItem('fps_current_user', JSON.stringify(currentUser));
        } else {
            sessionStorage.removeItem('fps_current_user');
        }
    } catch(e) {}
}

function restaurarSessao() {
    try {
        const saved = sessionStorage.getItem('fps_current_user');
        if (saved) {
            const u = JSON.parse(saved);
            if (u && (u.role === 'cliente' || u.role === 'client')) {
                u.role = 'client';
            }
            return u;
        }
    } catch(e) {}
    return null;
}

let syncInterval = null;
function startSync() {
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = setInterval(async () => {
        if (!currentUser || !DBReady) return;
        try {
            if (currentUser.role === 'admin') {
                // Sincronizar clientes periodicamente
                const clis = await DB_SERVICE.getClientes();
                if (Array.isArray(clis) && clis.length !== (DB.clientes || []).length) {
                    DB.clientes = clis;
                    DB.clientes.forEach(x => { x.docId = x.id; });
                    if (document.getElementById('adminClientes')?.classList.contains('active')) {
                        renderClientes();
                    }
                    if (document.getElementById('adminChat')?.classList.contains('active')) {
                        renderChatList(document.getElementById('buscaChatAdmin')?.value || '');
                    }
                }

                // Sincronizar pedidos periodicamente
                const peds = await DB_SERVICE.getPedidos();
                if (Array.isArray(peds) && peds.length !== (DB.pedidos || []).length) {
                    DB.pedidos = peds;
                    DB.pedidos.forEach(x => { x.docId = x.id; });
                    if (document.getElementById('adminPedidos')?.classList.contains('active')) {
                        renderPedidos();
                    }
                    if (document.getElementById('adminHome')?.classList.contains('active')) {
                        renderAdminDashboard();
                    }
                }

                const allChats = await DB_SERVICE.getAllChats();
                if (Array.isArray(allChats)) {
                    let hasNew = false;
                    for (const m of allChats) {
                        const key = `admin_${m.clienteId}`;
                        DB.chats[key] = DB.chats[key] || [];
                        const existingIdx = DB.chats[key].findIndex(x => x.id && m.id && x.id === m.id);
                        if (existingIdx === -1) {
                            DB.chats[key].push(m);
                            hasNew = true;
                        } else if (JSON.stringify(DB.chats[key][existingIdx]) !== JSON.stringify(m)) {
                            DB.chats[key][existingIdx] = m;
                            hasNew = true;
                        }
                    }
                    if (hasNew) {
                        updateChatBadge();
                        if (document.getElementById('adminChat')?.classList.contains('active')) {
                            renderChatList(document.getElementById('buscaChatAdmin')?.value || '');
                            if (currentChatClient) renderChatMessagesAdmin('admin_' + currentChatClient);
                        }
                    }
                }
                const bibs = await DB_SERVICE.getBiblioteca();
                if (Array.isArray(bibs) && bibs.length !== (DB.bibliotecas || []).length) {
                    DB.bibliotecas = bibs;
                    if (document.getElementById('adminBibliotecas')?.classList.contains('active')) {
                        renderBibliotecas();
                    }
                }
            } else if (currentUser.role === 'client' || currentUser.role === 'cliente') {
                const myChats = await DB_SERVICE.getChat(currentUser.id);
                if (Array.isArray(myChats)) {
                    const key = `admin_${currentUser.id}`;
                    DB.chats[key] = DB.chats[key] || [];
                    if (myChats.length !== DB.chats[key].length || JSON.stringify(myChats) !== JSON.stringify(DB.chats[key])) {
                        DB.chats[key] = myChats;
                        updateChatBadge();
                        if (document.getElementById('clientChat')?.classList.contains('active')) {
                            renderClientChat();
                        }
                    }
                }
                const peds = await DB_SERVICE.getPedidos();
                if (Array.isArray(peds)) {
                    DB.pedidos = peds;
                    if (document.getElementById('clientPedidos')?.classList.contains('active')) {
                        renderPedidosClient();
                    }
                }
            }
        } catch(e) {}
    }, 3000);
}

function stopSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
}

async function init() {
    let ok = false;

    // IndexedDB é a camada LOCAL (sempre disponível, persistente entre
    // F5 e offline). Usamos ELA como camada primária de dados. O backend
    // /api (Vercel serverless → SQLite em /tmp ÉFEMERO) é só espelho
    // opcional: se o IndexedDB falhar, tentamos a API.
    if (window.IDB_SERVICE) {
        try {
            await IDB_SERVICE.init();
            for (const k of Object.keys(IDB_SERVICE)) {
                if (typeof IDB_SERVICE[k] === 'function') DB_SERVICE[k] = IDB_SERVICE[k].bind(IDB_SERVICE);
            }
            ok = await DB_SERVICE.init();
            if (ok) {
                usingIDB = true;
                console.log('[PERSIST] Usando IndexedDB local como camada primária.');
            }
        } catch (e) {
            ok = false;
            console.warn('[PERSIST] IndexedDB indisponível:', (e && e.message) ? e.message : e);
        }
    }

    // Fallback: backend /api (só se IndexedDB falhou)
    if (!ok) {
        try { ok = await DB_SERVICE.init(); } catch (e) { ok = false; }
        if (ok) {
            usingIDB = false;
            console.log('[PERSIST] Usando backend /api (SQLite).');
        }
    }

    if (ok) {
        DBReady = true;
        await loadDB();
    } else {
        console.warn('[PERSIST] Nenhuma camada de dados disponível (IDB e backend falharam).');
    }

    const saved = restaurarSessao();
    if (saved) {
        currentUser = saved;
        if (currentUser.role === 'admin') {
            showView('adminDashboard');
            renderAdminDashboard();
        } else {
            showView('clientDashboard');
            const nameEl = document.getElementById('clientNameDisplay');
            if (nameEl) nameEl.textContent = currentUser.nome;
            renderClientDashboard();
        }
        startSync();
    } else {
        showView('loginScreen');
    }
}

async function loadDB() {
    try {
        const [servicos, materiais, clientes, pedidos, movimentacoes, config, bibliotecas] = await Promise.all([
            DB_SERVICE.getServicos(),
            DB_SERVICE.getMateriais(),
            DB_SERVICE.getClientes(),
            DB_SERVICE.getPedidos(),
            DB_SERVICE.getMovimentacoes(),
            DB_SERVICE.getConfig(),
            DB_SERVICE.getBiblioteca()
        ]);
        
        DB.servicos = servicos || [];
        DB.materiais = materiais || [];
        DB.clientes = clientes || [];
        DB.pedidos = pedidos || [];
        DB.movimentacoes = movimentacoes || [];
        DB.config = config || {};
        DB.bibliotecas = bibliotecas || [];
        
        // Normalizar IDs
        DB.servicos.forEach(x => { x.docId = x.id; });
        DB.materiais.forEach(x => { x.docId = x.id; });
        DB.clientes.forEach(x => { x.docId = x.id; });
        DB.pedidos.forEach(x => { x.docId = x.id; });
        DB.movimentacoes.forEach(x => { x.docId = x.id; });
        DB.bibliotecas.forEach(x => { x.docId = x.id; });
        initNextIds();

        // Inicializar conversas para todos os clientes
        DB.chats = {};
        DB.clientes.forEach(c => {
            DB.chats[`admin_${c.id}`] = [];
        });

        try {
            const allChats = await DB_SERVICE.getAllChats();
            if (Array.isArray(allChats)) {
                allChats.forEach(m => {
                    const key = `admin_${m.clienteId}`;
                    DB.chats[key] = DB.chats[key] || [];
                    DB.chats[key].push(m);
                });
            }
        } catch(e) {
            for (const c of DB.clientes) {
                try {
                    const cChats = await DB_SERVICE.getChat(c.id);
                    DB.chats[`admin_${c.id}`] = cChats || [];
                } catch(err) {}
            }
        }
    } catch (e) {
        console.error('Erro ao carregar dados do banco:', e);
    }
}

function showView(viewId) {
    document.querySelectorAll('.screen').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    fecharPopovers();
}


function switchLoginTab(tab) {
    document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.login-form').forEach(f => f.classList.remove('active'));
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
    
    if (tab === 'senha') document.getElementById('loginForm').classList.add('active');
    if (tab === 'pin') document.getElementById('pinForm').classList.add('active');
    if (tab === 'conta') document.getElementById('registerForm').classList.add('active');
}

async function login(event) {
    if (event) event.preventDefault();
    const tabEl = document.querySelector('.login-tab.active');
    const tab = tabEl ? tabEl.innerText.toLowerCase() : 'senha';
    
    let user = null;
    if (tab.includes('senha') || tab.includes('conta')) {
        const email = (document.getElementById('loginEmail')?.value || '').trim();
        const senha = (document.getElementById('loginPassword')?.value || '').trim();
        if (email.toLowerCase() === 'admin' && (senha === 'admin' || senha === 'admin123')) {
            user = { id: 'admin', role: 'admin', nome: 'Administrador' };
        } else {
            const c = DB.clientes.find(x => (x.email?.toLowerCase() === email.toLowerCase() || x.nome?.toLowerCase() === email.toLowerCase()) && x.senha === senha);
            if (c) user = { ...c, role: 'client' };
        }
    } else if (tab.includes('pin')) {
        const email = (document.getElementById('pinEmail')?.value || '').trim();
        const pinInputs = Array.from(document.querySelectorAll('.pin-digit:not(.reg-pin)')).map(i => i.value).join('');
        const pin = pinInputs;
        
        if (email.toLowerCase() === 'admin' && pin === '1234') {
             user = { id: 'admin', role: 'admin', nome: 'Administrador' };
        } else {
             const c = DB.clientes.find(x => (x.email?.toLowerCase() === email.toLowerCase() || x.nome?.toLowerCase() === email.toLowerCase()) && x.pin === pin);
             if (c) user = { ...c, role: 'client' };
        }
    }

    if (user) {
        currentUser = user;
        salvarSessao();
        showToast('Login efetuado com sucesso', 'success');
        if (user.role === 'admin') {
            showView('adminDashboard');
            renderAdminDashboard();
        } else {
            showView('clientDashboard');
            const nameEl = document.getElementById('clientNameDisplay');
            if (nameEl) nameEl.textContent = currentUser.nome;
            renderClientDashboard();
        }
        startSync();
    } else {
        showToast('Credenciais inválidas', 'error');
    }
}

async function registerClient(event) {
    if (event) event.preventDefault();
    const nome = (document.getElementById('regNome')?.value || '').trim();
    const email = (document.getElementById('regEmail')?.value || '').trim();
    const telefone = (document.getElementById('regTelefone')?.value || '').trim();
    const senha = (document.getElementById('regSenha')?.value || '').trim();
    const pin = Array.from(document.querySelectorAll('.reg-pin')).map(i => i.value).join('');

    if (!nome || !email || !senha) {
        showToast('Preencha os campos obrigatórios (Nome, E-mail, Senha).', 'error');
        return;
    }

    if (DB.clientes.some(c => c.email && c.email.toLowerCase() === email.toLowerCase())) {
        showToast('Este e-mail já está cadastrado.', 'error');
        return;
    }

    const novoCliente = {
        nome,
        email,
        telefone,
        senha,
        pin: pin || '0000',
        tipoPessoa: 'fisica',
        cpf: '',
        cnpj: '',
        razaoSocial: '',
        endereco: '',
        numero: '',
        complemento: '',
        bairro: '',
        cep: '',
        cidade: '',
        estado: '',
        dataCadastro: new Date().toISOString().split('T')[0]
    };

    try {
        if (DBReady) {
            const res = await DB_SERVICE.addCliente(novoCliente);
            if (res && res.id) {
                novoCliente.id = res.id;
                novoCliente.docId = res.id;
            }
        } else {
            novoCliente.id = Date.now();
            novoCliente.docId = novoCliente.id;
        }

        DB.clientes.push(novoCliente);
        DB.chats[`admin_${novoCliente.id}`] = [];

        currentUser = { ...novoCliente, role: 'client' };
        salvarSessao();

        const nameEl = document.getElementById('clientNameDisplay');
        if (nameEl) nameEl.textContent = currentUser.nome;

        showToast('Conta criada com sucesso!', 'success');
        showView('clientDashboard');
        renderClientDashboard();
        startSync();
    } catch(err) {
        console.error('Erro ao cadastrar cliente:', err);
        showToast('Erro ao criar conta.', 'error');
    }
}

// Bind events to forms
document.addEventListener("DOMContentLoaded", () => {
    const lf = document.getElementById('loginForm');
    if (lf) lf.addEventListener('submit', login);
    
    const pf = document.getElementById('pinForm');
    if (pf) pf.addEventListener('submit', login);
    
    const rf = document.getElementById('registerForm');
    if (rf) rf.addEventListener('submit', registerClient);
});

function logout() {
    currentUser = null;
    salvarSessao();
    stopSync();
    showView('loginScreen');
}

function toggleSidebar(id) {
    const sb = document.getElementById(id);
    if (sb) sb.classList.toggle('collapsed');
}

function alternarVisaoPedidos(view) {
    const btnBoard = document.getElementById('btnViewBoard');
    const btnTable = document.getElementById('btnViewTable');
    const boardEl = document.getElementById('kanbanPedidos');
    const tableEl = document.getElementById('tabelaPedidosWrap');
    const wrapStatus = document.getElementById('wrapStatusFiltro');
    
    if (view === 'board') {
        if (btnBoard) btnBoard.classList.add('active');
        if (btnTable) btnTable.classList.remove('active');
        if (boardEl) boardEl.style.display = 'grid';
        if (tableEl) tableEl.style.display = 'none';
        if (wrapStatus) wrapStatus.style.display = 'none';
    } else {
        if (btnBoard) btnBoard.classList.remove('active');
        if (btnTable) btnTable.classList.add('active');
        if (boardEl) boardEl.style.display = 'none';
        if (tableEl) tableEl.style.display = 'block';
        if (wrapStatus) wrapStatus.style.display = 'block';
    }
    renderPedidos();
}

function desenharGraficoBarras(movimentacoes) {
    const canvas = document.getElementById('graficoBarras');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const width = canvas.width = rect.width || 400;
    const height = canvas.height = rect.height || 220;
    ctx.clearRect(0, 0, width, height);
    
    const meses = [];
    const agora = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const rotulo = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
        meses.push({ chave: `${y}-${m}`, rotulo, entradas: 0, saidas: 0 });
    }
    
    (movimentacoes || []).forEach(m => {
        if (!m.data) return;
        const chave = m.data.slice(0, 7);
        const item = meses.find(x => x.chave === chave);
        if (item) {
            const v = parseFloat(m.valor) || 0;
            if (m.tipo === 'entrada') item.entradas += v;
            else if (m.tipo === 'saida') item.saidas += v;
        }
    });
    
    let maxVal = 100;
    meses.forEach(m => {
        if (m.entradas > maxVal) maxVal = m.entradas;
        if (m.saidas > maxVal) maxVal = m.saidas;
    });
    maxVal = maxVal * 1.15;
    
    const padX = 35;
    const padY = 25;
    const chartW = width - padX * 2;
    const chartH = height - padY * 2;
    const colW = chartW / meses.length;
    const barW = Math.min(20, colW * 0.35);
    
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
        const y = padY + (chartH / 3) * i;
        ctx.beginPath();
        ctx.moveTo(padX, y);
        ctx.lineTo(width - padX, y);
        ctx.stroke();
    }
    
    meses.forEach((m, idx) => {
        const centerX = padX + colW * idx + colW / 2;
        const hEntrada = (m.entradas / maxVal) * chartH;
        const hSaida = (m.saidas / maxVal) * chartH;
        
        const xEntrada = centerX - barW - 2;
        const yEntrada = padY + chartH - hEntrada;
        ctx.fillStyle = '#43e97b';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(xEntrada, yEntrada, barW, Math.max(3, hEntrada), [4, 4, 0, 0]);
        else ctx.rect(xEntrada, yEntrada, barW, Math.max(3, hEntrada));
        ctx.fill();
        
        const xSaida = centerX + 2;
        const ySaida = padY + chartH - hSaida;
        ctx.fillStyle = '#f5576c';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(xSaida, ySaida, barW, Math.max(3, hSaida), [4, 4, 0, 0]);
        else ctx.rect(xSaida, ySaida, barW, Math.max(3, hSaida));
        ctx.fill();
        
        ctx.fillStyle = '#718096';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(m.rotulo, centerX, height - 8);
    });
    
    const totalEntradas6M = meses.reduce((s, m) => s + m.entradas, 0);
    const totalSaidas6M = meses.reduce((s, m) => s + m.saidas, 0);
    const legEl = document.getElementById('legendBarras');
    if (legEl) {
        legEl.innerHTML = `
            <span class="leg-item"><i style="background:#43e97b"></i> Receitas: <strong>${formatCurrency(totalEntradas6M)}</strong></span>
            <span class="leg-item"><i style="background:#f5576c"></i> Despesas: <strong>${formatCurrency(totalSaidas6M)}</strong></span>
        `;
    }
}

function renderizarDonutServicos(pedidos, movimentacoes) {
    const donutRing = document.getElementById('donutServicosRing');
    const donutTotal = document.getElementById('donutTotal');
    const legendEl = document.getElementById('legendServicos');
    if (!donutRing || !donutTotal || !legendEl) return;
    
    const cores = ['#667eea', '#764ba2', '#4facfe', '#00f2fe', '#43e97b', '#f093fb', '#f5576c', '#fdcb6e'];
    
    const servMap = {};
    (DB.servicos || []).forEach(s => { servMap[s.id] = { nome: s.nome, total: 0 }; });
    
    (pedidos || []).forEach(p => {
        const sIds = Array.isArray(p.servicos) ? p.servicos : [];
        if (sIds.length > 0) {
            const part = (parseFloat(p.total) || 0) / sIds.length;
            sIds.forEach(id => {
                if (!servMap[id]) {
                    const s = (DB.servicos || []).find(x => x.id === id);
                    servMap[id] = { nome: s ? s.nome : `Serviço #${id}`, total: 0 };
                }
                servMap[id].total += part;
            });
        }
    });
    
    const items = Object.values(servMap).filter(x => x.total > 0).sort((a, b) => b.total - a.total);
    const totalGeral = items.reduce((s, x) => s + x.total, 0);
    donutTotal.textContent = formatCurrency(totalGeral);
    
    if (items.length === 0 || totalGeral === 0) {
        donutRing.style.background = '#e2e8f0';
        legendEl.innerHTML = '<span class="leg-vazio">Nenhuma receita registrada por serviço</span>';
        return;
    }
    
    let accPct = 0;
    const gradStops = [];
    const legendHtml = [];
    
    items.forEach((item, idx) => {
        const cor = cores[idx % cores.length];
        const pct = (item.total / totalGeral) * 100;
        const nextPct = accPct + pct;
        gradStops.push(`${cor} ${accPct.toFixed(1)}% ${nextPct.toFixed(1)}%`);
        accPct = nextPct;
        
        legendHtml.push(`
            <div class="leg-item">
                <span><i style="background:${cor}"></i> ${item.nome}</span>
                <strong>${formatCurrency(item.total)} (${pct.toFixed(0)}%)</strong>
            </div>
        `);
    });
    
    donutRing.style.background = `conic-gradient(${gradStops.join(', ')})`;
    legendEl.innerHTML = legendHtml.join('');
}

function renderizarUltimosPedidosDashboard(pedidos) {
    const el = document.getElementById('ultimosPedidos');
    if (!el) return;
    const ultimos = [...(pedidos || [])].sort((a, b) => (b.id - a.id) || (new Date(b.data) - new Date(a.data))).slice(0, 5);
    if (ultimos.length === 0) {
        el.innerHTML = '<p class="empty-state">Nenhum pedido encontrado</p>';
        return;
    }
    el.innerHTML = ultimos.map(p => {
        const cliente = (DB.clientes || []).find(c => c.id == p.clienteId);
        const cliNome = cliente ? cliente.nome : 'Cliente Avulso';
        return `
            <div class="pedido-item" style="cursor:pointer;" onclick="irParaPagina('adminPedidos')">
                <div class="pedido-item-info">
                    <h5>#${p.id} - ${cliNome}</h5>
                    <p>${formatDate(p.data)} · ${formatCurrency(p.total)}</p>
                </div>
                <div>
                    <span class="status-badge status-${p.status}">${statusLabel(p.status)}</span>
                </div>
            </div>
        `;
    }).join('');
}

window.aplicarFiltrosDashboard = function() {
    const container = document.getElementById('ultimasMovimentacoes');
    if (!container) return;
    
    const periodo = document.getElementById('filtroPeriodoDash')?.value || 'todos';
    const tipo = document.getElementById('filtroTipoDash')?.value || 'todos';
    const busca = (document.getElementById('buscaMovDash')?.value || '').toLowerCase().trim();
    
    let movs = [...(DB.movimentacoes || [])];
    
    const hoje = new Date();
    if (periodo === '7') {
        const limite = new Date();
        limite.setDate(hoje.getDate() - 7);
        const limStr = limite.toISOString().split('T')[0];
        movs = movs.filter(m => m.data >= limStr);
    } else if (periodo === '30') {
        const limite = new Date();
        limite.setDate(hoje.getDate() - 30);
        const limStr = limite.toISOString().split('T')[0];
        movs = movs.filter(m => m.data >= limStr);
    } else if (periodo === 'mes') {
        const mesStr = hoje.toISOString().slice(0, 7);
        movs = movs.filter(m => m.data && m.data.startsWith(mesStr));
    } else if (periodo === 'ano') {
        const anoStr = String(hoje.getFullYear());
        movs = movs.filter(m => m.data && m.data.startsWith(anoStr));
    }
    
    if (tipo !== 'todos') {
        movs = movs.filter(m => m.tipo === tipo);
    }
    
    if (busca) {
        movs = movs.filter(m => (m.descricao || '').toLowerCase().includes(busca) || (m.categoria || '').toLowerCase().includes(busca));
    }
    
    movs.sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.id - a.id));
    
    if (movs.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma movimentação encontrada</p>';
        return;
    }
    
    container.innerHTML = movs.slice(0, 5).map(m => {
        const isEntrada = m.tipo === 'entrada';
        return `
            <div class="pedido-item" style="cursor:pointer;" onclick="irParaPagina('adminFinanceiro')">
                <div class="pedido-item-info">
                    <h5>${m.descricao || 'Movimentação'}</h5>
                    <p>${formatDate(m.data)} ${m.hora || ''} · ${capitalize(m.categoria || 'outro')}</p>
                </div>
                <div style="text-align:right;">
                    <strong style="color:${isEntrada ? 'var(--success)' : 'var(--danger)'};">
                        ${isEntrada ? '+' : '-'} ${formatCurrency(m.valor)}
                    </strong>
                    <br><small class="status-badge ${isEntrada ? 'status-concluido' : 'status-cancelado'}">${isEntrada ? 'Entrada' : 'Saída'}</small>
                </div>
            </div>
        `;
    }).join('');
};

window.limparFiltrosDashboard = function() {
    const fPeriodo = document.getElementById('filtroPeriodoDash');
    const fTipo = document.getElementById('filtroTipoDash');
    const fBusca = document.getElementById('buscaMovDash');
    if (fPeriodo) fPeriodo.value = 'todos';
    if (fTipo) fTipo.value = 'todos';
    if (fBusca) fBusca.value = '';
    aplicarFiltrosDashboard();
};

function atualizarTotaisFinanceiro() {
    const movs = DB.movimentacoes || [];
    const entradas = movs.filter(m => m.tipo === 'entrada').reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);
    const saidas = movs.filter(m => m.tipo === 'saida').reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);
    const saldo = entradas - saidas;
    
    const pendentes = (DB.pedidos || []).filter(p => p.status === 'pendente' || p.status === 'em_andamento').reduce((s, p) => s + (parseFloat(p.total) || 0), 0);
    
    const elEntradas = document.getElementById('totalEntradas');
    if (elEntradas) elEntradas.textContent = formatCurrency(entradas);
    
    const elSaidas = document.getElementById('totalSaidas');
    if (elSaidas) elSaidas.textContent = formatCurrency(saidas);
    
    const elAReceber = document.getElementById('totalAReceber');
    if (elAReceber) elAReceber.textContent = formatCurrency(pendentes);
    
    const elSaldo = document.getElementById('saldoGeral');
    if (elSaldo) elSaldo.textContent = formatCurrency(saldo);
}

function renderAdminDashboard() {
    renderServicos();
    renderMateriais();
    renderPedidos();
    renderMovimentacoes();
    renderClientes();
    
    const totalClientes = (DB.clientes || []).length;
    const totalMateriais = (DB.materiais || []).length;
    
    const pedidos = DB.pedidos || [];
    const pedidosAtivos = pedidos.filter(p => p.status !== 'concluido' && p.status !== 'cancelado').length;
    
    const movimentacoes = DB.movimentacoes || [];
    const totalEntradas = movimentacoes.filter(m => m.tipo === 'entrada').reduce((sum, m) => sum + (parseFloat(m.valor) || 0), 0);
    
    const statReceita = document.getElementById('statReceita');
    if (statReceita) statReceita.textContent = formatCurrency(totalEntradas);
    
    const statPedidos = document.getElementById('statPedidos');
    if (statPedidos) statPedidos.textContent = pedidosAtivos;
    
    const statClientes = document.getElementById('statClientes');
    if (statClientes) statClientes.textContent = totalClientes;
    
    const statMateriais = document.getElementById('statMateriais');
    if (statMateriais) statMateriais.textContent = totalMateriais;
    
    desenharGraficoBarras(movimentacoes);
    renderizarDonutServicos(pedidos, movimentacoes);
    renderizarUltimosPedidosDashboard(pedidos);
    aplicarFiltrosDashboard();
    atualizarTotaisFinanceiro();
}

// ==========================================
// SERVIÇOS
// ==========================================

function abrirNovoServicoModal() {
    clearForm('servico');
    document.getElementById('servicoId').value = '';
    document.getElementById('servicoImagemPreview').style.display = 'none';
    openModal('servicoModal');
}
function abrirNovoMaterialModal() {
    clearForm('material');
    document.getElementById('materialId').value = '';
    document.getElementById('materialImagemPreview').style.display = 'none';
    openModal('materialModal');
}
function abrirNovoPedidoModal(ev, clienteId) {
    clearForm('pedido');
    document.getElementById('pedidoId').value = '';
    document.getElementById('pedidoCliente').innerHTML = DB.clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    if(clienteId) document.getElementById('pedidoCliente').value = clienteId;
    document.getElementById('pedidoStatus').value = 'pendente';
    document.getElementById('pedidoData').value = new Date().toISOString().substring(0,10);
    openModal('pedidoModal');
}
function abrirNovaMovimentacaoModal() {
    clearForm('movimentacao');
    document.getElementById('movId').value = '';
    document.getElementById('movTipo').value = 'entrada';
    document.getElementById('movData').value = new Date().toISOString().substring(0,10);
    openModal('movimentacaoModal');
}

function renderServicos() {
    const list = document.getElementById('listaServicosAdmin') || document.getElementById('adminServicosList');
    if (!list) return;
    if (!DB.servicos || DB.servicos.length === 0) {
        list.innerHTML = '<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:30px;"><p>Nenhum serviço cadastrado.</p></div>';
        return;
    }
    list.innerHTML = DB.servicos.map(s => `
        <div class="card item-card">
            <div class="item-card-image" style="height:140px;position:relative;background:#f1f5f9;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:8px 8px 0 0;">
                ${s.imagem ? `<img src="${s.imagem}" alt="${s.nome}" style="width:100%;height:100%;object-fit:cover;">` : `<i class="fas ${s.icone || 'fa-music'}" style="font-size:36px;color:#94a3b8;"></i>`}
            </div>
            <div class="card-body" style="padding:16px;">
                <h4 style="margin:0 0 6px 0;font-size:16px;">${s.nome}</h4>
                <p style="font-size:13px;color:var(--text-light);min-height:38px;line-height:1.4;margin:0 0 10px 0;">${s.descricao || 'Sem descrição'}</p>
                <div style="font-size:16px;font-weight:700;color:var(--primary);margin-bottom:12px;">${formatCurrency(s.preco)} ${s.duracao ? `<small style="font-size:12px;font-weight:400;color:#64748b;">· ${s.duracao}</small>` : ''}</div>
                <div style="display:flex;gap:8px;">
                    <button class="btn-secondary btn-sm" style="flex:1;" onclick="editarServico('${s.id}')"><i class="fas fa-edit"></i> Editar</button>
                    <button class="btn-danger btn-sm" style="flex:1;" onclick="excluirServico('${s.id}')"><i class="fas fa-trash"></i> Excluir</button>
                </div>
            </div>
        </div>
    `).join('');
}

function editarServico(id) {
    const s = DB.servicos.find(x => x.id === parseInt(id) || x.id === id);
    if (!s) return;
    clearForm('servico');
    document.getElementById('servicoId').value = s.id;
    document.getElementById('servicoNome').value = s.nome;
    document.getElementById('servicoDescricao').value = s.descricao || '';
    
    let precoFmt = Number(s.preco || 0).toFixed(2).replace('.', ',');
    document.getElementById('servicoPreco').value = precoFmt;
    
    if (document.getElementById('servicoDuracao')) document.getElementById('servicoDuracao').value = s.duracao || '';
    if (document.getElementById('servicoIcone')) document.getElementById('servicoIcone').value = s.icone || 'fa-cog';
    if (document.getElementById('servicoCategoria')) document.getElementById('servicoCategoria').value = s.categoria || 'outro';
    
    const preview = document.getElementById('servicoImagemPreview');
    const placeholder = document.getElementById('servicoImgPreview');
    const removeBtn = document.getElementById('servicoImagemRemoveBtn');
    if (s.imagem) {
        if (preview) { preview.src = s.imagem; preview.style.display = 'block'; }
        if (placeholder) placeholder.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'inline-flex';
    } else {
        if (preview) { preview.src = ''; preview.style.display = 'none'; }
        if (placeholder) placeholder.style.display = 'block';
        if (removeBtn) removeBtn.style.display = 'none';
    }
    openModal('servicoModal');
}

async function excluirServico(id) {
    if (!confirm('Excluir este serviço?')) return;
    const s = DB.servicos.find(x => x.id === id || x.id === parseInt(id));
    DB.servicos = DB.servicos.filter(x => x.id !== id && x.id !== parseInt(id));
    if (DBReady && s) await DB_SERVICE.deleteServico(s.docId || s.id);
    renderServicos();
    renderAdminDashboard();
    showToast('Serviço excluído', 'success');
}

async function salvarServico() {
    const id = document.getElementById('servicoId').value;
    const imgEl = document.getElementById('servicoImagemPreview');
    const inputEl = document.getElementById('servicoImagem');
    
    let img = '';
    if (inputEl && inputEl.dataset.base64) {
        img = inputEl.dataset.base64;
    } else if (imgEl && imgEl.style.display !== 'none' && imgEl.src && !imgEl.src.endsWith('/') && !imgEl.src.startsWith('blob:null')) {
        img = imgEl.src;
    }
    
    let strPreco = document.getElementById('servicoPreco').value || '0';
    const precoFloat = parseFloat(strPreco.replace(/\./g, '').replace(',', '.')) || 0;

    const data = {
        nome: (document.getElementById('servicoNome').value || '').trim(),
        descricao: (document.getElementById('servicoDescricao').value || '').trim(),
        preco: precoFloat,
        duracao: document.getElementById('servicoDuracao') ? document.getElementById('servicoDuracao').value.trim() : '',
        icone: document.getElementById('servicoIcone') ? document.getElementById('servicoIcone').value.trim() : 'fa-cog',
        categoria: document.getElementById('servicoCategoria') ? document.getElementById('servicoCategoria').value : 'outro',
        imagem: img || ''
    };

    if (!data.nome) {
        showToast('Informe o nome do serviço', 'error');
        return;
    }
    
    if (id) {
        const item = DB.servicos.find(x => x.id === parseInt(id) || x.id === id);
        if (item) {
            Object.assign(item, data);
            if (DBReady) await DB_SERVICE.updateServico(item.docId || item.id, data);
        }
    } else {
        if (DBReady) {
            const res = await DB_SERVICE.addServico(data);
            data.id = res.id;
            data.docId = res.id;
        } else {
            data.id = Date.now();
            data.docId = data.id;
        }
        DB.servicos.push(data);
    }
    
    closeAllModals();
    renderServicos();
    renderAdminDashboard();
    showToast('Serviço salvo', 'success');
}

// ==========================================
// MATERIAIS
// ==========================================
function renderMateriais() {
    const list = document.getElementById('listaMateriaisAdmin') || document.getElementById('adminMateriaisList');
    if (!list) return;
    if (!DB.materiais || DB.materiais.length === 0) {
        list.innerHTML = '<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:30px;"><p>Nenhum material cadastrado.</p></div>';
        return;
    }
    list.innerHTML = DB.materiais.map(m => `
        <div class="card item-card">
            <div class="item-card-image" style="height:140px;position:relative;background:#f1f5f9;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:8px 8px 0 0;">
                ${m.imagem ? `<img src="${m.imagem}" alt="${m.nome}" style="width:100%;height:100%;object-fit:cover;">` : `<i class="fas ${getCategoriaIcon(m.categoria)}" style="font-size:36px;color:#94a3b8;"></i>`}
            </div>
            <div class="card-body" style="padding:16px;">
                <h4 style="margin:0 0 6px 0;font-size:16px;">${m.nome}</h4>
                <p style="font-size:13px;color:var(--text-light);min-height:38px;line-height:1.4;margin:0 0 10px 0;">${m.descricao || 'Sem descrição'}</p>
                <div style="font-size:16px;font-weight:700;color:var(--primary);margin-bottom:12px;">${formatCurrency(m.preco)}</div>
                <div style="display:flex;gap:8px;">
                    <button class="btn-secondary btn-sm" style="flex:1;" onclick="editarMaterial('${m.id}')"><i class="fas fa-edit"></i> Editar</button>
                    <button class="btn-danger btn-sm" style="flex:1;" onclick="excluirMaterial('${m.id}')"><i class="fas fa-trash"></i> Excluir</button>
                </div>
            </div>
        </div>
    `).join('');
}

function editarMaterial(id) {
    const m = DB.materiais.find(x => x.id === parseInt(id) || x.id === id);
    if (!m) return;
    clearForm('material');
    document.getElementById('materialId').value = m.id;
    document.getElementById('materialNome').value = m.nome;
    document.getElementById('materialDescricao').value = m.descricao || '';
    
    let precoFmt = Number(m.preco || 0).toFixed(2).replace('.', ',');
    document.getElementById('materialPreco').value = precoFmt;

    if (document.getElementById('materialCategoria')) document.getElementById('materialCategoria').value = m.categoria || 'outro';
    
    const preview = document.getElementById('materialImagemPreview');
    const placeholder = document.getElementById('materialImgPreview');
    const removeBtn = document.getElementById('materialImagemRemoveBtn');
    if (m.imagem) {
        if (preview) { preview.src = m.imagem; preview.style.display = 'block'; }
        if (placeholder) placeholder.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'inline-flex';
    } else {
        if (preview) { preview.src = ''; preview.style.display = 'none'; }
        if (placeholder) placeholder.style.display = 'block';
        if (removeBtn) removeBtn.style.display = 'none';
    }
    openModal('materialModal');
}

async function excluirMaterial(id) {
    if (!confirm('Excluir este material?')) return;
    const m = DB.materiais.find(x => x.id === id || x.id === parseInt(id));
    DB.materiais = DB.materiais.filter(x => x.id !== id && x.id !== parseInt(id));
    if (DBReady && m) await DB_SERVICE.deleteMaterial(m.docId || m.id);
    renderMateriais();
    renderAdminDashboard();
    showToast('Material excluído', 'success');
}

async function salvarMaterial() {
    const id = document.getElementById('materialId').value;
    const imgEl = document.getElementById('materialImagemPreview');
    const inputEl = document.getElementById('materialImagem');
    
    let img = '';
    if (inputEl && inputEl.dataset.base64) {
        img = inputEl.dataset.base64;
    } else if (imgEl && imgEl.style.display !== 'none' && imgEl.src && !imgEl.src.endsWith('/') && !imgEl.src.startsWith('blob:null')) {
        img = imgEl.src;
    }
    
    let strPreco = document.getElementById('materialPreco').value || '0';
    const precoFloat = parseFloat(strPreco.replace(/\./g, '').replace(',', '.')) || 0;

    const data = {
        nome: (document.getElementById('materialNome').value || '').trim(),
        descricao: (document.getElementById('materialDescricao').value || '').trim(),
        preco: precoFloat,
        categoria: document.getElementById('materialCategoria') ? document.getElementById('materialCategoria').value : 'outro',
        imagem: img || ''
    };

    if (!data.nome) {
        showToast('Informe o nome do material', 'error');
        return;
    }
    
    if (id) {
        const item = DB.materiais.find(x => x.id === parseInt(id) || x.id === id);
        if (item) {
            Object.assign(item, data);
            if (DBReady) await DB_SERVICE.updateMaterial(item.docId || item.id, data);
        }
    } else {
        if (DBReady) {
            const res = await DB_SERVICE.addMaterial(data);
            data.id = res.id;
            data.docId = res.id;
        } else {
            data.id = Date.now();
            data.docId = data.id;
        }
        DB.materiais.push(data);
    }
    
    closeAllModals();
    renderMateriais();
    renderAdminDashboard();
    showToast('Material salvo', 'success');
}

// ==========================================
// PEDIDOS
// ==========================================
window.renderPedidosAdmin = function() {
    renderPedidos();
};

function renderPedidos() {
    const tableBody = document.getElementById('pedidosAdminBody') || document.getElementById('adminPedidosList');
    const kanbanEl = document.getElementById('kanbanPedidos');
    const selectCliente = document.getElementById('filtroClientePedido');
    
    if (selectCliente && selectCliente.options.length <= 1) {
        selectCliente.innerHTML = '<option value="">Todos os clientes</option>' + (DB.clientes || []).map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    }
    
    let pedidos = [...(DB.pedidos || [])];
    
    const filtroCli = document.getElementById('filtroClientePedido')?.value;
    if (filtroCli) {
        pedidos = pedidos.filter(p => p.clienteId == filtroCli);
    }
    
    const busca = (document.getElementById('buscaPedidoAdmin')?.value || '').toLowerCase().trim();
    if (busca) {
        pedidos = pedidos.filter(p => {
            const c = (DB.clientes || []).find(x => x.id == p.clienteId);
            return String(p.id).includes(busca) || (c && c.nome.toLowerCase().includes(busca));
        });
    }
    
    const filtroStatus = document.getElementById('filtroStatusPedido')?.value;
    if (filtroStatus && filtroStatus !== 'todos') {
        pedidos = pedidos.filter(p => p.status === filtroStatus);
    }
    
    // Sort recent first
    pedidos.sort((a, b) => (b.id - a.id) || (new Date(b.data) - new Date(a.data)));
    
    // Render Kanban
    if (kanbanEl) {
        const statusMap = {
            'pendente': { title: 'Pendente', icon: 'fa-clock', color: '#f59e0b' },
            'em_andamento': { title: 'Em Andamento', icon: 'fa-spinner', color: '#3b82f6' },
            'concluido': { title: 'Concluído', icon: 'fa-check-circle', color: '#10b981' },
            'cancelado': { title: 'Cancelado', icon: 'fa-times-circle', color: '#ef4444' }
        };
        
        kanbanEl.innerHTML = Object.keys(statusMap).map(statusKey => {
            const conf = statusMap[statusKey];
            const colPedidos = pedidos.filter(p => p.status === statusKey);
            const cardsHtml = colPedidos.map(p => {
                const c = (DB.clientes || []).find(x => x.id == p.clienteId);
                const servs = (p.servicos || []).map(id => (DB.servicos || []).find(s => s.id == id)?.nome).filter(Boolean).join(', ') || 'Sem serviços';
                return `
                    <div class="kanban-card" onclick="editarPedido('${p.id}')" style="background:#fff;border-radius:8px;padding:12px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,0.1);border-left:4px solid ${conf.color};cursor:pointer;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                            <strong style="font-size:13px;">#${p.id}</strong>
                            <small style="color:#64748b;">${formatDate(p.data)}</small>
                        </div>
                        <h5 style="margin:0 0 4px 0;font-size:14px;color:#1e293b;">${c ? c.nome : 'Cliente Avulso'}</h5>
                        <p style="font-size:12px;color:#64748b;margin:0 0 8px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${servs}</p>
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="font-size:13px;font-weight:700;color:var(--primary);">${formatCurrency(p.total)}</span>
                            <span style="font-size:11px;color:#64748b;">${(p.audios || []).length} áudio(s)</span>
                        </div>
                    </div>
                `;
            }).join('');
            
            return `
                <div class="kanban-col" style="background:#f8fafc;border-radius:8px;padding:12px;min-height:300px;">
                    <div class="kanban-col-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid ${conf.color};">
                        <span style="font-weight:600;font-size:14px;"><i class="fas ${conf.icon}" style="color:${conf.color};margin-right:6px;"></i>${conf.title}</span>
                        <span class="badge" style="background:${conf.color};color:#fff;border-radius:12px;padding:2px 8px;font-size:11px;">${colPedidos.length}</span>
                    </div>
                    <div class="kanban-cards">
                        ${cardsHtml || '<div style="text-align:center;color:#94a3b8;font-size:12px;padding:20px;">Vazio</div>'}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Render Table
    if (tableBody) {
        if (pedidos.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:20px;">Nenhum pedido encontrado.</td></tr>';
            return;
        }
        tableBody.innerHTML = pedidos.map(p => {
            const c = (DB.clientes || []).find(x => x.id == p.clienteId);
            const servs = (p.servicos || []).map(id => (DB.servicos || []).find(s => s.id == id)?.nome).filter(Boolean).join(', ') || 'Nenhum';
            return `
            <tr>
                <td><strong>#${p.id}</strong></td>
                <td>${c ? c.nome : 'Cliente #' + p.clienteId}</td>
                <td><small>${servs}</small></td>
                <td><strong>${formatCurrency(p.total)}</strong></td>
                <td><span class="status-badge status-${p.status}">${statusLabel(p.status)}</span></td>
                <td>${formatDate(p.data)}</td>
                <td>
                    <button class="btn-icon" onclick="editarPedido('${p.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon text-danger" onclick="excluirPedido('${p.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
            `;
        }).join('');
    }
}

function editarPedido(id) {
    const p = DB.pedidos.find(x => x.id == id);
    if (!p) return;
    clearForm('pedido');
    document.getElementById('pedidoId').value = p.id;
    document.getElementById('pedidoCliente').innerHTML = (DB.clientes || []).map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    document.getElementById('pedidoCliente').value = p.clienteId;
    document.getElementById('pedidoStatus').value = p.status;
    
    const pServs = p.servicos || [];
    const pMats = p.materiais || [];
    const servicosHtml = (DB.servicos || []).map(s => `<label><input type="checkbox" value="${s.id}" ${pServs.includes(s.id) ? 'checked' : ''} onchange="updatePedidoTotal()"> ${s.nome} (${formatCurrency(s.preco)})</label>`).join('');
    document.getElementById('pedidoServicos').innerHTML = servicosHtml;
    
    const materiaisHtml = (DB.materiais || []).map(m => `<label><input type="checkbox" value="${m.id}" ${pMats.includes(m.id) ? 'checked' : ''} onchange="updatePedidoTotal()"> ${m.nome} (${formatCurrency(m.preco)})</label>`).join('');
    document.getElementById('pedidoMateriais').innerHTML = materiaisHtml;
    
    document.getElementById('pedidoDesconto').value = p.desconto ? fmtCalc(p.desconto) : '0,00';
    document.getElementById('pedidoQtdFaixas').value = p.qtdFaixas || 1;
    if(document.getElementById('pedidoHoraInicial')) document.getElementById('pedidoHoraInicial').value = p.horaInicial || '';
    if(document.getElementById('pedidoHoraFinal')) document.getElementById('pedidoHoraFinal').value = p.horaFinal || '';
    updatePedidoTotal();
    openModal('pedidoModal');
}

async function excluirPedido(id) {
    if (!confirm('Excluir este pedido?')) return;
    const p = DB.pedidos.find(x => x.id == id);
    DB.pedidos = DB.pedidos.filter(x => x.id != id);
    if (DBReady && p) await DB_SERVICE.deletePedido(p.docId || p.id);
    renderPedidos();
    renderAdminDashboard();
    showToast('Pedido excluído', 'success');
}

window.updatePedidoTotal = function() {
    let t = 0;
    [...document.querySelectorAll('#pedidoServicos input:checked')].forEach(cb => {
        const s = (DB.servicos || []).find(x => x.id == cb.value);
        if(s) t += s.preco;
    });
    [...document.querySelectorAll('#pedidoMateriais input:checked')].forEach(cb => {
        const m = (DB.materiais || []).find(x => x.id == cb.value);
        if(m) t += m.preco;
    });
    const descStr = document.getElementById('pedidoDesconto')?.value || '0';
    const desc = parseFloat(descStr.replace(/\./g, '').replace(',', '.')) || 0;
    t = Math.max(0, t - desc);
    const prev = document.getElementById('pedidoTotalPreview');
    if(prev) prev.textContent = formatCurrency(t);
    return {t, desc};
};

async function salvarPedido() {
    const id = document.getElementById('pedidoId').value;
    const {t, desc} = updatePedidoTotal();
    const horaInicial = document.getElementById('pedidoHoraInicial') ? document.getElementById('pedidoHoraInicial').value : '';
    const horaFinal = document.getElementById('pedidoHoraFinal') ? document.getElementById('pedidoHoraFinal').value : '';
    if (horaInicial || horaFinal) {
        if (!validarHorarioEstudio(horaInicial, horaFinal)) return;
    }
    const servicos = [...document.querySelectorAll('#pedidoServicos input:checked')].map(cb => parseInt(cb.value) || cb.value);
    const materiais = [...document.querySelectorAll('#pedidoMateriais input:checked')].map(cb => parseInt(cb.value) || cb.value);
    
    const data = {
        clienteId: document.getElementById('pedidoCliente').value,
        status: document.getElementById('pedidoStatus').value,
        servicos, materiais,
        desconto: desc,
        total: t,
        data: document.getElementById('pedidoData')?.value || new Date().toISOString().split('T')[0],
        qtdFaixas: parseInt(document.getElementById('pedidoQtdFaixas').value) || 1,
        horaInicial, horaFinal
    };
    
    if (id) {
        const item = DB.pedidos.find(x => x.id == id);
        if (item) {
            Object.assign(item, data);
            if (DBReady) await DB_SERVICE.updatePedido(item.docId || item.id, data);
        }
    } else {
        if (DBReady) {
            const res = await DB_SERVICE.addPedido(data);
            data.id = res.id;
            data.docId = res.id;
        } else {
            data.id = Date.now();
            data.docId = data.id;
        }
        DB.pedidos.push(data);
    }
    closeAllModals();
    renderPedidos();
    renderAdminDashboard();
    showToast('Pedido salvo', 'success');
}

// ==========================================
// MOVIMENTAÇÕES
// ==========================================
function renderMovimentacoes() {
    const list = document.getElementById('movimentacoesBody') || document.getElementById('adminMovimentacoesList');
    if (!list) return;
    
    let movs = [...(DB.movimentacoes || [])];
    
    const fTipo = document.getElementById('filtroTipoMov')?.value;
    if (fTipo && fTipo !== 'todos') {
        movs = movs.filter(m => m.tipo === fTipo);
    }
    
    const dtIni = document.getElementById('filtroDataInicio')?.value;
    const dtFim = document.getElementById('filtroDataFim')?.value;
    if (dtIni) movs = movs.filter(m => m.data >= dtIni);
    if (dtFim) movs = movs.filter(m => m.data <= dtFim);
    
    movs.sort((a,b) => (b.data || '').localeCompare(a.data || '') || (b.id - a.id));
    
    if (movs.length === 0) {
        list.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:20px;">Nenhuma movimentação financeira encontrada.</td></tr>';
        atualizarTotaisFinanceiro();
        return;
    }
    
    list.innerHTML = movs.map(m => {
        const isEntrada = m.tipo === 'entrada';
        return `
        <tr>
            <td>${formatDate(m.data)} ${m.hora || ''}</td>
            <td><strong>${m.descricao || 'Movimentação'}</strong></td>
            <td><span class="badge" style="background:${isEntrada ? 'var(--success)' : 'var(--danger)'};color:#fff;border-radius:4px;padding:3px 8px;font-size:12px;">${isEntrada ? 'Entrada' : 'Saída'}</span></td>
            <td>${capitalize(m.categoria || 'outro')}</td>
            <td style="font-weight:bold;color:${isEntrada ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(m.valor)}</td>
            <td>${m.metodo || 'PIX'}</td>
            <td>
                <button class="btn-icon" onclick="editarMovimentacao('${m.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="btn-icon text-danger" onclick="excluirMovimentacao('${m.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `}).join('');

    atualizarTotaisFinanceiro();
}

function renderFinanceiro() {
    if (typeof renderMovimentacoes === 'function') renderMovimentacoes();
}


function editarMovimentacao(id) {
    const m = DB.movimentacoes.find(x => x.id == id);
    if (!m) return;
    clearForm('movimentacao');
    document.getElementById('movId').value = m.id;
    document.getElementById('movTipo').value = m.tipo;
    document.getElementById('movDescricao').value = m.descricao;
    document.getElementById('movValor').value = m.valor;
    document.getElementById('movData').value = m.data;
    openModal('movimentacaoModal');
}

async function excluirMovimentacao(id) {
    if (!confirm('Excluir esta movimentação?')) return;
    const m = DB.movimentacoes.find(x => x.id == id);
    DB.movimentacoes = DB.movimentacoes.filter(x => x.id != id);
    if (DBReady && m) await DB_SERVICE.deleteMovimentacao(m.docId || m.id);
    renderMovimentacoes();
    renderAdminDashboard();
    showToast('Movimentação excluída', 'success');
}

async function salvarMovimentacao() {
    const id = document.getElementById('movId').value;
    const data = {
        tipo: document.getElementById('movTipo').value,
        descricao: document.getElementById('movDescricao').value,
        valor: Number(document.getElementById('movValor').value) || 0,
        categoria: document.getElementById('movCategoria')?.value || 'outro',
        metodo: document.getElementById('movMetodo')?.value || 'PIX',
        data: document.getElementById('movData').value || new Date().toISOString().split('T')[0],
        hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
    
    if (id) {
        const item = DB.movimentacoes.find(x => x.id == id);
        if (item) {
            Object.assign(item, data);
            if (DBReady) await DB_SERVICE.updateMovimentacao(item.docId || item.id, data);
        }
    } else {
        if (DBReady) {
            const res = await DB_SERVICE.addMovimentacao(data);
            data.id = res.id;
            data.docId = res.id;
        } else {
            data.id = Date.now();
            data.docId = data.id;
        }
        DB.movimentacoes.push(data);
    }
    closeAllModals();
    renderMovimentacoes();
    renderAdminDashboard();
    showToast('Movimentação salva', 'success');
}

function htmlResumoMovimentacoesCliente(pedidos) {
    let totalPedidos = pedidos.reduce((sum, p) => sum + Number(p.total || 0), 0);
    let pagos = (DB.movimentacoes || []).filter(m => pedidos.some(p => p.id == m.pedidoId) && m.tipo === 'entrada').reduce((sum, m) => sum + Number(m.valor || 0), 0);
    return `
        <div style="margin:8px 0;padding:12px;background:#f1f5f9;border-radius:6px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                <span>Total em Pedidos:</span>
                <strong>${formatCurrency(totalPedidos)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;color:var(--success);">
                <span>Total Pago:</span>
                <strong>${formatCurrency(pagos)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;border-top:1px solid #cbd5e1;padding-top:6px;font-weight:bold;color:var(--danger);">
                <span>Saldo Pendente:</span>
                <span>${formatCurrency(Math.max(0, totalPedidos - pagos))}</span>
            </div>
        </div>
    `;
}

function renderClientes() {
    const tbody = document.getElementById('clientesBody');
    if (!tbody) return;
    const clientes = DB.clientes || [];
    if (!clientes.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:20px;">Nenhum cliente cadastrado.</td></tr>';
        return;
    }
    tbody.innerHTML = clientes.map(c => {
        const pedidos = DB.pedidos.filter(p => String(p.clienteId) === String(c.id));
        const ativos = pedidos.filter(p => p.status !== 'cancelado');
        const totalGasto = ativos.reduce((s, p) => s + valorEsperadoPedido(p), 0);
        const totalPago = ativos.reduce((s, p) => s + valorPagoPedido(p), 0);
        const aberto = Math.max(0, Math.round((totalGasto - totalPago) * 100) / 100);
        const abertoDet = clientesExpandidos.has(String(c.id)) || clientesExpandidos.has(c.id);
        const tipoBadge = c.tipoPessoa === 'juridica'
            ? '<span class="cond-badge" style="margin-left:6px;font-size:10px;">PJ</span>'
            : (c.cpf ? '<span class="cond-badge" style="margin-left:6px;font-size:10px;">PF</span>' : '');
        const idJs = JSON.stringify(String(c.id));
        const idAttr = String(c.id).replace(/'/g, '&#39;');
        return `<tr class="cliente-row" onclick="toggleClienteDetalhe(${idJs})">
            <td><strong>${c.nome}</strong>${tipoBadge}</td>
            <td>${c.email || '-'}${c.instagram ? `<br><small style="color:var(--text-muted);"><i class="fab fa-instagram"></i> ${c.instagram}</small>` : ''}</td>
            <td>${c.telefone || '-'}</td>
            <td title="${ativos.length} ativo(s) / ${pedidos.length} total">
                ${pedidos.length}
                ${ativos.length !== pedidos.length ? `<small style="color:var(--text-muted);"> (${ativos.length} ativos)</small>` : ''}
            </td>
            <td>
                <strong>${formatCurrency(totalGasto)}</strong>
                ${aberto > 0 ? `<br><small class="valor-aberto">aberto ${formatCurrency(aberto)}</small>` : `<br><small style="color:var(--success);">quitado</small>`}
            </td>
            <td>
                <div class="table-actions">
                    <button title="${abertoDet ? 'Ocultar detalhes' : 'Ver movimentações e somatório'}" class="${abertoDet ? 'btn-ativo' : ''}" onclick="event.stopPropagation();toggleClienteDetalhe(${idJs})"><i class="fas ${abertoDet ? 'fa-chevron-up' : 'fa-chevron-down'}"></i></button>
                    <button class="btn-primary btn-sm" onclick="event.stopPropagation();irParaChatComCliente('${idAttr}')" title="Conversar no Chat"><i class="fas fa-comments"></i> Chat</button>
                    <button class="btn-secondary btn-sm" onclick="event.stopPropagation();abrirNovoPedidoModal(null, '${idAttr}')" title="Novo Pedido"><i class="fas fa-plus"></i></button>
                    <button onclick="editarCliente(${idJs});event.stopPropagation()" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-del" onclick="excluirCliente(${idJs});event.stopPropagation()" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
        <tr class="cliente-detalhe" id="detalhe_${String(c.id).replace(/[^\w-]/g, '_')}" data-cliente="${String(c.id).replace(/"/g, '&quot;')}" style="${abertoDet ? '' : 'display:none;'}">
            <td colspan="6">${abertoDet ? htmlDetalheCliente(c) : ''}</td>
        </tr>`;
    }).join('');
}

window.irParaChatComCliente = function(clienteId) {
    irParaPagina('adminChat');
    setTimeout(() => {
        openChatAdmin(clienteId);
    }, 80);
};



function abrirNovoClienteModal() {
    clearForm('cliente');
    document.getElementById('clienteModalTitle').textContent = 'Novo Cliente';
    const tipo = document.getElementById('clienteTipoPessoa');
    if (tipo) { tipo.value = 'fisica'; toggleTipoPessoaAdmin(); }
    openModal('clienteModal');
}

function toggleTipoPessoaAdmin() {
    const tipo = document.getElementById('clienteTipoPessoa');
    const wrap = document.getElementById('clienteCnpjWrap');
    if (tipo && wrap) wrap.style.display = (tipo.value === 'juridica') ? '' : 'none';
}

function toggleTipoPessoaPerfil() {
    const tipo = document.getElementById('perfilTipoPessoa');
    const cpfWrap = document.getElementById('perfilCpfWrap');
    const cnpjWrap = document.getElementById('perfilCnpjWrap');
    if (!tipo) return;
    const juridica = tipo.value === 'juridica';
    if (cpfWrap) cpfWrap.style.display = juridica ? 'none' : '';
    if (cnpjWrap) cnpjWrap.style.display = juridica ? '' : 'none';
}

function editarCliente(id) {
    const c = DB.clientes.find(x => String(x.id) === String(id));
    if (!c) return;
    document.getElementById('clienteId').value = c.id;
    document.getElementById('clienteNome').value = c.nome;
    document.getElementById('clienteEmail').value = c.email;
    document.getElementById('clienteTelefone').value = c.telefone;
    document.getElementById('clienteSenha').value = c.senha;
    document.getElementById('clientePin').value = c.pin || '';
    const tipo = document.getElementById('clienteTipoPessoa');
    if (tipo) {
        tipo.value = c.tipoPessoa || 'fisica';
        toggleTipoPessoaAdmin();
    }
    document.getElementById('clienteCnpj').value = c.cnpj || '';
    document.getElementById('clienteInstagram').value = c.instagram || '';
    document.getElementById('clienteModalTitle').textContent = 'Editar Cliente';
    openModal('clienteModal');
}

async function excluirCliente(id) {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;
    const item = DB.clientes.find(c => String(c.id) === String(id));
    DB.clientes = DB.clientes.filter(c => String(c.id) !== String(id));
    if (DBReady && item?.docId) await DB_SERVICE.deleteCliente(item.docId);
    clientesExpandidos.delete(String(id));
    renderClientes();
    renderAdminDashboard();
    showToast('Cliente excluído!', 'success');
}

async function salvarCliente() {
    const id = document.getElementById('clienteId').value;
    const pin = document.getElementById('clientePin').value;
    const tipoPessoa = (document.getElementById('clienteTipoPessoa').value || 'fisica');
    const data = {
        nome: document.getElementById('clienteNome').value,
        email: document.getElementById('clienteEmail').value,
        telefone: document.getElementById('clienteTelefone').value,
        senha: document.getElementById('clienteSenha').value,
        pin: pin,
        tipoPessoa,
        cnpj: (document.getElementById('clienteCnpj').value || '').trim(),
        instagram: (document.getElementById('clienteInstagram').value || '').trim()
    };

    if (!data.nome || !data.email) {
        showToast('Preencha nome e e-mail!', 'error');
        return;
    }

    if (data.tipoPessoa === 'juridica' && !data.cnpj) {
        showToast('Informe o CNPJ!', 'error');
        return;
    }

    if (data.senha && data.senha.length < 6) {
        showToast('A senha deve ter pelo menos 6 caracteres!', 'error');
        return;
    }

    if (pin && pin.length !== 4) {
        showToast('O PIN deve ter exatamente 4 dígitos!', 'error');
        return;
    }

    if (id) {
        const idx = DB.clientes.findIndex(c => c.id === parseInt(id));
        if (idx !== -1) {
            const existente = DB.clientes[idx];
            const persistido = {
                ...data,
                cpf: existente.cpf || '',
                endereco: existente.endereco || '',
                numero: existente.numero || '',
                complemento: existente.complemento || '',
                bairro: existente.bairro || '',
                cep: existente.cep || '',
                cidade: existente.cidade || '',
                estado: existente.estado || ''
            };
            DB.clientes[idx] = { ...existente, ...data };
            if (DBReady) await DB_SERVICE.updateCliente(DB.clientes[idx].docId, persistido);
        }
    } else {
        data.id = (DB.nextId && DB.nextId.cliente) ? DB.nextId.cliente++ : Date.now();
        if (DBReady) {
            const res = await DB_SERVICE.addCliente(data);
            if (res && res.id) {
                data.id = res.id;
                data.docId = res.id;
            } else {
                data.docId = data.id;
            }
        } else {
            data.docId = data.id;
        }
        DB.clientes.push(data);
        if (DB.nextId) DB.nextId.cliente = Math.max(DB.nextId.cliente || 1, (parseInt(data.id) || 0) + 1);
    }

    closeAllModals();
    renderClientes();
    renderAdminDashboard();
    showToast(id ? 'Cliente atualizado!' : 'Cliente criado!', 'success');
    clearForm('cliente');
}

// ============================================
// MEUS DADOS (cadastro completo do cliente)
// ============================================
function perfilClienteCompleto(c) {
    const u = c || currentUser;
    if (!u || u.role !== 'client') return true;
    const doc = (u.tipoPessoa === 'juridica') ? u.cnpj : (u.cpf || u.cnpj);
    return !!(doc && u.endereco && u.cep && u.cidade && u.estado);
}

function atualizarAvisoPerfil(autoOpen) {
    if (!currentUser || currentUser.role !== 'client') return;
    const banner = document.getElementById('avisoPerfilBanner');
    if (!banner) return;
    const completo = perfilClienteCompleto();
    if (completo) { banner.style.display = 'none'; return; }
    banner.style.display = '';
    if (autoOpen && !window.__perfilAvisoAberto) {
        window.__perfilAvisoAberto = true;
        mostrarPerfilClient();
    }
}

function mostrarPerfilClient() {
    if (!currentUser || currentUser.role !== 'client') return;
    const u = currentUser;
    document.getElementById('perfilNome').value = u.nome || '';
    document.getElementById('perfilEmail').value = u.email || '';
    document.getElementById('perfilTelefone').value = u.telefone || '';
    const tipo = document.getElementById('perfilTipoPessoa');
    if (tipo) {
        tipo.value = u.tipoPessoa || 'fisica';
        toggleTipoPessoaPerfil();
    }
    document.getElementById('perfilCpf').value = u.cpf || '';
    document.getElementById('perfilCnpj').value = u.cnpj || '';
    document.getElementById('perfilInstagram').value = u.instagram || '';
    document.getElementById('perfilEndereco').value = u.endereco || '';
    document.getElementById('perfilNumero').value = u.numero || '';
    document.getElementById('perfilComplemento').value = u.complemento || '';
    document.getElementById('perfilBairro').value = u.bairro || '';
    document.getElementById('perfilCep').value = u.cep || '';
    document.getElementById('perfilCidade').value = u.cidade || '';
    document.getElementById('perfilEstado').value = u.estado || '';
    openModal('perfilClientModal');
}

async function salvarPerfilClient() {
    if (!currentUser || currentUser.role !== 'client') return;
    const atual = DB.clientes.find(c => c.id === currentUser.id);
    if (!atual) return;
    const v = id => (document.getElementById(id).value || '').trim();
    const dados = {
        nome: v('perfilNome'),
        email: v('perfilEmail'),
        telefone: v('perfilTelefone'),
        tipoPessoa: document.getElementById('perfilTipoPessoa').value || 'fisica',
        cpf: v('perfilCpf'),
        cnpj: v('perfilCnpj'),
        instagram: v('perfilInstagram'),
        endereco: v('perfilEndereco'),
        numero: v('perfilNumero'),
        complemento: v('perfilComplemento'),
        bairro: v('perfilBairro'),
        cep: v('perfilCep'),
        cidade: v('perfilCidade'),
        estado: v('perfilEstado')
    };
    if (!dados.nome || !dados.email) { showToast('Informe seu nome e e-mail!', 'error'); return; }
    if (dados.tipoPessoa === 'juridica' && !dados.cnpj) { showToast('Informe o CNPJ!', 'error'); return; }

    const persistido = { ...atual, ...dados };
    const dbUpdate = {
        nome: persistido.nome,
        email: persistido.email,
        telefone: persistido.telefone,
        senha: atual.senha,
        pin: atual.pin || '',
        cpf: persistido.cpf,
        cnpj: persistido.cnpj,
        tipoPessoa: persistido.tipoPessoa,
        instagram: persistido.instagram,
        endereco: persistido.endereco,
        numero: persistido.numero,
        complemento: persistido.complemento,
        bairro: persistido.bairro,
        cep: persistido.cep,
        cidade: persistido.cidade,
        estado: persistido.estado
    };
    Object.assign(atual, dados);
    currentUser = { role: 'client', ...atual };

    if (DBReady) {
        try { await DB_SERVICE.updateCliente(atual.docId, dbUpdate); }
        catch (e) { showToast('Erro ao salvar. Tente novamente.', 'error'); return; }
    }

    salvarSessao();
    document.getElementById('clientNameDisplay').textContent = currentUser.nome;
    atualizarAvisoPerfil();
    closeAllModals();
    showToast('Dados cadastrais atualizados!', 'success');
}

// ============================================
// CLIENT DASHBOARD
// ============================================
function renderClientDashboard() {
    if (!currentUser || currentUser.role !== 'client') return;
    const meusPedidos = DB.pedidos.filter(p => p.clienteId === currentUser.id);

    document.getElementById('clientStatPedidos').textContent = meusPedidos.length;
    document.getElementById('clientStatPendentes').textContent = meusPedidos.filter(p => p.status === 'pendente' || p.status === 'em_andamento').length;
    document.getElementById('clientStatConcluidos').textContent = meusPedidos.filter(p => p.status === 'concluido').length;
    document.getElementById('clientStatTotal').textContent = formatCurrency(meusPedidos.reduce((s, p) => s + p.total, 0));

    // Serviços em destaque
    const destaque = DB.servicos.slice(0, 3);
    document.getElementById('servicosDestaque').innerHTML = destaque.map(s => `<div class="pedido-item">
        <div class="pedido-item-info">
            <h5><i class="fas ${s.icone}" style="color:var(--primary);margin-right:8px;"></i>${s.nome}</h5>
            <p>${s.descricao.substring(0, 80)}...</p>
        </div>
        <div>
            <strong style="color:var(--primary)">${formatCurrency(s.preco)}</strong>
        </div>
    </div>`).join('');

    // Pedidos recentes
    const recentes = [...meusPedidos].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 5);
    const recentesContainer = document.getElementById('meusPedidosRecentes');
    if (recentes.length === 0) {
        recentesContainer.innerHTML = '<p class="empty-state">Nenhum pedido realizado</p>';
    } else {
        recentesContainer.innerHTML = recentes.map(p => `<div class="pedido-item">
            <div class="pedido-item-info">
                <h5>Pedido #${p.id}</h5>
                <p>${formatPedidoDataHora(p)}</p>
            </div>
            <div>
                <span class="status-badge status-${p.status}">${statusLabel(p.status)}</span>
            </div>
        </div>`).join('');
    }
}

// ============================================
// CLIENT SERVICES / MATERIALS
// ============================================
function renderServicosClient() {
    const container = document.getElementById('listaServicosClient');
    container.innerHTML = DB.servicos.map(s => `<div class="item-card">
        <div class="item-card-image">
            ${s.imagem ? `<img src="${s.imagem}" alt="${s.nome}">` : `<div class="placeholder-icon"><i class="fas ${s.icone}"></i><span>${s.duracao}</span></div>`}
        </div>
        <div class="item-card-body">
            <h4>${s.nome}</h4>
            <p>${s.descricao}</p>
            <div class="item-card-meta">
                <span class="item-card-price">${formatCurrency(s.preco)}</span>
                <span class="item-card-badge badge-estoque">${s.duracao}</span>
            </div>
        </div>
    </div>`).join('');
}

function renderMateriaisClient() {
    const container = document.getElementById('listaMateriaisClient');
    container.innerHTML = DB.materiais.map(m => `<div class="item-card">
        <div class="item-card-image">
            ${m.imagem ? `<img src="${m.imagem}" alt="${m.nome}">` : `<div class="placeholder-icon"><i class="fas ${getCategoriaIcon(m.categoria)}"></i><span>${capitalize(m.categoria)}</span></div>`}
        </div>
        <div class="item-card-body">
            <h4>${m.nome}</h4>
            <p>${m.descricao}</p>
            <div class="item-card-meta">
                ${formatMaterialPrice(m)}
                
            </div>
        </div>
    </div>`).join('');
}

// ============================================
// CLIENT PEDIDOS
// ============================================
function renderPedidosClient() {
    if (!currentUser || currentUser.role !== 'client') return;
    const meusPedidos = DB.pedidos.filter(p => p.clienteId === currentUser.id);
    const tbody = document.getElementById('pedidosClientBody');

    if (meusPedidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhum pedido realizado</td></tr>';
        return;
    }

    tbody.innerHTML = meusPedidos.map(p => {
        const servicoNomes = p.servicos.map(id => DB.servicos.find(s => s.id === id)?.nome || '').filter(Boolean).join(', ');
        const materialNomes = p.materiais.map(id => DB.materiais.find(m => m.id === id)?.nome || '').filter(Boolean).join(', ');
        const condRotulo = p.parcial ? '50% + 50%' : (p.descontoPct ? `-${p.descontoPct}% à vista` : '');
        return `<tr>
            <td><strong>#${p.id}</strong></td>
            <td>${servicoNomes || '-'}</td>
            <td>${materialNomes || '-'}</td>
            <td><strong>${formatCurrency(p.total)}</strong>${condRotulo ? `<small class="cond-badge">${condRotulo}</small>` : ''}</td>
            <td><span class="status-badge status-${p.status}">${statusLabel(p.status)}</span></td>
            <td>${formatPedidoDataHora(p)}</td>
            <td>
                <div class="table-actions">
                    <button onclick="verDetalhesPedidoClient(${p.id})" title="Ver Detalhes"><i class="fas fa-eye"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function verDetalhesPedidoClient(id) {
    const p = DB.pedidos.find(x => x.id === id);
    if (!p) return;
    const servicos = p.servicos.map(id => DB.servicos.find(s => s.id === id)).filter(Boolean);
    const materiais = p.materiais.map(id => DB.materiais.find(m => m.id === id)).filter(Boolean);

    let html = `
        <div class="detalhe-section">
            <h4><i class="fas fa-info-circle"></i> Informações do Pedido</h4>
            <div class="detalhe-item"><span>Pedido</span><strong>#${p.id}</strong></div>
            <div class="detalhe-item"><span>Criado em</span><span>${formatDate(p.data)}</span></div>
            ${p.dataInicial ? `<div class="detalhe-item"><span>Início</span><strong>${formatDate(p.dataInicial)} ${p.horaInicial || ''}${p.horaFinal ? ` &rarr; ${p.horaFinal}` : ''}</strong></div>` : ''}
            <div class="detalhe-item"><span>Status</span><span class="status-badge status-${p.status}">${statusLabel(p.status)}</span></div>
        </div>`;

    if (servicos.length) {
        html += `<div class="detalhe-section"><h4><i class="fas fa-concierge-bell"></i> Serviços</h4>`;
        servicos.forEach(s => {
            html += `<div class="detalhe-item"><span>${s.nome}</span><strong>${formatCurrency(s.preco)}</strong></div>`;
        });
        html += `</div>`;
    }

    if (materiais.length) {
        html += `<div class="detalhe-section"><h4><i class="fas fa-boxes"></i> Materiais</h4>`;
        materiais.forEach(m => {
            html += `<div class="detalhe-item"><span>${m.nome}</span>${m.preco <= 0 ? formatMaterialPrice(m) : `<strong>${formatCurrency(m.preco)}</strong>`}</div>`;
        });
        html += `</div>`;
    }

    html += `<div class="pedido-total"><span>Total</span><strong>${formatCurrency(p.total)}</strong></div>`;

    html += `<div class="detalhe-section"><h4><i class="fas fa-hand-holding-usd"></i> Condição de Pagamento</h4>`;
    if (p.parcial) {
        html += `<div class="detalhe-item"><span>Condição</span><strong>Dividido em 2x (50% + 50%)</strong></div>`;
        html += `<div class="detalhe-item"><span>Entrada agora</span><strong>${formatCurrency(p.total / 2)}</strong></div>`;
        html += `<div class="detalhe-item"><span>Saldo ao finalizar</span><strong>${formatCurrency(p.total / 2)}</strong></div>`;
        html += `<div class="detalhe-item"><span>Já pago</span><strong>${formatCurrency(valorPagoPedido(p))}</strong></div>`;
    } else if (p.descontoPct) {
        html += `<div class="detalhe-item"><span>Condição</span><strong>À vista com ${p.descontoPct}% de desconto</strong></div>`;
        html += `<div class="detalhe-item"><span>Total a pagar</span><strong>${formatCurrency(p.total * (1 - p.descontoPct / 100))}</strong></div>`;
    } else {
        html += `<div class="detalhe-item"><span>Condição</span><strong>Pagamento integral</strong></div>`;
        html += `<div class="detalhe-item"><span>Já pago</span><strong>${formatCurrency(valorPagoPedido(p))}</strong></div>`;
    }
    html += `</div>`;

    document.getElementById('pedidoDetalhesClientContent').innerHTML = html;
    openModal('pedidoDetalhesClientModal');
}

function prepareClientPedidoModal() {
    const servicosDiv = document.getElementById('clientPedidoServicos');
    if (servicosDiv) {
        servicosDiv.innerHTML = (DB.servicos || []).map(s => `<div class="checkbox-item">
            <input type="checkbox" id="cps_${s.id}" value="${s.id}" onchange="updateClientPedidoTotal()">
            <label for="cps_${s.id}">${s.nome}</label>
            <span class="item-price">${formatCurrency(s.preco)}</span>
        </div>`).join('') || '<p class="empty-state">Nenhum serviço disponível no momento.</p>';
    }

    const materiaisDiv = document.getElementById('clientPedidoMateriais');
    if (materiaisDiv) {
        materiaisDiv.innerHTML = (DB.materiais || []).map(m => `<div class="checkbox-item">
            <input type="checkbox" id="cpm_${m.id}" value="${m.id}" onchange="updateClientPedidoTotal()">
            <label for="cpm_${m.id}">${m.nome}</label>
            ${formatMaterialPrice(m, 'item-price')}
        </div>`).join('') || '<p class="empty-state">Nenhum material disponível no momento.</p>';
    }

    const di = document.getElementById('clientPedidoDataInicial');
    if (di) di.value = '';
    const hi = document.getElementById('clientPedidoHoraInicial');
    if (hi) hi.value = '';
    const hf = document.getElementById('clientPedidoHoraFinal');
    if (hf) hf.value = '';
    const audiosInput = document.getElementById('clientPedidoAudios');
    if (audiosInput) audiosInput.value = '';
    const qtdInput = document.getElementById('clientPedidoQtdFaixas');
    if (qtdInput) qtdInput.value = '1';

    const dp = document.getElementById('clientPedidoDataPref');
    const hp = document.getElementById('clientPedidoHoraPref');
    if (dp) dp.value = '';
    if (hp) hp.value = '';

    const nomeEl = document.getElementById('clientResumoNome');
    const emailEl = document.getElementById('clientResumoEmail');
    if (nomeEl && currentUser) {
        nomeEl.textContent = currentUser.nome || 'Cliente';
        if (emailEl) emailEl.textContent = currentUser.email || '';
    }

    const radioVista = document.getElementById('clientCondVista');
    if (radioVista) { radioVista.checked = true; }

    const tarja = document.querySelector('.tarja-funcionamento.tarja-dinamica');
    if (tarja) tarja.classList.remove('tarja-alerta');

    const estudioDiv = document.getElementById('clientResumoEstudio');
    if (estudioDiv) {
        const st = studioDados();
        const nome = st.nome || (APP_CONFIG && APP_CONFIG.appTitle) || 'FPS Studio';
        let txt = `<i class="fas fa-credit-card"></i> Pagamento via PIX de <strong>${nome}</strong>`;
        if (st.pixChave) txt += ` <span title="Chave PIX">(chave: ${st.pixChave})</span>`;
        if (st.telefone || st.email) txt += ` · ${st.telefone || st.email}`;
        estudioDiv.innerHTML = txt;
        estudioDiv.style.display = 'block';
    }

    updateClientPedidoTotal();
}

function valoresPedidoClient() {
    let total = 0;
    document.querySelectorAll('#clientPedidoServicos input:checked').forEach(cb => {
        const s = (DB.servicos || []).find(x => x.id == cb.value);
        if (s) total += Number(s.preco || 0);
    });
    document.querySelectorAll('#clientPedidoMateriais input:checked').forEach(cb => {
        const m = (DB.materiais || []).find(x => x.id == cb.value);
        if (m) total += Number(m.preco || 0);
    });
    const condicao = (document.querySelector('input[name="clientCondicao"]:checked') || {}).value || 'vista';
    return { subTotal: total, condicao };
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function limitAudiosClient(input) {
    if (!input || !input.files) return;
    if (input.files.length > 10) {
        showToast('Você pode anexar no máximo 10 áudios.', 'warning');
        const dt = new DataTransfer();
        for (let i = 0; i < 10; i++) dt.items.add(input.files[i]);
        input.files = dt.files;
    }
    
    if (typeof validateAudioFile === 'function') {
        const validFiles = new DataTransfer();
        for (let i = 0; i < input.files.length; i++) {
            if (validateAudioFile(input.files[i])) {
                validFiles.items.add(input.files[i]);
            }
        }
        input.files = validFiles.files;
    }
}

function atualizarCondicaoClient() {
    updateClientPedidoTotal();
}

function updateClientPedidoTotal() {
    const { subTotal } = valoresPedidoClient();
    const condicao = (document.querySelector('input[name="clientCondicao"]:checked') || {}).value || 'vista';

    const desconto = condicao === 'vista' ? subTotal * 0.10 : 0;
    const totalFinal = subTotal - desconto;
    const entrada = condicao === 'metade' ? subTotal / 2 : totalFinal;
    const saldo = condicao === 'metade' ? subTotal / 2 : 0;

    const elVistaVal = document.getElementById('clientCondVistaValor');
    if (elVistaVal) elVistaVal.textContent = formatCurrency(subTotal * 0.90);
    const elMetaVal = document.getElementById('clientCondMetaValor');
    if (elMetaVal) elMetaVal.textContent = formatCurrency(subTotal / 2);

    const elSub = document.getElementById('clientResSubtotal');
    if (elSub) elSub.textContent = formatCurrency(subTotal);

    const vistaLinha = document.getElementById('clientResVista');
    if (vistaLinha) vistaLinha.style.display = condicao === 'vista' ? 'flex' : 'none';

    const elDesc = document.getElementById('clientResDesconto');
    if (elDesc) elDesc.textContent = '-' + formatCurrency(desconto);

    const elTot = document.getElementById('clientResTotal');
    if (elTot) elTot.textContent = formatCurrency(totalFinal);

    const elRot = document.getElementById('clientResPagarRotulo');
    if (elRot) elRot.textContent = condicao === 'metade' ? 'Entrada (50%) agora' : 'Pagar agora (à vista)';

    const elPag = document.getElementById('clientResPagar');
    if (elPag) elPag.textContent = formatCurrency(entrada);

    const saldoLinha = document.getElementById('clientResSaldoLinha');
    if (saldoLinha) saldoLinha.style.display = condicao === 'metade' ? 'flex' : 'none';

    const elSal = document.getElementById('clientResSaldo');
    if (elSal) elSal.textContent = formatCurrency(saldo);
}

async function salvarPedidoClient() {
    if (!currentUser || currentUser.role !== 'client') {
        showToast('Você precisa estar logado como cliente para enviar um pedido.', 'error');
        return;
    }

    const servicos = [...document.querySelectorAll('#clientPedidoServicos input:checked')].map(cb => parseInt(cb.value) || cb.value);
    const materiais = [...document.querySelectorAll('#clientPedidoMateriais input:checked')].map(cb => parseInt(cb.value) || cb.value);

    if (servicos.length === 0 && materiais.length === 0) {
        showToast('Selecione pelo menos um serviço ou material!', 'error');
        return;
    }

    const dataInicial = (document.getElementById('clientPedidoDataInicial')?.value || '').trim();
    const horaInicial = (document.getElementById('clientPedidoHoraInicial')?.value || '').trim();
    const horaFinal = (document.getElementById('clientPedidoHoraFinal')?.value || '').trim();

    if (horaInicial || horaFinal) {
        if (typeof window.validarHorarioEstudio === 'function' && !window.validarHorarioEstudio(horaInicial, horaFinal)) {
            return;
        }
    }

    const btn = document.querySelector('#novoPedidoClientModal button.btn-primary.btn-full') ||
                document.querySelector('#novoPedidoClientModal button.btn-primary');
    let originalHtml = '';
    if (btn) {
        originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando Pedido...';
    }

    try {
        let total = 0;
        servicos.forEach(id => {
            const s = (DB.servicos || []).find(x => x.id == id);
            if (s) total += Number(s.preco || 0);
        });
        materiais.forEach(id => {
            const m = (DB.materiais || []).find(x => x.id == id);
            if (m) total += Number(m.preco || 0);
        });

        const condicao = (document.querySelector('input[name="clientCondicao"]:checked') || {}).value || 'vista';
        const descontoPct = condicao === 'vista' ? 10 : 0;
        const parcial = condicao === 'metade' ? 1 : 0;
        const valorDesconto = condicao === 'vista' ? (total * 0.10) : 0;

        let pedidoId = (DB.nextId && DB.nextId.pedido) ? DB.nextId.pedido++ : Date.now();

        const novoPedido = {
            id: pedidoId,
            clienteId: currentUser.id,
            servicos,
            materiais,
            desconto: valorDesconto,
            status: 'pendente',
            data: new Date().toISOString().split('T')[0],
            total,
            parcial,
            descontoPct,
            dataInicial,
            horaInicial,
            horaFinal,
            qtdFaixas: parseInt(document.getElementById('clientPedidoQtdFaixas')?.value) || 1,
            audios: []
        };

        // Anexar áudios com proteção de tamanho
        const fileInput = document.getElementById('clientPedidoAudios');
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
            for (let i = 0; i < Math.min(fileInput.files.length, 10); i++) {
                const f = fileInput.files[i];
                if (f.size > 15 * 1024 * 1024) {
                    showToast(`O áudio "${f.name}" ultrapassa 15MB e foi ignorado.`, 'warning');
                    continue;
                }
                try {
                    if (typeof validateAudioFile === 'function' && !validateAudioFile(f)) continue;
                    const prep = await prepararAudioPedido(f);
                    novoPedido.audios.push(prep);
                } catch(e) {
                    console.error('Erro ao ler áudio:', e);
                }
            }
        }

        if (DBReady) {
            try {
                const res = await DB_SERVICE.addPedido(novoPedido);
                if (res && res.id) {
                    novoPedido.id = res.id;
                    novoPedido.docId = res.id;
                } else {
                    novoPedido.docId = novoPedido.id;
                }
            } catch (err) {
                console.error('Erro ao salvar pedido no DB_SERVICE:', err);
                novoPedido.docId = novoPedido.id;
            }
        } else {
            novoPedido.docId = novoPedido.id;
        }

        DB.pedidos.unshift(novoPedido);
        if (DB.nextId) {
            DB.nextId.pedido = Math.max(DB.nextId.pedido || 1, (parseInt(novoPedido.id) || 0) + 1);
        }

        // Enviar notificação de pedido pelo chat para o administrador
        const chatKey = `admin_${currentUser.id}`;
        if (!DB.chats[chatKey]) DB.chats[chatKey] = [];

        const nomesServicos = servicos.map(id => {
            const s = (DB.servicos || []).find(x => x.id == id);
            return s ? s.nome : '';
        }).filter(Boolean);
        const nomesMateriais = materiais.map(id => {
            const m = (DB.materiais || []).find(x => x.id == id);
            return m ? m.nome : '';
        }).filter(Boolean);
        const detalhes = [...nomesServicos, ...nomesMateriais].join(', ');
        const totalFinal = condicao === 'vista' ? (total * 0.90) : total;
        const rotuloCondicao = condicao === 'vista'
            ? `Pagamento à vista (10% de desconto): ${formatCurrency(totalFinal)}`
            : `Dividido em 2x: entrada de ${formatCurrency(total / 2)} agora e ${formatCurrency(total / 2)} ao finalizar`;

        const prefHorario = dataInicial
            ? `Agendamento: ${formatDate(dataInicial)} ${horaInicial || ''}`
            : '';

        const msgData = {
            tipo: 'pedido',
            remetente: 'client',
            clienteId: currentUser.id,
            pedidoId: novoPedido.id,
            mensagem: `Novo pedido #${novoPedido.id} - ${formatCurrency(total)}`,
            descricao: (detalhes || 'Itens selecionados') + ' · ' + rotuloCondicao + (prefHorario ? ' · ' + prefHorario : ''),
            valor: total,
            data: new Date().toISOString(),
            lida: false
        };
        DB.chats[chatKey].push(msgData);
        if (DBReady) {
            try {
                const res = await DB_SERVICE.sendMessage(msgData);
                if (res && res.id) msgData.id = res.id;
            } catch (err) {
                console.error('Erro ao enviar mensagem no chat:', err);
            }
        }

        closeAllModals();
        renderPedidosClient();
        renderClientDashboard();
        showToast('Pedido enviado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao enviar pedido:', error);
        showToast('Erro ao enviar pedido. Tente novamente.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml || '<i class="fas fa-paper-plane"></i> Enviar Pedido';
        }
    }
}

function pixCrc16(str) {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
        crc ^= str.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
        }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

function gerarPixEmv(chave, nome, cidade, valor, txid) {
    const idL = (id, v) => `${id}${String(String(v).length).padStart(2, '0')}${v}`;
    const conta = `0014BR.GOV.BCB.PIX` + `01${String(String(chave).length).padStart(2, '0')}${chave}`;
    let payload = '000201';
    payload += idL('26', conta);
    payload += '52040000' + '5303986';
    if (valor > 0) payload += idL('54', valor.toFixed(2));
    payload += '5802BR';
    payload += idL('59', (nome || 'FPS STUDIO').substring(0, 25));
    payload += idL('60', (cidade || 'BRASIL').substring(0, 15));
    if (txid) payload += idL('62', idL('05', String(txid).substring(0, 25)));
    payload += '6304';
    return payload + pixCrc16(payload);
}

function abrirPagamento(pedidoId) {
    selectedPedidoId = pedidoId;
    const p = DB.pedidos.find(x => x.id === pedidoId);
    if (!p) return;
    if (!currentUser || currentUser.role !== 'client') return;

    const chatKey = `admin_${currentUser.id}`;
    const orc = (DB.chats[chatKey] || []).filter(m => m.tipo === 'orcamento' && m.pedidoId === pedidoId).pop();
    const base = Math.max(0, orc ? ((orc.valor || 0) - (orc.desconto || 0)) : p.total);

    let valorPag = base;
    let condRotulo = 'Pagamento integral';
    let saldo = 0;
    const jaPago = valorPagoPedido(p);

    if (p.parcial) {
        const falta = Math.max(0, base - jaPago);
        if (falta <= 0) {
            showToast('Este pedido já está totalmente pago!', 'info');
            return;
        }
        valorPag = Math.min(base / 2, falta);
        saldo = Math.max(0, base - (jaPago + valorPag));
        condRotulo = jaPago > 0 ? 'Pagamento da 2ª parcela (50%)' : 'Entrada de 50%';
    } else if (p.descontoPct) {
        valorPag = base * (1 - p.descontoPct / 100);
        condRotulo = `Pagamento à vista com ${p.descontoPct}% de desconto`;
    } else {
        valorPag = base;
        condRotulo = 'Pagamento integral';
    }

    selectedPagamentoValor = Math.round(valorPag * 100) / 100;

    let infoHtml = `
        <div class="pedido-total" style="margin-bottom:16px;">
            <span>Pedido #${p.id}</span>
            <strong>${formatCurrency(selectedPagamentoValor)}</strong>
        </div>`;
    if (orc) {
        infoHtml += `<div class="pagamento-linha"><span>Valor orçado (com desconto do admin)</span><strong>${formatCurrency(base)}</strong></div>`;
    }
    infoHtml += `<div class="pagamento-linha"><span>Condição</span><strong>${condRotulo}</strong></div>`;
    if (p.parcial && jaPago > 0) infoHtml += `<div class="pagamento-linha"><span>Já pago</span><strong>${formatCurrency(jaPago)}</strong></div>`;
    if (saldo > 0) infoHtml += `<div class="pagamento-linha"><span>Saldo a pagar depois</span><strong>${formatCurrency(saldo)}</strong></div>`;
    infoHtml += `<p class="field-hint">Envie o comprovante para o administrador confirmar o recebimento.</p>`;
    document.getElementById('pagamentoInfo').innerHTML = infoHtml;

    const st = studioDados();
    const chavePix = st.pixChave || 'fps-studio@fps.com';
    const beneficiario = st.pixBeneficiario || st.nome || 'FPS Studio';
    const cidade = st.cidade || 'SAO PAULO';
    const pixCode = gerarPixEmv(chavePix, beneficiario, cidade, selectedPagamentoValor, `p${p.id}`);
    document.getElementById('pixCopiaCola').textContent = pixCode;

    const pixDados = document.getElementById('pixDadosEstudio');
    if (pixDados) {
        pixDados.innerHTML = st.pixChave
            ? `<div class="pix-dados-item"><span>Beneficiário</span><strong>${beneficiario}</strong></div>
               <div class="pix-dados-item"><span>Chave PIX</span><strong>${st.pixChave}</strong></div>
               <div class="pix-dados-item"><span>Tipo</span><strong>${(st.pixTipo || 'email').toUpperCase()}</strong></div>
               <div class="pix-dados-item"><span>Valor</span><strong>${formatCurrency(selectedPagamentoValor)}</strong></div>`
            : `<div class="pix-dados-aviso"><i class="fas fa-exclamation-triangle"></i> Chave PIX não cadastrada. Cadastre os dados do estúdio em Configurações.</div>`;
    }

    openModal('pagamentoModal');
}

document.querySelectorAll('input[name="pagamentoTipo"]').forEach(radio => {
    radio.addEventListener('change', function() {
        document.getElementById('pixArea').style.display = this.value === 'pix' ? 'block' : 'none';
        document.getElementById('cartaoArea').style.display = this.value === 'cartao_credito' ? 'block' : 'none';
    });
});

function copiarPix() {
    const code = document.getElementById('pixCopiaCola').textContent;
    navigator.clipboard.writeText(code).then(() => {
        showToast('Código PIX copiado!', 'success');
    }).catch(() => {
        showToast('Código PIX: ' + code.substring(0, 30) + '...', 'info');
    });
}

async function confirmarPagamento() {
    if (!selectedPedidoId) return;
    const tipo = document.querySelector('input[name="pagamentoTipo"]:checked').value;
    const p = DB.pedidos.find(x => x.id === selectedPedidoId);
    if (!p) return;

    const fileInput = document.getElementById('pagamentoComprovanteImagem');
    const imagem = fileInput && fileInput.files && fileInput.files[0] ? await processarImagem(fileInput.files[0]) : '';

    const chatKey = `admin_${currentUser.id}`;
    if (!DB.chats[chatKey]) DB.chats[chatKey] = [];

    let rotuloCond = 'Pagamento integral';
    if (p.parcial) rotuloCond = valorPagoPedido(p) > 0 && (selectedPagamentoValor || 0) >= (p.total / 2) ? '2ª parcela (50% restante)' : 'Entrada de 50%';
    else if (p.descontoPct) rotuloCond = `À vista com ${p.descontoPct}% de desconto`;

    const msgData = {
        tipo: 'comprovante',
        remetente: 'client',
        clienteId: currentUser.id,
        mensagem: `Pagamento de ${formatCurrency(selectedPagamentoValor || p.total)} (${rotuloCond}) realizado via ${tipo === 'pix' ? 'PIX' : 'Cartão de Crédito'} para o Pedido #${p.id}`,
        descricao: `Pagamento do Pedido #${p.id} - ${rotuloCond}`,
        valor: selectedPagamentoValor || p.total,
        desconto: 0,
        pedidoId: p.id,
        status: 'aguardando',
        data: new Date().toISOString(),
        lida: false,
        imagem
    };

    DB.chats[chatKey].push(msgData);
    if (DBReady) {
        DB_SERVICE.sendMessage(msgData).then(res => {
            if (res && res.id) msgData.id = res.id;
        });
    }

    closeAllModals();
    renderPedidosClient();
    showToast('Comprovante enviado! Aguardando confirmação do administrador.', 'success');
}

// ============================================
// CHAT - ADMIN
// ============================================
function renderChatList(busca) {
    const chatList = document.getElementById('chatListAdmin');
    if (!chatList) return;

    const termo = (typeof busca === 'string' ? busca : (document.getElementById('buscaChatAdmin')?.value || '')).trim().toLowerCase();

    // Map com todos os clientes cadastrados e quaisquer outros identificados em chats
    const clientesMap = new Map();
    (DB.clientes || []).forEach(c => {
        if (c && c.id !== undefined && c.id !== null) {
            clientesMap.set(String(c.id), c);
        }
    });

    Object.keys(DB.chats || {}).forEach(k => {
        if (k.startsWith('admin_')) {
            const cid = k.replace('admin_', '');
            if (cid && !clientesMap.has(cid)) {
                clientesMap.set(cid, { id: cid, nome: 'Cliente #' + cid, email: '', telefone: '' });
            }
        }
    });

    let lista = Array.from(clientesMap.values());

    if (termo) {
        lista = lista.filter(c => {
            const nome = (c.nome || '').toLowerCase();
            const email = (c.email || '').toLowerCase();
            const tel = (c.telefone || '').toLowerCase();
            const cid = String(c.id);
            return nome.includes(termo) || email.includes(termo) || tel.includes(termo) || cid.includes(termo);
        });
    }

    if (lista.length === 0) {
        chatList.innerHTML = `<div class="empty-state">
            <i class="fas fa-users" style="font-size:32px;margin-bottom:8px;opacity:0.5;"></i>
            <p>${termo ? 'Nenhum cliente encontrado para "' + termo + '"' : 'Nenhum cliente cadastrado ainda'}</p>
        </div>`;
        return;
    }

    // Ordenação: 1. Conversas não lidas primeiro; 2. Mais recente; 3. Alfabética
    lista.sort((a, b) => {
        const keyA = `admin_${a.id}`;
        const keyB = `admin_${b.id}`;
        const msgsA = DB.chats[keyA] || [];
        const msgsB = DB.chats[keyB] || [];
        const unreadA = msgsA.filter(m => m.remetente === 'client' && !m.lida).length;
        const unreadB = msgsB.filter(m => m.remetente === 'client' && !m.lida).length;
        if (unreadA !== unreadB) return unreadB - unreadA;

        const lastA = msgsA[msgsA.length - 1];
        const lastB = msgsB[msgsB.length - 1];
        const timeA = lastA ? new Date(lastA.data).getTime() : 0;
        const timeB = lastB ? new Date(lastB.data).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;

        return (a.nome || '').localeCompare(b.nome || '');
    });

    chatList.innerHTML = lista.map(cliente => {
        const cid = cliente.id;
        const chatKey = `admin_${cid}`;
        const messages = DB.chats[chatKey] || [];
        const unread = messages.filter(m => m.remetente === 'client' && !m.lida).length;
        const lastMsg = messages[messages.length - 1];

        let previewText = 'Toque para conversar';
        let previewIcon = '<i class="fas fa-comment-dots" style="opacity:0.5;"></i>';
        if (lastMsg) {
            if (lastMsg.tipo === 'audio') {
                previewIcon = '<i class="fas fa-music text-primary"></i>';
                previewText = lastMsg.arquivoNome ? `Áudio: ${lastMsg.arquivoNome}` : 'Arquivo de áudio';
            } else if (lastMsg.tipo === 'pedido') {
                previewIcon = '<i class="fas fa-clipboard-list text-warning"></i>';
                previewText = lastMsg.mensagem || 'Novo pedido';
            } else if (lastMsg.tipo === 'orcamento') {
                previewIcon = '<i class="fas fa-file-invoice-dollar text-success"></i>';
                previewText = 'Orçamento enviado';
            } else if (lastMsg.tipo === 'comprovante') {
                previewIcon = '<i class="fas fa-receipt text-info"></i>';
                previewText = 'Comprovante recebido';
            } else {
                previewIcon = lastMsg.remetente === 'admin' ? '<i class="fas fa-reply text-muted"></i> ' : '';
                previewText = lastMsg.mensagem || 'Mensagem';
            }
        }

        const isActive = String(currentChatClient) === String(cid);

        return `<div class="chat-contact ${isActive ? 'active' : ''} ${unread > 0 ? 'unread' : ''}" onclick="openChatAdmin('${cid}')">
            <div class="avatar"><i class="fas fa-user"></i></div>
            <div class="chat-contact-info">
                <div class="chat-contact-top">
                    <h4>${cliente.nome || 'Cliente #' + cid}</h4>
                    <span class="chat-contact-time">${lastMsg ? timeAgo(lastMsg.data) : ''}</span>
                </div>
                <div class="chat-contact-bottom">
                    <p class="chat-contact-preview">${previewIcon} <span>${previewText}</span></p>
                    ${unread > 0 ? `<span class="badge-unread">${unread}</span>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

function openChatAdmin(clienteId) {
    currentChatClient = clienteId;
    const cliente = (DB.clientes || []).find(c => String(c.id) === String(clienteId)) || { id: clienteId, nome: 'Cliente #' + clienteId, email: '', telefone: '' };
    const chatKey = `admin_${clienteId}`;

    if (!DB.chats[chatKey]) DB.chats[chatKey] = [];

    // Marcar mensagens do cliente como lidas ao abrir o chat
    let marcouLida = false;
    DB.chats[chatKey].forEach(m => {
        if (m.remetente === 'client' && !m.lida) {
            m.lida = true;
            marcouLida = true;
        }
    });

    if (marcouLida && DBReady) {
        try {
            DB_SERVICE.updateMessage(null, { lida: 1, clienteId });
        } catch(e) {}
    }

    const header = document.getElementById('chatHeaderAdmin');
    if (header) {
        header.innerHTML = `<div class="chat-user-info">
            <div class="avatar"><i class="fas fa-user"></i></div>
            <div>
                <h4>${cliente.nome || 'Cliente'}</h4>
                <span>${cliente.telefone ? `${cliente.telefone} · ` : ''}${cliente.email || 'Conversa com Cliente'}</span>
            </div>
        </div>`;
    }

    const inputArea = document.getElementById('chatInputAreaAdmin');
    if (inputArea) inputArea.style.display = 'flex';

    renderChatMessagesAdmin(chatKey);
    renderChatList();
    updateChatBadge();
}

function chatImagemHtml(imagem) {
    if (!imagem) return '';
    return `<a href="${imagem}" target="_blank" rel="noopener">
        <img src="${imagem}" class="chat-comprovante-img" alt="Comprovante">
    </a>`;
}

function comprovanteStatusBadge(status) {
    const map = {
        aguardando: ['status-pendente', 'Aguardando'],
        recebido: ['status-em_andamento', 'Recebido'],
        pago: ['status-concluido', 'Pago']
    };
    const [cls, label] = map[status] || map.aguardando;
    return `<span class="status-badge ${cls}">${label}</span>`;
}

function renderChatMessagesAdmin(chatKey) {
    const container = document.getElementById('chatMessagesAdmin');
    const messages = DB.chats[chatKey] || [];

    if (messages.length === 0) {
        container.innerHTML = '<div class="empty-chat"><i class="fas fa-comments"></i><p>Nenhuma mensagem ainda</p></div>';
        return;
    }

    container.innerHTML = messages.map((m, msgIdx) => {
        if (m.tipo === 'sistema') {
            return `<div class="chat-message system">${m.mensagem}</div>`;
        } else if (m.tipo === 'pedido') {
            const pedido = DB.pedidos.find(x => x.id === m.pedidoId);
            return `<div class="chat-message pedido">
                <h4><i class="fas fa-clipboard-list"></i> Pedido do Cliente</h4>
                <p><strong>${m.mensagem}</strong></p>
                ${m.descricao ? `<p>${m.descricao}</p>` : ''}
                <p>Valor do pedido: <strong>${formatCurrency(m.valor || (pedido ? pedido.total : 0))}</strong></p>
                <div class="comprovante-acoes">
                    <button class="btn-primary btn-sm" onclick="abrirOrcamentoParaPedido(${msgIdx})"><i class="fas fa-file-invoice-dollar"></i> Enviar Orçamento</button>
                </div>
                <div class="chat-message-time">${formatDateTime(m.data)}</div>
            </div>`;
        } else if (m.tipo === 'orcamento') {
            const desconto = m.desconto || 0;
            const cond = condicaoOrcamentoDe(m);
            return `<div class="chat-message orcamento">
                <h4><i class="fas fa-file-invoice-dollar"></i> Orçamento</h4>
                <p><strong>${m.descricao}</strong></p>
                <p>Valor: <strong>${formatCurrency(m.valor)}</strong></p>
                ${desconto > 0 ? `<p>Desconto: <strong>-${formatCurrency(desconto)}</strong></p>` : ''}
                ${cond.linhas}
                <p>${cond.rotuloPagar}: <strong>${formatCurrency(cond.totalPagar)}</strong></p>
                <p>Validade: ${m.validade}</p>
                <div class="chat-message-time">${formatDateTime(m.data)}</div>
            </div>`;
        } else if (m.tipo === 'comprovante') {
            const isFromClient = m.remetente === 'client';
            const pedidoLinked = DB.pedidos.find(x => x.id === (m.pedidoId || parseInt((m.mensagem || '').match(/Pedido #(\d+)/)?.[1] || 0)));
            const valorPedido = pedidoLinked ? pedidoLinked.total : (m.valor || 0);
            const desconto = m.desconto || 0;
            const total = Math.max(0, valorPedido - desconto);
            let acoes = '';
            let descontoArea = '';
            if (isFromClient) {
                if (m.status !== 'pago') {
                    descontoArea = `<div class="comprovante-desconto">
                        <label>Desconto (R$)</label>
                        <input type="number" id="descontoComp_${msgIdx}" step="0.01" min="0" value="${desconto}" oninput="atualizarTotalComprovante(${msgIdx})">
                    </div>`;
                    acoes = `<div class="comprovante-acoes">
                        ${m.status !== 'recebido' ? `<button class="btn-secondary btn-sm" onclick="confirmarRecebidoComprovante(${msgIdx})"><i class="fas fa-check"></i> Confirmar Recebido</button>` : ''}
                        <button class="btn-primary btn-sm" onclick="confirmarPagoComprovante(${msgIdx})"><i class="fas fa-check-circle"></i> ${m.status === 'recebido' ? 'Confirmar Pago' : 'Confirmar Pagamento'}</button>
                    </div>`;
                }
            }
            return `<div class="chat-message comprovante">
                <h4><i class="fas fa-receipt"></i> ${isFromClient ? 'Comprovante de Pagamento (Cliente)' : 'Comprovante de Pagamento'}</h4>
                <p>${m.mensagem}</p>
                <p>Valor do Pedido: <strong>${formatCurrency(valorPedido)}</strong></p>
                ${descontoArea}
                ${desconto > 0 ? `<p>Desconto: <strong>-${formatCurrency(desconto)}</strong></p>` : ''}
                ${isFromClient ? `<p>Total a pagar: <strong id="totalComp_${msgIdx}">${formatCurrency(total)}</strong></p>` : ''}
                <p>Status: ${comprovanteStatusBadge(m.status || 'aguardando')}</p>
                ${chatImagemHtml(m.imagem)}
                ${acoes}
                <div class="chat-message-time">${formatDateTime(m.data)}</div>
            </div>`;


        } else if (m.tipo === 'audio') {
            const isSent = m.remetente === 'admin';
            return `<div class="chat-message ${isSent ? 'sent' : 'received'} audio">
                <div class="chat-audio-info"><i class="fas fa-music"></i> ${m.arquivoNome || 'Áudio'}
                    <a class="chat-audio-download" href="${m.audio}" download="${m.arquivoNome || 'audio.mp3'}" title="Baixar"><i class="fas fa-download"></i></a>
                </div>
                <audio controls src="${m.audio}"></audio>
                <div class="chat-message-time">${formatDateTime(m.data)}</div>
            </div>`;
        } else {
            const isSent = m.remetente === 'admin';


            return `<div class="chat-message ${isSent ? 'sent' : 'received'}">
                ${m.mensagem}
                <div class="chat-message-time">${formatDateTime(m.data)}</div>
            </div>`;
        }
    }).join('');

    container.scrollTop = container.scrollHeight;
}

async function sendMessageAdmin() {
    if (!currentChatClient) return;
    const input = document.getElementById('chatInputAdmin');
    const msg = input.value.trim();
    if (!msg) return;

    const chatKey = `admin_${currentChatClient}`;
    if (!DB.chats[chatKey]) DB.chats[chatKey] = [];

    const msgData = {
        tipo: 'mensagem',
        remetente: 'admin',
        clienteId: currentChatClient,
        mensagem: msg,
        data: new Date().toISOString()
    };

    DB.chats[chatKey].push(msgData);

    if (DBReady) {
        const res = await DB_SERVICE.sendMessage(msgData);
        if (res && res.id) msgData.id = res.id;
    }

    input.value = '';
    renderChatMessagesAdmin(chatKey);
    renderChatList();
    updateChatBadge();
}

let orcamentoPedidoId = null;
let orcamentoCondicao = null;

function prepararOrcamentoAvulso() {
    orcamentoPedidoId = null;
    orcamentoCondicao = null;
    document.getElementById('orcamentoPedidoInfo').value = '';
    document.getElementById('orcamentoDescricao').value = '';
    document.getElementById('orcamentoValor').value = '';
    document.getElementById('orcamentoDesconto').value = '0';
    document.getElementById('orcamentoValidade').value = '15 dias';
    atualizarTotalOrcamento();
    openModal('enviarOrcamentoModal');
}

function abrirOrcamentoParaPedido(msgIdx) {
    if (!currentChatClient) return;
    const msgs = DB.chats[`admin_${currentChatClient}`] || [];
    const m = msgs[msgIdx];
    if (!m) return;

    const pedido = DB.pedidos.find(x => x.id === m.pedidoId);
    orcamentoPedidoId = m.pedidoId || null;
    orcamentoCondicao = pedido ? { parcial: !!pedido.parcial, descontoPct: pedido.descontoPct || 0 } : null;

    const nomesServicos = (pedido ? pedido.servicos : []).map(id => { const s = DB.servicos.find(x => x.id === id); return s ? s.nome : ''; }).filter(Boolean);
    const nomesMateriais = (pedido ? pedido.materiais : []).map(id => { const mm = DB.materiais.find(x => x.id === id); return mm ? mm.nome : ''; }).filter(Boolean);

    document.getElementById('orcamentoPedidoInfo').value = pedido ? `#${pedido.id} - ${formatCurrency(pedido.total)}` : '';
    document.getElementById('orcamentoDescricao').value = [...nomesServicos, ...nomesMateriais].join(', ');
    document.getElementById('orcamentoValor').value = pedido ? pedido.total.toFixed(2) : '';
    document.getElementById('orcamentoDesconto').value = '0';
    document.getElementById('orcamentoValidade').value = '15 dias';

    atualizarTotalOrcamento();
    openModal('enviarOrcamentoModal');
}

function atualizarCondicaoOrcamento() {
    const el = document.getElementById('orcamentoCondicaoInfo');
    if (!el) return;
    const valor = parseFloat(document.getElementById('orcamentoValor').value) || 0;
    const desconto = parseFloat(document.getElementById('orcamentoDesconto').value) || 0;
    const base = Math.max(0, valor - desconto);
    const c = orcamentoCondicao;
    let html = '';
    if (!c) {
        html = '<span class="field-hint">Sem condição vinculada — será cobrado o valor integral.</span>';
    } else if (c.parcial) {
        html = `<p class="orc-cond-titulo"><i class="fas fa-sync-alt"></i> Condição escolhida pelo cliente: <strong>Dividido em 2x (50% + 50%)</strong></p>
            <div class="orc-cond-linha"><span>Entrada agora</span><strong>${formatCurrency(base / 2)}</strong></div>
            <div class="orc-cond-linha"><span>Saldo ao finalizar</span><strong>${formatCurrency(base / 2)}</strong></div>`;
    } else if (c.descontoPct) {
        html = `<p class="orc-cond-titulo"><i class="fas fa-hand-holding-usd"></i> Condição escolhida pelo cliente: <strong>À vista com ${c.descontoPct}% de desconto</strong></p>
            <div class="orc-cond-linha"><span>Total à vista</span><strong>${formatCurrency(base * (1 - c.descontoPct / 100))}</strong></div>`;
    }
    el.innerHTML = html;
    el.style.display = c ? 'block' : 'none';
}

function atualizarTotalOrcamento() {
    const valor = parseFloat(document.getElementById('orcamentoValor').value) || 0;
    const desconto = parseFloat(document.getElementById('orcamentoDesconto').value) || 0;
    document.getElementById('orcamentoTotal').textContent = formatCurrency(Math.max(0, valor - desconto));
    atualizarCondicaoOrcamento();
}

async function enviarOrcamento() {
    if (!currentChatClient) return;
    const chatKey = `admin_${currentChatClient}`;
    if (!DB.chats[chatKey]) DB.chats[chatKey] = [];

    const msgData = {
        tipo: 'orcamento',
        remetente: 'admin',
        clienteId: currentChatClient,
        descricao: document.getElementById('orcamentoDescricao').value,
        valor: parseFloat(document.getElementById('orcamentoValor').value) || 0,
        desconto: parseFloat(document.getElementById('orcamentoDesconto').value) || 0,
        pedidoId: orcamentoPedidoId,
        validade: document.getElementById('orcamentoValidade').value || '15 dias',
        parcial: orcamentoCondicao ? (orcamentoCondicao.parcial ? 1 : 0) : 0,
        descontoPct: orcamentoCondicao ? (orcamentoCondicao.descontoPct || 0) : 0,
        data: new Date().toISOString()
    };

    DB.chats[chatKey].push(msgData);
    if (DBReady) {
        const res = await DB_SERVICE.sendMessage(msgData);
        if (res && res.id) msgData.id = res.id;
    }

    orcamentoPedidoId = null;
    orcamentoCondicao = null;
    closeAllModals();
    renderChatMessagesAdmin(chatKey);
    showToast('Orçamento enviado!', 'success');
    clearForm('orcamento');
}

function condicaoOrcamentoDe(m) {
    const base = Math.max(0, (m.valor || 0) - (m.desconto || 0));
    let totalPagar = base;
    let rotuloPagar = 'Total a pagar';
    let linhas = '';
    if (m.parcial) {
        const entrada = base / 2;
        totalPagar = entrada;
        rotuloPagar = 'Entrada (50%) agora';
        linhas = `<p class="orc-cond-titulo"><i class="fas fa-sync-alt"></i> Condição: <strong>Dividido em 2x (50% + 50%)</strong></p>
            <p>Saldo ao finalizar: <strong>${formatCurrency(entrada)}</strong></p>`;
    } else if (m.descontoPct) {
        totalPagar = base * (1 - m.descontoPct / 100);
        rotuloPagar = `Total à vista (-${m.descontoPct}%)`;
        linhas = `<p class="orc-cond-titulo"><i class="fas fa-hand-holding-usd"></i> Condição: <strong>À vista com ${m.descontoPct}% de desconto</strong></p>`;
    }
    return { totalPagar, rotuloPagar, linhas };
}

async function enviarComprovante() {
    if (!currentChatClient) return;
    const chatKey = `admin_${currentChatClient}`;
    if (!DB.chats[chatKey]) DB.chats[chatKey] = [];

    const pedidoId = document.getElementById('comprovantePedido').value;
    const valor = parseFloat(document.getElementById('comprovanteValor').value) || 0;
    const forma = document.getElementById('comprovanteForma').value;
    const data = document.getElementById('comprovanteData').value;

    const fileInput = document.getElementById('comprovanteImagem');
    const imagem = fileInput && fileInput.files && fileInput.files[0] ? await processarImagem(fileInput.files[0]) : '';

    const msgData = {
        tipo: 'comprovante',
        remetente: 'admin',
        clienteId: currentChatClient,
        mensagem: `Pedido #${pedidoId} - Valor: ${formatCurrency(valor)} via ${forma} em ${formatDate(data)}`,
        data: new Date().toISOString(),
        imagem
    };

    DB.chats[chatKey].push(msgData);
    if (DBReady) {
        const res = await DB_SERVICE.sendMessage(msgData);
        if (res && res.id) msgData.id = res.id;
    }

    closeAllModals();
    renderChatMessagesAdmin(chatKey);
    showToast('Comprovante enviado!', 'success');
}

function atualizarTotalComprovante(msgIdx) {
    if (!currentChatClient) return;
    const msgs = DB.chats[`admin_${currentChatClient}`] || [];
    const m = msgs[msgIdx];
    if (!m || m.tipo !== 'comprovante') return;
    const input = document.getElementById(`descontoComp_${msgIdx}`);
    const desconto = input ? (parseFloat(input.value) || 0) : (m.desconto || 0);
    const pedidoLinked = DB.pedidos.find(x => x.id === (m.pedidoId || parseInt((m.mensagem || '').match(/Pedido #(\d+)/)?.[1] || 0)));
    const valorPedido = pedidoLinked ? pedidoLinked.total : (m.valor || 0);
    const el = document.getElementById(`totalComp_${msgIdx}`);
    if (el) el.textContent = formatCurrency(Math.max(0, valorPedido - desconto));
}

async function confirmarRecebidoComprovante(msgIdx) {
    if (!currentChatClient) return;
    const chatKey = `admin_${currentChatClient}`;
    const msgs = DB.chats[chatKey] || [];
    const m = msgs[msgIdx];
    if (!m || m.tipo !== 'comprovante') return;

    m.status = 'recebido';
    m.lida = true;
    if (DBReady && m.id) await DB_SERVICE.updateMessage(m.id, { status: 'recebido' });

    renderChatMessagesAdmin(chatKey);
    updateChatBadge();
    showToast('Comprovante confirmado como recebido!', 'success');
}

async function confirmarPagoComprovante(msgIdx) {
    if (!currentChatClient) return;
    const chatKey = `admin_${currentChatClient}`;
    const msgs = DB.chats[chatKey] || [];
    const m = msgs[msgIdx];
    if (!m || m.tipo !== 'comprovante') return;

    const input = document.getElementById(`descontoComp_${msgIdx}`);
    const descontoAdmin = input ? (parseFloat(input.value) || 0) : (m.desconto || 0);

    m.status = 'pago';
    m.desconto = descontoAdmin;
    m.lida = true;
    if (DBReady && m.id) await DB_SERVICE.updateMessage(m.id, { status: 'pago', desconto: descontoAdmin });

    const pedidoId = m.pedidoId || parseInt((m.mensagem || '').match(/Pedido #(\d+)/)?.[1] || 0);
    const pedido = DB.pedidos.find(x => x.id === pedidoId);
    const totalPago = Math.max(0, (m.valor || (pedido ? pedido.total : 0)) - descontoAdmin);
    const metodoPag = (m.mensagem || '').includes('Cartão') ? 'cartao_credito' : 'pix';

    if (pedido && totalPago > 0) {
        const jaConfirmado = DB.movimentacoes.find(mm => mm.pedidoId === pedido.id && mm.pagamento !== 'pendente');
        if (pedido.parcial && jaConfirmado) {
            const nova = {
                id: (DB.nextId && DB.nextId.movimentacao) ? DB.nextId.movimentacao++ : Date.now(),
                tipo: 'entrada',
                descricao: `Pagamento Pedido #${pedido.id} (2ª parcela)`,
                valor: totalPago,
                categoria: 'servico',
                pagamento: metodoPag,
                data: new Date().toISOString().split('T')[0],
                pedidoId: pedido.id
            };
            DB.movimentacoes.push(nova);
            if (DBReady) DB_SERVICE.addMovimentacao(nova).then(d => { if (d && d.id) nova.docId = d.id; });
        } else {
            const mov = DB.movimentacoes.find(mm => mm.pagamento === 'pendente' && (mm.pedidoId === pedido.id || (mm.descricao || '').includes(`Pedido #${pedido.id}`)));
            if (mov) {
                mov.tipo = 'entrada';
                mov.descricao = `Pagamento Pedido #${pedido.id}`;
                mov.valor = totalPago;
                mov.categoria = mov.categoria || 'servico';
                mov.pagamento = metodoPag;
                mov.pedidoId = pedido.id;
                if (DBReady && mov.docId) await DB_SERVICE.updateMovimentacao(mov.docId, { tipo: mov.tipo, descricao: mov.descricao, valor: mov.valor, categoria: mov.categoria, pagamento: mov.pagamento, data: mov.data });
            } else {
                const nova = {
                    id: (DB.nextId && DB.nextId.movimentacao) ? DB.nextId.movimentacao++ : Date.now(),
                    tipo: 'entrada',
                    descricao: `Pagamento Pedido #${pedido.id}`,
                    valor: totalPago,
                    categoria: 'servico',
                    pagamento: metodoPag,
                    data: new Date().toISOString().split('T')[0],
                    pedidoId: pedido.id
                };
                DB.movimentacoes.push(nova);
                if (DBReady) DB_SERVICE.addMovimentacao(nova).then(d => { if (d && d.id) nova.docId = d.id; });
            }
        }

        pedido.materiais.forEach(mId => {
            const mat = DB.materiais.find(x => x.id === mId);
            
        });

        if (pedido.status === 'pendente') {
            pedido.status = 'em_andamento';
            if (DBReady && pedido.docId) await DB_SERVICE.updatePedido(pedido.docId, { clienteId: pedido.clienteId, servicos: pedido.servicos, materiais: pedido.materiais, desconto: pedido.desconto, status: pedido.status, total: pedido.total, parcial: pedido.parcial || 0, descontoPct: pedido.descontoPct || 0 });
        }
    }

    // Enviar mensagem de confirmação pro cliente com os detalhes do serviço
    if (pedido) {
        const nomesServicos = (pedido.servicos || []).map(id2 => { const s = DB.servicos.find(x => x.id === id2); return s ? s.nome : ''; }).filter(Boolean);
        const nomesMateriais = (pedido.materiais || []).map(id2 => { const mm = DB.materiais.find(x => x.id === id2); return mm ? mm.nome : ''; }).filter(Boolean);
        const detalhes = [...nomesServicos, ...nomesMateriais].join(', ') || 'Serviço solicitado';
        const faltante = pedido.parcial ? Math.max(0, (pedido.total || 0) - valorPagoPedido(pedido)) : 0;
        const confMsg = {
            tipo: 'sistema',
            remetente: 'admin',
            clienteId: currentChatClient,
            mensagem: `Pagamento do Pedido #${pedido.id} confirmado! Detalhes do serviço: ${detalhes}. Valor recebido: ${formatCurrency(Math.max(0, totalPago))}.${faltante > 0 ? ` Falta pagar ${formatCurrency(Math.round(faltante * 100) / 100)} (50% restante).` : ' Status: em andamento.'}`,
            data: new Date().toISOString()
        };
        DB.chats[chatKey].push(confMsg);
        if (DBReady) {
            const res = await DB_SERVICE.sendMessage(confMsg);
            if (res && res.id) confMsg.id = res.id;
        }
    }

    renderChatMessagesAdmin(chatKey);
    renderFinanceiro();
    updateChatBadge();
    celebratePayment();
    showToast('Pagamento confirmado como PAGO!', 'success');
}

function updateChatBadge() {
    if (!currentUser) return;
    if (currentUser.role === 'admin') {
        let count = 0;
        Object.keys(DB.chats).forEach(key => {
            if (key.startsWith('admin_')) {
                const msgs = DB.chats[key];
                const unread = msgs.filter(m => m.remetente === 'client' && !m.lida).length;
                count += unread;
            }
        });
        const b = document.getElementById('chatBadge');
        if (b) { b.textContent = count; b.style.display = count > 0 ? 'block' : 'none'; }
    } else {
        const chatKey = `admin_${currentUser.id}`;
        const msgs = DB.chats[chatKey] || [];
        const unread = msgs.filter(m => m.remetente === 'admin' && !m.lida).length;
        const b = document.getElementById('chatBadgeClient');
        if (b) { b.textContent = unread; b.style.display = unread > 0 ? 'block' : 'none'; }
    }
    atualizarBadgeNotif();
}

// ============================================
// CHAT - CLIENT
// ============================================
function renderClientChat() {
    if (!currentUser || currentUser.role !== 'client') return;
    const chatKey = `admin_${currentUser.id}`;
    if (!DB.chats[chatKey]) DB.chats[chatKey] = [];

    // Mark admin messages as read
    DB.chats[chatKey].forEach(m => {
        if (m.remetente === 'admin') m.lida = true;
    });

    const container = document.getElementById('chatMessagesClient');
    const messages = DB.chats[chatKey];

    if (messages.length === 0) {
        container.innerHTML = `<div class="chat-welcome">
            <i class="fas fa-microphone-alt"></i>
            <h3>FPS Studio</h3>
            <p>Olá! Como podemos ajudá-lo? Envie sua mensagem ou solicite um orçamento.</p>
        </div>`;
        return;
    }

    container.innerHTML = messages.map((m, msgIdx) => {
        if (m.tipo === 'sistema') {
            return `<div class="chat-message system">${m.mensagem}</div>`;
        } else if (m.tipo === 'pedido') {
            return `<div class="chat-message pedido">
                <h4><i class="fas fa-clipboard-list"></i> Pedido Enviado</h4>
                <p><strong>${m.mensagem}</strong></p>
                ${m.descricao ? `<p>${m.descricao}</p>` : ''}
                <div class="chat-message-time">${formatDateTime(m.data)}</div>
            </div>`;
        } else if (m.tipo === 'orcamento') {
            const desconto = m.desconto || 0;
            const cond = condicaoOrcamentoDe(m);
            return `<div class="chat-message orcamento">
                <h4><i class="fas fa-file-invoice-dollar"></i> Orçamento Recebido</h4>
                <p><strong>${m.descricao}</strong></p>
                <p>Valor: <strong>${formatCurrency(m.valor)}</strong></p>
                ${desconto > 0 ? `<p>Desconto: <strong>-${formatCurrency(desconto)}</strong></p>` : ''}
                ${cond.linhas}
                <p>${cond.rotuloPagar}: <strong>${formatCurrency(cond.totalPagar)}</strong></p>
                <p>Validade: ${m.validade}</p>
                ${m.pedidoId ? `<div class="comprovante-acoes">
                    <button class="btn-primary btn-sm" onclick="pagarOrcamento(${msgIdx})"><i class="fas fa-credit-card"></i> Realizar Pagamento</button>
                </div>` : ''}
                <div class="chat-message-time">${formatDateTime(m.data)}</div>
            </div>`;
        } else if (m.tipo === 'comprovante') {
            return `<div class="chat-message comprovante">
                <h4><i class="fas fa-receipt"></i> ${m.remetente === 'client' ? 'Pagamento Enviado' : 'Comprovante'}</h4>
                <p>${m.mensagem}</p>
                ${m.desconto ? `<p>Desconto: <strong>-${formatCurrency(m.desconto)}</strong></p>` : ''}
                <p>Status: ${comprovanteStatusBadge(m.status || 'aguardando')}</p>
                ${chatImagemHtml(m.imagem)}
                <div class="chat-message-time">${formatDateTime(m.data)}</div>
            </div>`;

        } else if (m.tipo === 'audio') {
            const isSent = m.remetente === 'client';
            return `<div class="chat-message ${isSent ? 'sent' : 'received'} audio">
                <div class="chat-audio-info"><i class="fas fa-music"></i> ${m.arquivoNome || 'Áudio'}
                    <a class="chat-audio-download" href="${m.audio}" download="${m.arquivoNome || 'audio.mp3'}" title="Baixar"><i class="fas fa-download"></i></a>
                </div>
                <audio controls src="${m.audio}"></audio>
                <div class="chat-message-time">${formatDateTime(m.data)}</div>
            </div>`;
        } else {
            const isSent = m.remetente === 'client';

            return `<div class="chat-message ${isSent ? 'sent' : 'received'}">
                ${m.mensagem}
                <div class="chat-message-time">${formatDateTime(m.data)}</div>
            </div>`;
        }
    }).join('');

    container.scrollTop = container.scrollHeight;
    updateChatBadge();
}

async function sendAudioChat(remetente, inputElement) {
    if (!inputElement.files || inputElement.files.length === 0) return;

    let clienteId = null;
    if (remetente === 'client') {
        clienteId = currentUser && currentUser.id;
    } else {
        clienteId = currentChatClient;
    }

    if (!clienteId) {
        showToast(remetente === 'client' ? 'Faça login para enviar o áudio.' : 'Selecione uma conversa para enviar o áudio.', 'error');
        return;
    }
    
    for (let i = 0; i < inputElement.files.length; i++) {
        const file = inputElement.files[i];
        if (!file.type.includes('audio') && !file.name.toLowerCase().endsWith('.mp3') && !file.name.toLowerCase().endsWith('.wav')) {
            showToast('Apenas arquivos de áudio são permitidos!', 'error');
            continue;
        }
        
        try {
            if(!validateAudioFile(file)) continue;
            let prep;
            try {
                prep = await prepararAudioPedido(file);
            } catch (err) {
                prep = { base64: await arquivoAudioParaDataUrl(file) };
            }
            const audioSrcVal = prep.url || prep.base64;
            const msgAudio = {
                tipo: 'audio',
                remetente: remetente,
                clienteId: clienteId,
                mensagem: remetente === 'client' ? 'Áudio de referência enviado' : 'Áudio enviado',
                audio: audioSrcVal,
                audioUrl: prep.url || '',
                arquivoNome: file.name,
                data: new Date().toISOString(),
                lida: false
            };

            const chatKey = `admin_${clienteId}`;
            if (!DB.chats[chatKey]) DB.chats[chatKey] = [];
            DB.chats[chatKey].push(msgAudio);

            if (DBReady) await DB_SERVICE.sendMessage(msgAudio);

            // Cliente: anexar também ao pedido recente para aparecer em Áudios de Pedidos
            if (remetente === 'client') {
                const pedidoAtivo = (DB.pedidos || [])
                    .filter(ped => String(ped.clienteId) === String(clienteId))
                    .sort((a,b) => (Number(b.id) || 0) - (Number(a.id) || 0))[0];
                if (pedidoAtivo) {
                    pedidoAtivo.audios = pedidoAtivo.audios || [];
                    pedidoAtivo.audios.push({
                        nome: file.name,
                        base64: prep.base64 || '',
                        url: prep.url || '',
                        tamanho: file.size,
                        tipo: file.type || 'audio/mp3',
                        data: new Date().toISOString(),
                        origem: 'chat'
                    });
                    const updId = pedidoAtivo.docId || pedidoAtivo.id;
                    if (DBReady && updId) {
                        try { await DB_SERVICE.updatePedido(updId, { audios: pedidoAtivo.audios }); } catch (err) { console.error(err); }
                    }
                }
            }
        } catch(e) {
            console.error(e);
            showToast('Erro ao processar áudio.', 'error');
        }
    }
    
    inputElement.value = ''; // clear
    if (remetente === 'client') {
        renderClientChat();
    } else {
        try { renderChatMessagesAdmin(`admin_${clienteId}`); } catch (e) { console.error(e); }
    }
    try { renderChatList(); } catch (e) {}
    if (typeof renderBiblioteca === 'function') renderBiblioteca();
    showToast('Áudio enviado!', 'success');
}

window.sendAudioAdmin = function(inputElement) {
    return sendAudioChat('admin', inputElement);
};

async function sendMessageClient() {
    if (!currentUser || currentUser.role !== 'client') return;
    const input = document.getElementById('chatInputClient');
    const msg = input.value.trim();
    if (!msg) return;

    const chatKey = `admin_${currentUser.id}`;
    if (!DB.chats[chatKey]) DB.chats[chatKey] = [];

    const msgData = {
        tipo: 'mensagem',
        remetente: 'client',
        clienteId: currentUser.id,
        mensagem: msg,
        data: new Date().toISOString(),
        lida: false
    };

    DB.chats[chatKey].push(msgData);

    if (DBReady) {
        const res = await DB_SERVICE.sendMessage(msgData);
        if (res && res.id) msgData.id = res.id;
    }

    input.value = '';
    renderClientChat();
}

function pagarOrcamento(msgIdx) {
    if (!currentUser || currentUser.role !== 'client') return;
    const msgs = DB.chats[`admin_${currentUser.id}`] || [];
    const m = msgs[msgIdx];
    if (!m || m.tipo !== 'orcamento' || !m.pedidoId) return;
    abrirPagamento(m.pedidoId);
}

function prepareClientPagamentoModal() {
    if (!currentUser || currentUser.role !== 'client') return;
    const select = document.getElementById('clientPagamentoPedido');
    const meusPedidos = DB.pedidos.filter(p => p.clienteId === currentUser.id && p.status !== 'cancelado');
    select.innerHTML = meusPedidos.map(p => `<option value="${p.id}">#${p.id} - ${formatCurrency(p.total)}</option>`).join('') || '<option value="">Nenhum pedido</option>';

    document.getElementById('clientPagamentoValor').value = '';
    preencherDestinoPagamento();
    preencherValorPedidoClient();
}

function preencherDestinoPagamento() {
    const el = document.getElementById('pagamentoDestinoInfo');
    if (!el) return;
    const st = studioDados();
    const destNome = st.nome || st.pixBeneficiario || 'FPS Studio';
    let html = `<div class="pag-destino-titulo"><i class="fas fa-paper-plane"></i> Para onde vai o pagamento</div>
        <div class="pag-destino-linha"><span>Destinatário</span><strong>${destNome}</strong></div>`;
    if (st.pixBeneficiario && st.pixBeneficiario !== destNome) html += `<div class="pag-destino-linha"><span>Beneficiário PIX</span><strong>${st.pixBeneficiario}</strong></div>`;
    if (st.email) html += `<div class="pag-destino-linha"><span>E-mail</span><strong>${st.email}</strong></div>`;
    if (st.telefone) html += `<div class="pag-destino-linha"><span>Telefone</span><strong>${st.telefone}</strong></div>`;
    html += `<p class="field-hint">O comprovante será enviado para o estúdio confirmar o recebimento. Anexe o comprovante real do seu aplicativo de banco.</p>`;
    el.innerHTML = html;
}

function preencherValorPedidoClient() {
    const pedidoId = parseInt(document.getElementById('clientPagamentoPedido').value);
    const p = DB.pedidos.find(x => x.id === pedidoId);
    let valor = p ? p.total : 0;
    if (currentUser) {
        const orc = (DB.chats[`admin_${currentUser.id}`] || [])
            .filter(m => m.tipo === 'orcamento' && m.pedidoId === pedidoId).pop();
        if (orc) valor = Math.max(0, (orc.valor || 0) - (orc.desconto || 0));
    }
    document.getElementById('clientPagamentoValor').value = valor ? valor.toFixed(2) : '';
    atualizarTotalPagamentoClient();
}

function atualizarTotalPagamentoClient() {
    const valor = parseFloat(document.getElementById('clientPagamentoValor').value) || 0;
    document.getElementById('clientPagamentoTotal').textContent = formatCurrency(valor);
}

async function enviarPagamentoClient() {
    if (!currentUser || currentUser.role !== 'client') return;
    const pedidoId = parseInt(document.getElementById('clientPagamentoPedido').value);
    const valor = parseFloat(document.getElementById('clientPagamentoValor').value) || 0;

    if (!pedidoId) { showToast('Selecione um pedido!', 'error'); return; }
    if (valor <= 0) { showToast('Informe um valor válido!', 'error'); return; }

    const fileInput = document.getElementById('clientPagamentoImagem');
    const imagem = fileInput && fileInput.files && fileInput.files[0] ? await processarImagem(fileInput.files[0]) : '';

    const chatKey = `admin_${currentUser.id}`;
    if (!DB.chats[chatKey]) DB.chats[chatKey] = [];

    const msgData = {
        tipo: 'comprovante',
        remetente: 'client',
        clienteId: currentUser.id,
        mensagem: `Pedido #${pedidoId} - Valor a pagar: ${formatCurrency(valor)}`,
        descricao: `Pagamento do Pedido #${pedidoId}`,
        valor,
        desconto: 0,
        pedidoId,
        status: 'aguardando',
        data: new Date().toISOString(),
        lida: false,
        imagem
    };

    DB.chats[chatKey].push(msgData);
    if (DBReady) {
        const res = await DB_SERVICE.sendMessage(msgData);
        if (res && res.id) msgData.id = res.id;
    }

    closeAllModals();
    renderClientChat();
    showToast('Pagamento enviado para confirmação!', 'success');
}

// ============================================
// MODALS
// ============================================
function openModal(id) {
    if (id === 'novoPedidoClientModal') {
        const fileInput = document.getElementById('clientPedidoAudios');
        if (fileInput) fileInput.value = '';
        const qtdInput = document.getElementById('clientPedidoQtdFaixas');
        if (qtdInput) qtdInput.value = '1';
    }
    document.getElementById('modalOverlay').classList.add('active');
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    document.getElementById(id).style.display = 'block';

    if (id === 'pedidoModal') preparePedidoModal();
    if (id === 'novoPedidoClientModal') prepareClientPedidoModal();
    if (id === 'movimentacaoModal') {
        document.getElementById('movData').value = new Date().toISOString().split('T')[0];
    }
    if (id === 'comprovanteModal' || id === 'enviarComprovanteModal') {
        const select = document.getElementById('comprovantePedido');
        if (select) {
            select.innerHTML = DB.pedidos.map(p => `<option value="${p.id}">Pedido #${p.id} - ${formatCurrency(p.total)}</option>`).join('');
        }
        document.getElementById('comprovanteData').value = new Date().toISOString().split('T')[0];
    }
    if (id === 'enviarPagamentoClientModal') prepareClientPagamentoModal();
}

function closeAllModals() {
    document.getElementById('modalOverlay').classList.remove('active');
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    clearForm('servico');
    clearForm('material');
    clearForm('pedido');
    clearForm('cliente');
    clearForm('mov');
    clearForm('comprovante');
    clearForm('orcamento');
    document.querySelectorAll('.imagem-preview').forEach(img => { img.src = ''; img.style.display = 'none'; });
}

// ============================================
// UTILITIES & IMAGES
// ============================================
function lerArquivoComoDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function processarImagem(file) {
    if (!file) return '';
    const dataUrl = await lerArquivoComoDataURL(file);
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
    const maxDim = 900;
    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
        const scale = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.82);
}

async function previewImagem(input, previewId) {
    const preview = document.getElementById(previewId);
    if (!input || !input.files || !input.files[0]) {
        if (preview) {
            preview.src = '';
            preview.style.display = 'none';
        }
        return;
    }

    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
        showToast('Selecione apenas arquivos de imagem!', 'error');
        input.value = '';
        return;
    }

    if (file.size > 20 * 1024 * 1024) {
        showToast('Imagem muito grande! Máximo 20MB.', 'error');
        input.value = '';
        return;
    }

    try {
        const base64 = await processarImagem(file);
        input.dataset.base64 = base64;
        if (preview) {
            preview.src = base64;
            preview.style.display = 'block';
        }
        if (previewId === 'servicoImagemPreview') {
            const ph = document.getElementById('servicoImgPreview');
            if (ph) ph.style.display = 'none';
            const btn = document.getElementById('servicoImagemRemoveBtn');
            if (btn) btn.style.display = 'inline-flex';
        } else if (previewId === 'materialImagemPreview') {
            const ph = document.getElementById('materialImgPreview');
            if (ph) ph.style.display = 'none';
            const btn = document.getElementById('materialImagemRemoveBtn');
            if (btn) btn.style.display = 'inline-flex';
        }
    } catch (err) {
        console.error('Erro ao processar imagem:', err);
        const reader = new FileReader();
        reader.onload = function(e) {
            input.dataset.base64 = e.target.result;
            if (preview) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    }
}
window.previewImagem = previewImagem;

function removerImagemServico(e) {
    if (e) e.stopPropagation();
    const input = document.getElementById('servicoImagem');
    const preview = document.getElementById('servicoImagemPreview');
    const placeholder = document.getElementById('servicoImgPreview');
    const removeBtn = document.getElementById('servicoImagemRemoveBtn');
    if (input) { input.value = ''; delete input.dataset.base64; }
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    if (placeholder) { placeholder.style.display = 'block'; }
    if (removeBtn) { removeBtn.style.display = 'none'; }
}
window.removerImagemServico = removerImagemServico;

function removerImagemMaterial(e) {
    if (e) e.stopPropagation();
    const input = document.getElementById('materialImagem');
    const preview = document.getElementById('materialImagemPreview');
    const placeholder = document.getElementById('materialImgPreview');
    const removeBtn = document.getElementById('materialImagemRemoveBtn');
    if (input) { input.value = ''; delete input.dataset.base64; }
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    if (placeholder) { placeholder.style.display = 'block'; }
    if (removeBtn) { removeBtn.style.display = 'none'; }
}
window.removerImagemMaterial = removerImagemMaterial;

function formatCurrency(value) {
    return 'R$ ' + value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function formatPedidoDataHora(p) {
    if (!p.dataInicial) return formatDate(p.data);
    let txt = formatDate(p.dataInicial);
    if (p.horaInicial) txt += ` <span class="hora-pedido">${p.horaInicial}</span>`;
    return txt;
}

function validarDiaFuncionamento(fieldId) {
    const dp = (fieldId && document.getElementById(fieldId)) ||
               document.getElementById('clientPedidoDataInicial') ||
               document.getElementById('pedidoDataInicial') ||
               document.getElementById('clientPedidoDataPref') ||
               document.getElementById('pedidoDataPref');
    if (!dp || !dp.value) return;
    const d = new Date(dp.value + 'T12:00:00');
    const dia = d.getDay();
    const nomes = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const funciona = dia >= 2 && dia <= 5;
    document.querySelectorAll('.tarja-funcionamento.tarja-dinamica').forEach(t => t.classList.toggle('tarja-alerta', !funciona));
    if (!funciona) showToast(`Atenção: o estúdio não funciona em ${nomes[dia]}s — atendemos de terça a sexta.`, 'error');
}
window.validarDiaFuncionamento = validarDiaFuncionamento;

function formatDateTime(isoStr) {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(isoStr) {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'agora';
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

function statusLabel(status) {
    const labels = {
        pendente: 'Pendente',
        em_andamento: 'Em Andamento',
        concluido: 'Concluído',
        cancelado: 'Cancelado'
    };
    return labels[status] || status;
}

function formatMaterialPrice(m, cls = 'item-card-price') {
    return m && m.preco <= 0
        ? '<span class="badge-incluso"><i class="fas fa-gift"></i> INCLUSO</span>'
        : `<span class="${cls}">${formatCurrency(m.preco)}</span>`;
}

function getCategoriaIcon(cat) {
    const icons = {
        microfone: 'fa-microphone',
        fone: 'fa-headphones',
        monitor: 'fa-volume-up',
        interface: 'fa-plug',
        cabo: 'fa-plug',
        acessorio: 'fa-cog',
        outro: 'fa-box'
    };
    return icons[cat] || 'fa-box';
}

function limiteAudioBase64() {
    return usingIDB ? Infinity : AUDIO_BASE64_LIMIT;
}

function limitePayloadAudio() {
    return usingIDB ? Infinity : PAYLOAD_AUDIO_LIMIT;
}

function agoraHora() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

async function arquivoAudioParaDataUrl(file) {
    const arrayBuffer = await lerArquivoComoArrayBuffer(file);
    let dataUrl = '';
    const estimado = Math.ceil(arrayBuffer.byteLength * 4 / 3) + 30;
    const limite = limiteAudioBase64();
    if (estimado <= limite) {
        dataUrl = arrayBufferToDataUrl(arrayBuffer, file.type || 'audio/mpeg');
    } else {
        let kbps = 96;
        while (kbps >= 32) {
            const blob = await comprimirAudio(arrayBuffer, kbps);
            const du = await blobToDataUrl(blob);
            if (du.length <= limite) { dataUrl = du; break; }
            kbps = Math.floor(kbps / 2);
        }
        if (!dataUrl) throw new Error('Audio maior que o limite de envio (~4MB).');
    }
    return dataUrl;
}

async function prepararAudioPedido(file) {
    const b64 = await arquivoAudioParaDataUrl(file);
    const base = {
        nome: file.name,
        tamanho: file.size,
        tipo: file.type || 'audio/mp3',
        data: new Date().toISOString()
    };
    if (usingIDB) return { ...base, base64: b64 };
    if (!b64 || b64.length < 500000) return { ...base, base64: b64 };
    try {
        const up = await DB_SERVICE.uploadAudio({ base64: b64, nome: file.name, tipo: file.type || 'audio/mpeg' });
        if (up && up.url) return { ...base, url: up.url, origem: 'blob' };
    } catch (e) {
        console.warn('upload_audio falhou, mantendo base64:', e);
    }
    return { ...base, base64: b64 };
}

function audioSrc(a) {
    if (!a) return '';
    return a.url || a.base64 || a.audio || '';
}

// [restore b03a43a] arrayBufferToDataUrl
function arrayBufferToDataUrl(buffer, mime) {
    const bytes = new Uint8Array(buffer);
    let bin = '';
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    return `data:${mime};base64,${btoa(bin)}`;
}

// [restore b03a43a] avancarStagePedido
function avancarStagePedido(id) {
    const p = DB.pedidos.find(x => String(x.id) === String(id));
    if (!p) return;
    if (p.status === 'cancelado') { moverPedidoStatus(id, 'pendente'); return; }
    const idx = ordemPedidoStage.indexOf(p.status);
    moverPedidoStatus(id, ordemPedidoStage[Math.min(idx + 1, ordemPedidoStage.length - 1)]);
}

// [restore b03a43a] bindChatAudio
function bindChatAudio(container, messages) {
    _chatAudioObjectUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch(e) {} });
    _chatAudioObjectUrls = [];
    container.querySelectorAll('audio[data-idx]').forEach(a => {
        const m = messages[parseInt(a.dataset.idx)];
        if (m && m.audio) {
            const objUrl = dataUrlToObjectUrl(m.audio);
            if (objUrl) {
                _chatAudioObjectUrls.push(objUrl);
                a.src = objUrl;
            } else {
                a.src = m.audio;
            }
            a.load();
        }
    });
    container.querySelectorAll('a.chat-audio-download[data-idx]').forEach(a => {
        const m = messages[parseInt(a.dataset.idx)];
        if (m && m.audio) {
            a.href = m.audio;
            a.download = m.arquivoNome || 'audio.mp3';
        } else {
            a.style.display = 'none';
        }
    });
}

// [restore b03a43a] blobToDataUrl
function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
    });
}

// [restore b03a43a] chatAudioHtml
function chatAudioHtml(m, msgIdx, isSent) {
    return `<div class="chat-message audio ${isSent ? 'sent' : 'received'}">
        <div class="chat-audio-info">
            <i class="fas fa-file-audio"></i>
            <span>${m.arquivoNome || (isSent ? 'Áudio enviado' : 'Áudio recebido')}</span>
            <a class="chat-audio-download" data-idx="${msgIdx}" title="Baixar áudio" onclick="event.stopPropagation()"><i class="fas fa-download"></i></a>
        </div>
        <audio controls preload="none" data-idx="${msgIdx}"></audio>
        <div class="chat-message-time">${formatDateTime(m.data)}</div>
    </div>`;
}

// [restore b03a43a] chatsDiferentes
function chatsDiferentes(fresh, old) {
    if (fresh.length !== old.length) return true;
    for (let i = 0; i < fresh.length; i++) {
        if (msgSig(fresh[i]) !== msgSig(old[i])) return true;
    }
    return false;
}

// [restore b03a43a] clearRegisterForm
function clearRegisterForm() {
    document.getElementById('regNome').value = '';
    document.getElementById('regEmail').value = '';
    document.getElementById('regTelefone').value = '';
    document.getElementById('regSenha').value = '';
    document.querySelectorAll('.reg-pin').forEach(d => { d.value = ''; d.classList.remove('filled'); });
}

// [restore b03a43a] compactValor
function compactValor(v) {
    if (v >= 1000) return (v / 1000).toFixed(1).replace('.', ',') + 'k';
    return String(Math.round(v));
}

// [restore b03a43a] comprimirAudio
async function comprimirAudio(arrayBuffer, kbps) {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const decoded = await ac.decodeAudioData(arrayBuffer);
    const sr = decoded.sampleRate;
    const encoder = new lamejs.Mp3Encoder(1, sr, kbps);
    const samples = new Int16Array(decoded.length);
    const f32 = decoded.getChannelData(0);
    for (let i = 0; i < decoded.length; i++) samples[i] = Math.max(-32768, Math.min(32767, f32[i] * 32768));
    const chunks = [];
    for (let i = 0; i < decoded.length; i += 1152) {
        const buf = encoder.encodeBuffer(samples.subarray(i, Math.min(i + 1152, decoded.length)));
        if (buf.length) chunks.push(new Uint8Array(buf));
    }
    const end = encoder.flush();
    if (end.length) chunks.push(new Uint8Array(end));
    return new Blob(chunks, { type: 'audio/mpeg' });
}

// [restore b03a43a] confirmarPagamentoPedidoAdmin
async function confirmarPagamentoPedidoAdmin(pedidoId) {
    const p = DB.pedidos.find(x => String(x.id) === String(pedidoId));
    if (!p) return;
    const clienteId = p.clienteId;
    const chatKey = `admin_${clienteId}`;
    const msgs = DB.chats[chatKey] || [];

    const comp = msgs
        .filter(m => m.tipo === 'comprovante' && m.status !== 'pago' && movRefereAoPedido(m, p.id))
        .sort((a, b) => (b.id || 0) - (a.id || 0))[0];

    if (comp) {
        await executarConfirmacaoPagamentoAdmin(comp, chatKey, comp.desconto || 0);
        return;
    }

    const pendentes = DB.movimentacoes.filter(m => m.pagamento === 'pendente' && movRefereAoPedido(m, p.id));
    const restanteAtual = Math.max(0, Math.round((valorEsperadoPedido(p) - valorPagoPedido(p)) * 100) / 100);
    if (restanteAtual <= 0) {
        showToast('Este pedido não possui pendência para confirmar.', 'info');
        return;
    }
    if (pendentes.length === 0) {
        showToast('Nenhum valor pendente registrado para este pedido.', 'info');
        return;
    }
    if (!confirm(`Confirmar recebimento de ${formatCurrency(restanteAtual)} do Pedido #${pedidoId}?`)) return;

    const fake = {
        id: null,
        tipo: 'comprovante',
        remetente: 'client',
        clienteId,
        mensagem: `Pagamento de ${formatCurrency(restanteAtual)} via PIX para o Pedido #${pedidoId}`,
        valor: restanteAtual,
        desconto: 0,
        pedidoId,
        status: 'aguardando',
        data: new Date().toISOString()
    };
    await executarConfirmacaoPagamentoAdmin(fake, chatKey, 0);
}

// [restore b03a43a] dashCores
function dashCores() {
    const cs = getComputedStyle(document.body);
    const texto = cs.getPropertyValue('--dark').trim() || '#2d3436';
    const grid = cs.getPropertyValue('--gray-light').trim() || 'rgba(0,0,0,0.12)';
    return { texto, grid };
}

// [restore b03a43a] dashEmPeriodo
function dashEmPeriodo(data) {
    const f = dashFiltros.periodo;
    if (f === 'todos' || !data) return true;
    const hoje = new Date();
    // Aceita data ISO completa (com T) e data curta (YYYY-MM-DD)
    const d = String(data).indexOf('T') !== -1 ? new Date(data) : new Date(data + 'T00:00:00');
    if (isNaN(d.getTime())) return true;
    if (f === '7') return (hoje - d) / 86400000 <= 7;
    if (f === '30') return (hoje - d) / 86400000 <= 30;
    if (f === 'mes') return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
    if (f === 'ano') return d.getFullYear() === hoje.getFullYear();
    return true;
}

// [restore b03a43a] dashPeriodoLabel
function dashPeriodoLabel() {
    const map = { '7': '7 dias', '30': '30 dias', 'mes': 'este mês', 'ano': 'este ano', 'todos': '' };
    return map[dashFiltros.periodo];
}

// [restore b03a43a] dataUrlToObjectUrl
function dataUrlToObjectUrl(dataUrl) {
    try {
        const comma = dataUrl.indexOf(',');
        if (comma === -1) return null;
        const mime = (dataUrl.slice(0, comma).match(/data:([^;]+)/) || [])[1] || 'audio/mpeg';
        const bin = atob(dataUrl.slice(comma + 1));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return URL.createObjectURL(new Blob([bytes], { type: mime }));
    } catch (e) {
        console.error('Falha ao converter data URL de áudio:', e);
        return null;
    }
}

// [restore b03a43a] dragPedido
function dragPedido(event, id) {
    event.dataTransfer.setData('text/plain', String(id));
    event.dataTransfer.effectAllowed = 'move';
    event.currentTarget.classList.add('dragging');
}

// [restore b03a43a] excluirAudioBiblioteca
async function excluirAudioBiblioteca(id) {
    if (!confirm('Excluir este áudio da biblioteca?')) return;
    const item = DB.bibliotecas.find(x => x.id === id);
    if (!item) return;
    DB.bibliotecas = DB.bibliotecas.filter(x => x.id !== id);
    try {
        if (item.docId || item.id) await DB_SERVICE.deleteBiblioteca(item.docId || item.id);
        showToast('Áudio excluído!', 'success');
    } catch (e) {
        console.error(e);
        showToast('Erro ao excluir o áudio.', 'error');
    }
    renderBibliotecas();
}

// [restore b03a43a] executarConfirmacaoPagamentoAdmin
async function executarConfirmacaoPagamentoAdmin(m, chatKey, descontoAdmin) {
    if (!m || m.tipo !== 'comprovante') return;
    descontoAdmin = Math.max(0, descontoAdmin || 0);

    m.status = 'pago';
    m.desconto = descontoAdmin;
    m.lida = true;

    const pedidoIdRaw = m.pedidoId || parseInt((m.mensagem || '').match(/Pedido #(\d+)/)?.[1] || 0);
    const pedido = DB.pedidos.find(x => String(x.id) === String(pedidoIdRaw));
    const totalPago = Math.max(0, Math.round(((Number(m.valor) || (pedido ? (Number(pedido.total) || 0) : 0)) - descontoAdmin) * 100) / 100);
    const metodoPag = (m.mensagem || '').includes('Cartão') || (m.mensagem || '').includes('cartao') ? 'cartao_credito' : 'pix';

    try {
        if (m.id) await DB_SERVICE.updateMessage(m.id, { status: 'pago', desconto: descontoAdmin });

        if (pedido && totalPago > 0) {
            const jaConfirmado = DB.movimentacoes.find(mm => mm.pedidoId != null && String(mm.pedidoId) === String(pedido.id) && mm.pagamento !== 'pendente');
            if (pedido.parcial && jaConfirmado) {
                const nova = {
                    id: DB.nextId.movimentacao++,
                    tipo: 'entrada',
                    descricao: `Pagamento Pedido #${pedido.id} (2ª parcela)`,
                    valor: totalPago,
                    categoria: 'servico',
                    pagamento: metodoPag,
                    data: new Date().toISOString().split('T')[0],
                    hora: agoraHora(),
                    pedidoId: pedido.id
                };
                DB.movimentacoes.push(nova);
                const docId = await DB_SERVICE.addMovimentacao(nova);
                if (docId && docId.id) nova.docId = docId.id;
            } else {
                const mov = DB.movimentacoes.find(mm => mm.pagamento === 'pendente' && movRefereAoPedido(mm, pedido.id));
                if (mov) {
                    mov.tipo = 'entrada';
                    mov.descricao = `Pagamento Pedido #${pedido.id}`;
                    mov.valor = totalPago;
                    mov.categoria = mov.categoria || 'servico';
                    mov.pagamento = metodoPag;
                    mov.pedidoId = pedido.id;
                    if (mov.docId) await DB_SERVICE.updateMovimentacao(mov.docId, { tipo: mov.tipo, descricao: mov.descricao, valor: mov.valor, categoria: mov.categoria, pagamento: mov.pagamento, data: mov.data, hora: mov.hora || '', pedidoId: mov.pedidoId });
                } else {
                    const nova = {
                        id: DB.nextId.movimentacao++,
                        tipo: 'entrada',
                        descricao: `Pagamento Pedido #${pedido.id}`,
                        valor: totalPago,
                        categoria: 'servico',
                        pagamento: metodoPag,
                        data: new Date().toISOString().split('T')[0],
                        hora: agoraHora(),
                        pedidoId: pedido.id
                    };
                    DB.movimentacoes.push(nova);
                    const docId = await DB_SERVICE.addMovimentacao(nova);
                    if (docId && docId.id) nova.docId = docId.id;
                }
            }

            pedido.materiais.forEach(mId => {
                const mat = DB.materiais.find(x => x.id === mId);
            });

            // Normaliza o "a receber": mantém apenas o saldo realmente pendente
            const esperado = valorEsperadoPedido(pedido);
            const pagoAte = valorPagoPedido(pedido);
            const restante = Math.max(0, Math.round((esperado - pagoAte) * 100) / 100);
            const pendentes = DB.movimentacoes.filter(mm => mm.pagamento === 'pendente' && movRefereAoPedido(mm, pedido.id));
            if (restante > 0) {
                const pend = pendentes[pendentes.length - 1];
                if (pend) {
                    pend.valor = restante;
                    if (pend.docId) await DB_SERVICE.updateMovimentacao(pend.docId, { tipo: pend.tipo, descricao: pend.descricao, valor: pend.valor, categoria: pend.categoria, pagamento: pend.pagamento, data: pend.data, hora: pend.hora || '', pedidoId: pend.pedidoId });
                } else {
                    const nova = {
                        id: DB.nextId.movimentacao++,
                        tipo: 'entrada',
                        descricao: `Pedido #${pedido.id}`,
                        valor: restante,
                        categoria: 'servico',
                        pagamento: 'pendente',
                        data: new Date().toISOString().split('T')[0],
                        hora: agoraHora(),
                        pedidoId: pedido.id
                    };
                    DB.movimentacoes.push(nova);
                    const docId = await DB_SERVICE.addMovimentacao(nova);
                    if (docId && docId.id) nova.docId = docId.id;
                }
            } else {
                for (const pend of pendentes) {
                    DB.movimentacoes = DB.movimentacoes.filter(mm => mm.id !== pend.id);
                    if (pend.docId) await DB_SERVICE.deleteMovimentacao(pend.docId);
                }
            }

            if (pedido.status === 'pendente') {
                pedido.status = 'em_andamento';
                if (pedido.docId) await DB_SERVICE.updatePedido(pedido.docId, { clienteId: pedido.clienteId, servicos: pedido.servicos, materiais: pedido.materiais, desconto: pedido.desconto, status: pedido.status, total: pedido.total, parcial: pedido.parcial || 0, descontoPct: pedido.descontoPct || 0 });
            }
        }
    } catch (e) {
        console.error(e);
        m.status = 'aguardando';
        try { renderChatMessagesAdmin(chatKey); } catch (e2) {}
        try { renderChatList(); } catch (e2) {}
        try { renderFinanceiro(); } catch (e2) {}
        try { renderAdminDashboard(); } catch (e2) {}
        try { updateChatBadge(); } catch (e2) {}
        showToast('Erro ao confirmar pagamento. Verifique sua conexão e tente novamente.', 'error');
        return;
    }

    // Enviar mensagem de confirmação pro cliente com os detalhes do serviço
    if (pedido) {
        const nomesServicos = (pedido.servicos || []).map(id2 => { const s = DB.servicos.find(x => String(x.id) === String(id2)); return s ? s.nome : ''; }).filter(Boolean);
        const nomesMateriais = (pedido.materiais || []).map(id2 => { const mm = DB.materiais.find(x => String(x.id) === String(id2)); return mm ? mm.nome : ''; }).filter(Boolean);
        const detalhes = [...nomesServicos, ...nomesMateriais].join(', ') || 'Serviço solicitado';
        const faltante = pedido ? Math.max(0, Math.round((valorEsperadoPedido(pedido) - valorPagoPedido(pedido)) * 100) / 100) : 0;
        const confMsg = {
            tipo: 'sistema',
            remetente: 'admin',
            clienteId: m.clienteId,
            mensagem: `Pagamento do Pedido #${pedido.id} confirmado! Detalhes do serviço: ${detalhes}. Valor recebido: ${formatCurrency(Math.max(0, totalPago))}.${faltante > 0 ? ` Falta pagar ${formatCurrency(faltante)} (50% restante).` : ' Status: em andamento.'}`,
            data: new Date().toISOString()
        };
        if (!DB.chats[chatKey]) DB.chats[chatKey] = [];
        DB.chats[chatKey].push(confMsg);
        try {
            const res = await DB_SERVICE.sendMessage(confMsg);
            if (res && res.id) confMsg.id = res.id;
        } catch (e) {
            console.error(e);
            const idx = DB.chats[chatKey].indexOf(confMsg);
            if (idx > -1) DB.chats[chatKey].splice(idx, 1);
        }
    }

    try {
        if (currentChatClient != null && String(currentChatClient) === String(m.clienteId)) renderChatMessagesAdmin(chatKey);
        try { renderChatList(); } catch (e) {}
        try { renderFinanceiro(); } catch (e) {}
        try { renderAdminDashboard(); } catch (e) {}
        updateChatBadge();
        celebratePayment();
        showToast('Pagamento confirmado como PAGO!', 'success');
    } catch (e) {
        console.error('pós-confirmação:', e);
        try { renderFinanceiro(); } catch (e2) {}
        try { renderAdminDashboard(); } catch (e2) {}
        try { renderChatList(); } catch (e2) {}
        updateChatBadge();
        celebratePayment();
        showToast('Pagamento confirmado como PAGO!', 'success');
    }
}

// [restore b03a43a] formatDataHoraMov
function formatDataHoraMov(m) {
    const d = formatDate(m.data);
    const h = m.hora || '';
    return d + (h ? ' <span class="hora-pedido">' + h + '</span>' : '');
}

// [restore b03a43a] formatValorBR
function formatValorBR(num) {
    return (isFinite(num) ? num : parseValorBR(num)).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// [restore b03a43a] htmlResumoServicosCliente
function htmlResumoServicosCliente(clienteId) {
    const pedidos = DB.pedidos.filter(p => String(p.clienteId) === String(clienteId) && p.status !== 'cancelado');
    const itens = new Map();
    pedidos.forEach(p => {
        (p.servicos || []).forEach(sId => {
            const s = DB.servicos.find(x => String(x.id) === String(sId));
            if (!s || Number(s.preco) <= 0) return;
            const chave = `s_${sId}`;
            const item = itens.get(chave) || { tipo: 'Serviço', nome: s.nome, preco: Number(s.preco) || 0, qtd: 0, sub: 0 };
            item.qtd++;
            item.sub += Number(s.preco) || 0;
            itens.set(chave, item);
        });
        (p.materiais || []).forEach(mId => {
            const m = DB.materiais.find(x => String(x.id) === String(mId));
            if (!m || Number(m.preco) <= 0) return;
            const chave = `m_${mId}`;
            const item = itens.get(chave) || { tipo: 'Material', nome: m.nome, preco: Number(m.preco) || 0, qtd: 0, sub: 0 };
            item.qtd++;
            item.sub += Number(m.preco) || 0;
            itens.set(chave, item);
        });
    });

    if (itens.size === 0) return '';

    const linhas = [...itens.values()].map(item => `<tr>
        <td>${item.tipo}</td>
        <td style="white-space:normal;">${item.nome}</td>
        <td>${item.qtd}</td>
        <td>${formatCurrency(item.preco)}</td>
        <td class="valor-pago"><strong>${formatCurrency(item.sub)}</strong></td>
    </tr>`).join('');

    const somatoria = [...itens.values()].reduce((s, i) => s + i.sub, 0);

    return `<div class="sub-secao-titulo"><i class="fas fa-chart-pie"></i> Detalhes por Serviço / Material</div>
        <table class="data-table sub-table">
            <thead><tr><th>Tipo</th><th>Item</th><th>Qtde</th><th>Valor unit.</th><th>Subtotal</th></tr></thead>
            <tbody>${linhas}</tbody>
            <tfoot>
                <tr>
                    <td colspan="4"><strong>Somatória</strong></td>
                    <td class="valor-total"><strong>${formatCurrency(somatoria)}</strong></td>
                </tr>
            </tfoot>
        </table>`;
}

// [restore b03a43a] initApp
async function initApp() {
    try {
        const ok = await DB_SERVICE.init();
        if (ok) {
            // Carrega todos os dados do SQLite via API
            DB.servicos = await DB_SERVICE.getServicos();
            DB.materiais = await DB_SERVICE.getMateriais();
            DB.clientes = await DB_SERVICE.getClientes();
            DB.pedidos = await DB_SERVICE.getPedidos();
            DB.movimentacoes = await DB_SERVICE.getMovimentacoes();
            DB.bibliotecas = await DB_SERVICE.getBiblioteca();

            // Normaliza docId = id (o id do servidor é o mesmo do cliente)
            ['servicos', 'materiais', 'clientes', 'pedidos', 'movimentacoes', 'biblioteca'].forEach(tabela => {
                DB[tabela].forEach(r => { r.docId = r.id; });
            });

            // Calcular nextIds
            if (DB.servicos.length) DB.nextId.servico = Math.max(...DB.servicos.map(s => s.id)) + 1;
            if (DB.materiais.length) DB.nextId.material = Math.max(...DB.materiais.map(m => m.id)) + 1;
            if (DB.clientes.length) DB.nextId.cliente = Math.max(...DB.clientes.map(c => c.id)) + 1;
            if (DB.pedidos.length) DB.nextId.pedido = Math.max(...DB.pedidos.map(p => p.id)) + 1;
            if (DB.movimentacoes.length) DB.nextId.movimentacao = Math.max(...DB.movimentacoes.map(m => m.id)) + 1;
            if (DB.bibliotecas.length) DB.nextId.biblioteca = Math.max(...DB.bibliotecas.map(b => b.id)) + 1;

            // Carregar chats
            for (const c of DB.clientes) {
                try {
                    DB.chats[`admin_${c.id}`] = await DB_SERVICE.getChat(c.id);
                } catch(e) {}
            }

            DBReady = true;
            console.log('SQLite conectado!');
            setInterval(() => { if (document.visibilityState === 'visible') salvarAutoBackupLocal(); }, 60000);
            setInterval(refreshChatsLive, 5000);
            await restaurarAutoBackupLocal();
        }
    } catch (err) {
        console.warn('API SQLite offline. Modo local ativo.', err);
        DBReady = false;
    }

    await carregarConfig();

    setupDragDrop();
    document.getElementById('movData').value = new Date().toISOString().split('T')[0];
    updateChatBadge();
    restaurarSessao();
}

// [restore b03a43a] lerArquivoComoArrayBuffer
function lerArquivoComoArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
    });
}

// [restore b03a43a] lerArquivoComoDataURL
function lerArquivoComoDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// [restore b03a43a] limparSessao
function limparSessao() {
    localStorage.removeItem('fps_session');
}

// [restore b03a43a] mergeChats
function mergeChats(fresh, old) {
    const byId = new Map();
    (fresh || []).forEach(m => { if (m.id != null) byId.set(m.id, m); });
    const merged = (old || []).map(lm => {
        if (lm.id != null && byId.has(lm.id)) {
            const fm = byId.get(lm.id);
            byId.delete(lm.id);
            return fm;
        }
        return lm;
    });
    byId.forEach(fm => merged.push(fm));
    merged.sort((a, b) => {
        const ta = normChatData(a.data), tb = normChatData(b.data);
        if (ta !== tb) return ta - tb;
        return (a.id || 0) - (b.id || 0);
    });
    return merged;
}

// [restore b03a43a] metodoPagamentoRotulo
function metodoPagamentoRotulo(pagamento) {
    if (pagamento === 'cartao_credito') return 'Cartão';
    if (pagamento === 'pix') return 'PIX';
    if (pagamento === 'pendente') return 'Pendente';
    return (pagamento || '').charAt(0).toUpperCase() + (pagamento || '').slice(1);
}

// [restore b03a43a] moverPedidoStatus
async function moverPedidoStatus(id, novoStatus) {
    const p = DB.pedidos.find(x => String(x.id) === String(id));
    if (!p || p.status === novoStatus) return;
    p.status = novoStatus;
    if (DBReady) {
        try {
            await DB_SERVICE.updatePedido(p.docId, { clienteId: p.clienteId, servicos: p.servicos, materiais: p.materiais, desconto: p.desconto, status: novoStatus, total: p.total, parcial: p.parcial || 0, descontoPct: p.descontoPct || 0 });
        } catch (e) { console.error('updatePedido status', e); }
    }
    const mov = DB.movimentacoes.find(m => m.pedidoId != null && String(m.pedidoId) === String(id) && m.pagamento === 'pendente');
    if (novoStatus === 'cancelado' && mov) {
        DB.movimentacoes = DB.movimentacoes.filter(m => m.id !== mov.id);
        if (DBReady && mov.docId) await DB_SERVICE.deleteMovimentacao(mov.docId);
    }
    await sincronizarFinanceiroPedido(p);
    renderPedidosAdmin();
    renderAdminDashboard();
    renderFinanceiro();
    showToast(`Pedido #${id} movido para ${statusLabel(novoStatus)}`, 'success');
}

// [restore b03a43a] msgSig
function msgSig(m) {
    return m.id + '|' + (m.tipo || '') + '|' + (m.mensagem || '').slice(0, 80) + '|' + (m.status || '') + '|' + (m.lida ? 1 : 0) + '|' + (m.audio ? 1 : 0) + '|' + (m.arquivoNome || '');
}

// [restore b03a43a] nomeClienteDoPedido
function nomeClienteDoPedido(pedidoId) {
    const p = DB.pedidos.find(x => String(x.id) === String(pedidoId));
    if (!p) return '';
    const c = DB.clientes.find(x => x.id === p.clienteId);
    return c ? c.nome : '';
}

// [restore b03a43a] normChatData
function normChatData(d) {
    if (!d) return 0;
    const t = Date.parse(d);
    if (!isNaN(t)) return t;
    const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    return 0;
}

// [restore b03a43a] pagamentosPedidoResumo
function pagamentosPedidoResumo(p) {
    const pagamentos = DB.movimentacoes
        .filter(m => m.tipo === 'entrada' && m.pagamento !== 'pendente' && movRefereAoPedido(m, p.id))
        .sort((a, b) => (a.data || '').localeCompare(b.data || '') || (a.id || 0) - (b.id || 0));
    if (pagamentos.length === 0) {
        const temPendente = DB.movimentacoes.some(m => m.pagamento === 'pendente' && movRefereAoPedido(m, p.id));
        return temPendente
            ? '<span class="pag-badge pag-pend"><i class="fas fa-hourglass-half"></i> Aguardando pagamento</span>'
            : '<span class="pag-badge">Sem pagamento</span>';
    }
    return pagamentos.map((m, i) => {
        const icon = m.pagamento === 'cartao_credito' ? 'fa-credit-card' : 'fa-qrcode';
        const parcela = pagamentos.length > 1 ? ` · ${i + 1}ª parcela` : '';
        return `<div class="pag-linha"><span class="pag-metodo"><i class="fas ${icon}"></i> ${metodoPagamentoRotulo(m.pagamento)}${parcela}</span> ${formatCurrency(m.valor)} <small>${formatDate(m.data)}</small></div>`;
    }).join('');
}

// [restore b03a43a] parseDataChat
function parseDataChat(isoStr) {
    if (!isoStr) return null;
    let s = String(isoStr).trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) s = s.replace(' ', 'T') + 'Z';
    const t = Date.parse(s);
    return isNaN(t) ? null : new Date(t);
}

// [restore b03a43a] parseValorBR
function parseValorBR(str) {
    if (str === null || str === undefined) return 0;
    if (typeof str === 'number') return isFinite(str) ? str : 0;
    const s = String(str).trim().replace(/R\$\s?/gi, '').replace(/\s/g, '');
    if (!s) return 0;
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    let normalized;
    if (lastComma > lastDot) {
        normalized = s.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma) {
        normalized = s.replace(/,/g, '');
    } else {
        normalized = s;
    }
    const n = parseFloat(normalized);
    return isNaN(n) ? 0 : n;
}

// [restore b03a43a] pedidoKanbanCard
function pedidoKanbanCard(p) {
    const cliente = DB.clientes.find(c => String(c.id) === String(p.clienteId));
    const servicoNomes = (p.servicos || []).map(id => DB.servicos.find(s => String(s.id) === String(id))?.nome || '').filter(Boolean);
    const mostrar = servicoNomes.slice(0, 2);
    const extra = servicoNomes.length - mostrar.length;
    const pagos = valorPagoPedido(p) > 0;
    const pagoTotal = pedidoPagamentoCompleto(p);
    const restoPed = Math.max(0, Math.round((valorEsperadoPedido(p) - valorPagoPedido(p)) * 100) / 100);
    const condRotulo = p.parcial ? 'Dividido 50%+50%' : (p.descontoPct ? `À vista -${p.descontoPct}%` : '');
    const qtdAudios = (p.audios || []).length;
    return `<div class="kanban-card" draggable="true" ondragstart="dragPedido(event, ${p.id})" ondragend="this.classList.remove('dragging')">
        <div class="kanban-card-top">
            <strong>#${p.id}</strong>
            ${qtdAudios ? `<span class="kanban-chip" title="${qtdAudios} MP3(s)"><i class="fas fa-music"></i> ${qtdAudios}</span>` : ''}
            ${pagoTotal
                ? '<span class="kanban-pagamento pag-ok"><i class="fas fa-check-circle"></i> Pago</span>'
                : pagos
                    ? '<span class="kanban-pagamento pag-parc"><i class="fas fa-adjust"></i> Parcial</span>'
                    : '<span class="kanban-pagamento pag-pend"><i class="fas fa-hourglass"></i> Aguardando</span>'}
        </div>
        ${condRotulo ? `<span class="kanban-chip chip-cond">${condRotulo}</span>` : ''}
        <h5 class="kanban-cliente"><i class="fas fa-user-circle"></i> ${cliente ? cliente.nome : 'N/A'}</h5>
        <div class="kanban-servicos">
            ${servicoNomes.length === 0 ? '<span class="kanban-chip chip-material">Materiais</span>' : mostrar.map(n => `<span class="kanban-chip">${n}</span>`).join('')}
            ${extra > 0 ? `<span class="kanban-chip">+${extra}</span>` : ''}
        </div>
        <div class="kanban-card-bottom">
            <strong class="kanban-total">${formatCurrency(valorEsperadoPedido(p))}</strong>
            <span class="kanban-data">${formatPedidoDataHora(p)}</span>
        </div>
        <div class="kanban-card-acoes">
            ${restoPed > 0 && p.status !== 'cancelado' ? `<button title="Confirmar pagamento" onclick="confirmarPagamentoPedidoAdmin('${p.id}')"><i class="fas fa-check-circle"></i></button>` : ''}
            <button title="Ver detalhes" onclick="verDetalhesPedido('${p.id}')"><i class="fas fa-eye"></i></button>
            <button title="Avançar etapa" onclick="avancarStagePedido('${p.id}')"><i class="fas fa-forward"></i></button>
            <button title="Editar" onclick="editarPedido('${p.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn-del" title="Excluir" onclick="excluirPedido('${p.id}')"><i class="fas fa-trash"></i></button>
        </div>
    </div>`;
}

// [restore b03a43a] pedidoPagamentoCompleto
function pedidoPagamentoCompleto(p) {
    return valorPagoPedido(p) >= valorEsperadoPedido(p);
}

// [restore b03a43a] refreshChatsLive
async function refreshChatsLive() {
    if (!DBReady || !currentUser) return;
    try {
        if (currentUser.role === 'admin') {
            DB.chats = DB.chats || {};
            (DB.clientes || []).forEach(c => {
                const k = `admin_${c.id}`;
                if (!DB.chats[k]) DB.chats[k] = [];
            });
            const keys = Object.keys(DB.chats).filter(k => k.startsWith('admin_'));
            for (const key of keys) {
                const clienteId = key.replace('admin_', '');
                if (!clienteId) continue;
                try {
                    const fresh = await DB_SERVICE.getChat(clienteId);
                    const old = DB.chats[key] || [];
                    const merged = mergeChats(fresh, old);
                    if (chatsDiferentes(merged, old)) {
                        DB.chats[key] = merged;
                        if (currentChatClient != null && String(currentChatClient) === String(clienteId)) renderChatMessagesAdmin(key);
                    }
                } catch (e) {}
            }
            try { renderChatList(); } catch (e) {}
            try { updateChatBadge(); } catch (e) {}
        } else {
            const key = `admin_${currentUser.id}`;
            const fresh = await DB_SERVICE.getChat(currentUser.id);
            const old = DB.chats[key] || [];
            const merged = mergeChats(fresh, old);
            if (chatsDiferentes(merged, old)) {
                DB.chats[key] = merged;
                renderClientChat();
            }
        }
    } catch (e) {}
}

// [restore b03a43a] renderCurrentPage
function renderCurrentPage(page) {
    switch(page) {
        case 'adminHome': renderAdminDashboard(); break;
        case 'adminServicos': renderServicosAdmin(); break;
        case 'adminMateriais': renderMateriaisAdmin(); break;
        case 'adminPedidos': renderPedidosAdmin(); break;
        case 'adminFinanceiro': renderFinanceiro(); break;
        case 'adminChat': renderChatList(); break;
        case 'adminBiblioteca': renderBiblioteca(); break;
        case 'adminBibliotecas': renderBibliotecas(); break;
        case 'adminClientes': renderClientes(); break;
        case 'adminConfig': preencherFormConfig(); break;
        case 'clientHome': renderClientDashboard(); break;
        case 'clientServicos': renderServicosClient(); break;
        case 'clientMateriais': renderMateriaisClient(); break;
        case 'clientPedidos': renderPedidosClient(); break;
        case 'clientChat': renderClientChat(); break;
    }
}

// [restore b03a43a] renderKanbanPedidos
function renderKanbanPedidos(pedidos) {
    const cols = [
        { status: 'pendente', rotulo: 'Pendente', icone: 'fa-hourglass-half', cor: '#fdcb6e' },
        { status: 'em_andamento', rotulo: 'Em Andamento', icone: 'fa-spinner', cor: '#6c5ce7' },
        { status: 'concluido', rotulo: 'Concluído', icone: 'fa-check-circle', cor: '#00b894' },
        { status: 'cancelado', rotulo: 'Cancelado', icone: 'fa-ban', cor: '#d63031' }
    ];
    const board = document.getElementById('kanbanPedidos');
    if (!board) return;
    board.innerHTML = cols.map(col => {
        const itens = pedidos.filter(p => p.status === col.status);
        return `<div class="kanban-col" data-status="${col.status}"
            ondragover="event.preventDefault(); this.classList.add('kanban-over')"
            ondragleave="this.classList.remove('kanban-over')"
            ondrop="soltarPedidoKanban(event, '${col.status}')">
            <div class="kanban-col-header">
                <span class="kanban-titulo"><i class="fas ${col.icone}" style="color:${col.cor}"></i> ${col.rotulo}</span>
                <span class="kanban-count">${itens.length}</span>
            </div>
            <div class="kanban-col-body">
                ${itens.length ? itens.map(p => pedidoKanbanCard(p)).join('') : '<p class="kanban-vazio">Nenhum pedido</p>'}
            </div>
        </div>`;
    }).join('');
}

// [restore b03a43a] renderMateriaisAdmin
function renderMateriaisAdmin() {
    const container = document.getElementById('listaMateriaisAdmin');
    container.innerHTML = DB.materiais.map(m => `<div class="item-card">
        <div class="item-card-image">
            ${m.imagem ? `<img src="${m.imagem}" alt="${m.nome}">` : `<div class="placeholder-icon"><i class="fas ${getCategoriaIcon(m.categoria)}"></i><span>${capitalize(m.categoria)}</span></div>`}
        </div>
        <div class="item-card-body">
            <h4>${m.nome}</h4>
            <p>${m.descricao}</p>
            <div class="item-card-meta">
                ${formatMaterialPrice(m)}
                <span class="item-card-badge badge-estoque"><i class="fas fa-tag"></i> ${m.categoria || 'outro'}</span>
            </div>
        </div>
        <div class="item-card-actions">
            <button class="btn-secondary btn-sm" onclick="editarMaterial(${m.id})"><i class="fas fa-edit"></i> Editar</button>
            <button class="btn-danger btn-sm" onclick="excluirMaterial(${m.id})"><i class="fas fa-trash"></i> Excluir</button>
        </div>
    </div>`).join('');
}

// [restore b03a43a] renderServicosAdmin
function renderServicosAdmin() {
    const container = document.getElementById('listaServicosAdmin');
    container.innerHTML = DB.servicos.map(s => `<div class="item-card">
        <div class="item-card-image">
            ${s.imagem ? `<img src="${s.imagem}" alt="${s.nome}">` : `<div class="placeholder-icon"><i class="fas ${s.icone}"></i><span>${s.duracao}</span></div>`}
        </div>
        <div class="item-card-body">
            <h4>${s.nome}</h4>
            <small class="item-card-categoria"><i class="fas fa-tag"></i> ${s.categoria || 'outro'}</small>
            <p>${s.descricao}</p>
            <div class="item-card-meta">
                <span class="item-card-price">${formatCurrency(s.preco)}</span>
                <span class="item-card-badge badge-estoque">${s.duracao}</span>
            </div>
        </div>
        <div class="item-card-actions">
            <button class="btn-secondary btn-sm" onclick="editarServico(${s.id})"><i class="fas fa-edit"></i> Editar</button>
            <button class="btn-danger btn-sm" onclick="excluirServico(${s.id})"><i class="fas fa-trash"></i> Excluir</button>
        </div>
    </div>`).join('');
}

// [restore b03a43a] restaurarAutoBackupLocal
async function restaurarAutoBackupLocal() {
    if (!DBReady) return;
    try {
        const raw = localStorage.getItem('fps_autobackup');
        if (!raw) return;
        const b = JSON.parse(raw);
        if (!b || b.tipo !== 'fps-studio-backup') return;
        const temDados = (b.servicos && b.servicos.length) || (b.clientes && b.clientes.length) || (b.pedidos && b.pedidos.length);
        const servidorVazio = DB.servicos.length === 0 && DB.clientes.length === 0 && DB.pedidos.length === 0;
        if (!temDados || !servidorVazio) return;
        await DB_SERVICE.importBackup(b);
        location.reload();
    } catch (e) {}
}

// [restore b03a43a] restaurarSessao
function restaurarSessao() {
    const saved = localStorage.getItem('fps_session');
    if (!saved) return;
    try {
        const user = JSON.parse(saved);
        if (!user || !user.role) return;
        if (user.role === 'cliente') user.role = 'client';
        if (user.role === 'client') {
            const cliente = DB.clientes.find(c => c.id === user.id);
            if (!cliente) { limparSessao(); return; }
            currentUser = { role: 'client', ...cliente };
            showDashboard('client');
            document.getElementById('clientNameDisplay').textContent = cliente.nome;
            atualizarAvisoPerfil();
        } else {
            currentUser = { role: 'admin', nome: 'Administrador' };
            showDashboard('admin');
        }
    } catch (e) {
        limparSessao();
    }
}

// [restore b03a43a] salvarAutoBackupLocal
function salvarAutoBackupLocal() {
    if (!DBReady) return;
    DB_SERVICE.exportBackup().then(dados => {
        try {
            localStorage.setItem('fps_autobackup', JSON.stringify(Object.assign({}, dados, { salvoEm: new Date().toISOString() })));
        } catch (e) {}
    }).catch(() => {});
}

// [restore b03a43a] showDashboard
function showDashboard(role) {
    document.getElementById('loginScreen').classList.remove('active');
    if (role === 'admin') {
        document.getElementById('adminDashboard').classList.add('active');
        renderAdminDashboard();
    } else {
        document.getElementById('clientDashboard').classList.add('active');
        renderClientDashboard();
    }
}

// [restore b03a43a] soltarPedidoKanban
async function soltarPedidoKanban(event, status) {
    event.preventDefault();
    event.currentTarget.classList.remove('kanban-over');
    const id = event.dataTransfer.getData('text/plain');
    if (id) await moverPedidoStatus(id, status);
}

// [restore b03a43a] toggleClienteDetalhe
function toggleClienteDetalhe(id) {
    const key = String(id);
    if (clientesExpandidos.has(key)) {
        clientesExpandidos.delete(key);
    } else {
        clientesExpandidos.add(key);
    }
    renderClientes();
}

// Detalhe expandido do cliente: perfil, somatório geral dos pedidos,
// movimentações consolidadas e blocos por pedido.
function htmlDetalheCliente(c) {
    if (!c) return '';
    const id = c.id;
    const pedidos = (DB.pedidos || []).filter(p => String(p.clienteId) === String(id));
    const ativos = pedidos.filter(p => p.status !== 'cancelado');
    const cancelados = pedidos.filter(p => p.status === 'cancelado');
    const pendentes = pedidos.filter(p => p.status === 'pendente');
    const emAndamento = pedidos.filter(p => p.status === 'em_andamento');
    const concluidos = pedidos.filter(p => p.status === 'concluido');
    const totalGasto = ativos.reduce((s, p) => s + valorEsperadoPedido(p), 0);
    const totalPago = ativos.reduce((s, p) => s + valorPagoPedido(p), 0);
    const totalCancelado = cancelados.reduce((s, p) => s + valorEsperadoPedido(p), 0);
    const emAberto = Math.max(0, Math.round((totalGasto - totalPago) * 100) / 100);

    const tipoRot = c.tipoPessoa === 'juridica' ? 'Pessoa Jurídica' : 'Pessoa Física';
    const docPrincipal = c.tipoPessoa === 'juridica' ? (c.cnpj || '') : (c.cpf || '');
    const perfilHtml = `
        <div class="cliente-perfil-topo">
            <div class="cliente-perfil-avatar"><i class="fas ${c.tipoPessoa === 'juridica' ? 'fa-building' : 'fa-user'}"></i></div>
            <div class="cliente-perfil-info">
                <div class="cliente-perfil-nome">${c.nome} ${c.tipoPessoa === 'juridica' ? '<span class="cond-badge">PJ</span>' : (docPrincipal ? '<span class="cond-badge">PF</span>' : '')}</div>
                <div class="cliente-perfil-linha">
                    <span><i class="fas fa-tag"></i> ${tipoRot}</span>
                    ${docPrincipal ? `<span><i class="fas ${c.tipoPessoa === 'juridica' ? 'fa-building' : 'fa-id-card'}"></i> ${docPrincipal}</span>` : '<span class="sem-dado"><i class="fas fa-id-card"></i> Sem CPF/CNPJ</span>'}
                </div>
                <div class="cliente-perfil-linha">
                    <span><i class="fas fa-envelope"></i> ${c.email || '-'}</span>
                    ${c.telefone ? `<span><i class="fas fa-phone"></i> ${c.telefone}</span>` : ''}
                    ${c.instagram ? `<span><i class="fab fa-instagram"></i> ${c.instagram}</span>` : ''}
                </div>
                ${(c.endereco || c.cidade) ? `<div class="cliente-perfil-linha"><span><i class="fas fa-map-marker-alt"></i> ${[c.endereco, c.numero, c.complemento, c.bairro, c.cep, c.cidade, c.estado].filter(Boolean).join(', ')}</span></div>` : ''}
            </div>
        </div>`;

    // --- Somatório geral dos pedidos ---
    const somatorioHtml = `
        <div class="sub-secao-titulo"><i class="fas fa-calculator"></i> Somatório Geral dos Pedidos</div>
        <div class="cliente-resumo">
            <div class="resumo-card"><span>Pedidos</span><strong>${pedidos.length}</strong></div>
            <div class="resumo-card"><span>Total Ativos</span><strong>${formatCurrency(totalGasto)}</strong></div>
            <div class="resumo-card resumo-pago"><span>Pago</span><strong>${formatCurrency(totalPago)}</strong></div>
            <div class="resumo-card resumo-aberto"><span>Em Aberto</span><strong>${formatCurrency(emAberto)}</strong></div>
            ${cancelados.length ? `<div class="resumo-card"><span>Cancelados</span><strong>${formatCurrency(totalCancelado)}</strong></div>` : ''}
        </div>
        <table class="data-table sub-table" style="margin-top:8px;">
            <thead><tr>
                <th>Situação</th><th>Qtd</th><th>Total Esperado</th><th>Total Pago</th><th>Em Aberto</th>
            </tr></thead>
            <tbody>
                ${[
                    { rot: 'Pendente', lista: pendentes },
                    { rot: 'Em Andamento', lista: emAndamento },
                    { rot: 'Concluído', lista: concluidos },
                    { rot: 'Cancelado', lista: cancelados }
                ].filter(g => g.lista.length).map(g => {
                    const esp = g.lista.reduce((s, p) => s + valorEsperadoPedido(p), 0);
                    const pag = g.lista.reduce((s, p) => s + valorPagoPedido(p), 0);
                    const ab = g.rot === 'Cancelado' ? 0 : Math.max(0, Math.round((esp - pag) * 100) / 100);
                    return `<tr${g.rot === 'Cancelado' ? ' style="opacity:0.7;"' : ''}>
                        <td>${g.rot}</td>
                        <td>${g.lista.length}</td>
                        <td>${formatCurrency(esp)}</td>
                        <td class="valor-pago">${formatCurrency(pag)}</td>
                        <td class="${ab > 0 ? 'valor-aberto' : ''}">${formatCurrency(ab)}</td>
                    </tr>`;
                }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">Nenhum pedido</td></tr>'}
            </tbody>
            <tfoot>
                <tr>
                    <td><strong>Geral (ativos)</strong></td>
                    <td><strong>${ativos.length}</strong></td>
                    <td class="valor-total"><strong>${formatCurrency(totalGasto)}</strong></td>
                    <td class="valor-pago"><strong>${formatCurrency(totalPago)}</strong></td>
                    <td class="${emAberto > 0 ? 'valor-aberto' : 'valor-pago'}"><strong>${formatCurrency(emAberto)}</strong></td>
                </tr>
            </tfoot>
        </table>`;

    // --- Movimentações consolidadas do cliente (todos os pedidos) ---
    const pedidoIds = pedidos.map(p => p.id);
    const movsCliente = (DB.movimentacoes || []).filter(m => {
        if (m.pedidoId != null && pedidoIds.some(pid => String(pid) === String(m.pedidoId))) return true;
        return pedidoIds.some(pid => movRefereAoPedido(m, pid));
    });
    const compsChat = ((DB.chats && DB.chats[`admin_${id}`]) || [])
        .filter(m => m.tipo === 'comprovante' && m.status !== 'pago')
        .map(m => ({
            ...m,
            orig: 'chat',
            tipo: 'entrada',
            valor: m.valor || 0,
            _pedidoRef: m.pedidoId
        }));
    const movTodas = [...movsCliente, ...compsChat].sort((a, b) => {
        const da = a.data || '', db_ = b.data || '';
        return da.localeCompare(db_) || String(a.id || 0).localeCompare(String(b.id || 0));
    });

    const movConsolidadaRows = movTodas.length === 0
        ? `<tr><td colspan="7" style="padding:10px;text-align:center;color:var(--text-muted);font-size:12px;">Nenhuma movimentação registrada para este cliente.</td></tr>`
        : movTodas.map(m => {
            const isChat = m.orig === 'chat';
            const isPendente = isChat || m.pagamento === 'pendente';
            const icon = m.pagamento === 'cartao_credito' ? 'fa-credit-card' : m.pagamento === 'pix' ? 'fa-qrcode' : 'fa-hourglass-half';
            let metodoHtml;
            if (isChat) {
                const temCartao = !!(m.mensagem || '').includes('Cartão');
                metodoHtml = `<i class="fas ${temCartao ? 'fa-credit-card' : 'fa-receipt'}"></i> Comprovante ${temCartao ? '(Cartão)' : '(PIX)'}`;
            } else {
                const parcela = (m.descricao || '').includes('(2ª parcela)') ? ' <span class="pag-cond">2ª parcela</span>' : '';
                metodoHtml = `<i class="fas ${icon}"></i> ${isPendente ? '<em>Aguardando</em>' : metodoPagamentoRotulo(m.pagamento)}${parcela}`;
            }
            const dataHora = isChat ? formatDateTime(m.data) : formatDataHoraMov(m);
            const pid = m.pedidoId != null ? m.pedidoId : (m._pedidoRef != null ? m._pedidoRef : ((m.descricao || '').match(/Pedido #(\d+)/) || [])[1]);
            const descricao = m.descricao || (isChat ? 'Comprovante de pagamento' : '-');
            return `<tr class="${isPendente ? 'mov-pendente' : ''}">
                <td>${dataHora}</td>
                <td>${pid != null ? `<strong>#${pid}</strong>` : '-'}</td>
                <td style="white-space:normal;">${descricao}</td>
                <td>${metodoHtml}</td>
                <td class="${m.tipo === 'saida' ? 'valor-aberto' : 'valor-pago'}"><strong>${m.tipo === 'saida' ? '-' : '+'}${formatCurrency(m.valor)}</strong></td>
                <td><span class="status-badge status-${isPendente ? 'pendente' : 'concluido'}">${isPendente ? 'Aguardando' : 'Confirmado'}</span></td>
                <td>${capitalize(m.categoria || 'servico')}</td>
            </tr>`;
        }).join('');

    const entradasConf = movsCliente.filter(m => m.tipo === 'entrada' && m.pagamento !== 'pendente').reduce((s, m) => s + (Number(m.valor) || 0), 0);
    const entradasPend = movsCliente.filter(m => m.tipo === 'entrada' && m.pagamento === 'pendente').reduce((s, m) => s + (Number(m.valor) || 0), 0);
    const saidasConf = movsCliente.filter(m => m.tipo === 'saida').reduce((s, m) => s + (Number(m.valor) || 0), 0);
    const compsAguardando = compsChat.reduce((s, m) => s + (Number(m.valor) || 0), 0);

    const movConsolidadaHtml = `
        <div class="sub-secao-titulo"><i class="fas fa-exchange-alt"></i> Movimentações do Cliente</div>
        <table class="data-table sub-table" style="margin-top:6px;">
            <thead><tr>
                <th>Data / Hora</th><th>Pedido</th><th>Descrição</th><th>Pagamento</th><th>Valor</th><th>Situação</th><th>Categoria</th>
            </tr></thead>
            <tbody>${movConsolidadaRows}</tbody>
            <tfoot>
                <tr>
                    <td colspan="4"><strong>Entradas confirmadas</strong></td>
                    <td class="valor-pago" colspan="3"><strong>${formatCurrency(entradasConf)}</strong></td>
                </tr>
                <tr>
                    <td colspan="4">Entradas pendentes${compsAguardando > 0 ? ` (+ ${formatCurrency(compsAguardando)} em comprovantes)` : ''}</td>
                    <td class="valor-aberto" colspan="3">${formatCurrency(Math.round((entradasPend + compsAguardando) * 100) / 100)}</td>
                </tr>
                <tr>
                    <td colspan="4">Saídas</td>
                    <td class="valor-aberto" colspan="3">-${formatCurrency(saidasConf)}</td>
                </tr>
                <tr>
                    <td colspan="4"><strong>Saldo líquido (confirmado)</strong></td>
                    <td class="valor-total" colspan="3"><strong>${formatCurrency(Math.round((entradasConf - saidasConf) * 100) / 100)}</strong></td>
                </tr>
            </tfoot>
        </table>`;

    // --- Blocos por pedido (detalhe de movimentação de cada pedido) ---
    const pedidosHtml = pedidos.length === 0
        ? '<p class="empty-state">Este cliente ainda não possui pedidos.</p>'
        : pedidos.map(p => {
            const itens = [
                ...(p.servicos || []).map(sid => DB.servicos.find(s => String(s.id) === String(sid))?.nome).filter(Boolean),
                ...(p.materiais || []).map(mid => DB.materiais.find(m => String(m.id) === String(mid))?.nome).filter(Boolean)
            ];
            const esperado = valorEsperadoPedido(p);
            const pago = valorPagoPedido(p);
            const restante = Math.max(0, Math.round((esperado - pago) * 100) / 100);
            const cond = p.parcial
                ? '<span class="pag-cond">50% + 50%</span>'
                : (p.descontoPct ? `<span class="pag-cond">-${p.descontoPct}% à vista</span>` : '<span class="pag-cond">Integral</span>');

            const movs = (DB.movimentacoes || []).filter(m => movRefereAoPedido(m, p.id));
            const compsPendentes = ((DB.chats && DB.chats[`admin_${id}`]) || [])
                .filter(m => m.tipo === 'comprovante' && m.status === 'aguardando' && movRefereAoPedido(m, p.id))
                .map(m => ({ ...m, orig: 'chat', tipo: 'entrada', valor: m.valor || 0, categoria: m.categoria || 'servico' }));
            const todos = [...movs, ...compsPendentes].sort((a, b) => {
                const da = a.data || '', db_ = b.data || '';
                return da.localeCompare(db_) || String(a.id || 0).localeCompare(String(b.id || 0));
            });

            const movRows = todos.length === 0
                ? `<tr><td colspan="5" style="padding:8px 12px;font-size:12px;color:var(--text-muted);text-align:center;">Nenhum movimento registrado</td></tr>`
                : todos.map(m => {
                    const isChat = m.orig === 'chat';
                    const isPendente = isChat || m.pagamento === 'pendente';
                    const icon = m.pagamento === 'cartao_credito' ? 'fa-credit-card' : m.pagamento === 'pix' ? 'fa-qrcode' : 'fa-hourglass-half';
                    let metodoHtml;
                    if (isChat) {
                        const temCartao = !!(m.mensagem || '').includes('Cartão');
                        metodoHtml = `<i class="fas ${temCartao ? 'fa-credit-card' : 'fa-receipt'}"></i> Comprovante ${temCartao ? '(Cartão)' : '(PIX)'}`;
                    } else {
                        const parcela = (m.descricao || '').includes('(2ª parcela)') ? ' <span class="pag-cond">2ª parcela</span>' : '';
                        metodoHtml = `<i class="fas ${icon}"></i> ${isPendente ? '<em>Aguardando</em>' : metodoPagamentoRotulo(m.pagamento)}${parcela}`;
                    }
                    const dataHora = isChat ? formatDateTime(m.data) : formatDataHoraMov(m);
                    return `<tr class="${isPendente ? 'mov-pendente' : ''}">
                        <td>${dataHora}</td>
                        <td>${m.descricao || (isChat ? 'Comprovante de pagamento' : '-')}</td>
                        <td>${metodoHtml}</td>
                        <td class="${m.tipo === 'entrada' ? 'valor-pago' : 'valor-aberto'}"><strong>${m.tipo === 'entrada' ? '+' : '-'}${formatCurrency(m.valor)}</strong></td>
                        <td><span class="status-badge status-${isPendente ? 'pendente' : 'concluido'}">${isPendente ? 'Aguardando' : 'Confirmado'}</span></td>
                    </tr>`;
                }).join('');

            const somaConfirmado = movs.filter(m => m.tipo === 'entrada' && m.pagamento !== 'pendente').reduce((s, m) => s + (Number(m.valor) || 0), 0);
            const somaPendente = Math.max(0, Math.round((esperado - somaConfirmado) * 100) / 100);

            const horaAgend = p.horaInicial ? `${p.horaInicial}${p.horaFinal ? ' &rarr; ' + p.horaFinal : ''}` : '';
            const dataAgend = p.dataInicial ? `<span style="font-size:11px;color:var(--text-muted);"><i class="fas fa-calendar-alt"></i> ${formatDate(p.dataInicial)} ${horaAgend}</span>` : '';
            const qtdAudios = (p.audios || []).length;
            return `<div class="cliente-pedido-bloco">
                <div class="cliente-pedido-header">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <strong style="font-size:14px;">Pedido #${p.id}</strong>
                        <span class="status-badge status-${p.status}">${statusLabel(p.status)}</span>
                        ${cond} ${dataAgend}
                        ${qtdAudios ? `<span class="badge badge-info" title="${qtdAudios} MP3(s)"><i class="fas fa-music"></i> ${qtdAudios}</span>` : ''}
                    </div>
                    <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:13px;">
                        <span style="color:var(--text-muted);">${itens.join(', ') || '-'}</span>
                        <span>Total: <strong>${formatCurrency(esperado)}</strong></span>
                        <span class="valor-pago">Pago: <strong>${formatCurrency(pago)}</strong></span>
                        ${restante > 0 ? `<span class="valor-aberto">Falta: <strong>${formatCurrency(restante)}</strong></span>` : `<span style="color:#26cc00;"><i class="fas fa-check-circle"></i> Quitado</span>`}
                        ${restante > 0 && p.status !== 'cancelado' ? `<button class="btn-primary btn-sm" onclick="confirmarPagamentoPedidoAdmin('${p.id}')"><i class="fas fa-check-circle"></i> Confirmar Pagamento</button>` : ''}
                        <button class="btn-secondary btn-sm" onclick="verDetalhesPedido('${p.id}')"><i class="fas fa-eye"></i> Detalhes</button>
                    </div>
                </div>
                <table class="data-table sub-table" style="margin:0;">
                    <thead><tr>
                        <th>Data / Hora</th><th>Descrição</th><th>Pagamento</th><th>Valor</th><th>Situação</th>
                    </tr></thead>
                    <tbody>${movRows}</tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2"><strong>Totais</strong></td>
                            <td class="${somaPendente > 0 ? 'valor-aberto' : 'valor-pago'}">${somaPendente > 0 ? `<span>Aguardando: <strong>${formatCurrency(somaPendente)}</strong></span>` : '<span>Sem pendência</span>'}</td>
                            <td class="valor-pago"><strong>Confirmado: ${formatCurrency(somaConfirmado)}</strong></td>
                            <td class="${restante > 0 ? 'valor-aberto' : 'valor-pago'}"><strong>${restante > 0 ? 'Falta ' + formatCurrency(restante) : 'Quitado'}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>`;
        }).join('');

    return `<div class="cliente-detalhe-content">
        ${perfilHtml}
        ${somatorioHtml}
        ${htmlResumoServicosCliente(id)}
        ${movConsolidadaHtml}
        <div class="sub-secao-titulo"><i class="fas fa-clipboard-list"></i> Pedidos e Movimentações por Pedido</div>
        ${pedidosHtml}
    </div>`;
}

// [restore b03a43a] valorEsperadoPedido
function valorEsperadoPedido(p) {
    if (!p) return 0;
    const total = Number(p.total) || 0;
    if (!p.parcial && p.descontoPct) return Math.max(0, Math.round(total * (1 - p.descontoPct / 100) * 100) / 100);
    return total;
}

// [restore b03a43a] verDetalhesPedido
function verDetalhesPedido(id) {
    const p = DB.pedidos.find(x => String(x.id) === String(id));
    if (!p) return;
    const cliente = DB.clientes.find(c => String(c.id) === String(p.clienteId));
    const servicos = (p.servicos || []).map(id => DB.servicos.find(s => String(s.id) === String(id))).filter(Boolean);
    const materiais = (p.materiais || []).map(id => DB.materiais.find(m => String(m.id) === String(id))).filter(Boolean);

    let html = `
        <div class="detalhe-section">
            <h4><i class="fas fa-user"></i> Cliente</h4>
            <div class="detalhe-item"><span>${cliente ? cliente.nome : 'N/A'}</span></div>
        </div>
        <div class="detalhe-section">
            <h4><i class="fas fa-info-circle"></i> Informações</h4>
            <div class="detalhe-item"><span>Pedido</span><strong>#${p.id}</strong></div>
            <div class="detalhe-item"><span>Criado em</span><span>${formatDate(p.data)}</span></div>
            ${p.dataInicial ? `<div class="detalhe-item"><span>Início</span><strong>${formatDate(p.dataInicial)} ${p.horaInicial || ''}${p.horaFinal ? ` &rarr; ${p.horaFinal}` : ''}</strong></div>` : ''}
            <div class="detalhe-item"><span>Status</span><span class="status-badge status-${p.status}">${statusLabel(p.status)}</span></div>
        </div>`;

    // Seção de Áudios / MP3s do pedido (recebidos do cliente)
    const audios = p.audios || [];
    const qtdF = Number(p.qtdFaixas) || 1;
    html += `<div class="detalhe-section">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <h4><i class="fas fa-music"></i> Áudios / MP3s (${audios.length} de ${qtdF} faixas)</h4>
            <button class="btn-primary btn-sm" onclick="abrirUploadAudioAdmin('${p.id}')">
                <i class="fas fa-upload"></i> Upload
            </button>
        </div>`;
    if (audios.length > 0) {
        html += `<div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">`;
        audios.forEach((a, idx) => {
            const src = audioSrc(a);
            const nome = a.nome || 'audio.mp3';
            html += `
            <div style="display:flex; align-items:center; gap:10px; background:var(--bg-lighter, #f1f2f6); padding:8px 12px; border-radius:6px;">
                <i class="fas fa-file-audio" style="color:var(--primary-color, #6c5ce7); font-size:20px;"></i>
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:600; font-size:13px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;" title="${nome}">${nome}${a.origem === 'chat' ? ' <small style="color:var(--text-muted);">(chat)</small>' : ''}</div>
                    <audio controls src="${src}" style="height:28px; width:100%; margin-top:4px;"></audio>
                </div>
                <a href="${src}" download="${nome}" class="btn-icon" title="Baixar"><i class="fas fa-download"></i></a>
                <button class="btn-icon text-danger" onclick="excluirAudioPedido('${p.id}', ${idx})" title="Excluir"><i class="fas fa-trash"></i></button>
            </div>`;
        });
        html += `</div>`;
    } else {
        html += `<p style="color:var(--text-muted); font-size:13px; margin-bottom:10px;">Nenhum MP3 recebido deste pedido ainda.</p>`;
    }
    html += `</div>`;

    if (servicos.length) {
        html += `<div class="detalhe-section"><h4><i class="fas fa-concierge-bell"></i> Serviços</h4>`;
        servicos.forEach(s => {
            html += `<div class="detalhe-item"><span>${s.nome}</span><strong>${formatCurrency(s.preco)}</strong></div>`;
        });
        html += `</div>`;
    }

    if (materiais.length) {
        html += `<div class="detalhe-section"><h4><i class="fas fa-boxes"></i> Materiais</h4>`;
        materiais.forEach(m => {
            html += `<div class="detalhe-item"><span>${m.nome}</span>${m.preco <= 0 ? formatMaterialPrice(m) : `<strong>${formatCurrency(m.preco)}</strong>`}</div>`;
        });
        html += `</div>`;
    }

    if (p.desconto > 0) {
        html += `<div class="detalhe-section"><div class="detalhe-item"><span>Desconto</span><span style="color:var(--danger)">-${formatCurrency(p.desconto)}</span></div></div>`;
    }

    html += `<div class="pedido-total"><span>Total do Pedido</span><strong>${formatCurrency(valorEsperadoPedido(p))}</strong></div>`;

    document.getElementById('detalhesPedidoContent').innerHTML = html;
    openModal('detalhesPedidoModal');
}

// [restore b03a43a] visualizarImagem
function visualizarImagem(src) {
    const img = document.getElementById('lightboxImg');
    if (img && src) img.src = src;
    document.getElementById('lightboxOverlay').classList.add('active');
}

function studioDados() {
    const cfg = APP_CONFIG || CONFIG_DEFAULT;
    return Object.assign({}, CONFIG_DEFAULT.studio, (cfg.studio && typeof cfg.studio === 'object' ? cfg.studio : {}));
}

function fmtValorBR(n) {
    return (Number(n) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function valorPagoPedido(p) {
    if (!p) return 0;
    return DB.movimentacoes
        .filter(m => m.tipo === 'entrada' && m.pagamento !== 'pendente' && movRefereAoPedido(m, p.id))
        .reduce((s, m) => s + (Number(m.valor) || 0), 0);
}

function movRefereAoPedido(m, pedidoId) {
    if (!m || pedidoId === null || pedidoId === undefined || pedidoId === '') return false;
    const id = String(pedidoId);
    if (m.pedidoId !== null && m.pedidoId !== undefined && String(m.pedidoId) === id) return true;
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(?:Pedido\\s*#|#)' + esc + '(?!\\d)');
    return re.test(String(m.descricao || '')) || re.test(String(m.mensagem || ''));
}

async function sincronizarFinanceiroPedido(p) {
    if (!p) return null;
    const doPedido = (DB.movimentacoes || []).filter(m =>
        (m.pedidoId != null && String(m.pedidoId) === String(p.id)) ||
        (m.tipo === 'entrada' && movRefereAoPedido(m, p.id))
    );
    const pagas = doPedido.filter(m => m.pagamento !== 'pendente');
    const pendentes = doPedido.filter(m => m.pagamento === 'pendente');

    if (p.status === 'cancelado') {
        for (const m of doPedido) {
            DB.movimentacoes = (DB.movimentacoes || []).filter(x => x.id !== m.id);
            if (DBReady && m.docId) {
                try { await DB_SERVICE.deleteMovimentacao(m.docId); } catch (e) {}
            }
        }
        return null;
    }

    // Nunca sobrescrever valor já recebido: paga mantém o valor pago;
    // pendente recebe apenas o restante (esperado - pago).
    const pago = pagas.reduce((s, m) => s + (Number(m.valor) || 0), 0);
    const esperado = valorEsperadoPedido(p);
    const restante = Math.max(0, Math.round((esperado - pago) * 100) / 100);

    let ref = null;
    if (pagas.length) {
        ref = pagas[pagas.length - 1];
        const mudancas = { descricao: `Pedido #${p.id}`, pedidoId: p.id, categoria: ref.categoria || 'servico' };
        Object.assign(ref, mudancas);
        if (DBReady && ref.docId) {
            try { await DB_SERVICE.updateMovimentacao(ref.docId, mudancas); } catch (e) {}
        }
    }

    if (restante > 0) {
        if (pendentes.length) {
            const pend = pendentes[pendentes.length - 1];
            const mudancas = { tipo: 'entrada', descricao: `Pedido #${p.id}`, valor: restante, categoria: 'servico', pagamento: 'pendente', pedidoId: p.id };
            Object.assign(pend, mudancas);
            if (DBReady && pend.docId) {
                try { await DB_SERVICE.updateMovimentacao(pend.docId, mudancas); } catch (e) {}
            }
            ref = ref || pend;
        } else {
            const nova = {
                id: DB.nextId.movimentacao++,
                tipo: 'entrada',
                descricao: `Pedido #${p.id}`,
                valor: restante,
                categoria: 'servico',
                pagamento: 'pendente',
                data: new Date().toISOString().split('T')[0],
                hora: agoraHora(),
                pedidoId: p.id
            };
            DB.movimentacoes.push(nova);
            if (DBReady) {
                try {
                    const resDoc = await DB_SERVICE.addMovimentacao(nova);
                    nova.docId = resDoc && resDoc.id ? resDoc.id : resDoc;
                } catch (e) {
                    console.error('Falha ao persistir movimentação do pedido:', e);
                }
            }
            ref = nova;
        }
    } else {
        // Tudo já pago: remove pendentes órfãs
        for (const pend of pendentes) {
            DB.movimentacoes = (DB.movimentacoes || []).filter(x => x.id !== pend.id);
            if (DBReady && pend.docId) {
                try { await DB_SERVICE.deleteMovimentacao(pend.docId); } catch (e) {}
            }
        }
    }

    if (!ref && !pagas.length && restante > 0) {
        // fallback: cria pendente pelo total
        const nova = {
            id: DB.nextId.movimentacao++,
            tipo: 'entrada',
            descricao: `Pedido #${p.id}`,
            valor: esperado,
            categoria: 'servico',
            pagamento: 'pendente',
            data: new Date().toISOString().split('T')[0],
            hora: agoraHora(),
            pedidoId: p.id
        };
        DB.movimentacoes.push(nova);
        if (DBReady) {
            try {
                const resDoc = await DB_SERVICE.addMovimentacao(nova);
                nova.docId = resDoc && resDoc.id ? resDoc.id : resDoc;
            } catch (e) {}
        }
        ref = nova;
    }
    return ref;
}

function preparePedidoModal() {
    const clienteSelect = document.getElementById('pedidoCliente');
    if (clienteSelect) clienteSelect.innerHTML = DB.clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

    const servicosDiv = document.getElementById('pedidoServicos');
    if (servicosDiv) {
        servicosDiv.innerHTML = DB.servicos.map(s => `<div class="checkbox-item">
        <input type="checkbox" id="ps_${s.id}" value="${String(s.id).replace(/"/g, '&quot;')}" onchange="updatePedidoTotal()">
        <label for="ps_${s.id}">${s.nome}</label>
        <span class="item-price">${formatCurrency(s.preco)}</span>
    </div>`).join('');
        servicosDiv.onclick = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'LABEL') return;
            const item = e.target.closest('.checkbox-item');
            if (!item) return;
            const cb = item.querySelector('input');
            if (cb) { cb.checked = !cb.checked; updatePedidoTotal(); }
        };
    }

    const materiaisDiv = document.getElementById('pedidoMateriais');
    if (materiaisDiv) {
        materiaisDiv.innerHTML = DB.materiais.map(m => `<div class="checkbox-item">
        <input type="checkbox" id="pm_${m.id}" value="${String(m.id).replace(/"/g, '&quot;')}" onchange="updatePedidoTotal()">
        <label for="pm_${m.id}">${m.nome}</label>
        ${formatMaterialPrice(m, 'item-price')}
    </div>`).join('');
        materiaisDiv.onclick = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'LABEL') return;
            const item = e.target.closest('.checkbox-item');
            if (!item) return;
            const cb = item.querySelector('input');
            if (cb) { cb.checked = !cb.checked; updatePedidoTotal(); }
        };
    }
    updatePedidoTotal();
}

function renderFooterStudio() {
    const st = studioDados();
    const enderecoCompleto = [st.endereco, st.cidade].filter(Boolean).join(', ');
    ['', 'Client'].forEach(sfx => {
        const nomeEl = document.getElementById('footerStudioNome' + sfx);
        if (!nomeEl) return;
        nomeEl.textContent = st.nome || 'FPS Studio';
        const linhas = { footerStudioEndereco: st.endereco, footerStudioCidade: st.cidade, footerStudioTelefone: st.telefone, footerStudioEmail: st.email };
        Object.keys(linhas).forEach(base => {
            const el = document.getElementById(base + sfx);
            if (!el) return;
            const val = linhas[base];
            if (val) { el.style.display = ''; el.querySelector('span').textContent = val; }
            else el.style.display = 'none';
        });
        const maps = document.getElementById('rotaGoogle' + sfx);
        const waze = document.getElementById('rotaWaze' + sfx);
        if (maps) maps.href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(enderecoCompleto);
        if (waze) waze.href = 'https://waze.com/ul?q=' + encodeURIComponent(enderecoCompleto) + '&navigate=yes';
        const rotas = document.getElementById('footerRotas' + sfx);
        if (rotas) rotas.style.display = enderecoCompleto ? '' : 'none';
    });
}

function fecharLightbox() {
    document.getElementById('lightboxOverlay').classList.remove('active');
    document.getElementById('lightboxImg').src = '';
}

function desenharDonutServicos(a, b) {
    if (typeof renderizarDonutServicos === 'function') return renderizarDonutServicos(a, b);
}

// UTILITIES & UPLOAD DE IMAGENS
// ============================================
// UPLOAD DE IMAGENS - DRAG & DROP E FORM CLEANUP
// ============================================
function setupDragDrop() {
    document.querySelectorAll('.upload-area').forEach(area => {
        area.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.classList.add('dragover');
        });

        area.addEventListener('dragleave', function(e) {
            e.preventDefault();
            this.classList.remove('dragover');
        });

        area.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('dragover');
            const input = this.querySelector('input[type="file"]');
            if (!input) return;
            const previewId = input.id === 'servicoImagem' ? 'servicoImagemPreview' :
                             (input.id === 'materialImagem' ? 'materialImagemPreview' :
                             (input.id === 'comprovanteImagem' ? 'comprovanteImagemPreview' :
                             (input.id === 'pagamentoComprovanteImagem' ? 'pagamentoImagemPreview' :
                             (input.id === 'clientPagamentoImagem' ? 'clientPagamentoImagemPreview' : null))));
            const files = e.dataTransfer.files;
            if (files && files.length && previewId) {
                input.files = files;
                previewImagem(input, previewId);
            }
        });
    });
}

function clearForm(prefix) {
    const form = {
        servico: ['servicoId', 'servicoNome', 'servicoDescricao', 'servicoPreco', 'servicoDuracao', 'servicoIcone', 'servicoImagem'],
        material: ['materialId', 'materialNome', 'materialDescricao', 'materialPreco', 'materialEstoque', 'materialImagem'],
        pedido: ['pedidoId', 'pedidoDesconto', 'pedidoDataInicial', 'pedidoHoraInicial', 'pedidoDataFinal', 'pedidoHoraFinal'],
        cliente: ['clienteId', 'clienteNome', 'clienteEmail', 'clienteTelefone', 'clienteSenha', 'clientePin', 'clienteCnpj', 'clienteInstagram'],
        mov: ['movDescricao', 'movValor'],
        comprovante: ['comprovantePedido', 'comprovanteValor', 'comprovanteData', 'comprovanteImagem'],
        orcamento: ['orcamentoPedidoInfo', 'orcamentoDescricao', 'orcamentoValor', 'orcamentoDesconto', 'orcamentoValidade']
    };

    (form[prefix] || []).forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (el.type === 'file') {
                el.value = '';
                delete el.dataset.base64;
            } else {
                el.value = '';
            }
        }
    });

    // Reset upload previews
    if (prefix === 'servico') {
        const preview = document.getElementById('servicoImagemPreview');
        if (preview) { preview.src = ''; preview.style.display = 'none'; }
        const ph = document.getElementById('servicoImgPreview');
        if (ph) ph.style.display = 'block';
        const btn = document.getElementById('servicoImagemRemoveBtn');
        if (btn) btn.style.display = 'none';
        const fileInput = document.getElementById('servicoImagem');
        if (fileInput) { fileInput.value = ''; delete fileInput.dataset.base64; }
    }
    if (prefix === 'material') {
        const preview = document.getElementById('materialImagemPreview');
        if (preview) { preview.src = ''; preview.style.display = 'none'; }
        const ph = document.getElementById('materialImgPreview');
        if (ph) ph.style.display = 'block';
        const btn = document.getElementById('materialImagemRemoveBtn');
        if (btn) btn.style.display = 'none';
        const fileInput = document.getElementById('materialImagem');
        if (fileInput) { fileInput.value = ''; delete fileInput.dataset.base64; }
    }

    // Uncheck checkboxes
    document.querySelectorAll('#pedidoServicos input, #pedidoMateriais input, #clientPedidoServicos input, #clientPedidoMateriais input').forEach(cb => {
        cb.checked = false;
    });
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
    toast.innerHTML = `<i class="fas ${icons[type]}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================
// CONFIGURAÇÕES DO APP (título, tema, cores, fonte, backup)
// ============================================


function hexToRgb(hex) {
    const m = (hex || '#6c5ce7').replace('#', '');
    return { r: parseInt(m.slice(0, 2), 16), g: parseInt(m.slice(2, 4), 16), b: parseInt(m.slice(4, 6), 16) };
}

function shadeHex(hex, pct) {
    const { r, g, b } = hexToRgb(hex);
    const t = pct < 0 ? 0 : 255;
    const p = Math.abs(pct);
    const c = v => Math.round((t - v) * p) + v;
    return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

function coresConfig() {
    const cfg = APP_CONFIG || CONFIG_DEFAULT;
    if (cfg.tema === 'custom') {
        const cor = cfg.primaryColor && /^#[0-9a-fA-F]{6}$/.test(cfg.primaryColor) ? cfg.primaryColor : '#6c5ce7';
        return { primary: cor, dark: shadeHex(cor, -0.25), light: shadeHex(cor, 0.4), grad1: '#0c0c1d', grad2: '#1a1a3e', grad3: '#2d1b69' };
    }
    return TEMAS_PRESET[cfg.tema] || TEMAS_PRESET.padrao;
}

function carregarFonte(familia) {
    const fontes = {
        'Inter': 'Inter:wght@400;500;600;700',
        'Poppins': 'Poppins:wght@400;500;600;700',
        'Roboto': 'Roboto:wght@400;500;700',
        'Montserrat': 'Montserrat:wght@400;500;600;700',
        'Open Sans': 'Open+Sans:wght@400;600;700',
        'Lato': 'Lato:wght@400;700'
    };
    const el = document.getElementById('fonteDinamica');
    if (el) el.remove();
    const slug = fontes[familia];
    if (!slug) return;
    const link = document.createElement('link');
    link.id = 'fonteDinamica';
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${slug}&display=swap`;
    document.head.appendChild(link);
}

function aplicarConfigLook() {
    const cfg = APP_CONFIG || CONFIG_DEFAULT;
    const cor = coresConfig();
    const root = document.documentElement;
    root.style.setProperty('--primary', cor.primary);
    root.style.setProperty('--primary-dark', cor.dark);
    root.style.setProperty('--primary-light', cor.light);
    root.style.setProperty('--ff', cfg.fonte);
    root.style.zoom = Math.max(0.8, Math.min(1.3, (parseFloat(cfg.fontSize) || 14) / 14));

    const titulo = cfg.appTitle || 'FPS Studio';
    document.title = `${titulo} - Gerenciamento de Estúdio`;
    document.querySelectorAll('.brand-titulo, #appTitleLogin').forEach(el => { if (el) el.textContent = titulo; });

    const login = document.querySelector('.login-container');
    if (login && cor.grad1) login.style.background = `linear-gradient(135deg, ${cor.grad1} 0%, ${cor.grad2} 50%, ${cor.grad3} 100%)`;

    if (!localStorage.getItem('fps_tema')) document.body.classList.toggle('dark', !!cfg.darkPadrao);
    atualizarIconeTema();
    carregarFonte(cfg.fonte);
}

async function carregarConfig() {
    try {
        const dados = await DB_SERVICE.getConfig();
        APP_CONFIG = Object.assign({}, CONFIG_DEFAULT, dados || {});
    } catch (e) {
        APP_CONFIG = Object.assign({}, CONFIG_DEFAULT);
    }
    aplicarConfigLook();
    renderFooterStudio();
}

function preencherFormConfig() {
    if (!document.getElementById('configTitulo')) return;
    const cfg = APP_CONFIG || CONFIG_DEFAULT;
    document.getElementById('configTitulo').value = cfg.appTitle;
    document.getElementById('configTema').value = cfg.tema;
    document.getElementById('configCorCustom').value = (cfg.tema === 'custom' && cfg.primaryColor) ? cfg.primaryColor : coresConfig().primary;
    document.getElementById('configFonte').value = cfg.fonte;
    document.getElementById('configFontSize').value = cfg.fontSize;
    document.getElementById('configFontSizeVal').textContent = cfg.fontSize + 'px';
    document.getElementById('configDark').checked = !!cfg.darkPadrao;

    const st = studioDados();
    if (document.getElementById('configStudioNome')) {
        document.getElementById('configStudioNome').value = st.nome;
        document.getElementById('configStudioCnpj').value = st.cnpj;
        document.getElementById('configStudioTelefone').value = st.telefone;
        document.getElementById('configStudioEmail').value = st.email;
        document.getElementById('configStudioEndereco').value = st.endereco;
        document.getElementById('configStudioCidade').value = st.cidade;
        document.getElementById('configStudioPixChave').value = st.pixChave;
        document.getElementById('configStudioPixTipo').value = st.pixTipo;
        document.getElementById('configStudioPixBeneficiario').value = st.pixBeneficiario;
    }

    atualizarVisualConfig();
}

function atualizarVisualConfig() {
    const tema = document.getElementById('configTema').value;
    document.getElementById('linhaCorCustom').style.display = tema === 'custom' ? 'flex' : 'none';
    const cor = tema === 'custom' ? document.getElementById('configCorCustom').value : (TEMAS_PRESET[tema] || TEMAS_PRESET.padrao).primary;
    document.getElementById('configCorSwatch') && (document.getElementById('configCorSwatch').style.background = cor);
    document.getElementById('configPreviewCor').style.background = cor;
}

function aplicarCorConfig() {
    const cor = document.getElementById('configCorCustom').value;
    document.getElementById('configPreviewCor').style.background = cor;
    showToast('Cor selecionada. Clique em Salvar para aplicar.', 'info');
}

async function salvarConfig() {
    if (!DBReady) { showToast('Sem conexão com o servidor para salvar!', 'error'); return; }
    const cfg = {
        appTitle: (document.getElementById('configTitulo').value || '').trim() || 'FPS Studio',
        tema: document.getElementById('configTema').value,
        primaryColor: document.getElementById('configTema').value === 'custom' ? document.getElementById('configCorCustom').value : '',
        fonte: document.getElementById('configFonte').value,
        fontSize: parseFloat(document.getElementById('configFontSize').value) || 14,
        darkPadrao: document.getElementById('configDark').checked,
        studio: document.getElementById('configStudioNome') ? {
            nome: (document.getElementById('configStudioNome').value || '').trim(),
            cnpj: (document.getElementById('configStudioCnpj').value || '').trim(),
            telefone: (document.getElementById('configStudioTelefone').value || '').trim(),
            email: (document.getElementById('configStudioEmail').value || '').trim(),
            endereco: (document.getElementById('configStudioEndereco').value || '').trim(),
            cidade: (document.getElementById('configStudioCidade').value || '').trim(),
            pixChave: (document.getElementById('configStudioPixChave').value || '').trim(),
            pixTipo: document.getElementById('configStudioPixTipo').value,
            pixBeneficiario: (document.getElementById('configStudioPixBeneficiario').value || '').trim()
        } : CONFIG_DEFAULT.studio
    };
    try {
        await DB_SERVICE.saveConfig(cfg);
        APP_CONFIG = cfg;
        aplicarConfigLook();
        renderFooterStudio();
        showToast('Configurações salvas com sucesso!', 'success');
    } catch (e) {
        showToast('Erro ao salvar configurações.', 'error');
    }
}

async function restaurarConfigPadrao() {
    if (!confirm('Restaurar as configurações de aparência para o padrão?')) return;
    try {
        await DB_SERVICE.saveConfig(Object.assign({}, CONFIG_DEFAULT));
        APP_CONFIG = Object.assign({}, CONFIG_DEFAULT);
        aplicarConfigLook();
        preencherFormConfig();
        renderFooterStudio();
        showToast('Configurações padrão restauradas!', 'success');
    } catch (e) {
        showToast('Erro ao restaurar.', 'error');
    }
}

async function exportarBackup() {
    try {
        showToast('Gerando backup...', 'info');
        const data = await DB_SERVICE.exportBackup();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fps-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast('Backup gerado com sucesso!', 'success');
    } catch (e) {
        showToast('Erro ao gerar backup.', 'error');
    }
}

async function importarBackup(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!confirm('Restaurar este backup substituirá TODOS os dados atuais. Deseja continuar?')) { input.value = ''; return; }
    try {
        const texto = await file.text();
        const dados = JSON.parse(texto);
        if (dados.tipo !== 'fps-studio-backup') {
            showToast('Este arquivo não é um backup do FPS Studio.', 'error');
            return;
        }
        showToast('Restaurando backup...', 'info');
        await DB_SERVICE.importBackup(dados);
        showToast('Backup restaurado! Recarregando...', 'success');
        setTimeout(() => location.reload(), 1400);
    } catch (e) {
        showToast('Erro ao restaurar backup.', 'error');
    } finally {
        input.value = '';
    }
}

// ============================================
// TOOLS DA TOPBAR (relógio, tema, calendário, calculadora, avisos)
// ============================================
const calcEstado = { '': { display: '0', prev: null, operador: null, reset: false }, 'Client': { display: '0', prev: null, operador: null, reset: false } };
const calEstado = { '': { ano: null, mes: null }, 'Client': { ano: null, mes: null } };

function getSfx(popover) {
    return (popover.id || '').endsWith('Client') ? 'Client' : '';
}

function getPopover(btn) {
    return btn.closest('.tool-wrapper').querySelector('.tool-popover');
}

function fecharPopovers() {
    document.querySelectorAll('.tool-popover.active').forEach(p => p.classList.remove('active'));
}

function fecharNotif() {
    document.querySelectorAll('.notif-popover').forEach(p => p.classList.remove('active'));
}

function atualizarRelogio() {
    const agora = new Date();
    const tempo = agora.toLocaleTimeString('pt-BR');
    const data = agora.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
    ['Admin', 'Client'].forEach(sfx => {
        const rel = document.getElementById('relogio' + sfx);
        const dat = document.getElementById('data' + sfx);
        if (rel) rel.textContent = tempo;
        if (dat) dat.textContent = data.charAt(0).toUpperCase() + data.slice(1);
    });
}

function aplicarTema() {
    if (!localStorage.getItem('fps_tema')) {
        document.body.classList.toggle('dark', !!(APP_CONFIG && APP_CONFIG.darkPadrao));
    } else {
        document.body.classList.toggle('dark', localStorage.getItem('fps_tema') === 'dark');
    }
    atualizarIconeTema();
}

function atualizarIconeTema() {
    const dark = document.body.classList.contains('dark');
    document.querySelectorAll('.btn-tema i').forEach(i => i.className = dark ? 'fas fa-sun' : 'fas fa-moon');
}

function toggleTema() {
    document.body.classList.toggle('dark');
    localStorage.setItem('fps_tema', document.body.classList.contains('dark') ? 'dark' : 'light');
    atualizarIconeTema();
}

function irParaPagina(pagina) {
    const nav = document.querySelector(`.nav-item[data-page="${pagina}"]`);
    if (nav) nav.click();
}

function montarCalculadora() {
    const teclas = ['C', '⌫', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '='];
    ['', 'Client'].forEach(sfx => {
        const gridEl = document.getElementById('calcGrid' + (sfx === '' ? '' : 'Client'));
        if (!gridEl || gridEl.dataset.montado) return;
        gridEl.dataset.montado = '1';
        gridEl.innerHTML = teclas.map(t => {
            const extra = t === '0' ? ' calc-zero' : t === '=' ? ' calc-equals' : isNaN(t) ? ' calc-op' : ' calc-num';
            return `<button class="calc-btn${extra}" onclick="calcClick('${sfx}', '${t}')">${t}</button>`;
        }).join('');
    });
}

function fmtCalc(n) {
    if (!isFinite(n)) return 'Erro';
    return String(parseFloat(n.toFixed(8)));
}

function calcClick(sfx, key) {
    const st = calcEstado[sfx];
    const displayEl = document.getElementById('calcDisplay' + (sfx === '' ? '' : 'Client'));
    if (!displayEl) return;
    const mostrar = v => { st.display = v; displayEl.textContent = v; };
    const calcular = (a, b, op) => {
        switch (op) {
            case '+': return a + b;
            case '-': return a - b;
            case '×': return a * b;
            case '÷': return b === 0 ? NaN : a / b;
        }
    };

    if (key >= '0' && key <= '9') {
        if (st.reset || st.display === '0') mostrar(key);
        else mostrar(st.display.length < 14 ? (st.display === 'Erro' ? key : st.display + key) : st.display);
        st.reset = false;
        return;
    }
    if (key === '.') {
        if (st.display === 'Erro') { mostrar('0.'); st.reset = false; return; }
        if (st.reset) { mostrar('0.'); st.reset = false; return; }
        if (!st.display.includes('.')) mostrar(st.display + '.');
        return;
    }
    if (key === '%') {
        mostrar(fmtCalc(parseFloat(st.display) / 100));
        st.reset = true;
        return;
    }
    if (key === '⌫') {
        if (st.reset) return;
        mostrar(st.display.length > 1 ? st.display.slice(0, -1) : '0');
        return;
    }
    if (key === 'C') {
        st.prev = null; st.operador = null; st.reset = false;
        mostrar('0');
        return;
    }
    if (['+', '-', '×', '÷'].includes(key)) {
        const v = parseFloat(st.display);
        if (st.prev !== null && st.operador && !st.reset) {
            const r = calcular(st.prev, v, st.operador);
            st.prev = isNaN(r) ? null : r;
            mostrar(st.prev === null ? 'Erro' : fmtCalc(r));
        } else {
            st.prev = v;
        }
        st.operador = key;
        st.reset = true;
        return;
    }
    if (key === '=') {
        const v = parseFloat(st.display);
        if (st.prev !== null && st.operador) {
            const r = calcular(st.prev, v, st.operador);
            st.prev = null; st.operador = null; st.reset = true;
            mostrar(isNaN(r) ? 'Erro' : fmtCalc(r));
        } else {
            st.reset = true;
        }
        return;
    }
}

function toggleCalculator(btn) {
    const pop = getPopover(btn);
    if (pop.classList.contains('active')) { pop.classList.remove('active'); return; }
    fecharPopovers();
    montarCalculadora();
    pop.classList.add('active');
}

function renderCalendar(sfx) {
    const st = calEstado[sfx];
    const hoje = new Date();
    if (!st.ano || !st.mes) { st.ano = hoje.getFullYear(); st.mes = hoje.getMonth(); }
    const mesAnoEl = document.getElementById('calendarMesAno' + (sfx === '' ? '' : 'Client'));
    const gridEl = document.getElementById('calendarGrid' + (sfx === '' ? '' : 'Client'));
    if (!mesAnoEl || !gridEl) return;
    const primeiro = new Date(st.ano, st.mes, 1);
    const diasNoMes = new Date(st.ano, st.mes + 1, 0).getDate();
    const offset = primeiro.getDay();
    const nomesMes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    let html = diasSemana.map(d => `<span class="cal-dia cal-dia-label">${d}</span>`).join('');
    for (let i = 0; i < offset; i++) html += '<span></span>';
    for (let d = 1; d <= diasNoMes; d++) {
        const ehHoje = st.ano === hoje.getFullYear() && st.mes === hoje.getMonth() && d === hoje.getDate();
        html += `<span class="cal-dia${ehHoje ? ' cal-hoje' : ''}">${d}</span>`;
    }
    mesAnoEl.textContent = `${nomesMes[st.mes]} ${st.ano}`;
    gridEl.innerHTML = html;
}

function mudarMes(delta, sfx = '') {
    const st = calEstado[sfx];
    st.mes += delta;
    if (st.mes < 0) { st.mes = 11; st.ano--; }
    if (st.mes > 11) { st.mes = 0; st.ano++; }
    renderCalendar(sfx);
}

function toggleCalendar(btn) {
    const pop = getPopover(btn);
    if (pop.classList.contains('active')) { pop.classList.remove('active'); return; }
    fecharPopovers();
    renderCalendar(getSfx(pop));
    pop.classList.add('active');
}

function gerarNotificacoes() {
    const lista = [];
    if (!currentUser) return lista;
    if (currentUser.role === 'admin') {
        DB.pedidos.filter(p => p.status === 'pendente').slice(0, 5).forEach(p => {
            lista.push({ icone: 'fa-clipboard-list', classe: 'notif-primary', titulo: `Pedido #${p.id} pendente`, texto: `Aguardando orçamento/pagamento - ${formatCurrency(p.total)}`, pagina: 'adminPedidos' });
        });
        Object.keys(DB.chats).forEach(key => {
            (DB.chats[key] || []).forEach(m => {
                if (m.tipo === 'comprovante' && m.remetente === 'client' && m.status === 'aguardando') {
                    lista.push({ icone: 'fa-receipt', classe: 'notif-warning', titulo: 'Comprovante aguardando', texto: m.mensagem, pagina: 'adminChat' });
                }
            });
        });
        
        const temNaoLida = Object.keys(DB.chats).some(key => (DB.chats[key] || []).some(m => m.remetente === 'client' && !m.lida));
        if (temNaoLida) lista.push({ icone: 'fa-envelope', classe: 'notif-primary', titulo: 'Mensagens não lidas', texto: 'Há mensagens de clientes no chat', pagina: 'adminChat' });
    } else if (currentUser.role === 'client') {
        const msgs = DB.chats[`admin_${currentUser.id}`] || [];
        msgs.forEach(m => {
            if (m.tipo === 'orcamento' && m.remetente === 'admin' && !m.lida) {
                lista.push({ icone: 'fa-file-invoice-dollar', classe: 'notif-primary', titulo: 'Novo orçamento', texto: `${m.descricao || 'Orçamento'} - ${formatCurrency(Math.max(0, (m.valor || 0) - (m.desconto || 0)))}`, pagina: 'clientChat' });
            }
            if (m.tipo === 'comprovante' && m.remetente === 'client' && m.status === 'aguardando') {
                lista.push({ icone: 'fa-hourglass-half', classe: 'notif-warning', titulo: 'Pagamento aguardando', texto: m.mensagem, pagina: 'clientChat' });
            }
            if (m.tipo === 'sistema' && m.remetente === 'admin' && !m.lida) {
                lista.push({ icone: 'fa-check-circle', classe: 'notif-success', titulo: 'Confirmação', texto: m.mensagem, pagina: 'clientChat' });
            }
        });
    }
    const vistos = new Set();
    return lista.filter(n => { const k = n.titulo + n.texto; if (vistos.has(k)) return false; vistos.add(k); return true; });
}

function atualizarBadgeNotif() {
    if (!currentUser) return;
    const n = gerarNotificacoes().length;
    ['', 'Client'].forEach(sfx => {
        const badge = document.getElementById('notifBadge' + (sfx === '' ? '' : 'Client'));
        if (badge) { badge.textContent = n; badge.style.display = n ? 'flex' : 'none'; }
    });
}

function renderNotif(pop) {
    const sfx = getSfx(pop);
    const listaEl = pop.querySelector('.notif-list');
    const badgeEl = document.getElementById('notifBadge' + (sfx === '' ? '' : 'Client'));
    const todos = gerarNotificacoes();
    const visiveis = todos.slice(0, 8);
    if (badgeEl) { badgeEl.textContent = todos.length; badgeEl.style.display = todos.length ? 'flex' : 'none'; }
    listaEl.innerHTML = visiveis.length ? visiveis.map(x => `
        <div class="notif-item" onclick="fecharNotif(); irParaPagina('${x.pagina}')">
            <div class="notif-icone ${x.classe}"><i class="fas ${x.icone}"></i></div>
            <div class="notif-corpo"><strong>${x.titulo}</strong><p>${x.texto}</p></div>
        </div>`).join('') : '<div class="notif-vazio"><i class="fas fa-check-circle"></i><p>Sem avisos</p></div>';
}

function toggleNotif(btn) {
    const pop = getPopover(btn);
    if (pop.classList.contains('active')) { pop.classList.remove('active'); return; }
    fecharPopovers();
    renderNotif(pop);
    pop.classList.add('active');
}

function iniciarFerramentas() {
    atualizarRelogio();
    setInterval(atualizarRelogio, 1000);
    montarCalculadora();
    aplicarTema();
    atualizarBadgeNotif();
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.tool-wrapper')) fecharPopovers();
    });
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('movData').value = new Date().toISOString().split('T')[0];
    updateChatBadge();
    setupDragDrop();
    iniciarFerramentas();
    let dashResizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(dashResizeTimer);
        dashResizeTimer = setTimeout(function() {
            if (currentUser && currentUser.role === 'admin' && document.getElementById('adminHome').classList.contains('active')) {
                desenharGraficoBarras();
                desenharDonutServicos();
            }
        }, 150);
    });
});

function celebratePayment() {
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#26cc00', '#00c3ff', '#ff0055', '#ff9900', '#ffffff'],
            zIndex: 9999
        });
    }

    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const audioCtx = new AudioContext();
        
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
    } catch(e) {
        console.error("Audio API error", e);
    }
}




function handlePinInput(el, num) {
    if(el.value.length === 1 && num < 4) {
        document.querySelector(`.pin-digit[data-pin="${num+1}"]`).focus();
    }
}
function handlePinKeydown(ev, num) {
    if(ev.key === 'Backspace' && ev.target.value === '' && num > 1) {
        document.querySelector(`.pin-digit[data-pin="${num-1}"]`).focus();
    }
}
function handleRegPinInput(el, num) {
    if(el.value.length === 1 && num < 4) {
        document.querySelector(`.reg-pin[data-regpin="${num+1}"]`).focus();
    }
}
function handleRegPinKeydown(ev, num) {
    if(ev.key === 'Backspace' && ev.target.value === '' && num > 1) {
        document.querySelector(`.reg-pin[data-regpin="${num-1}"]`).focus();
    }
}

window.abrirNovoPedidoModalAdmin = function() {
    clearForm('pedido');
    document.getElementById('pedidoId').value = '';
    document.getElementById('pedidoCliente').innerHTML = DB.clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    
    const servicosHtml = DB.servicos.map(s => `<label><input type="checkbox" value="${s.id}" onchange="updatePedidoTotal()"> ${s.nome} (${formatCurrency(s.preco)})</label>`).join('');
    document.getElementById('pedidoServicos').innerHTML = servicosHtml;
    
    const materiaisHtml = DB.materiais.map(m => `<label><input type="checkbox" value="${m.id}" onchange="updatePedidoTotal()"> ${m.nome} (${formatCurrency(m.preco)})</label>`).join('');
    document.getElementById('pedidoMateriais').innerHTML = materiaisHtml;
    
    document.getElementById('pedidoDesconto').value = '0,00';
    document.getElementById('pedidoQtdFaixas').value = '1';
    
    openModal('pedidoModal');
    updatePedidoTotal();
}

window.renderBiblioteca = function() {
    const list = document.getElementById('bibliotecaBody');
    if (!list) return;
    
    // Sort by most recent
    const pedidosComAudio = DB.pedidos.filter(p => p.audios && p.audios.length > 0 || p.qtdFaixas > 0).sort((a,b) => b.id - a.id);
    
    if (pedidosComAudio.length === 0) {
        list.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum áudio encontrado.</td></tr>';
        return;
    }
    
    list.innerHTML = pedidosComAudio.map(p => {
        const cliente = DB.clientes.find(c => c.id === p.clienteId);
        const cliNome = cliente ? cliente.nome : 'Desconhecido';
        const audios = p.audios || [];
        
        let arquivosHtml = '';
        if (audios.length > 0) {
            arquivosHtml = audios.map((a, idx) => `
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;background:var(--bg-lighter);padding:4px 8px;border-radius:4px;font-size:12px;">
                    <i class="fas fa-music text-primary"></i>
                    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${a.nome}">${a.nome}</span>
                    <audio controls src="${audioSrc(a)}" style="height:24px;width:120px;"></audio>
                    <a href="${audioSrc(a)}" download="${a.nome}" class="btn-icon" title="Baixar"><i class="fas fa-download"></i></a>
                    <button class="btn-icon text-danger" onclick="excluirAudioPedido(${p.id}, ${idx})" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
            `).join('');
        } else {
            arquivosHtml = '<span class="text-muted">Nenhum áudio enviado</span>';
        }
        
        return `
        <tr>
            <td>#${p.id}</td>
            <td>${cliNome}</td>
            <td>${p.qtdFaixas || 1}</td>
            <td>${audios.length} / ${p.qtdFaixas || 1}</td>
            <td style="max-width:300px;">${arquivosHtml}</td>
            <td>
                <button class="btn-primary btn-sm" onclick="abrirUploadAudioAdmin(${p.id})" title="Enviar novo áudio"><i class="fas fa-upload"></i> Upload</button>
            </td>
        </tr>
        `;
    }).join('');
};

window.excluirAudioPedido = async function(pedidoId, audioIdx) {
    if (!confirm('Excluir este áudio?')) return;
    const p = DB.pedidos.find(x => x.id === pedidoId);
    if (p && p.audios) {
        p.audios.splice(audioIdx, 1);
        if (DBReady && p.docId) await DB_SERVICE.updatePedido(p.docId, p);
        renderBiblioteca();
        showToast('Áudio excluído!', 'success');
    }
};

window.abrirUploadAudioAdmin = function(pedidoId) {
    const p = DB.pedidos.find(x => x.id === pedidoId);
    if(!p) return;
    
    // We'll create a hidden file input on the fly
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.multiple = true;
    
    input.onchange = async (e) => {
        if (!e.target.files || e.target.files.length === 0) return;
        
        const novosAudios = [];
        for (let i = 0; i < e.target.files.length; i++) {
            const file = e.target.files[i];
            if (typeof validateAudioFile === 'function' && !validateAudioFile(file)) continue;
            try {
                const prep = await prepararAudioPedido(file);
                novosAudios.push(prep);
            } catch (err) {
                console.error('Falha ao processar áudio', file.name, err);
            }
        }
        
        p.audios = p.audios || [];
        p.audios.push(...novosAudios);
        
        if (DBReady && p.docId) await DB_SERVICE.updatePedido(p.docId, p);
        renderBiblioteca();
        showToast('Áudios enviados com sucesso!', 'success');
    };
    
    input.click();
};


window.validateAudioFile = function(file) {
    if (!file) return false;
    const name = (file.name || '').toLowerCase();
    const isAudio = (file.type && file.type.startsWith('audio/')) ||
                    name.endsWith('.mp3') ||
                    name.endsWith('.wav') ||
                    name.endsWith('.ogg') ||
                    name.endsWith('.m4a') ||
                    name.endsWith('.aac');
    if (!isAudio) {
        showToast('Apenas arquivos de áudio (.mp3, .wav, .m4a, .ogg) são permitidos.', 'error');
        return false;
    }
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
        showToast('O arquivo excede o limite de 25MB.', 'error');
        return false;
    }
    return true;
};

window.enviarAudioBiblioteca = async function(input) {
    if (!currentUser || currentUser.role !== 'client') return;
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    if (!validateAudioFile(file)) {
        input.value = '';
        return;
    }
    
    showToast('Enviando áudio...', 'info');
    
    try {
        let prep;
        try {
            prep = await prepararAudioPedido(file);
        } catch (err) {
            prep = { nome: file.name, base64: await fileToBase64(file), data: new Date().toISOString() };
        }
        const b64 = prep.url || prep.base64;
        const audioObj = {
            clienteId: currentUser.id,
            arquivoNome: file.name,
            audio: b64,
            audioUrl: prep.url || '',
            descricao: 'Enviado pelo Chat do Cliente',
            duracao: 0,
            data: new Date().toISOString().split('T')[0],
            hora: new Date().toTimeString().slice(0, 5)
        };
        
        DB.bibliotecas = DB.bibliotecas || [];
        DB.bibliotecas.push(audioObj);
        
        if (DBReady) {
            const docId = await DB_SERVICE.addBiblioteca(audioObj);
            audioObj.id = (docId && docId.id) ? docId.id : docId;
        }
        
        // Mensagem no chat para notificar o admin
        const chatKey = 'admin_' + currentUser.id;
        if (!DB.chats[chatKey]) DB.chats[chatKey] = [];
        
        const msgData = {
            tipo: 'audio',
            remetente: 'client',
            clienteId: currentUser.id,
            arquivoNome: file.name,
            audio: b64,
            mensagem: '🎵 Enviei um novo arquivo de áudio (' + file.name + ')',
            data: new Date().toISOString(),
            lida: false
        };
        DB.chats[chatKey].push(msgData);
        if (DBReady) {
            const res = await DB_SERVICE.sendMessage(msgData);
            if (res && res.id) msgData.id = res.id;
        }
        if (document.getElementById('chatMessagesClient')) renderClientChat();
        
        showToast('Áudio enviado com sucesso para o estúdio!', 'success');
    } catch (err) {
        console.error('Erro ao enviar áudio do cliente:', err);
        showToast('Erro ao processar o áudio. Tente novamente.', 'error');
    }

    input.value = '';
};

window.renderBibliotecas = function() {
    const selectCli = document.getElementById('biblioFiltroCliente');
    if (selectCli && selectCli.options.length <= 1) {
        selectCli.innerHTML = '<option value="">Todos os clientes</option>' + DB.clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    }
    const list = document.getElementById('bibliotecasBody');
    if (!list) return;
    
    let dados = DB.bibliotecas || [];
    
    const filtroCli = document.getElementById('biblioFiltroCliente')?.value;
    if (filtroCli) {
        dados = dados.filter(b => b.clienteId == filtroCli);
    }
    
    const dtInicio = document.getElementById('biblioDataInicio')?.value;
    const dtFim = document.getElementById('biblioDataFim')?.value;
    if (dtInicio) dados = dados.filter(b => b.data >= dtInicio);
    if (dtFim) dados = dados.filter(b => b.data <= dtFim);
    
    const busca = document.getElementById('biblioBusca')?.value?.toLowerCase();
    if (busca) {
        dados = dados.filter(b => b.arquivoNome.toLowerCase().includes(busca) || b.descricao.toLowerCase().includes(busca));
    }
    
    if (dados.length === 0) {
        list.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum áudio encontrado.</td></tr>';
        return;
    }
    
    list.innerHTML = dados.map(b => {
        const cliente = DB.clientes.find(c => c.id === b.clienteId);
        const cliNome = cliente ? cliente.nome : 'Desconhecido';
        return `
        <tr>
            <td>${cliNome}</td>
            <td>
                <strong>${b.arquivoNome}</strong>
                <br><small class="text-muted">${b.descricao}</small>
            </td>
            <td>${formatDate(b.data)} ${b.hora || ''}</td>
            <td>
                ${b.audio ? `<audio controls src="${b.audio}" style="height:30px;width:150px;"></audio>` : '-'}
            </td>
            <td>
                ${b.audio ? `<a href="${b.audio}" download="${b.arquivoNome}" class="btn-icon" title="Baixar"><i class="fas fa-download"></i></a>` : ''}
                <button class="btn-icon text-danger" onclick="excluirBibliotecaAudio(${b.id})" title="Excluir"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
        `;
    }).join('');
};

window.excluirBibliotecaAudio = async function(id) {
    if(!confirm('Excluir este áudio da biblioteca?')) return;
    DB.bibliotecas = DB.bibliotecas.filter(x => x.id !== id);
    if(DBReady) await DB_SERVICE.deleteBiblioteca(id);
    renderBibliotecas();
    showToast('Áudio excluído!', 'success');
};

window.mascaraMoedaBR = function(i) {
        let v = i.value.replace(/\D/g, '');
        v = (v / 100).toFixed(2) + '';
        v = v.replace('.', ',');
        v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
        i.value = v;
    };


window.validarHorarioEstudio = function(horaInicio, horaFim) {
    if (!horaInicio || !horaFim) return true;
    
    const parseTime = (timeStr) => {
        const [h, m] = timeStr.split(':').map(Number);
        return (h * 60) + (m || 0);
    };
    
    const inicioTotal = parseTime(horaInicio);
    const fimTotal = parseTime(horaFim);
    
    const expedienteInicio = 8 * 60; // 08:00
    const expedienteFim = 22 * 60;   // 22:00
    
    if (inicioTotal < expedienteInicio || fimTotal > expedienteFim) {
        showToast('O horário solicitado está fora do expediente (08:00 às 22:00).', 'warning');
        return false;
    }
    if (inicioTotal >= fimTotal) {
        showToast('A hora final deve ser maior que a hora inicial.', 'warning');
        return false;
    }
    return true;
};

window.salvarPedidoClient = salvarPedidoClient;
window.prepareClientPedidoModal = prepareClientPedidoModal;
window.updateClientPedidoTotal = updateClientPedidoTotal;
window.atualizarCondicaoClient = atualizarCondicaoClient;
window.verDetalhesPedidoClient = verDetalhesPedidoClient;
window.limitAudiosClient = limitAudiosClient;
window.valoresPedidoClient = valoresPedidoClient;

