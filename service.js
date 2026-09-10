// FPS STUDIO - SUPABASE SERVICE
// ============================================
// Camada de acesso ao banco Supabase (PostgreSQL)

const DB_SERVICE = {

    // ============================================
    // INICIALIZAÇÃO
    // ============================================
    async init() {
        if (typeof supabase === 'undefined' || !SUPABASE_URL.includes('supabase.co')) {
            console.warn('Supabase não configurado. Modo local ativo.');
            return false;
        }
        this.client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return true;
    },

    // ============================================
    // SERVIÇOS
    // ============================================
    async getServicos() {
        const { data, error } = await this.client.from('servicos').select('*').order('id');
        if (error) throw error;
        return data || [];
    },

    async addServico(servico) {
        const { data, error } = await this.client.from('servicos').insert(servico).select();
        if (error) throw error;
        return data[0]?.doc_id;
    },

    async updateServico(docId, data) {
        const { error } = await this.client.from('servicos').update(data).eq('doc_id', docId);
        if (error) throw error;
    },

    async deleteServico(docId) {
        const { error } = await this.client.from('servicos').delete().eq('doc_id', docId);
        if (error) throw error;
    },

    // ============================================
    // MATERIAIS
    // ============================================
    async getMateriais() {
        const { data, error } = await this.client.from('materiais').select('*').order('id');
        if (error) throw error;
        return data || [];
    },

    async addMaterial(material) {
        const { data, error } = await this.client.from('materiais').insert(material).select();
        if (error) throw error;
        return data[0]?.doc_id;
    },

    async updateMaterial(docId, data) {
        const { error } = await this.client.from('materiais').update(data).eq('doc_id', docId);
        if (error) throw error;
    },

    async deleteMaterial(docId) {
        const { error } = await this.client.from('materiais').delete().eq('doc_id', docId);
        if (error) throw error;
    },

    // ============================================
    // CLIENTES
    // ============================================
    async getClientes() {
        const { data, error } = await this.client.from('clientes').select('*').order('id');
        if (error) throw error;
        return data || [];
    },

    async addCliente(cliente) {
        const { data, error } = await this.client.from('clientes').insert(cliente).select();
        if (error) throw error;
        return data[0]?.doc_id;
    },

    async updateCliente(docId, data) {
        const { error } = await this.client.from('clientes').update(data).eq('doc_id', docId);
        if (error) throw error;
    },

    async deleteCliente(docId) {
        const { error } = await this.client.from('clientes').delete().eq('doc_id', docId);
        if (error) throw error;
    },

    // ============================================
    // PEDIDOS
    // ============================================
    async getPedidos() {
        const { data, error } = await this.client.from('pedidos').select('*').order('id', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async addPedido(pedido) {
        const { data, error } = await this.client.from('pedidos').insert(pedido).select();
        if (error) throw error;
        return data[0]?.doc_id;
    },

    async updatePedido(docId, data) {
        const { error } = await this.client.from('pedidos').update(data).eq('doc_id', docId);
        if (error) throw error;
    },

    async deletePedido(docId) {
        const { error } = await this.client.from('pedidos').delete().eq('doc_id', docId);
        if (error) throw error;
    },

    // ============================================
    // MOVIMENTAÇÕES FINANCEIRAS
    // ============================================
    async getMovimentacoes() {
        const { data, error } = await this.client.from('movimentacoes').select('*').order('data', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async addMovimentacao(mov) {
        const { data, error } = await this.client.from('movimentacoes').insert(mov).select();
        if (error) throw error;
        return data[0]?.doc_id;
    },

    async deleteMovimentacao(docId) {
        const { error } = await this.client.from('movimentacoes').delete().eq('doc_id', docId);
        if (error) throw error;
    },

    // ============================================
    // CHAT
    // ============================================
    async getChat(clienteId) {
        const { data, error } = await this.client.from('chats')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('data');
        if (error) throw error;
        return data || [];
    },

    async sendMessage(msg) {
        const { data, error } = await this.client.from('chats').insert({
            tipo: msg.tipo,
            remetente: msg.remetente,
            cliente_id: msg.clienteId,
            mensagem: msg.mensagem || '',
            descricao: msg.descricao || '',
            valor: msg.valor || 0,
            validade: msg.validade || '',
            data: msg.data,
            lida: msg.lida || false
        }).select();
        if (error) throw error;
        return data[0]?.doc_id;
    },

    // ============================================
    // SEED - Popula dados iniciais (só roda 1 vez)
    // ============================================
    async seedAll() {
        const { data: check } = await this.client.from('config').select('*').eq('chave', 'init').maybeSingle();
        if (check) return false;

        // Serviços
        await this.client.from('servicos').insert([
            { id: 1, nome: "Gravação de Vocais", descricao: "Sessão completa de gravação de vocais com tratamento acústico profissional.", preco: 250.00, duracao: "2 horas", icone: "fa-microphone", imagem: "" },
            { id: 2, nome: "Mixagem Profissional", descricao: "Mixagem completa com até 64 trilhas, EQ dinâmico e efeitos premium.", preco: 500.00, duracao: "3 dias", icone: "fa-sliders-h", imagem: "" },
            { id: 3, nome: "Masterização", descricao: "Masterização para streaming e mídia física com referência A/B.", preco: 350.00, duracao: "2 dias", icone: "fa-compact-disc", imagem: "" },
            { id: 4, nome: "Produção Musical", descricao: "Produção completa de faixa com arranjo e programação.", preco: 800.00, duracao: "5 dias", icone: "fa-music", imagem: "" },
            { id: 5, nome: "Aluguel de Estúdio", descricao: "Aluguel por hora do estúdio completo com engenheiro.", preco: 150.00, duracao: "1 hora", icone: "fa-building", imagem: "" },
            { id: 6, nome: "Aulas de Canto", descricao: "Aula particular de técnica vocal.", preco: 120.00, duracao: "1 hora", icone: "fa-users", imagem: "" }
        ]);

        // Materiais
        await this.client.from('materiais').insert([
            { id: 1, nome: "Microfone Condensador AT2020", descricao: "Microfone condensador cardioide para gravação.", preco: 899.00, estoque: 5, categoria: "microfone", imagem: "" },
            { id: 2, nome: "Fone Audio-Technica M50x", descricao: "Fone circumaural profissional.", preco: 1299.00, estoque: 8, categoria: "fone", imagem: "" },
            { id: 3, nome: "Monitor Yamaha HS8", descricao: "Monitor bi-amplificado 8 polegadas.", preco: 2499.00, estoque: 4, categoria: "monitor", imagem: "" },
            { id: 4, nome: "Interface Focusrite Scarlett 2i2", descricao: "Interface USB 2 entradas 2 saídas.", preco: 1099.00, estoque: 6, categoria: "interface", imagem: "" },
            { id: 5, nome: "Cabo XLR 5m", descricao: "Cabo XLR balanceado blindado.", preco: 79.00, estoque: 20, categoria: "cabo", imagem: "" },
            { id: 6, nome: "Suporte Microfone", descricao: "Braço articulado com fixação bancada.", preco: 189.00, estoque: 10, categoria: "acessorio", imagem: "" }
        ]);

        // Clientes
        await this.client.from('clientes').insert([
            { id: 1, nome: "João Silva", email: "cliente@exemplo.com", telefone: "(11) 99999-0000", senha: "cliente123", pin: "5678" },
            { id: 2, nome: "Maria Santos", email: "maria@email.com", telefone: "(11) 88888-1111", senha: "maria123", pin: "1111" },
            { id: 3, nome: "Pedro Costa", email: "pedro@email.com", telefone: "(21) 77777-2222", senha: "pedro123", pin: "2222" }
        ]);

        // Marcar seed como feito
        await this.client.from('config').insert({ chave: "init", valor: "true", criado: new Date().toISOString() });

        return true;
    }
};
