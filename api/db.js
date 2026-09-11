const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_DIR = process.env.VERCEL ? '/tmp' : process.cwd();
const DB_PATH = path.join(DB_DIR, 'fps-studio.db');
const WASM_PATH = path.join(__dirname, 'sql-wasm.wasm');

let dbInstance = null;

async function getDb() {
    if (dbInstance) return dbInstance;

    const SQL = await initSqlJs({
        locateFile: () => WASM_PATH
    });

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
            pin TEXT DEFAULT '',
            cpf TEXT DEFAULT '',
            endereco TEXT DEFAULT '',
            numero TEXT DEFAULT '',
            complemento TEXT DEFAULT '',
            bairro TEXT DEFAULT '',
            cep TEXT DEFAULT '',
            cidade TEXT DEFAULT '',
            estado TEXT DEFAULT '',
            tipoPessoa TEXT DEFAULT 'fisica',
            cnpj TEXT DEFAULT '',
            instagram TEXT DEFAULT ''
        )
    `);

    try { db.run('ALTER TABLE clientes ADD COLUMN cpf TEXT DEFAULT ""'); } catch(e) {}
    try { db.run('ALTER TABLE clientes ADD COLUMN endereco TEXT DEFAULT ""'); } catch(e) {}
    try { db.run('ALTER TABLE clientes ADD COLUMN numero TEXT DEFAULT ""'); } catch(e) {}
    try { db.run('ALTER TABLE clientes ADD COLUMN complemento TEXT DEFAULT ""'); } catch(e) {}
    try { db.run('ALTER TABLE clientes ADD COLUMN bairro TEXT DEFAULT ""'); } catch(e) {}
    try { db.run('ALTER TABLE clientes ADD COLUMN cep TEXT DEFAULT ""'); } catch(e) {}
    try { db.run('ALTER TABLE clientes ADD COLUMN cidade TEXT DEFAULT ""'); } catch(e) {}
    try { db.run('ALTER TABLE clientes ADD COLUMN estado TEXT DEFAULT ""'); } catch(e) {}
    try { db.run('ALTER TABLE clientes ADD COLUMN tipoPessoa TEXT DEFAULT "fisica"'); } catch(e) {}
    try { db.run('ALTER TABLE clientes ADD COLUMN cnpj TEXT DEFAULT ""'); } catch(e) {}
    try { db.run('ALTER TABLE clientes ADD COLUMN instagram TEXT DEFAULT ""'); } catch(e) {}

    db.run(`
        CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clienteId INTEGER,
            servicos TEXT DEFAULT '[]',
            materiais TEXT DEFAULT '[]',
            desconto REAL DEFAULT 0,
            status TEXT DEFAULT 'pendente',
            data TEXT DEFAULT (date('now')),
            dataPref TEXT DEFAULT '',
            horarioPref TEXT DEFAULT '',
            dataInicial TEXT DEFAULT '',
            horaInicial TEXT DEFAULT '',
            dataFinal TEXT DEFAULT '',
            horaFinal TEXT DEFAULT '',
            total REAL DEFAULT 0,
            parcial INTEGER DEFAULT 0,
            descontoPct REAL DEFAULT 0
        )
    `);

    try { db.run('ALTER TABLE pedidos ADD COLUMN parcial INTEGER DEFAULT 0'); } catch(e) {}
    try { db.run('ALTER TABLE pedidos ADD COLUMN descontoPct REAL DEFAULT 0'); } catch(e) {}
    try { db.run('ALTER TABLE pedidos ADD COLUMN dataPref TEXT DEFAULT ""'); } catch(e) {}
    try { db.run('ALTER TABLE pedidos ADD COLUMN horarioPref TEXT DEFAULT ""'); } catch(e) {}
    try { db.run('ALTER TABLE pedidos ADD COLUMN dataInicial TEXT DEFAULT ""'); } catch(e) {}
    try { db.run('ALTER TABLE pedidos ADD COLUMN horaInicial TEXT DEFAULT ""'); } catch(e) {}
    try { db.run('ALTER TABLE pedidos ADD COLUMN dataFinal TEXT DEFAULT ""'); } catch(e) {}
    try { db.run('ALTER TABLE pedidos ADD COLUMN horaFinal TEXT DEFAULT ""'); } catch(e) {}
    try { db.run('ALTER TABLE pedidos ADD COLUMN audios TEXT DEFAULT "[]"'); } catch(e) {}

    db.run(`
        CREATE TABLE IF NOT EXISTS movimentacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT NOT NULL,
            descricao TEXT DEFAULT '',
            valor REAL DEFAULT 0,
            categoria TEXT DEFAULT 'outro',
            pagamento TEXT DEFAULT 'pix',
            data TEXT DEFAULT (date('now')),
            pedidoId INTEGER DEFAULT NULL
        )
    `);

    try { db.run('ALTER TABLE movimentacoes ADD COLUMN pedidoId INTEGER DEFAULT NULL'); } catch(e) {}

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
            lida INTEGER DEFAULT 0,
            desconto REAL DEFAULT 0,
            status TEXT DEFAULT '',
            pedidoId INTEGER DEFAULT NULL,
            imagem TEXT DEFAULT ''
        )
    `);

    try { db.run('ALTER TABLE chats ADD COLUMN desconto REAL DEFAULT 0'); } catch(e) {}
    try { db.run('ALTER TABLE chats ADD COLUMN status TEXT DEFAULT ""'); } catch(e) {}
    try { db.run('ALTER TABLE chats ADD COLUMN pedidoId INTEGER DEFAULT NULL'); } catch(e) {}
    try { db.run('ALTER TABLE chats ADD COLUMN imagem TEXT DEFAULT ""'); } catch(e) {}
    try { db.run('ALTER TABLE chats ADD COLUMN audio TEXT DEFAULT ""'); } catch(e) {}
    try { db.run('ALTER TABLE chats ADD COLUMN arquivoNome TEXT DEFAULT ""'); } catch(e) {}

    db.run(`
        CREATE TABLE IF NOT EXISTS config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chave TEXT UNIQUE NOT NULL,
            valor TEXT DEFAULT ''
        )
    `);

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
