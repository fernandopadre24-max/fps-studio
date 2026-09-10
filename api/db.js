const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_DIR = process.env.VERCEL ? '/tmp' : process.cwd();
const DB_PATH = path.join(DB_DIR, 'fps-studio.db');

let dbInstance = null;

async function getDb() {
    if (dbInstance) return dbInstance;

    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        dbInstance = new SQL.Database(buffer);
    } else {
        dbInstance = new SQL.Database();
    }

    return dbInstance;
}

function saveDb(db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

async function initDb() {
    const db = await getDb();

    db.run(`
        CREATE TABLE IF NOT EXISTS servicos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            descricao TEXT DEFAULT '',
            preco REAL DEFAULT 0,
            duracao TEXT DEFAULT '',
            icone TEXT DEFAULT 'fa-cog',
            imagem TEXT DEFAULT ''
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS materiais (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            descricao TEXT DEFAULT '',
            preco REAL DEFAULT 0,
            estoque INTEGER DEFAULT 0,
            categoria TEXT DEFAULT 'outro',
            imagem TEXT DEFAULT ''
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            telefone TEXT DEFAULT '',
            senha TEXT NOT NULL,
            pin TEXT DEFAULT ''
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clienteId INTEGER,
            servicos TEXT DEFAULT '[]',
            materiais TEXT DEFAULT '[]',
            desconto REAL DEFAULT 0,
            status TEXT DEFAULT 'pendente',
            data TEXT DEFAULT (date('now')),
            total REAL DEFAULT 0
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS movimentacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT NOT NULL,
            descricao TEXT DEFAULT '',
            valor REAL DEFAULT 0,
            categoria TEXT DEFAULT 'outro',
            pagamento TEXT DEFAULT 'pix',
            data TEXT DEFAULT (date('now'))
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT DEFAULT 'mensagem',
            remetente TEXT DEFAULT 'client',
            clienteId INTEGER,
            mensagem TEXT DEFAULT '',
            descricao TEXT DEFAULT '',
            valor REAL DEFAULT 0,
            validade TEXT DEFAULT '',
            data TEXT DEFAULT (datetime('now')),
            lida INTEGER DEFAULT 0
        )
    `);

    // Seed se vazio
    const result = db.exec("SELECT COUNT(*) as c FROM servicos");
    const count = result.length > 0 ? result[0].values[0][0] : 0;

    if (count === 0) {
        const seedData = [
            ["INSERT INTO servicos (nome, descricao, preco, duracao, icone, imagem) VALUES (?, ?, ?, ?, ?, ?)",
                ["Gravação de Vocais", "Sessão completa de gravação de vocais com tratamento acústico profissional.", 250.00, "2 horas", "fa-microphone", ""]],
            ["INSERT INTO servicos (nome, descricao, preco, duracao, icone, imagem) VALUES (?, ?, ?, ?, ?, ?)",
                ["Mixagem Profissional", "Mixagem completa com até 64 trilhas, EQ dinâmico e efeitos premium.", 500.00, "3 dias", "fa-sliders-h", ""]],
            ["INSERT INTO servicos (nome, descricao, preco, duracao, icone, imagem) VALUES (?, ?, ?, ?, ?, ?)",
                ["Masterização", "Masterização para streaming e mídia física com referência A/B.", 350.00, "2 dias", "fa-compact-disc", ""]],
            ["INSERT INTO servicos (nome, descricao, preco, duracao, icone, imagem) VALUES (?, ?, ?, ?, ?, ?)",
                ["Produção Musical", "Produção completa de faixa com arranjo e programação.", 800.00, "5 dias", "fa-music", ""]],
            ["INSERT INTO servicos (nome, descricao, preco, duracao, icone, imagem) VALUES (?, ?, ?, ?, ?, ?)",
                ["Aluguel de Estúdio", "Aluguel por hora do estúdio completo com engenheiro.", 150.00, "1 hora", "fa-building", ""]],
            ["INSERT INTO servicos (nome, descricao, preco, duracao, icone, imagem) VALUES (?, ?, ?, ?, ?, ?)",
                ["Aulas de Canto", "Aula particular de técnica vocal.", 120.00, "1 hora", "fa-users", ""]],

            ["INSERT INTO materiais (nome, descricao, preco, estoque, categoria, imagem) VALUES (?, ?, ?, ?, ?, ?)",
                ["Microfone Condensador AT2020", "Microfone condensador cardioide para gravação.", 899.00, 5, "microfone", ""]],
            ["INSERT INTO materiais (nome, descricao, preco, estoque, categoria, imagem) VALUES (?, ?, ?, ?, ?, ?)",
                ["Fone Audio-Technica M50x", "Fone circumaural profissional.", 1299.00, 8, "fone", ""]],
            ["INSERT INTO materiais (nome, descricao, preco, estoque, categoria, imagem) VALUES (?, ?, ?, ?, ?, ?)",
                ["Monitor Yamaha HS8", "Monitor bi-amplificado 8 polegadas.", 2499.00, 4, "monitor", ""]],
            ["INSERT INTO materiais (nome, descricao, preco, estoque, categoria, imagem) VALUES (?, ?, ?, ?, ?, ?)",
                ["Interface Focusrite Scarlett 2i2", "Interface USB 2 entradas 2 saídas.", 1099.00, 6, "interface", ""]],
            ["INSERT INTO materiais (nome, descricao, preco, estoque, categoria, imagem) VALUES (?, ?, ?, ?, ?, ?)",
                ["Cabo XLR 5m", "Cabo XLR balanceado blindado.", 79.00, 20, "cabo", ""]],
            ["INSERT INTO materiais (nome, descricao, preco, estoque, categoria, imagem) VALUES (?, ?, ?, ?, ?, ?)",
                ["Suporte Microfone", "Braço articulado com fixação bancada.", 189.00, 10, "acessorio", ""]],

            ["INSERT INTO clientes (nome, email, telefone, senha, pin) VALUES (?, ?, ?, ?, ?)",
                ["João Silva", "cliente@exemplo.com", "(11) 99999-0000", "cliente123", "5678"]],
            ["INSERT INTO clientes (nome, email, telefone, senha, pin) VALUES (?, ?, ?, ?, ?)",
                ["Maria Santos", "maria@email.com", "(11) 88888-1111", "maria123", "1111"]],
            ["INSERT INTO clientes (nome, email, telefone, senha, pin) VALUES (?, ?, ?, ?, ?)",
                ["Pedro Costa", "pedro@email.com", "(21) 77777-2222", "pedro123", "2222"]]
        ];

        for (const [sql, params] of seedData) {
            db.run(sql, params);
        }
    }

    saveDb(db);
    return db;
}

function queryAll(db, sql, params = []) {
    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}

function queryOne(db, sql, params = []) {
    const rows = queryAll(db, sql, params);
    return rows.length > 0 ? rows[0] : null;
}

module.exports = { getDb, initDb, saveDb, queryAll, queryOne };
