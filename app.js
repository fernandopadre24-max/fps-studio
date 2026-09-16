

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

let currentUser = null;
let DB = { servicos: [], materiais: [], clientes: [], pedidos: [], movimentacoes: [], chats: {}, config: {} };
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
            if(pageId === 'adminBiblioteca') renderBiblioteca();            if(pageId === 'adminBibliotecas') renderBibliotecas();
            if(pageId === 'adminChat') renderChatList();
            if(pageId === 'adminClientes') renderClientes();
            if(pageId === 'adminConfig') preencherFormConfig();
            
            if(pageId === 'clientHome') renderClientDashboard();
            if(pageId === 'clientPedidos') renderPedidosClient();
            if(pageId === 'clientChat') renderClientChat();
            
        });
    });
}

document.addEventListener("DOMContentLoaded", () => { init(); setupNavigation(); });

async function init() {
    const ok = await DB_SERVICE.init();
    if (ok) {
        DBReady = true;
        await loadDB();
    }
    showView('loginScreen');
}

async function loadDB() {
    DB.servicos = await DB_SERVICE.getServicos();
    DB.materiais = await DB_SERVICE.getMateriais();
    DB.clientes = await DB_SERVICE.getClientes();
    DB.pedidos = await DB_SERVICE.getPedidos();
    DB.movimentacoes = await DB_SERVICE.getMovimentacoes();
    DB.config = await DB_SERVICE.getConfig();    DB.bibliotecas = await DB_SERVICE.getBiblioteca();
    
    DB.chats = {};
    for (const c of DB.clientes) {
        const cChats = await DB_SERVICE.getChat(c.id);
        DB.chats[`admin_${c.id}`] = cChats || [];
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
        const email = document.getElementById('loginEmail').value;
        const senha = document.getElementById('loginPassword').value;
        if (email === 'admin' && (senha === 'admin' || senha === 'admin123')) {
            user = { id: 'admin', role: 'admin', nome: 'Admin' };
        } else {
            const c = DB.clientes.find(x => (x.email === email || x.nome === email) && x.senha === senha);
            if (c) user = { ...c, role: 'cliente' };
        }
    } else if (tab.includes('pin')) {
        const email = document.getElementById('pinEmail').value;
        const pinInputs = Array.from(document.querySelectorAll('.pin-digit:not(.reg-pin)')).map(i => i.value).join('');
        const pin = pinInputs;
        
        if (email === 'admin' && pin === '1234') {
             user = { id: 'admin', role: 'admin', nome: 'Admin' };
        } else {
             const c = DB.clientes.find(x => (x.email === email || x.nome === email) && x.pin === pin);
             if (c) user = { ...c, role: 'cliente' };
        }
    }

    if (user) {
        currentUser = user;
        showToast('Login efetuado com sucesso', 'success');
        if (user.role === 'admin') {
            showView('adminDashboard');
            renderAdminDashboard();
        } else {
            showView('clientDashboard');
            renderClientDashboard();
        }
    } else {
        showToast('Credenciais inválidas', 'error');
    }
}

// Bind events to forms
document.addEventListener("DOMContentLoaded", () => {
    const lf = document.getElementById('loginForm');
    if (lf) lf.addEventListener('submit', login);
    
    const pf = document.getElementById('pinForm');
    if (pf) pf.addEventListener('submit', login);
    
    // NOTE: register form should ideally call a register func, but for now we can alert
    const rf = document.getElementById('registerForm');
    if (rf) rf.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Cadastro não implementado nesta demonstração.');
    });
});

function logout() {
    currentUser = null;
    showView('loginScreen');
}

function toggleSidebar(id) {
    const sb = document.getElementById(id);
    if (sb) sb.classList.toggle('collapsed');
}

function alternarVisaoPedidos(view) {
    document.querySelectorAll('.vt-btn').forEach(b => b.classList.remove('active'));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');
    
    if (view === 'board') {
        document.getElementById('pedidosTableWrap').style.display = 'none';
        document.getElementById('pedidosBoardWrap').style.display = '';
    } else {
        document.getElementById('pedidosTableWrap').style.display = '';
        document.getElementById('pedidosBoardWrap').style.display = 'none';
    }
    renderPedidos();
}

function limparFiltrosDashboard() {
    document.getElementById('dashFiltroMes').value = '';
    renderAdminDashboard();
}

function renderAdminDashboard() {
    renderServicos();
    renderMateriais();
    renderPedidos();
    renderMovimentacoes();
    renderClientes();
    
    const mesFiltro = document.getElementById('dashFiltroMes')?.value;
    let pedidosFiltro = DB.pedidos;
    let movFiltro = DB.movimentacoes;
    
    if (mesFiltro) {
        pedidosFiltro = pedidosFiltro.filter(p => p.data && p.data.startsWith(mesFiltro));
        movFiltro = movFiltro.filter(m => m.data && m.data.startsWith(mesFiltro));
    }
    
    const concluidos = pedidosFiltro.filter(p => p.status === 'concluido').length;
    const andamento = pedidosFiltro.filter(p => p.status === 'em_andamento').length;
    
    const entradas = movFiltro.filter(m => m.tipo === 'entrada').reduce((sum, m) => sum + Number(m.valor), 0);
    const saidas = movFiltro.filter(m => m.tipo === 'saida').reduce((sum, m) => sum + Number(m.valor), 0);
    const saldo = entradas - saidas;
    
    document.getElementById('dashTotalEntradas').textContent = formatCurrency(entradas);
    document.getElementById('dashTotalSaidas').textContent = formatCurrency(saidas);
    document.getElementById('dashSaldo').textContent = formatCurrency(saldo);
    document.getElementById('dashPedidosConcluidos').textContent = concluidos;
    document.getElementById('dashPedidosAndamento').textContent = andamento;
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
    const list = document.getElementById('adminServicosList');
    if (!list) return;
    list.innerHTML = DB.servicos.map(s => `
        <div class="card">
            <img src="${s.imagem || 'https://via.placeholder.com/150'}" alt="${s.nome}" style="width:100%;height:120px;object-fit:cover;border-radius:4px;margin-bottom:10px;">
            <h4>${s.nome}</h4>
            <p style="font-size:12px;color:var(--text-light);height:40px;overflow:hidden;">${s.descricao || ''}</p>
            <div style="font-weight:bold;margin:10px 0;color:var(--primary-color);">${formatCurrency(s.preco)} ${s.isPorHora ? '/ hora' : ''}</div>
            <div style="display:flex;gap:5px;">
                <button class="btn-secondary btn-sm" style="flex:1;" onclick="editarServico('${s.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-danger btn-sm" style="flex:1;" onclick="excluirServico('${s.id}')"><i class="fas fa-trash"></i></button>
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
    document.getElementById('servicoDescricao').value = s.descricao;
    
    // Convert to string formatted for the mask if needed, but let's just set the string.
    let precoFmt = Number(s.preco).toFixed(2).replace('.', ',');
    document.getElementById('servicoPreco').value = precoFmt;
    
    if (document.getElementById('servicoDuracao')) document.getElementById('servicoDuracao').value = s.duracao || '';
    if (document.getElementById('servicoIcone')) document.getElementById('servicoIcone').value = s.icone || 'fa-cog';
    if (document.getElementById('servicoCategoria')) document.getElementById('servicoCategoria').value = s.categoria || 'outro';
    
    if (s.imagem) {
        document.getElementById('servicoImagemPreview').src = s.imagem;
        document.getElementById('servicoImagemPreview').style.display = 'block';
    }
    openModal('servicoModal');
}

async function excluirServico(id) {
    if (!confirm('Excluir este serviço?')) return;
    const s = DB.servicos.find(x => x.id === id);
    DB.servicos = DB.servicos.filter(x => x.id !== id);
    if (DBReady && s?.docId) await DB_SERVICE.deleteServico(s.docId);
    renderServicos();
    showToast('Serviço excluído', 'success');
}

async function salvarServico() {
    const id = document.getElementById('servicoId').value;
    const imgEl = document.getElementById('servicoImagemPreview');
    const img = imgEl.style.display !== 'none' ? imgEl.src : null;
    
    let strPreco = document.getElementById('servicoPreco').value || '0';
    const precoFloat = parseFloat(strPreco.replace(/\./g, '').replace(',', '.')) || 0;

    const data = {
        nome: document.getElementById('servicoNome').value,
        descricao: document.getElementById('servicoDescricao').value,
        preco: precoFloat,
        duracao: document.getElementById('servicoDuracao') ? document.getElementById('servicoDuracao').value : '',
        icone: document.getElementById('servicoIcone') ? document.getElementById('servicoIcone').value : 'fa-cog',
        categoria: document.getElementById('servicoCategoria') ? document.getElementById('servicoCategoria').value : 'outro',
        imagem: img
    };
    
    if (id) {
        const item = DB.servicos.find(x => x.id === parseInt(id) || x.id === id);
        if (item) {
            Object.assign(item, data);
            if (DBReady) await DB_SERVICE.updateServico(item.id, data);
        }
    } else {
        if (DBReady) {
            const res = await DB_SERVICE.addServico(data);
            data.id = res.id;
        } else {
            data.id = 'serv_' + Date.now();
        }
        DB.servicos.push(data);
    }
    
    closeAllModals();
    renderServicos();
    showToast('Serviço salvo', 'success');
}

// ==========================================
// MATERIAIS
// ==========================================
function renderMateriais() {
    const list = document.getElementById('adminMateriaisList');
    if (!list) return;
    list.innerHTML = DB.materiais.map(m => `
        <div class="card">
            <img src="${m.imagem || 'https://via.placeholder.com/150'}" alt="${m.nome}" style="width:100%;height:120px;object-fit:cover;border-radius:4px;margin-bottom:10px;">
            <h4>${m.nome}</h4>
            <p style="font-size:12px;color:var(--text-light);height:40px;overflow:hidden;">${m.descricao || ''}</p>
            <div style="font-weight:bold;margin:10px 0;color:var(--primary-color);">${formatCurrency(m.preco)}</div>
            <div style="display:flex;gap:5px;">
                <button class="btn-secondary btn-sm" style="flex:1;" onclick="editarMaterial('${m.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-danger btn-sm" style="flex:1;" onclick="excluirMaterial('${m.id}')"><i class="fas fa-trash"></i></button>
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
    document.getElementById('materialDescricao').value = m.descricao;
    
    let precoFmt = Number(m.preco).toFixed(2).replace('.', ',');
    document.getElementById('materialPreco').value = precoFmt;

    if (document.getElementById('materialCategoria')) document.getElementById('materialCategoria').value = m.categoria || 'outro';
    
    if (m.imagem) {
        document.getElementById('materialImagemPreview').src = m.imagem;
        document.getElementById('materialImagemPreview').style.display = 'block';
    }
    openModal('materialModal');
}

async function excluirMaterial(id) {
    if (!confirm('Excluir este material?')) return;
    const m = DB.materiais.find(x => x.id === id);
    DB.materiais = DB.materiais.filter(x => x.id !== id);
    if (DBReady && m?.docId) await DB_SERVICE.deleteMaterial(m.docId);
    renderMateriais();
    showToast('Material excluído', 'success');
}

async function salvarMaterial() {
    const id = document.getElementById('materialId').value;
    const imgEl = document.getElementById('materialImagemPreview');
    const img = imgEl.style.display !== 'none' ? imgEl.src : null;
    
    let strPreco = document.getElementById('materialPreco').value || '0';
    const precoFloat = parseFloat(strPreco.replace(/\./g, '').replace(',', '.')) || 0;

    const data = {
        nome: document.getElementById('materialNome').value,
        descricao: document.getElementById('materialDescricao').value,
        preco: precoFloat,
        categoria: document.getElementById('materialCategoria') ? document.getElementById('materialCategoria').value : 'outro',
        imagem: img
    };
    
    if (id) {
        const item = DB.materiais.find(x => x.id === parseInt(id) || x.id === id);
        if (item) {
            Object.assign(item, data);
            if (DBReady) await DB_SERVICE.updateMaterial(item.id, data);
        }
    } else {
        if (DBReady) {
            const res = await DB_SERVICE.addMaterial(data);
            data.id = res.id;
        } else {
            data.id = 'mat_' + Date.now();
        }
        DB.materiais.push(data);
    }
    
    closeAllModals();
    renderMateriais();
    showToast('Material salvo', 'success');
}

// ==========================================
// PEDIDOS
// ==========================================
function renderPedidos() {
    const list = document.getElementById('adminPedidosList');
    const board = document.getElementById('pedidosBoardWrap');
    if (!list || !board) return;
    
    if (board.style.display !== 'none') {
        renderPedidosBoard();
        return;
    }
    
    list.innerHTML = DB.pedidos.map(p => {
        const c = DB.clientes.find(x => x.id === p.clienteId);
        return `
        <tr>
            <td>#${p.id.substring(4,8).toUpperCase()}</td>
            <td>${c ? c.nome : 'Avulso'}</td>
            <td>${formatDate(p.data)}</td>
            <td>${statusLabel(p.status)}</td>
            <td style="font-weight:bold;">${formatCurrency(p.total)}</td>
            <td>
                <button class="btn-icon" onclick="editarPedido('${p.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-icon" onclick="excluirPedido('${p.id}')"><i class="fas fa-trash" style="color:var(--danger-color)"></i></button>
            </td>
        </tr>
    `}).join('');
}

function renderPedidosBoard() {
    const cols = {
        'pendente': document.getElementById('boardPendente'),
        'em_andamento': document.getElementById('boardAndamento'),
        'concluido': document.getElementById('boardConcluido')
    };
    if(!cols.pendente) return;
    Object.values(cols).forEach(c => c.innerHTML = '');
    
    DB.pedidos.forEach(p => {
        const c = DB.clientes.find(x => x.id === p.clienteId);
        const el = document.createElement('div');
        el.className = 'board-card';
        el.innerHTML = `
            <div style="font-weight:bold;margin-bottom:5px;">${c ? c.nome : 'Pedido Avulso'}</div>
            <div style="font-size:12px;color:var(--text-light);margin-bottom:10px;">${formatDate(p.data)}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:bold;color:var(--primary-color);">${formatCurrency(p.total)}</span>
                <button class="btn-secondary btn-sm" onclick="editarPedido('${p.id}')">Editar</button>
            </div>
        `;
        if(cols[p.status]) cols[p.status].appendChild(el);
    });
}

function editarPedido(id) {
    const p = DB.pedidos.find(x => x.id === id);
    if (!p) return;
    clearForm('pedido');
    document.getElementById('pedidoId').value = p.id;
    document.getElementById('pedidoCliente').innerHTML = DB.clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    document.getElementById('pedidoCliente').value = p.clienteId;
    document.getElementById('pedidoStatus').value = p.status;
    
    // Checkboxes for servicos and materiais
    const servicosHtml = DB.servicos.map(s => `<label><input type="checkbox" value="${s.id}" ${p.servicos.includes(s.id) ? 'checked' : ''} onchange="updatePedidoTotal()"> ${s.nome} (${formatCurrency(s.preco)})</label>`).join('');
    document.getElementById('pedidoServicos').innerHTML = servicosHtml;
    
    const materiaisHtml = DB.materiais.map(m => `<label><input type="checkbox" value="${m.id}" ${p.materiais.includes(m.id) ? 'checked' : ''} onchange="updatePedidoTotal()"> ${m.nome} (${formatCurrency(m.preco)})</label>`).join('');
    document.getElementById('pedidoMateriais').innerHTML = materiaisHtml;
    
    document.getElementById('pedidoDesconto').value = p.desconto ? fmtCalc(p.desconto) : '0,00';
    document.getElementById('pedidoQtdFaixas').value = p.qtdFaixas || 1;
    openModal('pedidoModal');
}

async function excluirPedido(id) {
    if (!confirm('Excluir este pedido?')) return;
    const p = DB.pedidos.find(x => x.id === id);
    DB.pedidos = DB.pedidos.filter(x => x.id !== id);
    if (DBReady && p?.docId) await DB_SERVICE.deletePedido(p.docId);
    renderPedidos();
    showToast('Pedido excluído', 'success');
}

window.updatePedidoTotal = function() {
    let t = 0;
    [...document.querySelectorAll('#pedidoServicos input:checked')].forEach(cb => {
        const s = DB.servicos.find(x => x.id === parseInt(cb.value));
        if(s) t += s.preco;
    });
    [...document.querySelectorAll('#pedidoMateriais input:checked')].forEach(cb => {
        const m = DB.materiais.find(x => x.id === parseInt(cb.value));
        if(m) t += m.preco;
    });
    const descStr = document.getElementById('pedidoDesconto').value;
    const desc = parseFloat((descStr || '0').replace(/\./g, '').replace(',', '.'));
    t = Math.max(0, t - desc);
    const prev = document.getElementById('pedidoTotalPreview');
    if(prev) prev.textContent = formatCurrency(t);
    return {t, desc};
};

async function salvarPedido() {
    const id = document.getElementById('pedidoId').value;
    const {t, desc} = updatePedidoTotal();
    const servicos = [...document.querySelectorAll('#pedidoServicos input:checked')].map(cb => parseInt(cb.value));
    const materiais = [...document.querySelectorAll('#pedidoMateriais input:checked')].map(cb => parseInt(cb.value));
    
    const data = {
        clienteId: parseInt(document.getElementById('pedidoCliente').value),
        status: document.getElementById('pedidoStatus').value,
        servicos, materiais,
        desconto: desc,
        total: t,
        qtdFaixas: parseInt(document.getElementById('pedidoQtdFaixas').value) || 1
    };
    
    if (id) {
        const item = DB.pedidos.find(x => x.id === id);
        Object.assign(item, data);
        if (DBReady && item.docId) await DB_SERVICE.updatePedido(item.docId, data);
    } else {
        data.id = 'ped_' + Date.now();
        if (DBReady) {
            const res = await DB_SERVICE.addPedido(data);
            data.docId = res.id;
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
    const list = document.getElementById('adminMovimentacoesList');
    if (!list) return;
    
    list.innerHTML = DB.movimentacoes.sort((a,b) => b.data.localeCompare(a.data)).map(m => {
        const isEntrada = m.tipo === 'entrada';
        return `
        <tr>
            <td>${formatDate(m.data)}</td>
            <td>${m.descricao}</td>
            <td><span class="badge" style="background:${isEntrada ? 'var(--success-color)' : 'var(--danger-color)'}">${isEntrada ? 'Entrada' : 'Saída'}</span></td>
            <td style="font-weight:bold;color:${isEntrada ? 'var(--success-color)' : 'var(--danger-color)'}">${formatCurrency(m.valor)}</td>
            <td>
                <button class="btn-icon" onclick="editarMovimentacao('${m.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-icon" onclick="excluirMovimentacao('${m.id}')"><i class="fas fa-trash" style="color:var(--danger-color)"></i></button>
            </td>
        </tr>
    `}).join('');
}

function editarMovimentacao(id) {
    const m = DB.movimentacoes.find(x => x.id === id);
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
    const m = DB.movimentacoes.find(x => x.id === id);
    DB.movimentacoes = DB.movimentacoes.filter(x => x.id !== id);
    if (DBReady && m?.docId) await DB_SERVICE.deleteMovimentacao(m.docId);
    renderMovimentacoes();
    renderAdminDashboard();
    showToast('Movimentação excluída', 'success');
}

async function salvarMovimentacao() {
    const id = document.getElementById('movId').value;
    const data = {
        tipo: document.getElementById('movTipo').value,
        descricao: document.getElementById('movDescricao').value,
        valor: Number(document.getElementById('movValor').value),
        data: document.getElementById('movData').value,
    };
    
    if (id) {
        const item = DB.movimentacoes.find(x => x.id === id);
        Object.assign(item, data);
        if (DBReady && item.docId) await DB_SERVICE.updateMovimentacao(item.docId, data);
    } else {
        data.id = 'mov_' + Date.now();
        if (DBReady) {
            const res = await DB_SERVICE.addMovimentacao(data);
            data.docId = res.id;
        }
        DB.movimentacoes.push(data);
    }
    closeAllModals();
    renderMovimentacoes();
    renderAdminDashboard();
    showToast('Movimentação salva', 'success');
}

function htmlResumoMovimentacoesCliente(pedidos) {
    let totalPedidos = pedidos.reduce((sum, p) => sum + Number(p.total), 0);
    let pagos = DB.movimentacoes.filter(m => pedidos.find(p => p.id === m.pedidoId) && m.tipo === 'entrada').reduce((sum, m) => sum + Number(m.valor), 0);
    return `
        <div style="margin-top:10px;padding:10px;background:var(--bg-lighter);border-radius:4px;border:1px solid var(--border-color);">
            <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
                <span>Total em Pedidos:</span>
                <strong>${formatCurrency(totalPedidos)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:5px;color:var(--success-color);">
                <span>Total Pago:</span>
                <strong>${formatCurrency(pagos)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border-color);padding-top:5px;font-weight:bold;color:var(--danger-color);">
                <span>Em Aberto:</span>
                <span>${formatCurrency(totalPedidos - pagos)}</span>
            </div>
        </div>
    `;
}


function renderClientes() {
    const list = document.getElementById('adminClientesList');
    if (!list) return;
    
    list.innerHTML = DB.clientes.map(c => `
        <tr>
            <td>
                <button class="btn-icon" onclick="toggleDetalhesCliente('${c.id}', this)">
                    <i class="fas ${clientesExpandidos.has(c.id) ? 'fa-chevron-down' : 'fa-chevron-right'}"></i>
                </button>
            </td>
            <td style="font-weight:bold;">${c.nome}</td>
            <td>${c.email}</td>
            <td>${c.telefone || '-'}</td>
            <td>
                <button class="btn-secondary btn-sm" onclick="abrirNovoPedidoModal(null, '${c.id}')"><i class="fas fa-plus"></i> Pedido</button>
                <button class="btn-icon" onclick="openChatAdmin('${c.id}')"><i class="fas fa-comments"></i></button>
            </td>
            <td>
                <button class="btn-icon" onclick="editarCliente('${c.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-icon" onclick="excluirCliente('${c.id}')"><i class="fas fa-trash" style="color:var(--danger-color)"></i></button>
            </td>
        </tr>
        <tr style="display: ${clientesExpandidos.has(c.id) ? '' : 'none'}">
            <td colspan="6" style="padding:0;">${clientesExpandidos.has(c.id) ? htmlResumoMovimentacoesCliente(DB.pedidos.filter(p=>p.clienteId===c.id)) : ''}</td>
        </tr>
    `).join('');
}

function toggleDetalhesCliente(id, btn) {
    const row = btn.closest('tr').nextElementSibling;
    const td = row.firstElementChild;
    if (clientesExpandidos.has(id)) {
        clientesExpandidos.delete(id);
        row.style.display = 'none';
        td.innerHTML = '';
    } else {
        clientesExpandidos.add(id);
        
        const pedidos = DB.pedidos.filter(p => p.clienteId === id);
        td.innerHTML = htmlResumoMovimentacoesCliente(pedidos);
        row.style.display = '';
    }
}



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
    const c = DB.clientes.find(x => x.id === id);
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
    const item = DB.clientes.find(c => c.id === id);
    DB.clientes = DB.clientes.filter(c => c.id !== id);
    if (DBReady && item?.docId) await DB_SERVICE.deleteCliente(item.docId);
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
        data.id = DB.nextId.cliente++;
        DB.clientes.push(data);
        if (DBReady) {
            const docId = await DB_SERVICE.addCliente(data);
            DB.clientes[DB.clientes.length - 1].docId = docId;
        }
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
                <span class="item-card-badge ${m.estoque > 0 ? 'badge-estoque' : 'badge-sem-estoque'}">${m.estoque > 0 ? `${m.estoque} disponível` : 'Esgotado'}</span>
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
    servicosDiv.innerHTML = DB.servicos.map(s => `<div class="checkbox-item">
        <input type="checkbox" id="cps_${s.id}" value="${s.id}" onchange="updateClientPedidoTotal()">
        <label for="cps_${s.id}">${s.nome}</label>
        <span class="item-price">${formatCurrency(s.preco)}</span>
    </div>`).join('');

    const materiaisDiv = document.getElementById('clientPedidoMateriais');
    materiaisDiv.innerHTML = DB.materiais.map(m => `<div class="checkbox-item">
        <input type="checkbox" id="cpm_${m.id}" value="${m.id}" onchange="updateClientPedidoTotal()">
        <label for="cpm_${m.id}">${m.nome}</label>
        ${formatMaterialPrice(m, 'item-price')}
    </div>`).join('');

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
        const s = DB.servicos.find(x => x.id === parseInt(cb.value));
        if (s) total += s.preco;
    });
    document.querySelectorAll('#clientPedidoMateriais input:checked').forEach(cb => {
        const m = DB.materiais.find(x => x.id === parseInt(cb.value));
        if (m) total += m.preco;
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
    if (input.files.length > 10) {
        showToast('Você pode anexar no máximo 10 áudios.', 'error');
        const dt = new DataTransfer();
        for (let i = 0; i < 10; i++) dt.items.add(input.files[i]);
        input.files = dt.files;
    }
    
    const validFiles = new DataTransfer();
    for(let i=0; i<input.files.length; i++) {
        if(validateAudioFile(input.files[i])) {
            validFiles.items.add(input.files[i]);
        }
    }
    input.files = validFiles.files;
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

    document.getElementById('clientCondVistaValor').textContent = formatCurrency(subTotal * 0.90);
    document.getElementById('clientCondMetaValor').textContent = formatCurrency(subTotal / 2);

    document.getElementById('clientResSubtotal').textContent = formatCurrency(subTotal);
    const vistaLinha = document.getElementById('clientResVista');
    vistaLinha.style.display = condicao === 'vista' ? 'flex' : 'none';
    document.getElementById('clientResDesconto').textContent = '-' + formatCurrency(desconto);
    document.getElementById('clientResTotal').textContent = formatCurrency(totalFinal);
    document.getElementById('clientResPagarRotulo').textContent = condicao === 'metade' ? 'Entrada (50%) agora' : 'Pagar agora (à vista)';
    document.getElementById('clientResPagar').textContent = formatCurrency(entrada);
    const saldoLinha = document.getElementById('clientResSaldoLinha');
    saldoLinha.style.display = condicao === 'metade' ? 'flex' : 'none';
    document.getElementById('clientResSaldo').textContent = formatCurrency(saldo);
}

async function salvarPedidoClient() {
    if (!currentUser || currentUser.role !== 'client') return;
    const servicos = [...document.querySelectorAll('#clientPedidoServicos input:checked')].map(cb => parseInt(cb.value));
    const materiais = [...document.querySelectorAll('#clientPedidoMateriais input:checked')].map(cb => parseInt(cb.value));

    if (servicos.length === 0 && materiais.length === 0) {
        showToast('Selecione pelo menos um serviço ou material!', 'error');
        return;
    }

    let total = 0;
    servicos.forEach(id => { const s = DB.servicos.find(x => x.id === id); if (s) total += s.preco; });
    materiais.forEach(id => { const m = DB.materiais.find(x => x.id === id); if (m) total += m.preco; });

    const condicao = (document.querySelector('input[name="clientCondicao"]:checked') || {}).value || 'vista';
    const descontoPct = condicao === 'vista' ? 10 : 0;
    const parcial = condicao === 'metade' ? 1 : 0;
    const dataInicial = document.getElementById('clientPedidoDataInicial').value || '';
    const horaInicial = document.getElementById('clientPedidoHoraInicial').value || '';
    const horaFinal = document.getElementById('clientPedidoHoraFinal').value || '';

    const novoPedido = {
        id: DB.nextId.pedido++,
        clienteId: currentUser.id,
        servicos, materiais,
        desconto: 0,
        status: 'pendente',
        data: new Date().toISOString().split('T')[0],
        total,
        parcial,
        descontoPct,
        dataInicial,
        horaInicial,
        horaFinal,
        qtdFaixas: parseInt(document.getElementById('clientPedidoQtdFaixas').value) || 1,
        audios: []
    };
    
    // Anexar áudios
    const fileInput = document.getElementById('clientPedidoAudios');
    if (fileInput && fileInput.files.length > 0) {
        for (let i = 0; i < fileInput.files.length; i++) {
            const b64 = await fileToBase64(fileInput.files[i]);
            novoPedido.audios.push({
                nome: fileInput.files[i].name,
                base64: b64,
                data: new Date().toISOString()
            });
        }
    }

    DB.pedidos.push(novoPedido);
    if (DBReady) {
        const docId = await DB_SERVICE.addPedido(novoPedido);
        novoPedido.docId = docId;
    }
    await sincronizarFinanceiroPedido(novoPedido);

    // Enviar pedido pelo chat para o administrador
    const chatKey = `admin_${currentUser.id}`;
    if (!DB.chats[chatKey]) DB.chats[chatKey] = [];

    const nomesServicos = servicos.map(id => { const s = DB.servicos.find(x => x.id === id); return s ? s.nome : ''; }).filter(Boolean);
    const nomesMateriais = materiais.map(id => { const m = DB.materiais.find(x => x.id === id); return m ? m.nome : ''; }).filter(Boolean);
    const detalhes = [...nomesServicos, ...nomesMateriais].join(', ');
    const rotuloCondicao = condicao === 'vista'
        ? `Pagamento à vista (10% de desconto): R$ ${formatCurrency(total * 0.90)}`
        : `Dividido em 2x: entrada de R$ ${formatCurrency(total / 2)} agora e R$ ${formatCurrency(total / 2)} ao finalizar`;

    const prefHorario = dataInicial
        ? `Agendamento: ${formatDate(dataInicial)} ${horaInicial}`
        : '';

    const msgData = {
        tipo: 'pedido',
        remetente: 'client',
        clienteId: currentUser.id,
        pedidoId: novoPedido.id,
        mensagem: `Novo pedido #${novoPedido.id} - ${formatCurrency(total)}`,
        descricao: detalhes + ' · ' + rotuloCondicao + (prefHorario ? ' · ' + prefHorario : ''),
        valor: total,
        data: new Date().toISOString(),
        lida: false
    };
    DB.chats[chatKey].push(msgData);
    if (DBReady) {
        const res = await DB_SERVICE.sendMessage(msgData);
        if (res && res.id) msgData.id = res.id;
    }

    closeAllModals();
    renderPedidosClient();
    renderClientDashboard();
    showToast('Pedido enviado com sucesso!', 'success');
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
function renderChatList() {
    const chatList = document.getElementById('chatListAdmin');
    const chatKeys = Object.keys(DB.chats).filter(k => k.startsWith('admin_'));

    if (chatKeys.length === 0) {
        chatList.innerHTML = '<div class="empty-state"><p>Nenhuma conversa</p></div>';
        return;
    }

    chatList.innerHTML = chatKeys.map(key => {
        const clienteId = parseInt(key.split('_')[1]);
        const cliente = DB.clientes.find(c => c.id === clienteId);
        const messages = DB.chats[key];
        const lastMsg = messages[messages.length - 1];
        return `<div class="chat-contact ${currentChatClient === clienteId ? 'active' : ''}" onclick="openChatAdmin(${clienteId})">
            <div class="avatar"><i class="fas fa-user"></i></div>
            <div class="chat-contact-info">
                <h4>${cliente ? cliente.nome : 'Cliente #' + clienteId}</h4>
                <p>${lastMsg ? (lastMsg.mensagem || lastMsg.tipo).substring(0, 40) + '...' : 'Nova conversa'}</p>
            </div>
            <span class="chat-contact-time">${lastMsg ? timeAgo(lastMsg.data) : ''}</span>
        </div>`;
    }).join('');
}

function openChatAdmin(clienteId) {
    currentChatClient = clienteId;
    const cliente = DB.clientes.find(c => c.id === clienteId);
    const chatKey = `admin_${clienteId}`;

    if (!DB.chats[chatKey]) DB.chats[chatKey] = [];

    document.getElementById('chatHeaderAdmin').innerHTML = `<div class="chat-user-info">
        <div class="avatar"><i class="fas fa-user"></i></div>
        <div>
            <h4>${cliente ? cliente.nome : 'Cliente'}</h4>
            <span>${cliente ? cliente.email : ''}</span>
        </div>
    </div>`;

    document.getElementById('chatInputAreaAdmin').style.display = 'flex';

    renderChatMessagesAdmin(chatKey);
    renderChatList();
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
                id: DB.nextId.movimentacao++,
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
                    id: DB.nextId.movimentacao++,
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
            if (mat && mat.estoque > 0) mat.estoque--;
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
        clienteId = currentUser.id;
    } else {
        clienteId = document.getElementById('chatClienteSelect') ? parseInt(document.getElementById('chatClienteSelect').value) : null;
    }
    
    if (!clienteId) {
        showToast('Selecione um cliente para enviar o áudio.', 'error');
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
            const b64 = await fileToBase64(file);
            const msgAudio = {
                tipo: 'audio',
                remetente: remetente,
                clienteId: clienteId,
                mensagem: remetente === 'client' ? 'Áudio de referência enviado' : 'Áudio enviado',
                audio: b64,
                arquivoNome: file.name,
                data: new Date().toISOString(),
                lida: false
            };
            
            const chatKey = `admin_${clienteId}`;
            if (!DB.chats[chatKey]) DB.chats[chatKey] = [];
            DB.chats[chatKey].push(msgAudio);

            if (DBReady) await DB_SERVICE.sendMessage(msgAudio);
        } catch(e) {
            console.error(e);
            showToast('Erro ao processar áudio.', 'error');
        }
    }
    
    inputElement.value = ''; // clear
    if (remetente === 'client') {
        renderChatMessagesClient();
    } else {
        renderChatMessagesAdmin();
    }
    showToast('Áudio enviado!', 'success');
}

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
// UTILITIES
// ============================================
function previewImagem(input, previewId) {
    const preview = document.getElementById(previewId);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => { preview.src = e.target.result; preview.style.display = 'block'; };
        reader.readAsDataURL(input.files[0]);
    } else if (preview) {
        preview.style.display = 'none';
        preview.src = '';
    }
}

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
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.7);
}

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

function validarDiaFuncionamento() {
    const dp = document.getElementById('clientPedidoDataPref') || document.getElementById('pedidoDataPref');
    if (!dp || !dp.value) return;
    const d = new Date(dp.value + 'T12:00:00');
    const dia = d.getDay();
    const nomes = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const funciona = dia >= 2 && dia <= 5;
    document.querySelectorAll('.tarja-funcionamento.tarja-dinamica').forEach(t => t.classList.toggle('tarja-alerta', !funciona));
    if (!funciona) showToast(`Atenção: o estúdio não funciona em ${nomes[dia]}s — atendemos de terça a sexta.`, 'error');
}

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

// ============================================
// UPLOAD DE IMAGENS
// ============================================
function previewImagem(input, previewId) {
    const preview = document.getElementById(previewId);
    const file = input.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Selecione apenas arquivos de imagem!', 'error');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showToast('Imagem muito grande! Máximo 5MB.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        input.dataset.base64 = e.target.result;
        const isServico = previewId === 'servicoImgPreview';
        const removeFn = isServico ? 'removerImagemServico' : 'removerImagemMaterial';
        preview.innerHTML = `<img src="${e.target.result}" class="upload-preview"><div class="upload-actions"><span>${file.name} (${(file.size / 1024).toFixed(0)}KB)</span><button onclick="${removeFn}(event)"><i class="fas fa-trash"></i> Remover</button></div>`;
    };
    reader.readAsDataURL(file);
}

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
            const previewId = input.id === 'servicoImagem' ? 'servicoImgPreview' : 'materialImgPreview';
            const files = e.dataTransfer.files;
            if (files.length) {
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
        const preview = document.getElementById('servicoImgPreview');
        if (preview) preview.innerHTML = `<i class="fas fa-cloud-upload-alt"></i><p>Clique para selecionar uma foto</p><span>ou arraste e solte aqui</span>`;
    }
    if (prefix === 'material') {
        const preview = document.getElementById('materialImgPreview');
        if (preview) preview.innerHTML = `<i class="fas fa-cloud-upload-alt"></i><p>Clique para selecionar uma foto</p><span>ou arraste e solte aqui</span>`;
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
        DB.materiais.filter(m => m.estoque <= 3).slice(0, 5).forEach(m => {
            lista.push({ icone: 'fa-boxes', classe: 'notif-danger', titulo: `Estoque baixo: ${m.nome}`, texto: `Restam ${m.estoque} unidade(s)`, pagina: 'adminMateriais' });
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
                    <audio controls src="${a.base64}" style="height:24px;width:120px;"></audio>
                    <a href="${a.base64}" download="${a.nome}" class="btn-icon" title="Baixar"><i class="fas fa-download"></i></a>
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
            const b64 = await fileToBase64(file);
            novosAudios.push({
                nome: file.name,
                base64: b64,
                data: new Date().toISOString()
            });
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
    // Apenas MP3
    if (file.type !== 'audio/mpeg' && !file.name.toLowerCase().endsWith('.mp3')) {
        showToast('Apenas arquivos .mp3 são permitidos.', 'error');
        return false;
    }
    // Tamanho máximo (15MB)
    const maxSize = 15 * 1024 * 1024;
    if (file.size > maxSize) {
        showToast('O arquivo excede o limite de 15MB.', 'error');
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
    
    const b64 = await fileToBase64(file);
    const audioObj = {
        clienteId: currentUser.id,
        arquivoNome: file.name,
        audio: b64,
        descricao: 'Enviado pelo Chat do Cliente',
        duracao: 0
    };
    
    DB.bibliotecas = DB.bibliotecas || [];
    DB.bibliotecas.push(audioObj);
    
    if (DBReady) {
        const docId = await DB_SERVICE.addBiblioteca(audioObj);
        audioObj.id = docId.id;
    }
    
    showToast('Áudio enviado para a Biblioteca do estúdio!', 'success');
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
