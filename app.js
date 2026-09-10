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
        }
    } catch (err) {
        console.warn('API SQLite offline. Modo local ativo.', err);
        DBReady = false;
    }

    setupDragDrop();
    document.getElementById('movData').value = new Date().toISOString().split('T')[0];
    updateChatBadge();
    restaurarSessao();
}

// Chama init ao carregar
initApp();

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
function renderAdminDashboard() {
    const totalReceita = DB.movimentacoes.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0);
    const pedidosAtivos = DB.pedidos.filter(p => p.status !== 'cancelado' && p.status !== 'concluido').length;

    document.getElementById('statReceita').textContent = formatCurrency(totalReceita);
    document.getElementById('statPedidos').textContent = pedidosAtivos;
    document.getElementById('statClientes').textContent = DB.clientes.length;
    document.getElementById('statMateriais').textContent = DB.materiais.length;

    // Últimos pedidos
    const ultimosPedidos = [...DB.pedidos].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 5);
    const container = document.getElementById('ultimosPedidos');
    if (ultimosPedidos.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhum pedido encontrado</p>';
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

    // Últimas movimentações
    const ultimasMovs = [...DB.movimentacoes].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 5);
    const movContainer = document.getElementById('ultimasMovimentacoes');
    if (ultimasMovs.length === 0) {
        movContainer.innerHTML = '<p class="empty-state">Nenhuma movimentação encontrada</p>';
    } else {
        movContainer.innerHTML = ultimasMovs.map(m => `<div class="mov-item">
            <div class="mov-item-left">
                <div class="mov-item-icon ${m.tipo}">
                    <i class="fas fa-arrow-${m.tipo === 'entrada' ? 'up' : 'down'}"></i>
                </div>
                <div class="mov-item-info">
                    <h5>${m.descricao}</h5>
                    <p>${formatDate(m.data)} - ${capitalize(m.pagamento)}</p>
                </div>
            </div>
            <div class="mov-item-value ${m.tipo}">${m.tipo === 'entrada' ? '+' : '-'}${formatCurrency(m.valor)}</div>
        </div>`).join('');
    }
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
    const filtro = document.getElementById('filtroStatusPedido').value;
    let pedidos = [...DB.pedidos];
    if (filtro !== 'todos') pedidos = pedidos.filter(p => p.status === filtro);

    const tbody = document.getElementById('pedidosAdminBody');
    tbody.innerHTML = pedidos.map(p => {
        const cliente = DB.clientes.find(c => c.id === p.clienteId);
        const servicoNomes = p.servicos.map(id => DB.servicos.find(s => s.id === id)?.nome || '').filter(Boolean).join(', ');
        return `<tr>
            <td><strong>#${p.id}</strong></td>
            <td>${cliente ? cliente.nome : 'N/A'}</td>
            <td>${servicoNomes || '-'}</td>
            <td><strong>${formatCurrency(p.total)}</strong></td>
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
            if (DBReady) await DB_SERVICE.updatePedido(pedidoSalvo.docId, { clienteId, servicos, materiais, desconto, status, total });
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
            : capitalize(m.pagamento)}</td>
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

function renderClientes() {
    const tbody = document.getElementById('clientesBody');
    tbody.innerHTML = DB.clientes.map(c => {
        const pedidos = DB.pedidos.filter(p => p.clienteId === c.id);
        const totalGasto = pedidos.reduce((s, p) => s + p.total, 0);
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

function toggleClienteDetalhe(id) {
    const row = document.getElementById(`detalhe_${id}`);
    const content = document.createElement('div');
    const c = DB.clientes.find(x => x.id === id);
    const pedidos = DB.pedidos.filter(p => p.clienteId === id);
    const totalGasto = pedidos.reduce((s, p) => s + p.total, 0);
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
        ${pedidos.length === 0
            ? '<p class="empty-state">Este cliente ainda não possui pedidos.</p>'
            : `<table class="data-table sub-table">
                <thead>
                    <tr><th>#</th><th>Data</th><th>Serviços / Materiais</th><th>Total</th><th>Pago</th><th>Em aberto</th><th>Status</th></tr>
                </thead>
                <tbody>
                    ${pedidos.map(p => {
                        const nomes = [
                            ...p.servicos.map(id => DB.servicos.find(s => s.id === id)?.nome).filter(Boolean),
                            ...p.materiais.map(id => DB.materiais.find(m => m.id === id)?.nome).filter(Boolean)
                        ].join(', ');
                        const pago = valorPagoPedido(p);
                        const restante = p.total - pago;
                        const pagoCls = pago >= p.total ? 'valor-pago' : '';
                        const abertoCls = restante > 0 ? 'valor-aberto' : '';
                        return `<tr>
                            <td><strong>#${p.id}</strong></td>
                            <td>${formatDate(p.data)}</td>
                            <td style="max-width:280px;white-space:normal;">${nomes || '-'}</td>
                            <td><strong>${formatCurrency(p.total)}</strong></td>
                            <td class="${pagoCls}">${formatCurrency(pago)}</td>
                            <td class="${abertoCls}">${formatCurrency(Math.max(0, restante))}</td>
                            <td><span class="status-badge status-${p.status}">${statusLabel(p.status)}</span></td>
                        </tr>`;
                    }).join('')}
                </tbody>
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
        return `<tr>
            <td><strong>#${p.id}</strong></td>
            <td>${servicoNomes || '-'}</td>
            <td>${materialNomes || '-'}</td>
            <td><strong>${formatCurrency(p.total)}</strong></td>
            <td><span class="status-badge status-${p.status}">${statusLabel(p.status)}</span></td>
            <td>${formatDate(p.data)}</td>
            <td>
                <div class="table-actions">
                    <button onclick="verDetalhesPedidoClient(${p.id})" title="Ver Detalhes"><i class="fas fa-eye"></i></button>
                    ${p.status === 'pendente' || p.status === 'em_andamento' ? `<button onclick="abrirPagamento(${p.id})" title="Pagar" style="background:var(--success);color:white;"><i class="fas fa-credit-card"></i></button>` : ''}
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
}

function updateClientPedidoTotal() {
    let total = 0;
    document.querySelectorAll('#clientPedidoServicos input:checked').forEach(cb => {
        const s = DB.servicos.find(x => x.id === parseInt(cb.value));
        if (s) total += s.preco;
    });
    document.querySelectorAll('#clientPedidoMateriais input:checked').forEach(cb => {
        const m = DB.materiais.find(x => x.id === parseInt(cb.value));
        if (m) total += m.preco;
    });
    document.getElementById('clientPedidoTotal').textContent = formatCurrency(total);
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

    const novoPedido = {
        id: DB.nextId.pedido++,
        clienteId: currentUser.id,
        servicos, materiais,
        desconto: 0,
        status: 'pendente',
        data: new Date().toISOString().split('T')[0],
        total
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

    const msgData = {
        tipo: 'pedido',
        remetente: 'client',
        clienteId: currentUser.id,
        pedidoId: novoPedido.id,
        mensagem: `Novo pedido #${novoPedido.id} - ${formatCurrency(total)}`,
        descricao: detalhes,
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

function abrirPagamento(pedidoId) {
    selectedPedidoId = pedidoId;
    const p = DB.pedidos.find(x => x.id === pedidoId);
    if (!p) return;

    const chatKey = `admin_${currentUser.id}`;
    const orc = (DB.chats[chatKey] || []).filter(m => m.tipo === 'orcamento' && m.pedidoId === pedidoId).pop();
    const valorPag = orc ? Math.max(0, (orc.valor || 0) - (orc.desconto || 0)) : p.total;
    selectedPagamentoValor = valorPag;

    document.getElementById('pagamentoInfo').innerHTML = `
        <div class="pedido-total" style="margin-bottom:16px;">
            <span>Pedido #${p.id}</span>
            <strong>${formatCurrency(valorPag)}</strong>
        </div>`;

    // Generate PIX code
    const pixCode = `00020126580014br.gov.bcb.pix0136fps-studio-${p.id}@fps.com520400005303986540${valorPag.toFixed(2)}5802BR5913FPS STUDIO6009SAO PAULO62070503***6304`;
    document.getElementById('pixCopiaCola').textContent = pixCode;

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

    const msgData = {
        tipo: 'comprovante',
        remetente: 'client',
        clienteId: currentUser.id,
        mensagem: `Pagamento de ${formatCurrency(selectedPagamentoValor || p.total)} realizado via ${tipo === 'pix' ? 'PIX' : 'Cartão de Crédito'} para o Pedido #${p.id}`,
        descricao: `Pagamento do Pedido #${p.id}`,
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
            const total = Math.max(0, (m.valor || 0) - desconto);
            return `<div class="chat-message orcamento">
                <h4><i class="fas fa-file-invoice-dollar"></i> Orçamento</h4>
                <p><strong>${m.descricao}</strong></p>
                <p>Valor: <strong>${formatCurrency(m.valor)}</strong></p>
                ${desconto > 0 ? `<p>Desconto: <strong>-${formatCurrency(desconto)}</strong></p>` : ''}
                <p>Total a pagar: <strong>${formatCurrency(total)}</strong></p>
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

function prepararOrcamentoAvulso() {
    orcamentoPedidoId = null;
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

function atualizarTotalOrcamento() {
    const valor = parseFloat(document.getElementById('orcamentoValor').value) || 0;
    const desconto = parseFloat(document.getElementById('orcamentoDesconto').value) || 0;
    document.getElementById('orcamentoTotal').textContent = formatCurrency(Math.max(0, valor - desconto));
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
        data: new Date().toISOString()
    };

    DB.chats[chatKey].push(msgData);
    if (DBReady) {
        const res = await DB_SERVICE.sendMessage(msgData);
        if (res && res.id) msgData.id = res.id;
    }

    orcamentoPedidoId = null;
    closeAllModals();
    renderChatMessagesAdmin(chatKey);
    showToast('Orçamento enviado!', 'success');
    clearForm('orcamento');
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

    if (pedido && totalPago > 0) {
        const mov = DB.movimentacoes.find(mm => mm.pedidoId === pedido.id) ||
            DB.movimentacoes.find(mm => mm.tipo === 'entrada' && (mm.descricao || '').includes(`Pedido #${pedido.id}`) && mm.pagamento === 'pendente');
        if (mov) {
            mov.tipo = 'entrada';
            mov.descricao = `Pagamento Pedido #${pedido.id}`;
            mov.valor = totalPago;
            mov.categoria = mov.categoria || 'servico';
            mov.pagamento = 'pix';
            mov.pedidoId = pedido.id;
            if (DBReady && mov.docId) await DB_SERVICE.updateMovimentacao(mov.docId, { tipo: mov.tipo, descricao: mov.descricao, valor: mov.valor, categoria: mov.categoria, pagamento: mov.pagamento, data: mov.data });
        } else {
            const nova = {
                id: DB.nextId.movimentacao++,
                tipo: 'entrada',
                descricao: `Pagamento Pedido #${pedido.id}`,
                valor: totalPago,
                categoria: 'servico',
                pagamento: 'pix',
                data: new Date().toISOString().split('T')[0],
                pedidoId: pedido.id
            };
            DB.movimentacoes.push(nova);
            if (DBReady) DB_SERVICE.addMovimentacao(nova).then(d => { if (d && d.id) nova.docId = d.id; });
        }

        pedido.materiais.forEach(mId => {
            const mat = DB.materiais.find(x => x.id === mId);
            if (mat && mat.estoque > 0) mat.estoque--;
        });

        if (pedido.status === 'pendente') {
            pedido.status = 'em_andamento';
            if (DBReady && pedido.docId) await DB_SERVICE.updatePedido(pedido.docId, { clienteId: pedido.clienteId, servicos: pedido.servicos, materiais: pedido.materiais, desconto: pedido.desconto, status: pedido.status, total: pedido.total });
        }
    }

    // Enviar mensagem de confirmação pro cliente com os detalhes do serviço
    if (pedido) {
        const nomesServicos = (pedido.servicos || []).map(id2 => { const s = DB.servicos.find(x => x.id === id2); return s ? s.nome : ''; }).filter(Boolean);
        const nomesMateriais = (pedido.materiais || []).map(id2 => { const mm = DB.materiais.find(x => x.id === id2); return mm ? mm.nome : ''; }).filter(Boolean);
        const detalhes = [...nomesServicos, ...nomesMateriais].join(', ') || 'Serviço solicitado';
        const confMsg = {
            tipo: 'sistema',
            remetente: 'admin',
            clienteId: currentChatClient,
            mensagem: `Pagamento do Pedido #${pedido.id} confirmado! Detalhes do serviço: ${detalhes}. Valor: ${formatCurrency(Math.max(0, totalPago))}. Status: em andamento.`,
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
            const total = Math.max(0, (m.valor || 0) - desconto);
            return `<div class="chat-message orcamento">
                <h4><i class="fas fa-file-invoice-dollar"></i> Orçamento Recebido</h4>
                <p><strong>${m.descricao}</strong></p>
                <p>Valor: <strong>${formatCurrency(m.valor)}</strong></p>
                ${desconto > 0 ? `<p>Desconto: <strong>-${formatCurrency(desconto)}</strong></p>` : ''}
                <p>Total a pagar: <strong>${formatCurrency(total)}</strong></p>
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
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('movData').value = new Date().toISOString().split('T')[0];
    updateChatBadge();
    setupDragDrop();
});
