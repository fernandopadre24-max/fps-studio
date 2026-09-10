// FPS STUDIO - SISTEMA DE GERENCIAMENTO
// ============================================

// DATA STORE (Fallback local quando offline)
const DB = {
    servicos: [],
    materiais: [],
    clientes: [],
    pedidos: [],
    movimentacoes: [],
    chats: {},
    nextId: { servico: 7, material: 7, cliente: 4, pedido: 4, movimentacao: 6 }
};

let DBReady = false; // Indica se a API SQLite está conectada

let currentUser = null;
let currentChatClient = null;
let selectedPedidoId = null;
let selectedPagamentoValor = 0;
const clientesExpandidos = new Set();

let APP_CONFIG = null;
const CONFIG_DEFAULT = { appTitle: 'FPS Studio', tema: 'padrao', primaryColor: '', fonte: 'Inter', fontSize: 14, darkPadrao: false, studio: { nome: '', cnpj: '', telefone: '', email: '', endereco: '', cidade: '', pixChave: '', pixTipo: 'email', pixBeneficiario: '' } };

function studioDados() {
    const cfg = APP_CONFIG || CONFIG_DEFAULT;
    return Object.assign({}, CONFIG_DEFAULT.studio, (cfg.studio && typeof cfg.studio === 'object' ? cfg.studio : {}));
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

// ============================================
// INICIALIZAÇÃO COM SQLITE (via API)
// ============================================
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

            // Normaliza docId = id (o id do servidor é o mesmo do cliente)
            ['servicos', 'materiais', 'clientes', 'pedidos', 'movimentacoes'].forEach(tabela => {
                DB[tabela].forEach(r => { r.docId = r.id; });
            });

            // Calcular nextIds
            if (DB.servicos.length) DB.nextId.servico = Math.max(...DB.servicos.map(s => s.id)) + 1;
            if (DB.materiais.length) DB.nextId.material = Math.max(...DB.materiais.map(m => m.id)) + 1;
            if (DB.clientes.length) DB.nextId.cliente = Math.max(...DB.clientes.map(c => c.id)) + 1;
            if (DB.pedidos.length) DB.nextId.pedido = Math.max(...DB.pedidos.map(p => p.id)) + 1;
            if (DB.movimentacoes.length) DB.nextId.movimentacao = Math.max(...DB.movimentacoes.map(m => m.id)) + 1;

            // Carregar chats
            for (const c of DB.clientes) {
                try {
                    DB.chats[`admin_${c.id}`] = await DB_SERVICE.getChat(c.id);
                } catch(e) {}
            }

            DBReady = true;
            console.log('SQLite conectado!');
            setInterval(() => { if (document.visibilityState === 'visible') salvarAutoBackupLocal(); }, 60000);
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

// Chama init ao carregar
initApp();

function salvarAutoBackupLocal() {
    if (!DBReady) return;
    DB_SERVICE.exportBackup().then(dados => {
        try {
            localStorage.setItem('fps_autobackup', JSON.stringify(Object.assign({}, dados, { salvoEm: new Date().toISOString() })));
        } catch (e) {}
    }).catch(() => {});
}

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

// ============================================
// SESSÃO (permanência de login)
// ============================================
function salvarSessao() {
    if (currentUser) localStorage.setItem('fps_session', JSON.stringify(currentUser));
}

function limparSessao() {
    localStorage.removeItem('fps_session');
}

function restaurarSessao() {
    const saved = localStorage.getItem('fps_session');
    if (!saved) return;
    try {
        const user = JSON.parse(saved);
        if (!user || !user.role) return;
        if (user.role === 'client') {
            const cliente = DB.clientes.find(c => c.id === user.id);
            if (!cliente) { limparSessao(); return; }
            currentUser = { role: 'client', ...cliente };
            showDashboard('client');
            document.getElementById('clientNameDisplay').textContent = cliente.nome;
        } else {
            currentUser = { role: 'admin', nome: 'Administrador' };
            showDashboard('admin');
        }
    } catch (e) {
        limparSessao();
    }
}

// ============================================
// LOGIN / AUTH
// ============================================

// LOGIN COM SENHA
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (email === 'admin' && password === 'admin123') {
        currentUser = { role: 'admin', nome: 'Administrador' };
        showDashboard('admin');
        salvarSessao();
        showToast('Bem-vindo, Administrador!', 'success');
    } else {
        const cliente = DB.clientes.find(c => c.email === email && c.senha === password);
        if (cliente) {
            currentUser = { role: 'client', ...cliente };
            showDashboard('client');
            document.getElementById('clientNameDisplay').textContent = cliente.nome;
            salvarSessao();
            showToast(`Bem-vindo, ${cliente.nome}!`, 'success');
        } else {
            showToast('Credenciais inválidas!', 'error');
        }
    }
});

// LOGIN COM PIN
document.getElementById('pinForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const email = document.getElementById('pinEmail').value.trim();
    const pinDigits = document.querySelectorAll('.pin-digit');
    const pin = Array.from(pinDigits).map(d => d.value).join('');

    if (pin.length !== 4) {
        showToast('Digite os 4 dígitos do PIN!', 'error');
        return;
    }

    if (email === 'admin' && pin === '1234') {
        currentUser = { role: 'admin', nome: 'Administrador' };
        showDashboard('admin');
        salvarSessao();
        showToast('Bem-vindo, Administrador! (PIN)', 'success');
    } else {
        const cliente = DB.clientes.find(c => c.email === email && c.pin === pin);
        if (cliente) {
            currentUser = { role: 'client', ...cliente };
            showDashboard('client');
            document.getElementById('clientNameDisplay').textContent = cliente.nome;
            salvarSessao();
            showToast(`Bem-vindo, ${cliente.nome}! (PIN)`, 'success');
        } else {
            showToast('E-mail ou PIN inválido!', 'error');
        }
    }
});

// CRIAR CONTA
document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const nome = document.getElementById('regNome').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const telefone = document.getElementById('regTelefone').value.trim();
    const senha = document.getElementById('regSenha').value;
    const regPinDigits = document.querySelectorAll('.reg-pin');
    const pin = Array.from(regPinDigits).map(d => d.value).join('');

    if (!nome || !email || !senha) {
        showToast('Preencha todos os campos!', 'error');
        return;
    }

    if (senha.length < 6) {
        showToast('A senha deve ter pelo menos 6 caracteres!', 'error');
        return;
    }

    if (pin.length !== 4) {
        showToast('Crie um PIN de 4 dígitos!', 'error');
        return;
    }

    if (DB.clientes.find(c => c.email === email)) {
        showToast('Este e-mail já está cadastrado!', 'error');
        return;
    }

    if (DB.clientes.find(c => c.pin === pin)) {
        showToast('Este PIN já está em uso! Tente outro.', 'error');
        return;
    }

    const novoCliente = {
        id: DB.nextId.cliente++,
        nome, email, telefone, senha, pin
    };
    DB.clientes.push(novoCliente);

    if (DBReady) {
        const docId = await DB_SERVICE.addCliente(novoCliente);
        DB.clientes[DB.clientes.length - 1].docId = docId;
    }

    showToast('Conta criada com sucesso! Faça login.', 'success');
    switchLoginTab('senha');
    document.getElementById('loginEmail').value = email;
    document.getElementById('loginPassword').value = '';
    clearRegisterForm();
});

// ============================================
// LOGIN TABS
// ============================================
function switchLoginTab(tab) {
    document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.login-form').forEach(f => f.classList.remove('active'));

    const tabs = document.querySelectorAll('.login-tab');
    if (tab === 'senha') tabs[0].classList.add('active');
    if (tab === 'pin') tabs[1].classList.add('active');
    if (tab === 'conta') tabs[2].classList.add('active');

    document.getElementById(tab === 'senha' ? 'loginForm' : tab === 'pin' ? 'pinForm' : 'registerForm').classList.add('active');
}

// ============================================
// PIN INPUT HANDLING
// ============================================
function handlePinInput(input, pos) {
    if (input.value.length === 1) {
        input.classList.add('filled');
        if (pos < 4) {
            document.querySelector(`.pin-digit[data-pin="${pos + 1}"]`).focus();
        }
    } else {
        input.classList.remove('filled');
    }
}

function handlePinKeydown(e, pos) {
    if (e.key === 'Backspace' && !e.target.value && pos > 1) {
        const prev = document.querySelector(`.pin-digit[data-pin="${pos - 1}"]`);
        prev.focus();
        prev.value = '';
        prev.classList.remove('filled');
    }
}

function handleRegPinInput(input, pos) {
    if (input.value.length === 1) {
        input.classList.add('filled');
        if (pos < 4) {
            document.querySelector(`.reg-pin[data-regpin="${pos + 1}"]`).focus();
        }
    } else {
        input.classList.remove('filled');
    }
}

function handleRegPinKeydown(e, pos) {
    if (e.key === 'Backspace' && !e.target.value && pos > 1) {
        const prev = document.querySelector(`.reg-pin[data-regpin="${pos - 1}"]`);
        prev.focus();
        prev.value = '';
        prev.classList.remove('filled');
    }
}

function clearRegisterForm() {
    document.getElementById('regNome').value = '';
    document.getElementById('regEmail').value = '';
    document.getElementById('regTelefone').value = '';
    document.getElementById('regSenha').value = '';
    document.querySelectorAll('.reg-pin').forEach(d => { d.value = ''; d.classList.remove('filled'); });
}

function logout() {
    limparSessao();
    currentUser = null;
    currentChatClient = null;
    selectedPedidoId = null;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('loginScreen').classList.add('active');
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('pinEmail').value = '';
    document.querySelectorAll('.pin-digit').forEach(d => { d.value = ''; d.classList.remove('filled'); });
    switchLoginTab('senha');
}

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

// ============================================
// NAVIGATION
// ============================================
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        const page = this.dataset.page;
        const parent = this.closest('.sidebar');
        const contentArea = parent.nextElementSibling.querySelector('.content-area');

        parent.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        this.classList.add('active');

        contentArea.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(page).classList.add('active');

        const titles = {
            adminHome: 'Painel Administrativo',
            adminServicos: 'Gerenciar Serviços',
            adminMateriais: 'Gerenciar Materiais',
            adminPedidos: 'Gerenciar Pedidos',
            adminFinanceiro: 'Controle Financeiro',
            adminChat: 'Chat com Clientes',
            adminClientes: 'Gerenciar Clientes',
            adminConfig: 'Configurações',
            clientHome: 'Painel do Cliente',
            clientServicos: 'Nossos Serviços',
            clientMateriais: 'Materiais Disponíveis',
            clientPedidos: 'Meus Pedidos',
            clientChat: 'Chat com Suporte'
        };

        const titleEl = parent.classList.contains('client-sidebar') ? 'pageTitleClient' : 'pageTitle';
        document.getElementById(titleEl).textContent = titles[page] || '';

        renderCurrentPage(page);
    });
});

function renderCurrentPage(page) {
    switch(page) {
        case 'adminHome': renderAdminDashboard(); break;
        case 'adminServicos': renderServicosAdmin(); break;
        case 'adminMateriais': renderMateriaisAdmin(); break;
        case 'adminPedidos': renderPedidosAdmin(); break;
        case 'adminFinanceiro': renderFinanceiro(); break;
        case 'adminChat': renderChatList(); break;
        case 'adminClientes': renderClientes(); break;
        case 'adminConfig': preencherFormConfig(); break;
        case 'clientHome': renderClientDashboard(); break;
        case 'clientServicos': renderServicosClient(); break;
        case 'clientMateriais': renderMateriaisClient(); break;
        case 'clientPedidos': renderPedidosClient(); break;
        case 'clientChat': renderClientChat(); break;
    }
}

function toggleSidebar(id) {
    document.getElementById(id).classList.toggle('open');
}

// ============================================
// ADMIN DASHBOARD
// ============================================
// ============================================
// DASHBOARD ADMIN (gráficos, filtros, movimentações detalhadas)
// ============================================
const dashFiltros = { periodo: 'todos', tipo: 'todos', busca: '' };

function dashCores() {
    const cs = getComputedStyle(document.body);
    const texto = cs.getPropertyValue('--dark').trim() || '#2d3436';
    const grid = cs.getPropertyValue('--gray-light').trim() || 'rgba(0,0,0,0.12)';
    return { texto, grid };
}

function compactValor(v) {
    if (v >= 1000) return (v / 1000).toFixed(1).replace('.', ',') + 'k';
    return String(Math.round(v));
}

function dashEmPeriodo(data) {
    const f = dashFiltros.periodo;
    if (f === 'todos' || !data) return true;
    const hoje = new Date();
    const d = new Date(data + 'T00:00:00');
    if (f === '7') return (hoje - d) / 86400000 <= 7;
    if (f === '30') return (hoje - d) / 86400000 <= 30;
    if (f === 'mes') return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
    if (f === 'ano') return d.getFullYear() === hoje.getFullYear();
    return true;
}

function dashPeriodoLabel() {
    const map = { '7': '7 dias', '30': '30 dias', 'mes': 'este mês', 'ano': 'este ano', 'todos': '' };
    return map[dashFiltros.periodo];
}

function aplicarFiltrosDashboard() {
    dashFiltros.periodo = document.getElementById('filtroPeriodoDash').value;
    dashFiltros.tipo = document.getElementById('filtroTipoDash').value;
    dashFiltros.busca = document.getElementById('buscaMovDash').value.trim().toLowerCase();
    renderAdminDashboard();
}

function limparFiltrosDashboard() {
    document.getElementById('filtroPeriodoDash').value = 'todos';
    document.getElementById('filtroTipoDash').value = 'todos';
    document.getElementById('buscaMovDash').value = '';
    dashFiltros.periodo = 'todos'; dashFiltros.tipo = 'todos'; dashFiltros.busca = '';
    renderAdminDashboard();
}

function nomeClienteDoPedido(pedidoId) {
    const p = DB.pedidos.find(x => x.id === pedidoId);
    if (!p) return '';
    const c = DB.clientes.find(x => x.id === p.clienteId);
    return c ? c.nome : '';
}

function renderAdminDashboard() {
    const movs = DB.movimentacoes.filter(m => dashEmPeriodo(m.data) && (dashFiltros.tipo === 'todos' || m.tipo === dashFiltros.tipo));
    const totalReceita = movs.filter(m => m.tipo === 'entrada' && m.pagamento !== 'pendente').reduce((s, m) => s + m.valor, 0);
    const pedidosAtivos = DB.pedidos.filter(p => p.status !== 'cancelado' && p.status !== 'concluido').length;

    document.getElementById('statReceita').textContent = formatCurrency(totalReceita);
    document.getElementById('statPedidos').textContent = pedidosAtivos;
    document.getElementById('statClientes').textContent = DB.clientes.length;
    document.getElementById('statMateriais').textContent = DB.materiais.length;
    const statPeriodoEl = document.getElementById('statPeriodoReceita');
    if (statPeriodoEl) statPeriodoEl.textContent = dashPeriodoLabel() ? `(${dashPeriodoLabel()})` : '';

    const ultimosPedidos = [...DB.pedidos].filter(p => dashEmPeriodo(p.data)).sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 5);
    const container = document.getElementById('ultimosPedidos');
    if (ultimosPedidos.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhum pedido encontrado neste período</p>';
    } else {
        container.innerHTML = ultimosPedidos.map(p => {
            const cliente = DB.clientes.find(c => c.id === p.clienteId);
            return `<div class="pedido-item">
                <div class="pedido-item-info">
                    <h5>Pedido #${p.id} - ${cliente ? cliente.nome : 'N/A'}</h5>
                    <p>${formatDate(p.data)}</p>
                </div>
                <div>
                    <span class="status-badge status-${p.status}">${statusLabel(p.status)}</span>
                </div>
            </div>`;
        }).join('');
    }

    let ultimasMovs = [...movs].sort((a, b) => new Date(b.data) - new Date(a.data));
    if (dashFiltros.busca) {
        ultimasMovs = ultimasMovs.filter(m => {
            const cliente = nomeClienteDoPedido(m.pedidoId) || '';
            return (m.descricao || '').toLowerCase().includes(dashFiltros.busca) || cliente.toLowerCase().includes(dashFiltros.busca);
        });
    }
    const movContainer = document.getElementById('ultimasMovimentacoes');
    const mostrarMovs = ultimasMovs.slice(0, 8);
    if (mostrarMovs.length === 0) {
        movContainer.innerHTML = '<p class="empty-state">Nenhuma movimentação encontrada' + (dashFiltros.busca ? ' para a busca acima' : ' neste período') + '</p>';
    } else {
        movContainer.innerHTML = mostrarMovs.map(m => {
            const cliente = nomeClienteDoPedido(m.pedidoId);
            const pendente = m.tipo === 'entrada' && m.pagamento === 'pendente';
            return `<div class="mov-item${pendente ? ' mov-pendente' : ''}">
                <div class="mov-item-left">
                    <div class="mov-item-icon ${m.tipo}">
                        <i class="fas fa-arrow-${m.tipo === 'entrada' ? 'up' : 'down'}"></i>
                    </div>
                    <div class="mov-item-info">
                        <h5>${m.descricao}</h5>
                        <p>${formatDate(m.data)}${cliente ? ` · ${cliente}` : ''} · ${capitalize(m.categoria)}</p>
                        <span class="status-badge status-${pendente ? 'pendente' : m.tipo === 'entrada' ? 'concluido' : 'cancelado'}">${pendente ? 'Pendente' : metodoPagamentoRotulo(m.pagamento)}</span>
                    </div>
                </div>
                <div class="mov-item-value ${m.tipo}">${m.tipo === 'entrada' ? '+' : '-'}${formatCurrency(m.valor)}</div>
            </div>`;
        }).join('');
    }

    desenharGraficoBarras();
    desenharDonutServicos();
}

// ----- Gráfico de barras: receitas x despesas (últimos 6 meses) -----
function desenharGraficoBarras() {
    const canvas = document.getElementById('graficoBarras');
    const legendEl = document.getElementById('legendBarras');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cores = dashCores();
    const dpr = window.devicePixelRatio || 1;
    const wrap = canvas.parentElement;
    const cssW = wrap.clientWidth || 320;
    const cssH = 220;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const agora = new Date();
    const meses = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
        meses.push({ ano: d.getFullYear(), mes: d.getMonth(), entradas: 0, saidas: 0 });
    }
    DB.movimentacoes.forEach(m => {
        const idx = meses.findIndex(x => `${x.ano}-${String(x.mes + 1).padStart(2, '0')}` === (m.data || '').slice(0, 7));
        if (idx === -1) return;
        if (m.tipo === 'entrada' && m.pagamento !== 'pendente') meses[idx].entradas += m.valor;
        if (m.tipo === 'saida') meses[idx].saidas += m.valor;
    });

    const maxVal = Math.max(...meses.flatMap(x => [x.entradas, x.saidas]), 1);
    const padL = 46, padR = 10, padT = 18, padB = 26;
    const w = cssW - padL - padR;
    const h = cssH - padT - padB;
    ctx.clearRect(0, 0, cssW, cssH);

    const linhas = 4;
    ctx.lineWidth = 1;
    ctx.strokeStyle = cores.grid;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = cores.texto;
    for (let i = 0; i <= linhas; i++) {
        const y = padT + (h / linhas) * i;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(cssW - padR, y);
        ctx.stroke();
        ctx.fillText(compactValor(maxVal - (maxVal / linhas) * i), padL - 6, y);
    }

    const nomesMesShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const barW = Math.min(26, (w / meses.length) / 2.6);
    meses.forEach((m, i) => {
        const groupW = w / meses.length;
        const xC = padL + groupW * i + groupW / 2;
        const hE = (m.entradas / maxVal) * h;
        const hS = (m.saidas / maxVal) * h;
        ctx.fillStyle = '#667eea';
        ctx.fillRect(xC - barW - 2, padT + h - Math.max(hE, 1), barW, Math.max(hE, 1));
        ctx.fillStyle = '#f5576c';
        ctx.fillRect(xC + 2, padT + h - Math.max(hS, 1), barW, Math.max(hS, 1));
        ctx.fillStyle = cores.texto;
        ctx.font = '9px Inter, sans-serif';
        if (hE > 0) ctx.fillText(compactValor(m.entradas), xC - barW - 2, padT + h - hE - 6);
        if (hS > 0) ctx.fillText(compactValor(m.saidas), xC + 2, padT + h - hS - 6);
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(nomesMesShort[m.mes], xC, padT + h + 16);
        ctx.textAlign = 'right';
    });

    if (legendEl) legendEl.innerHTML = `<span class="leg-item"><i style="background:#667eea"></i>Entradas</span><span class="leg-item"><i style="background:#f5576c"></i>Saídas</span>`;
}

// ----- Donut: receita por serviço (apenas pagamentos confirmados) -----
function desenharDonutServicos() {
    const ring = document.getElementById('donutServicosRing');
    const legendEl = document.getElementById('legendServicos');
    const totalEl = document.getElementById('donutTotal');
    if (!ring || !legendEl || !totalEl) return;

    const servicosMap = {};
    let outros = 0;
    DB.movimentacoes.forEach(m => {
        if (m.tipo !== 'entrada' || m.pagamento === 'pendente') return;
        const pedido = m.pedidoId ? DB.pedidos.find(p => p.id === m.pedidoId) : null;
        if (!pedido || !pedido.servicos || !pedido.servicos.length) { outros += m.valor; return; }
        const share = m.valor / pedido.servicos.length;
        pedido.servicos.forEach(id => {
            const nome = (DB.servicos.find(s => s.id === id) || {}).nome || 'Serviço';
            servicosMap[nome] = (servicosMap[nome] || 0) + share;
        });
    });
    if (outros > 1e-9) servicosMap['Outros'] = outros;

    const entradas = Object.entries(servicosMap).sort((a, b) => b[1] - a[1]);
    const total = entradas.reduce((s, [, v]) => s + v, 0);
    totalEl.textContent = formatCurrency(total);

    if (!total) {
        ring.style.background = 'conic-gradient(#e1e8f0 0 100%)';
        legendEl.innerHTML = '<span class="leg-vazio">Sem receita confirmada ainda</span>';
        return;
    }

    const cores = ['#667eea', '#f093fb', '#43e97b', '#fdcb6e', '#f5576c', '#00b894', '#4facfe', '#e17055', '#6c5ce7', '#00cec9'];
    let acum = 0;
    const partes = [];
    const legend = entradas.map(([nome, valor], i) => {
        const pct = (valor / total) * 100;
        const cor = cores[i % cores.length];
        partes.push(`${cor} ${acum.toFixed(2)}% ${(acum + pct).toFixed(2)}%`);
        acum += pct;
        return `<span class="leg-item"><i style="background:${cor}"></i>${nome}<strong>${formatCurrency(valor)}</strong></span>`;
    }).join('');
    ring.style.background = `conic-gradient(${partes.join(', ')})`;
    legendEl.innerHTML = legend;
}

// ============================================
// SERVIÇOS ADMIN
// ============================================
function renderServicosAdmin() {
    const container = document.getElementById('listaServicosAdmin');
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
        <div class="item-card-actions">
            <button class="btn-secondary btn-sm" onclick="editarServico(${s.id})"><i class="fas fa-edit"></i> Editar</button>
            <button class="btn-danger btn-sm" onclick="excluirServico(${s.id})"><i class="fas fa-trash"></i> Excluir</button>
        </div>
    </div>`).join('');
}

function editarServico(id) {
    const s = DB.servicos.find(x => x.id === id);
    if (!s) return;
    document.getElementById('servicoId').value = s.id;
    document.getElementById('servicoNome').value = s.nome;
    document.getElementById('servicoDescricao').value = s.descricao;
    document.getElementById('servicoPreco').value = s.preco;
    document.getElementById('servicoDuracao').value = s.duracao;
    document.getElementById('servicoIcone').value = s.icone;

    const preview = document.getElementById('servicoImgPreview');
    if (s.imagem) {
        preview.innerHTML = `<img src="${s.imagem}" class="upload-preview"><div class="upload-actions"><span>Foto atual</span><button onclick="removerImagemServico(event)"><i class="fas fa-trash"></i> Remover</button></div>`;
    } else {
        preview.innerHTML = `<i class="fas fa-cloud-upload-alt"></i><p>Clique para selecionar uma foto</p><span>ou arraste e solte aqui</span>`;
    }

    document.getElementById('servicoModalTitle').textContent = 'Editar Serviço';
    openModal('servicoModal');
}

async function excluirServico(id) {
    if (!confirm('Tem certeza que deseja excluir este serviço?')) return;
    const item = DB.servicos.find(s => s.id === id);
    DB.servicos = DB.servicos.filter(s => s.id !== id);
    if (DBReady && item?.docId) await DB_SERVICE.deleteServico(item.docId);
    renderServicosAdmin();
    showToast('Serviço excluído!', 'success');
}

async function salvarServico() {
    const id = document.getElementById('servicoId').value;
    const fileInput = document.getElementById('servicoImagem');
    const imagemBase64 = fileInput.dataset.base64 || '';

    const data = {
        nome: document.getElementById('servicoNome').value,
        descricao: document.getElementById('servicoDescricao').value,
        preco: parseFloat(document.getElementById('servicoPreco').value) || 0,
        duracao: document.getElementById('servicoDuracao').value,
        icone: document.getElementById('servicoIcone').value || 'fa-cog',
        imagem: imagemBase64
    };

    if (!data.nome) { showToast('Preencha o nome do serviço!', 'error'); return; }

    if (id) {
        const idx = DB.servicos.findIndex(s => s.id === parseInt(id));
        if (idx !== -1) {
            if (!data.imagem) data.imagem = DB.servicos[idx].imagem;
            DB.servicos[idx] = { ...DB.servicos[idx], ...data };
            if (DBReady) await DB_SERVICE.updateServico(DB.servicos[idx].docId, data);
        }
    } else {
        data.id = DB.nextId.servico++;
        DB.servicos.push(data);
        if (DBReady) {
            const docId = await DB_SERVICE.addServico(data);
            DB.servicos[DB.servicos.length - 1].docId = docId;
        }
    }

    closeAllModals();
    renderServicosAdmin();
    showToast(id ? 'Serviço atualizado!' : 'Serviço criado!', 'success');
    clearForm('servico');
}

function removerImagemServico(e) {
    e.stopPropagation();
    document.getElementById('servicoImagem').value = '';
    delete document.getElementById('servicoImagem').dataset.base64;
    document.getElementById('servicoImgPreview').innerHTML = `<i class="fas fa-cloud-upload-alt"></i><p>Clique para selecionar uma foto</p><span>ou arraste e solte aqui</span>`;
}

// ============================================
// MATERIAIS ADMIN
// ============================================
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
                <span class="item-card-badge ${m.estoque > 0 ? 'badge-estoque' : 'badge-sem-estoque'}">${m.estoque} em estoque</span>
            </div>
        </div>
        <div class="item-card-actions">
            <button class="btn-secondary btn-sm" onclick="editarMaterial(${m.id})"><i class="fas fa-edit"></i> Editar</button>
            <button class="btn-danger btn-sm" onclick="excluirMaterial(${m.id})"><i class="fas fa-trash"></i> Excluir</button>
        </div>
    </div>`).join('');
}

function editarMaterial(id) {
    const m = DB.materiais.find(x => x.id === id);
    if (!m) return;
    document.getElementById('materialId').value = m.id;
    document.getElementById('materialNome').value = m.nome;
    document.getElementById('materialDescricao').value = m.descricao;
    document.getElementById('materialPreco').value = m.preco;
    document.getElementById('materialEstoque').value = m.estoque;
    document.getElementById('materialCategoria').value = m.categoria;

    const preview = document.getElementById('materialImgPreview');
    if (m.imagem) {
        preview.innerHTML = `<img src="${m.imagem}" class="upload-preview"><div class="upload-actions"><span>Foto atual</span><button onclick="removerImagemMaterial(event)"><i class="fas fa-trash"></i> Remover</button></div>`;
    } else {
        preview.innerHTML = `<i class="fas fa-cloud-upload-alt"></i><p>Clique para selecionar uma foto</p><span>ou arraste e solte aqui</span>`;
    }

    document.getElementById('materialModalTitle').textContent = 'Editar Material';
    openModal('materialModal');
}

async function excluirMaterial(id) {
    if (!confirm('Tem certeza que deseja excluir este material?')) return;
    const item = DB.materiais.find(m => m.id === id);
    DB.materiais = DB.materiais.filter(m => m.id !== id);
    if (DBReady && item?.docId) await DB_SERVICE.deleteMaterial(item.docId);
    renderMateriaisAdmin();
    showToast('Material excluído!', 'success');
}

async function salvarMaterial() {
    const id = document.getElementById('materialId').value;
    const fileInput = document.getElementById('materialImagem');
    const imagemBase64 = fileInput.dataset.base64 || '';

    const data = {
        nome: document.getElementById('materialNome').value,
        descricao: document.getElementById('materialDescricao').value,
        preco: parseFloat(document.getElementById('materialPreco').value) || 0,
        estoque: parseInt(document.getElementById('materialEstoque').value) || 0,
        categoria: document.getElementById('materialCategoria').value,
        imagem: imagemBase64
    };

    if (!data.nome) { showToast('Preencha o nome do material!', 'error'); return; }

    if (id) {
        const idx = DB.materiais.findIndex(m => m.id === parseInt(id));
        if (idx !== -1) {
            if (!data.imagem) data.imagem = DB.materiais[idx].imagem;
            DB.materiais[idx] = { ...DB.materiais[idx], ...data };
            if (DBReady) await DB_SERVICE.updateMaterial(DB.materiais[idx].docId, data);
        }
    } else {
        data.id = DB.nextId.material++;
        DB.materiais.push(data);
        if (DBReady) {
            const docId = await DB_SERVICE.addMaterial(data);
            DB.materiais[DB.materiais.length - 1].docId = docId;
        }
    }

    closeAllModals();
    renderMateriaisAdmin();
    showToast(id ? 'Material atualizado!' : 'Material criado!', 'success');
    clearForm('material');
}

function removerImagemMaterial(e) {
    e.stopPropagation();
    document.getElementById('materialImagem').value = '';
    delete document.getElementById('materialImagem').dataset.base64;
    document.getElementById('materialImgPreview').innerHTML = `<i class="fas fa-cloud-upload-alt"></i><p>Clique para selecionar uma foto</p><span>ou arraste e solte aqui</span>`;
}

// ============================================
// PEDIDOS ADMIN
// ============================================
function renderPedidosAdmin() {
    const selCliente = document.getElementById('filtroClientePedido');
    const clienteVal = selCliente.value;
    selCliente.innerHTML = '<option value="">Todos os clientes</option>' +
        DB.clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    selCliente.value = clienteVal;

    const busca = (document.getElementById('buscaPedidoAdmin').value || '').trim().toLowerCase();
    let pedidos = DB.pedidos.filter(p => {
        const cliente = DB.clientes.find(c => c.id === p.clienteId);
        const nome = cliente ? cliente.nome.toLowerCase() : '';
        if (clienteVal && p.clienteId !== parseInt(clienteVal)) return false;
        if (busca && !String(p.id).includes(busca.replace('#', '')) && !nome.includes(busca)) return false;
        return true;
    });

    renderKanbanPedidos(pedidos);

    const filtro = document.getElementById('filtroStatusPedido').value;
    let tabela = pedidos;
    if (filtro !== 'todos') tabela = tabela.filter(p => p.status === filtro);
    const tbody = document.getElementById('pedidosAdminBody');
    tbody.innerHTML = tabela.map(p => {
        const cliente = DB.clientes.find(c => c.id === p.clienteId);
        const servicoNomes = p.servicos.map(id => DB.servicos.find(s => s.id === id)?.nome || '').filter(Boolean).join(', ');
        const condRotulo = p.parcial ? '50% + 50%' : (p.descontoPct ? `-${p.descontoPct}% à vista` : '');
        return `<tr>
            <td><strong>#${p.id}</strong></td>
            <td>${cliente ? cliente.nome : 'N/A'}</td>
            <td>${servicoNomes || '-'}</td>
            <td><strong>${formatCurrency(p.total)}</strong>${condRotulo ? `<small class="cond-badge">${condRotulo}</small>` : ''}</td>
            <td><span class="status-badge status-${p.status}">${statusLabel(p.status)}</span></td>
            <td>${formatDate(p.data)}</td>
            <td>
                <div class="table-actions">
                    <button onclick="verDetalhesPedido(${p.id})" title="Ver Detalhes"><i class="fas fa-eye"></i></button>
                    <button onclick="editarPedido(${p.id})" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-del" onclick="excluirPedido(${p.id})" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function pedidoKanbanCard(p) {
    const cliente = DB.clientes.find(c => c.id === p.clienteId);
    const servicoNomes = p.servicos.map(id => DB.servicos.find(s => s.id === id)?.nome || '').filter(Boolean);
    const mostrar = servicoNomes.slice(0, 2);
    const extra = servicoNomes.length - mostrar.length;
    const pagos = valorPagoPedido(p) > 0;
    const pagoTotal = pedidoPagamentoCompleto(p);
    const condRotulo = p.parcial ? 'Dividido 50%+50%' : (p.descontoPct ? `À vista -${p.descontoPct}%` : '');
    return `<div class="kanban-card" draggable="true" ondragstart="dragPedido(event, ${p.id})" ondragend="this.classList.remove('dragging')">
        <div class="kanban-card-top">
            <strong>#${p.id}</strong>
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
            <strong class="kanban-total">${formatCurrency(p.total)}</strong>
            <span class="kanban-data">${formatDate(p.data)}</span>
        </div>
        <div class="kanban-card-acoes">
            <button title="Ver detalhes" onclick="verDetalhesPedido(${p.id})"><i class="fas fa-eye"></i></button>
            <button title="Avançar etapa" onclick="avancarStagePedido(${p.id})"><i class="fas fa-forward"></i></button>
            <button title="Editar" onclick="editarPedido(${p.id})"><i class="fas fa-edit"></i></button>
            <button class="btn-del" title="Excluir" onclick="excluirPedido(${p.id})"><i class="fas fa-trash"></i></button>
        </div>
    </div>`;
}

function renderKanbanPedidos(pedidos) {
    const cols = [
        { status: 'pendente', rotulo: 'Pendente', icone: 'fa-hourglass-half', cor: '#fdcb6e' },
        { status: 'em_andamento', rotulo: 'Em Andamento', icone: 'fa-spinner', cor: '#6c5ce7' },
        { status: 'concluido', rotulo: 'Concluído', icone: 'fa-check-circle', cor: '#00b894' },
        { status: 'cancelado', rotulo: 'Cancelado', icone: 'fa-ban', cor: '#d63031' }
    ];
    const board = document.getElementById('kanbanPedidos');
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

function dragPedido(event, id) {
    event.dataTransfer.setData('text/plain', String(id));
    event.dataTransfer.effectAllowed = 'move';
    event.currentTarget.classList.add('dragging');
}

async function moverPedidoStatus(id, novoStatus) {
    const p = DB.pedidos.find(x => x.id === id);
    if (!p || p.status === novoStatus) return;
    p.status = novoStatus;
    if (DBReady) {
        await DB_SERVICE.updatePedido(p.docId, { clienteId: p.clienteId, servicos: p.servicos, materiais: p.materiais, desconto: p.desconto, status: novoStatus, total: p.total, parcial: p.parcial || 0, descontoPct: p.descontoPct || 0 });
    }
    const mov = DB.movimentacoes.find(m => m.pedidoId === id && m.pagamento === 'pendente');
    if (novoStatus === 'cancelado' && mov) {
        DB.movimentacoes = DB.movimentacoes.filter(m => m.id !== mov.id);
        if (DBReady && mov.docId) await DB_SERVICE.deleteMovimentacao(mov.docId);
    }
    renderPedidosAdmin();
    renderAdminDashboard();
    renderFinanceiro();
    showToast(`Pedido #${id} movido para ${statusLabel(novoStatus)}`, 'success');
}

async function soltarPedidoKanban(event, status) {
    event.preventDefault();
    event.currentTarget.classList.remove('kanban-over');
    const id = parseInt(event.dataTransfer.getData('text/plain'));
    if (id) await moverPedidoStatus(id, status);
}

const ordemPedidoStage = ['pendente', 'em_andamento', 'concluido'];
function avancarStagePedido(id) {
    const p = DB.pedidos.find(x => x.id === id);
    if (!p) return;
    if (p.status === 'cancelado') { moverPedidoStatus(id, 'pendente'); return; }
    const idx = ordemPedidoStage.indexOf(p.status);
    moverPedidoStatus(id, ordemPedidoStage[Math.min(idx + 1, ordemPedidoStage.length - 1)]);
}

function alternarVisaoPedidos(modo) {
    document.getElementById('kanbanPedidos').style.display = modo === 'board' ? '' : 'none';
    document.getElementById('tabelaPedidosWrap').style.display = modo === 'board' ? 'none' : 'block';
    document.getElementById('btnViewBoard').classList.toggle('active', modo === 'board');
    document.getElementById('btnViewTable').classList.toggle('active', modo === 'table');
    document.getElementById('wrapStatusFiltro').style.display = modo === 'board' ? 'none' : 'inline-flex';
    renderPedidosAdmin();
}

function preparePedidoModal() {
    const clienteSelect = document.getElementById('pedidoCliente');
    clienteSelect.innerHTML = DB.clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

    const servicosDiv = document.getElementById('pedidoServicos');
    servicosDiv.innerHTML = DB.servicos.map(s => `<div class="checkbox-item">
        <input type="checkbox" id="ps_${s.id}" value="${s.id}" onchange="updatePedidoTotal()">
        <label for="ps_${s.id}">${s.nome}</label>
        <span class="item-price">${formatCurrency(s.preco)}</span>
    </div>`).join('');

    const materiaisDiv = document.getElementById('pedidoMateriais');
    materiaisDiv.innerHTML = DB.materiais.map(m => `<div class="checkbox-item">
        <input type="checkbox" id="pm_${m.id}" value="${m.id}" onchange="updatePedidoTotal()">
        <label for="pm_${m.id}">${m.nome}</label>
        ${formatMaterialPrice(m, 'item-price')}
    </div>`).join('');
}

function updatePedidoTotal() {
    let total = 0;
    document.querySelectorAll('#pedidoServicos input:checked').forEach(cb => {
        const s = DB.servicos.find(x => x.id === parseInt(cb.value));
        if (s) total += s.preco;
    });
    document.querySelectorAll('#pedidoMateriais input:checked').forEach(cb => {
        const m = DB.materiais.find(x => x.id === parseInt(cb.value));
        if (m) total += m.preco;
    });
    const desconto = parseFloat(document.getElementById('pedidoDesconto').value) || 0;
    total -= desconto;
    document.getElementById('pedidoTotalPreview').textContent = formatCurrency(Math.max(0, total));
}

async function salvarPedido() {
    const id = document.getElementById('pedidoId').value;
    const clienteId = parseInt(document.getElementById('pedidoCliente').value);
    const servicos = [...document.querySelectorAll('#pedidoServicos input:checked')].map(cb => parseInt(cb.value));
    const materiais = [...document.querySelectorAll('#pedidoMateriais input:checked')].map(cb => parseInt(cb.value));
    const desconto = parseFloat(document.getElementById('pedidoDesconto').value) || 0;
    const status = document.getElementById('pedidoStatus').value;

    if (servicos.length === 0 && materiais.length === 0) {
        showToast('Selecione pelo menos um serviço ou material!', 'error');
        return;
    }

    let total = 0;
    servicos.forEach(id => { const s = DB.servicos.find(x => x.id === id); if (s) total += s.preco; });
    materiais.forEach(id => { const m = DB.materiais.find(x => x.id === id); if (m) total += m.preco; });
    total = Math.max(0, total - desconto);

    let pedidoSalvo;
    if (id) {
        const idx = DB.pedidos.findIndex(p => p.id === parseInt(id));
        if (idx !== -1) {
            DB.pedidos[idx] = { ...DB.pedidos[idx], clienteId, servicos, materiais, desconto, status, total };
            pedidoSalvo = DB.pedidos[idx];
            if (DBReady) await DB_SERVICE.updatePedido(pedidoSalvo.docId, { clienteId, servicos, materiais, desconto, status, total, parcial: pedidoSalvo.parcial || 0, descontoPct: pedidoSalvo.descontoPct || 0 });
        }
    } else {
        const novoPedido = {
            id: DB.nextId.pedido++, clienteId, servicos, materiais, desconto, status, total,
            data: new Date().toISOString().split('T')[0]
        };
        DB.pedidos.push(novoPedido);
        pedidoSalvo = novoPedido;
        if (DBReady) {
            const docId = await DB_SERVICE.addPedido(novoPedido);
            DB.pedidos[DB.pedidos.length - 1].docId = docId;
        }
    }

    await sincronizarFinanceiroPedido(pedidoSalvo);

    closeAllModals();
    renderPedidosAdmin();
    renderAdminDashboard();
    renderFinanceiro();
    showToast(id ? 'Pedido atualizado!' : 'Pedido criado!', 'success');
    clearForm('pedido');
}

function editarPedido(id) {
    preparePedidoModal();
    const p = DB.pedidos.find(x => x.id === id);
    if (!p) return;
    document.getElementById('pedidoId').value = p.id;
    document.getElementById('pedidoCliente').value = p.clienteId;
    document.getElementById('pedidoDesconto').value = p.desconto;
    document.getElementById('pedidoStatus').value = p.status;

    p.servicos.forEach(sId => {
        const cb = document.getElementById(`ps_${sId}`);
        if (cb) cb.checked = true;
    });
    p.materiais.forEach(mId => {
        const cb = document.getElementById(`pm_${mId}`);
        if (cb) cb.checked = true;
    });

    document.getElementById('pedidoModalTitle').textContent = 'Editar Pedido';
    updatePedidoTotal();
    openModal('pedidoModal');
}

async function excluirPedido(id) {
    if (!confirm('Tem certeza que deseja excluir este pedido?')) return;
    const item = DB.pedidos.find(p => p.id === id);
    DB.pedidos = DB.pedidos.filter(p => p.id !== id);
    const mov = DB.movimentacoes.find(m => m.pedidoId === id);
    if (mov) {
        DB.movimentacoes = DB.movimentacoes.filter(m => m.id !== mov.id);
        if (DBReady && mov.docId) await DB_SERVICE.deleteMovimentacao(mov.docId);
    }
    if (DBReady && item?.docId) await DB_SERVICE.deletePedido(item.docId);
    renderPedidosAdmin();
    renderAdminDashboard();
    renderFinanceiro();
    showToast('Pedido excluído!', 'success');
}

function verDetalhesPedido(id) {
    const p = DB.pedidos.find(x => x.id === id);
    if (!p) return;
    const cliente = DB.clientes.find(c => c.id === p.clienteId);
    const servicos = p.servicos.map(id => DB.servicos.find(s => s.id === id)).filter(Boolean);
    const materiais = p.materiais.map(id => DB.materiais.find(m => m.id === id)).filter(Boolean);

    let html = `
        <div class="detalhe-section">
            <h4><i class="fas fa-user"></i> Cliente</h4>
            <div class="detalhe-item"><span>${cliente ? cliente.nome : 'N/A'}</span></div>
        </div>
        <div class="detalhe-section">
            <h4><i class="fas fa-info-circle"></i> Informações</h4>
            <div class="detalhe-item"><span>Pedido</span><strong>#${p.id}</strong></div>
            <div class="detalhe-item"><span>Data</span><span>${formatDate(p.data)}</span></div>
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

    if (p.desconto > 0) {
        html += `<div class="detalhe-section"><div class="detalhe-item"><span>Desconto</span><span style="color:var(--danger)">-${formatCurrency(p.desconto)}</span></div></div>`;
    }

    html += `<div class="pedido-total"><span>Total do Pedido</span><strong>${formatCurrency(p.total)}</strong></div>`;

    document.getElementById('detalhesPedidoContent').innerHTML = html;
    openModal('detalhesPedidoModal');
}

// ============================================
// FINANCEIRO
// ============================================
function renderFinanceiro() {
    const recebido = DB.movimentacoes.filter(m => m.tipo === 'entrada' && m.pagamento !== 'pendente').reduce((s, m) => s + m.valor, 0);
    const aReceber = DB.movimentacoes.filter(m => m.tipo === 'entrada' && m.pagamento === 'pendente').reduce((s, m) => s + m.valor, 0);
    const saida = DB.movimentacoes.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.valor, 0);

    document.getElementById('totalEntradas').textContent = formatCurrency(recebido);
    const aReceberEl = document.getElementById('totalAReceber');
    if (aReceberEl) aReceberEl.textContent = formatCurrency(aReceber);
    document.getElementById('totalSaidas').textContent = formatCurrency(saida);
    document.getElementById('saldoGeral').textContent = formatCurrency(recebido - saida);

    renderMovimentacoes();
}

async function sincronizarFinanceiroPedido(p) {
    if (!p) return null;
    const existente = DB.movimentacoes.find(m => m.pedidoId === p.id) ||
        DB.movimentacoes.find(m => m.tipo === 'entrada' && (m.descricao || '').includes(`Pedido #${p.id}`) && m.pagamento !== 'pendente');

    if (p.status === 'cancelado') {
        if (existente) {
            DB.movimentacoes = DB.movimentacoes.filter(m => m.id !== existente.id);
            if (DBReady && existente.docId) await DB_SERVICE.deleteMovimentacao(existente.docId);
        }
        return null;
    }

    if (existente) {
        const mudancas = { tipo: 'entrada', descricao: `Pedido #${p.id}`, valor: p.total, categoria: 'servico', pagamento: existente.pagamento || 'pendente', data: existente.data, pedidoId: p.id };
        Object.assign(existente, mudancas);
        if (DBReady && existente.docId) await DB_SERVICE.updateMovimentacao(existente.docId, mudancas);
        return existente;
    }

    const nova = {
        id: DB.nextId.movimentacao++,
        tipo: 'entrada',
        descricao: `Pedido #${p.id}`,
        valor: p.total,
        categoria: 'servico',
        pagamento: 'pendente',
        data: new Date().toISOString().split('T')[0],
        pedidoId: p.id
    };
    DB.movimentacoes.push(nova);
    if (DBReady) {
        const docId = await DB_SERVICE.addMovimentacao(nova);
        nova.docId = docId;
    }
    return nova;
}

function renderMovimentacoes() {
    const filtroTipo = document.getElementById('filtroTipoMov').value;
    const dataInicio = document.getElementById('filtroDataInicio').value;
    const dataFim = document.getElementById('filtroDataFim').value;

    let movs = [...DB.movimentacoes];
    if (filtroTipo !== 'todos') movs = movs.filter(m => m.tipo === filtroTipo);
    if (dataInicio) movs = movs.filter(m => m.data >= dataInicio);
    if (dataFim) movs = movs.filter(m => m.data <= dataFim);

    movs.sort((a, b) => new Date(b.data) - new Date(a.data));

    const tbody = document.getElementById('movimentacoesBody');
    tbody.innerHTML = movs.map(m => `<tr class="${m.pagamento === 'pendente' ? 'mov-pendente' : ''}">
        <td>${formatDate(m.data)}</td>
        <td>${m.descricao}</td>
        <td><span class="status-badge status-${m.tipo === 'entrada' ? 'concluido' : 'cancelado'}">${capitalize(m.tipo)}</span></td>
        <td>${capitalize(m.categoria)}</td>
        <td class="mov-item-value ${m.tipo}">${m.tipo === 'entrada' ? '+' : '-'}${formatCurrency(m.valor)}</td>
        <td>${m.pagamento === 'pendente'
            ? `<span class="status-badge status-pendente">Pendente</span>`
            : metodoPagamentoRotulo(m.pagamento)}</td>
        <td>
            <div class="table-actions">
                <button class="btn-del" onclick="excluirMovimentacao(${m.id})" title="Excluir"><i class="fas fa-trash"></i></button>
            </div>
        </td>
    </tr>`).join('');
}

async function salvarMovimentacao() {
    const data = {
        tipo: document.getElementById('movTipo').value,
        descricao: document.getElementById('movDescricao').value,
        valor: parseFloat(document.getElementById('movValor').value) || 0,
        categoria: document.getElementById('movCategoria').value,
        pagamento: document.getElementById('movPagamento').value,
        data: document.getElementById('movData').value || new Date().toISOString().split('T')[0]
    };

    if (!data.descricao || !data.valor) {
        showToast('Preencha descrição e valor!', 'error');
        return;
    }

    data.id = DB.nextId.movimentacao++;
    DB.movimentacoes.push(data);
    if (DBReady) {
        const docId = await DB_SERVICE.addMovimentacao(data);
        DB.movimentacoes[DB.movimentacoes.length - 1].docId = docId;
    }

    closeAllModals();
    renderFinanceiro();
    renderAdminDashboard();
    showToast('Movimentação registrada!', 'success');
    clearForm('mov');
}

async function excluirMovimentacao(id) {
    if (!confirm('Tem certeza que deseja excluir esta movimentação?')) return;
    const item = DB.movimentacoes.find(m => m.id === id);
    DB.movimentacoes = DB.movimentacoes.filter(m => m.id !== id);
    if (DBReady && item?.docId) await DB_SERVICE.deleteMovimentacao(item.docId);
    renderFinanceiro();
    showToast('Movimentação excluída!', 'success');
}

// ============================================
// CLIENTES ADMIN
// ============================================
function valorPagoPedido(p) {
    return DB.movimentacoes
        .filter(m => m.tipo === 'entrada' && m.pagamento !== 'pendente' && (m.descricao || '').includes(`Pedido #${p.id}`))
        .reduce((s, m) => s + m.valor, 0);
}

function pedidoPagamentoCompleto(p) {
    return valorPagoPedido(p) >= valorEsperadoPedido(p);
}

function valorEsperadoPedido(p) {
    if (p && !p.parcial && p.descontoPct) return Math.max(0, (p.total || 0) * (1 - p.descontoPct / 100));
    return p.total || 0;
}

function metodoPagamentoRotulo(pagamento) {
    if (pagamento === 'cartao_credito') return 'Cartão';
    if (pagamento === 'pix') return 'PIX';
    if (pagamento === 'pendente') return 'Pendente';
    return (pagamento || '').charAt(0).toUpperCase() + (pagamento || '').slice(1);
}

function pagamentosPedidoResumo(p) {
    const pagamentos = DB.movimentacoes
        .filter(m => m.tipo === 'entrada' && m.pagamento !== 'pendente' && (m.descricao || '').includes(`Pedido #${p.id}`))
        .sort((a, b) => (a.data || '').localeCompare(b.data || '') || (a.id || 0) - (b.id || 0));
    if (pagamentos.length === 0) {
        const temPendente = DB.movimentacoes.some(m => m.pagamento === 'pendente' && (m.pedidoId === p.id || (m.descricao || '').includes(`Pedido #${p.id}`)));
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

function renderClientes() {
    const tbody = document.getElementById('clientesBody');
    tbody.innerHTML = DB.clientes.map(c => {
        const pedidos = DB.pedidos.filter(p => p.clienteId === c.id);
        const totalGasto = pedidos.reduce((s, p) => s + valorEsperadoPedido(p), 0);
        const aberto = clientesExpandidos.has(c.id);
        return `<tr class="cliente-row" onclick="toggleClienteDetalhe(${c.id})">
            <td><strong>${c.nome}</strong></td>
            <td>${c.email}</td>
            <td>${c.telefone}</td>
            <td>${pedidos.length}</td>
            <td><strong>${formatCurrency(totalGasto)}</strong></td>
            <td>
                <div class="table-actions">
                    <button title="${aberto ? 'Ocultar pedidos' : 'Ver pedidos'}" class="${aberto ? 'btn-ativo' : ''}"><i class="fas ${aberto ? 'fa-chevron-up' : 'fa-chevron-down'}"></i></button>
                    <button onclick="editarCliente(${c.id});event.stopPropagation()" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-del" onclick="excluirCliente(${c.id});event.stopPropagation()" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
        <tr class="cliente-detalhe" id="detalhe_${c.id}" style="${aberto ? '' : 'display:none;'}">
            <td colspan="6"></td>
        </tr>`;
    }).join('');
}

function htmlResumoServicosCliente(clienteId) {
    const pedidos = DB.pedidos.filter(p => p.clienteId === clienteId && p.status !== 'cancelado');
    const itens = new Map();
    pedidos.forEach(p => {
        (p.servicos || []).forEach(sId => {
            const s = DB.servicos.find(x => x.id === sId);
            if (!s || s.preco <= 0) return;
            const chave = `s_${sId}`;
            const item = itens.get(chave) || { tipo: 'Serviço', nome: s.nome, preco: s.preco, qtd: 0, sub: 0 };
            item.qtd++;
            item.sub += s.preco;
            itens.set(chave, item);
        });
        (p.materiais || []).forEach(mId => {
            const m = DB.materiais.find(x => x.id === mId);
            if (!m || m.preco <= 0) return;
            const chave = `m_${mId}`;
            const item = itens.get(chave) || { tipo: 'Material', nome: m.nome, preco: m.preco, qtd: 0, sub: 0 };
            item.qtd++;
            item.sub += m.preco;
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

function toggleClienteDetalhe(id) {
    const row = document.getElementById(`detalhe_${id}`);
    const content = document.createElement('div');
    const c = DB.clientes.find(x => x.id === id);
    const pedidos = DB.pedidos.filter(p => p.clienteId === id);
    const totalGasto = pedidos.reduce((s, p) => s + valorEsperadoPedido(p), 0);
    const totalPago = pedidos.reduce((s, p) => s + valorPagoPedido(p), 0);
    const emAberto = totalGasto - totalPago;

    content.className = 'cliente-detalhe-content';
    content.innerHTML = `
        <div class="cliente-resumo">
            <div class="resumo-card"><span>Pedidos</span><strong>${pedidos.length}</strong></div>
            <div class="resumo-card"><span>Total</span><strong>${formatCurrency(totalGasto)}</strong></div>
            <div class="resumo-card resumo-pago"><span>Pago</span><strong>${formatCurrency(totalPago)}</strong></div>
            <div class="resumo-card resumo-aberto"><span>Em aberto</span><strong>${formatCurrency(Math.max(0, emAberto))}</strong></div>
        </div>
        ${htmlResumoServicosCliente(id)}
        ${pedidos.length === 0
            ? '<p class="empty-state">Este cliente ainda não possui pedidos.</p>'
            : `<table class="data-table sub-table">
                <thead>
                    <tr><th>#</th><th>Data</th><th>O que foi feito</th><th>Como foi pago</th><th>Total</th><th>Pago</th><th>Em aberto</th><th>Status</th></tr>
                </thead>
                <tbody>
                    ${pedidos.map(p => {
                        const itens = [
                            ...p.servicos.map(id => DB.servicos.find(s => s.id === id)?.nome).filter(Boolean),
                            ...p.materiais.map(id => DB.materiais.find(m => m.id === id)?.nome).filter(Boolean)
                        ];
                        const nomes = itens.join('<br>');
                        const esperado = valorEsperadoPedido(p);
                        const pago = valorPagoPedido(p);
                        const restante = Math.max(0, esperado - pago);
                        const pagoCls = pago >= esperado ? 'valor-pago' : '';
                        const abertoCls = restante > 0 ? 'valor-aberto' : '';
                        const cond = p.parcial
                            ? '<span class="pag-cond">50% + 50%</span>'
                            : (p.descontoPct ? `<span class="pag-cond">-${p.descontoPct}% à vista</span>` : '');
                        return `<tr>
                            <td><strong>#${p.id}</strong></td>
                            <td>${formatDate(p.data)}</td>
                            <td style="max-width:280px;white-space:normal;">${nomes || '-'}</td>
                            <td>${pagamentosPedidoResumo(p)}${cond ? `<div style="margin-top:4px;">${cond}</div>` : ''}</td>
                            <td><strong>${formatCurrency(esperado)}</strong></td>
                            <td class="${pagoCls}">${formatCurrency(pago)}</td>
                            <td class="${abertoCls}">${formatCurrency(restante)}</td>
                            <td><span class="status-badge status-${p.status}">${statusLabel(p.status)}</span></td>
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="4"><strong>Somatória</strong></td>
                        <td class="valor-total"><strong>${formatCurrency(totalGasto)}</strong></td>
                        <td class="valor-pago" style="font-size:14px;"><strong>${formatCurrency(totalPago)}</strong></td>
                        <td class="valor-aberto" style="font-size:14px;"><strong>${formatCurrency(Math.max(0, emAberto))}</strong></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>`}
    `;

    const td = row.firstElementChild;
    if (clientesExpandidos.has(id)) {
        clientesExpandidos.delete(id);
        row.style.display = 'none';
        td.innerHTML = '';
    } else {
        clientesExpandidos.add(id);
        td.innerHTML = '';
        td.appendChild(content);
        row.style.display = '';
    }
    renderClientes();
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
    const data = {
        nome: document.getElementById('clienteNome').value,
        email: document.getElementById('clienteEmail').value,
        telefone: document.getElementById('clienteTelefone').value,
        senha: document.getElementById('clienteSenha').value,
        pin: pin
    };

    if (!data.nome || !data.email) {
        showToast('Preencha nome e e-mail!', 'error');
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
            DB.clientes[idx] = { ...DB.clientes[idx], ...data };
            if (DBReady) await DB_SERVICE.updateCliente(DB.clientes[idx].docId, data);
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
                <p>${formatDate(p.data)}</p>
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
            <td>${formatDate(p.data)}</td>
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
            <div class="detalhe-item"><span>Data</span><span>${formatDate(p.data)}</span></div>
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

    const novoPedido = {
        id: DB.nextId.pedido++,
        clienteId: currentUser.id,
        servicos, materiais,
        desconto: 0,
        status: 'pendente',
        data: new Date().toISOString().split('T')[0],
        total,
        parcial,
        descontoPct
    };
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

    const msgData = {
        tipo: 'pedido',
        remetente: 'client',
        clienteId: currentUser.id,
        pedidoId: novoPedido.id,
        mensagem: `Novo pedido #${novoPedido.id} - ${formatCurrency(total)}`,
        descricao: detalhes + ' · ' + rotuloCondicao,
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
        document.getElementById('chatBadge').textContent = count;
        document.getElementById('chatBadge').style.display = count > 0 ? 'block' : 'none';
    } else {
        const chatKey = `admin_${currentUser.id}`;
        const msgs = DB.chats[chatKey] || [];
        const unread = msgs.filter(m => m.remetente === 'admin' && !m.lida).length;
        document.getElementById('chatBadgeClient').textContent = unread;
        document.getElementById('chatBadgeClient').style.display = unread > 0 ? 'block' : 'none';
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
    preencherValorPedidoClient();
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
        pedido: ['pedidoId', 'pedidoDesconto'],
        cliente: ['clienteId', 'clienteNome', 'clienteEmail', 'clienteTelefone', 'clienteSenha', 'clientePin'],
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
const TEMAS_PRESET = {
    padrao:    { rotulo: 'Padrão',       primary: '#6c5ce7', dark: '#5a4bd1', light: '#a29bfe', grad1: '#0c0c1d', grad2: '#1a1a3e', grad3: '#2d1b69' },
    neon:      { rotulo: 'Neon',         primary: '#00c2ff', dark: '#00a0d6', light: '#7aedff', grad1: '#0a0a23', grad2: '#11353f', grad3: '#0d4f63' },
    oceano:    { rotulo: 'Oceano',       primary: '#2f6fed', dark: '#2553c9', light: '#7aa5ff', grad1: '#081125', grad2: '#12326b', grad3: '#1b5aa8' },
    esmeralda: { rotulo: 'Esmeralda',    primary: '#10b981', dark: '#0d9668', light: '#6ee7b7', grad1: '#06281d', grad2: '#0c5c40', grad3: '#0f8f63' },
    solar:     { rotulo: 'Solar',        primary: '#f59e0b', dark: '#d97706', light: '#fcd34d', grad1: '#2b1a05', grad2: '#6b3f08', grad3: '#b06a0e' },
    rosa:      { rotulo: 'Rosa',         primary: '#ec4899', dark: '#d6378b', light: '#f9a8d4', grad1: '#2b0a1d', grad2: '#6b123c', grad3: '#a81f5f' }
};

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
