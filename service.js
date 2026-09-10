// FPS STUDIO - FIREBASE SERVICE
// ============================================
// Camada de acesso ao banco Firestore

const DB_SERVICE = {

    // ============================================
    // INICIALIZAÇÃO
    // ============================================
    async init() {
        if (typeof firebase === 'undefined') {
            console.warn('Firebase não carregado. Usando modo local.');
            return false;
        }
        firebase.initializeApp(firebaseConfig);
        this.db = firebase.firestore();
        this.auth = firebase.auth();
        return true;
    },

    // ============================================
    // SERVIÇOS
    // ============================================
    async getServicos() {
        const snapshot = await this.db.collection('servicos').orderBy('id').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async addServico(servico) {
        const ref = await this.db.collection('servicos').add(servico);
        return ref.id;
    },

    async updateServico(docId, data) {
        await this.db.collection('servicos').doc(docId).update(data);
    },

    async deleteServico(docId) {
        await this.db.collection('servicos').doc(docId).delete();
    },

    // ============================================
    // MATERIAIS
    // ============================================
    async getMateriais() {
        const snapshot = await this.db.collection('materiais').orderBy('id').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async addMaterial(material) {
        const ref = await this.db.collection('materiais').add(material);
        return ref.id;
    },

    async updateMaterial(docId, data) {
        await this.db.collection('materiais').doc(docId).update(data);
    },

    async deleteMaterial(docId) {
        await this.db.collection('materiais').doc(docId).delete();
    },

    // ============================================
    // CLIENTES
    // ============================================
    async getClientes() {
        const snapshot = await this.db.collection('clientes').orderBy('id').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async addCliente(cliente) {
        const ref = await this.db.collection('clientes').add(cliente);
        return ref.id;
    },

    async updateCliente(docId, data) {
        await this.db.collection('clientes').doc(docId).update(data);
    },

    async deleteCliente(docId) {
        await this.db.collection('clientes').doc(docId).delete();
    },

    // ============================================
    // PEDIDOS
    // ============================================
    async getPedidos() {
        const snapshot = await this.db.collection('pedidos').orderBy('id', 'desc').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async addPedido(pedido) {
        const ref = await this.db.collection('pedidos').add(pedido);
        return ref.id;
    },

    async updatePedido(docId, data) {
        await this.db.collection('pedidos').doc(docId).update(data);
    },

    async deletePedido(docId) {
        await this.db.collection('pedidos').doc(docId).delete();
    },

    // ============================================
    // MOVIMENTAÇÕES FINANCEIRAS
    // ============================================
    async getMovimentacoes() {
        const snapshot = await this.db.collection('movimentacoes').orderBy('data', 'desc').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async addMovimentacao(mov) {
        const ref = await this.db.collection('movimentacoes').add(mov);
        return ref.id;
    },

    async deleteMovimentacao(docId) {
        await this.db.collection('movimentacoes').doc(docId).delete();
    },

    // ============================================
    // CHAT
    // ============================================
    async getChat(clienteId) {
        const snapshot = await this.db.collection('chats')
            .where('clienteId', '==', clienteId)
            .orderBy('data')
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async sendMessage(msg) {
        const ref = await this.db.collection('chats').add(msg);
        return ref.id;
    },

    // ============================================
    // SEED - Popula dados iniciais (só roda 1 vez)
    // ============================================
    async seedAll() {
        const check = await this.db.collection('config').doc('init').get();
        if (check.exists) return false;

        const batch = this.db.batch();

        // Serviços
        const servicos = [
            { id: 1, nome: "Gravação de Vocais", descricao: "Sessão completa de gravação de vocais com tratamento acústico profissional.", preco: 250.00, duracao: "2 horas", icone: "fa-microphone", imagem: "" },
            { id: 2, nome: "Mixagem Profissional", descricao: "Mixagem completa com até 64 trilhas, EQ dinâmico e efeitos premium.", preco: 500.00, duracao: "3 dias", icone: "fa-sliders-h", imagem: "" },
            { id: 3, nome: "Masterização", descricao: "Masterização para streaming e mídia física com referência A/B.", preco: 350.00, duracao: "2 dias", icone: "fa-compact-disc", imagem: "" },
            { id: 4, nome: "Produção Musical", descricao: "Produção completa de faixa com arranjo e programação.", preco: 800.00, duracao: "5 dias", icone: "fa-music", imagem: "" },
            { id: 5, nome: "Aluguel de Estúdio", descricao: "Aluguel por hora do estúdio completo com engenheiro.", preco: 150.00, duracao: "1 hora", icone: "fa-building", imagem: "" },
            { id: 6, nome: "Aulas de Canto", descricao: "Aula particular de técnica vocal.", preco: 120.00, duracao: "1 hora", icone: "fa-users", imagem: "" }
        ];
        servicos.forEach(s => {
            const ref = this.db.collection('servicos').doc();
            batch.set(ref, s);
        });

        // Materiais
        const materiais = [
            { id: 1, nome: "Microfone Condensador AT2020", descricao: "Microfone condensador cardioide para gravação.", preco: 899.00, estoque: 5, categoria: "microfone", imagem: "" },
            { id: 2, nome: "Fone Audio-Technica M50x", descricao: "Fone circumaural profissional.", preco: 1299.00, estoque: 8, categoria: "fone", imagem: "" },
            { id: 3, nome: "Monitor Yamaha HS8", descricao: "Monitor bi-amplificado 8 polegadas.", preco: 2499.00, estoque: 4, categoria: "monitor", imagem: "" },
            { id: 4, nome: "Interface Focusrite Scarlett 2i2", descricao: "Interface USB 2 entradas 2 saídas.", preco: 1099.00, estoque: 6, categoria: "interface", imagem: "" },
            { id: 5, nome: "Cabo XLR 5m", descricao: "Cabo XLR balanceado blindado.", preco: 79.00, estoque: 20, categoria: "cabo", imagem: "" },
            { id: 6, nome: "Suporte Microfone", descricao: "Braço articulado com fixação bancada.", preco: 189.00, estoque: 10, categoria: "acessorio", imagem: "" }
        ];
        materiais.forEach(m => {
            const ref = this.db.collection('materiais').doc();
            batch.set(ref, m);
        });

        // Clientes
        const clientes = [
            { id: 1, nome: "João Silva", email: "cliente@exemplo.com", telefone: "(11) 99999-0000", senha: "cliente123", pin: "5678" },
            { id: 2, nome: "Maria Santos", email: "maria@email.com", telefone: "(11) 88888-1111", senha: "maria123", pin: "1111" },
            { id: 3, nome: "Pedro Costa", email: "pedro@email.com", telefone: "(21) 77777-2222", senha: "pedro123", pin: "2222" }
        ];
        clientes.forEach(c => {
            const ref = this.db.collection('clientes').doc();
            batch.set(ref, c);
        });

        // Config
        batch.set(this.db.collection('config').doc('init'), {
            criado: new Date().toISOString(),
            versao: "1.0.0"
        });

        await batch.commit();
        return true;
    }
};
