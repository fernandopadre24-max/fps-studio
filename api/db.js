const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_DIR = process.env.VERCEL ? '/tmp' : process.cwd();
const DB_PATH = path.join(DB_DIR, 'fps-studio.db');
const WASM_PATH = path.join(__dirname, 'sql-wasm.wasm');
const DB_BLOB_NAME = 'fps-studio.db';
const BLOB_REFRESH_MS = 3000;

let dbInstance = null;
let lastSavedAt = 0;
let lastBlobCheck = 0;
let pendingUpload = Promise.resolve();

async function blobHead() {
    const { head } = require('@vercel/blob');
    return head(DB_BLOB_NAME);
}

async function blobDownload(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('blob GET ' + res.status);
    return Buffer.from(await res.arrayBuffer());
}

async function blobUpload(buffer) {
    const { put } = require('@vercel/blob');
    const b = await put(DB_BLOB_NAME, buffer, { access: 'public', allowOverwrite: true, addRandomSuffix: false });
    if (b && b.uploadedAt) lastSavedAt = new Date(b.uploadedAt).getTime();
}

async function loadSqlInstance(buffer) {
    const SQL = await initSqlJs({ locateFile: () => WASM_PATH });
    return buffer ? new SQL.Database(buffer) : new SQL.Database();
}

async function getDb() {
    await pendingUpload.catch(() => {});

    if (dbInstance) {
        if (process.env.VERCEL) {
            const agora = Date.now();
            if (agora - lastBlobCheck > BLOB_REFRESH_MS) {
                lastBlobCheck = agora;
                try {
                    const meta = await blobHead();
                    const uploaded = meta && meta.uploadedAt ? new Date(meta.uploadedAt).getTime() : 0;
                    if (uploaded > lastSavedAt) {
                        const buffer = await blobDownload(meta.url);
                        const novo = await loadSqlInstance(buffer);
                        if (novo) {
                            dbInstance = novo;
                            lastSavedAt = uploaded;
                        }
                    }
                } catch (e) {}
            }
        }
        return dbInstance;
    }

    let buffer = null;
    let fromBlob = false;
    if (process.env.VERCEL) {
        try {
            const meta = await blobHead();
            if (meta && meta.url) {
                buffer = await blobDownload(meta.url);
                fromBlob = true;
            }
        } catch (e) {
            if (fs.existsSync(DB_PATH)) buffer = fs.readFileSync(DB_PATH);
        }
    } else {
        if (fs.existsSync(DB_PATH)) buffer = fs.readFileSync(DB_PATH);
    }

    dbInstance = await loadSqlInstance(buffer);
    if (fromBlob) {
        try {
            const meta = await blobHead();
            if (meta && meta.uploadedAt) lastSavedAt = new Date(meta.uploadedAt).getTime();
        } catch (e) {}
    } else if (!buffer) {
        lastSavedAt = 0;
    } else {
        lastSavedAt = Date.now();
    }

    return dbInstance;
}

function saveDb(db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    lastSavedAt = Date.now();

    if (process.env.VERCEL && process.env.BLOB_READ_WRITE_TOKEN) {
        pendingUpload = pendingUpload
            .catch(() => {})
            .then(() => blobUpload(buffer))
            .catch(e => console.error('Falha ao salvar no Blob:', e && e.message ? e.message : e));
        return pendingUpload;
    }
    return Promise.resolve();
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
            imagem TEXT DEFAULT '',
            categoria TEXT DEFAULT 'outro'
        )
    `);

    try { db.run('ALTER TABLE servicos ADD COLUMN categoria TEXT DEFAULT "outro"'); } catch(e) {}

    db.run(`
        CREATE TABLE IF NOT EXISTS materiais (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            descricao TEXT DEFAULT '',
            preco REAL DEFAULT 0,
            categoria TEXT DEFAULT 'outro',
            imagem TEXT DEFAULT '',
            tag TEXT DEFAULT '',
            especificacao TEXT DEFAULT ''
        )
    `);

    try { db.run('ALTER TABLE materiais ADD COLUMN tag TEXT DEFAULT ""'); } catch(e) {}
    try { db.run('ALTER TABLE materiais ADD COLUMN especificacao TEXT DEFAULT ""'); } catch(e) {}

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
            descontoPct REAL DEFAULT 0,
            faixas INTEGER DEFAULT 1,
            qtdFaixas INTEGER DEFAULT 1,
            audios TEXT DEFAULT '[]'
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
    try { db.run('ALTER TABLE pedidos ADD COLUMN faixas INTEGER DEFAULT 1'); } catch(e) {}
    try { db.run('ALTER TABLE pedidos ADD COLUMN qtdFaixas INTEGER DEFAULT 1'); } catch(e) {}

    db.run(`
        CREATE TABLE IF NOT EXISTS movimentacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT NOT NULL,
            descricao TEXT DEFAULT '',
            valor REAL DEFAULT 0,
            categoria TEXT DEFAULT 'outro',
            pagamento TEXT DEFAULT 'pix',
            data TEXT DEFAULT (date('now')),
            hora TEXT DEFAULT '',
            pedidoId INTEGER DEFAULT NULL
        )
    `);

    try { db.run('ALTER TABLE movimentacoes ADD COLUMN pedidoId INTEGER DEFAULT NULL'); } catch(e) {}
    try { db.run('ALTER TABLE movimentacoes ADD COLUMN hora TEXT DEFAULT ""'); } catch(e) {}

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
    try { db.run('ALTER TABLE chats ADD COLUMN parcial INTEGER DEFAULT 0'); } catch(e) {}
    try { db.run('ALTER TABLE chats ADD COLUMN descontoPct REAL DEFAULT 0'); } catch(e) {}

    db.run(`
        CREATE TABLE IF NOT EXISTS bibliotecas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clienteId INTEGER,
            arquivoNome TEXT DEFAULT '',
            audio TEXT DEFAULT '',
            descricao TEXT DEFAULT '',
            data TEXT DEFAULT (date('now')),
            hora TEXT DEFAULT '',
            duracao INTEGER DEFAULT 0
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chave TEXT UNIQUE NOT NULL,
            valor TEXT DEFAULT ''
        )
    `);

    // SEED DE SERVIÇOS DO ESTÚDIO (CONFORME FOTO 1)
    const countServ = queryOne(db, 'SELECT count(*) as c FROM servicos');
    if (!countServ || countServ.c === 0) {
        const servicosSeed = [
            {
                nome: 'MÚSICA AUTORAL (COM ARRANJO)',
                descricao: 'Produção completa de composição autoral no FPStudio com criação de arranjo instrumental, captação multicanal e gravação no Pro-Tools.',
                preco: 200.0,
                duracao: '3 horas de estúdio',
                icone: 'fa-microphone-alt',
                categoria: 'producao',
                imagem: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80'
            },
            {
                nome: 'MÚSICA AUTORAL (SEM ARRANJO)',
                descricao: 'Gravação direta e captação da sua música autoral com voz guia, instrumento base (violão/teclado) ou acompanhamento simples.',
                preco: 170.0,
                duracao: '3 horas de estúdio',
                icone: 'fa-guitar',
                categoria: 'gravacao',
                imagem: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=600&auto=format&fit=crop&q=80'
            },
            {
                nome: 'MÚSICA COMUM (COM ARRANJO)',
                descricao: 'Gravação de música comum/cover com arranjo instrumental exclusivo personalizado com instrumentos da sua escolha.',
                preco: 130.0,
                duracao: '3 horas de estúdio',
                icone: 'fa-guitar',
                categoria: 'producao',
                imagem: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80'
            },
            {
                nome: 'MÚSICA COMUM (SEM ARRANJO)',
                descricao: 'Captação rápida de voz e instrumentos para reprodução de música comum sem alterações de arranjo.',
                preco: 100.0,
                duracao: '3 horas de estúdio',
                icone: 'fa-microphone',
                categoria: 'gravacao',
                imagem: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=600&auto=format&fit=crop&q=80'
            },
            {
                nome: 'VINHETA PROFISSIONAL',
                descricao: 'Criação, locução, gravação e edição de vinheta para comerciais, podcasts, emissoras de rádio e redes sociais.',
                preco: 150.0,
                duracao: '1 hora de estúdio',
                icone: 'fa-broadcast-tower',
                categoria: 'producao',
                imagem: 'https://images.unsplash.com/photo-1520523839898-507127027154?w=600&auto=format&fit=crop&q=80'
            },
            {
                nome: 'EDIÇÃO DE BATERIA – POR FAIXA',
                descricao: 'Tratamento de áudio em Pro-Tools: quantização/alinhamento de bateria, OBS: Bateria com 8 peças.',
                preco: 150.0,
                duracao: '3 horas de estúdio',
                icone: 'fa-drum',
                categoria: 'edicao',
                imagem: 'https://images.unsplash.com/photo-1598653222000-6b7b7a552625?w=600&auto=format&fit=crop&q=80'
            },
            {
                nome: 'MIXAGEM – POR FAIXA',
                descricao: 'Equilíbrio de frequências, espacialidade estéreo, processamento analógico virtual (SSL/Neve) e masterização padrão streaming (-14 LUFS).',
                preco: 60.0,
                duracao: '3 horas de estúdio',
                icone: 'fa-sliders-h',
                categoria: 'mixagem',
                imagem: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=600&auto=format&fit=crop&q=80'
            },
            {
                nome: 'MASTERIZAÇÃO – POR FAIXA',
                descricao: 'Equilíbrio de frequências, espacialidade estéreo, processamento analógico virtual.',
                preco: 30.0,
                duracao: '3 horas de estúdio',
                icone: 'fa-wave-square',
                categoria: 'masterizacao',
                imagem: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=600&auto=format&fit=crop&q=80'
            },
            {
                nome: 'CORREÇÃO DE VOZ & AFINAÇÃO',
                descricao: 'Correção nota por nota, com o maior editor destinado só para essa função',
                preco: 120.0,
                duracao: '1 hora de estúdio',
                icone: 'fa-music',
                categoria: 'edicao',
                imagem: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&auto=format&fit=crop&q=80'
            },
            {
                nome: 'EDIÇÃO DE VÍDEO – DAVINCI RESOLVE 21',
                descricao: 'Edição de Vídeos com o melhor para isso, Davinci Resolve 21, qualidade e definição final, para suas redes socias. OBS: ate 10 min.',
                preco: 250.0,
                duracao: '3 horas de estúdio',
                icone: 'fa-video',
                categoria: 'edicao',
                imagem: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=600&auto=format&fit=crop&q=80'
            },
            {
                nome: 'LOCUÇÃO – POR TRILHA',
                descricao: 'Gravação pra Vídeo, Vinhetas etc...',
                preco: 40.0,
                duracao: '1 hora de estúdio',
                icone: 'fa-headset',
                categoria: 'vocal',
                imagem: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=600&auto=format&fit=crop&q=80'
            }
        ];

        for (const s of servicosSeed) {
            db.run('INSERT INTO servicos (nome, descricao, preco, duracao, icone, categoria, imagem) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [s.nome, s.descricao, s.preco, s.duracao, s.icone, s.categoria, s.imagem]);
        }
    }

    // SEED DE MATERIAIS / ACERVO (CONFORME FOTO 2)
    const countMat = queryOne(db, 'SELECT count(*) as c FROM materiais');
    if (!countMat || countMat.c === 0) {
        const materiaisSeed = [
            {
                nome: 'BATERIA ACUSTICA – POR FAIXA',
                descricao: 'Bateria completa profissional com pratos de alta resposta, microfonação multipista e afinação precisa para estúdio.',
                preco: 150.0,
                categoria: 'PERCUSSÃO & BATERIA',
                tag: 'BATERIA ACÚSTICA',
                especificacao: 'Gravação multicanal + Edição cirúrgica',
                imagem: 'https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=600&auto=format&fit=crop&q=80'
            },
            {
                nome: 'GUITARRAS IBANEZ STEVE VAI.',
                descricao: 'Guitarras elétricas Ibanez Steve Vai, reguladas com precisão para gravação em linha ou com microfonação de amplificador valvulado.',
                preco: 80.0,
                categoria: 'CORDAS',
                tag: 'IBANEZ',
                especificacao: 'Gravação em linha / amplificador valvulado',
                imagem: 'https://images.unsplash.com/photo-1564186763535-ebb21ef5277f?w=600&auto=format&fit=crop&q=80'
            },
            {
                nome: 'BAIXO 5 CORDAS',
                descricao: 'Contrabaixos de 5 cordas ativo / passivo, para Sertanejo, Forró, MPB, Pop e Rock com timbre encorpado e pegada firme.',
                preco: 60.0,
                categoria: 'CORDAS',
                tag: 'ARMONIA',
                especificacao: 'Gravação via Direct Box + Edição precisa',
                imagem: 'https://images.unsplash.com/photo-1550291652-6ea9114a47b1?w=600&auto=format&fit=crop&q=80'
            },
            {
                nome: 'VIOLÃO AÇO IBANEZ',
                descricao: 'Violões profissionais de aço e nylon acusticamente balanceados para arranjos harmônicos e dedilhados nítidos.',
                preco: 50.0,
                categoria: 'CORDAS',
                tag: 'IBANEZ',
                especificacao: 'Gravação com captação dupla + microfone',
                imagem: 'https://images.unsplash.com/photo-1525201548942-d8732f6617a0?w=600&auto=format&fit=crop&q=80'
            },
            {
                nome: 'SANFONA TODESCHINI',
                descricao: 'Acordeon Todeschini tradicional com timbre acústico cristalino e timbragem quente para produções regionais e populares.',
                preco: 80.0,
                categoria: 'INSTRUMENTOS ESPECIAIS',
                tag: 'TODESCHINI',
                especificacao: 'Gravação em microfonação estéreo',
                imagem: 'https://images.unsplash.com/photo-1520523839898-507127027154?w=600&auto=format&fit=crop&q=80'
            },
            {
                nome: 'CONTROLADOR MIDI – POR FAIXA',
                descricao: 'O controlador MIDI é um dispositivo de hardware que não produz som sozinho, acionando sintetizadores e instrumentos virtuais.',
                preco: 25.0,
                categoria: 'TECLADOS & FX',
                tag: 'USB MIDI 6',
                especificacao: 'Gravação de arranjos MIDI, Pianos e Synths',
                imagem: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=600&auto=format&fit=crop&q=80'
            },
            {
                nome: 'PERCUSSÃO ACUSTICA – POR FAIXA',
                descricao: 'Conjunto completo de percussão para forró, samba, pagode, axé e sertanejo gravados com microfones dedicados.',
                preco: 60.0,
                categoria: 'PERCUSSÃO & BATERIA',
                tag: 'PERCUSSÃO',
                especificacao: 'Gravação acústica multicanal + Efeitos',
                imagem: 'https://images.unsplash.com/photo-1543791187-df796fa11835?w=600&auto=format&fit=crop&q=80'
            },
            {
                nome: 'VIOLINO ACÚSTICO',
                descricao: 'Violino acústico 4/4 regulado para solos emocionantes de sertanejo, música erudita ou gospel com captação condensadora.',
                preco: 80.0,
                categoria: 'INSTRUMENTOS ESPECIAIS',
                tag: 'VIOLINO 4/4',
                especificacao: 'Gravação condensadora de alta sensibilidade',
                imagem: 'https://images.unsplash.com/photo-1612225330812-01a9c6b355ec?w=600&auto=format&fit=crop&q=80'
            },
            {
                nome: 'PRO TOOLS 12 COMPLETO',
                descricao: 'O Pro Tools é a estação de trabalho de áudio digital (DAW) desenvolvida pela Avid, referência mundial em gravação de estúdio.',
                preco: 0,
                categoria: 'DAW & SOFTWARE',
                tag: 'AVID PRO TOOLS HD',
                especificacao: 'Incluso na Sessão (DAW Padrão da Indústria)',
                imagem: 'https://images.unsplash.com/photo-1598653222000-6b7b7a552625?w=600&auto=format&fit=crop&q=80'
            },
            {
                nome: 'MICROFONE KADOSH 412',
                descricao: 'Microfone Kadosh 412 condensador de grande diafragma para captação vocal cristalina com alta fidelidade e baixo ruído.',
                preco: 0,
                categoria: 'CAPTAÇÃO & VOZ',
                tag: 'KADOSH 412 CONDENSER',
                especificacao: 'Incluso na Sessão (Microfonação Vocal)',
                imagem: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=600&auto=format&fit=crop&q=80'
            },
            {
                nome: 'MONITORES TOMATE PRO & PLACA M-AUDIO',
                descricao: 'Sistema de monitoramento Tomate de resposta de frequência precisa e placa de áudio M-Audio de baixa latência.',
                preco: 0,
                categoria: 'MONITORAMENTO',
                tag: 'TOMATE STUDIO & M-AUDIO',
                especificacao: 'Incluso na Sessão (Monitoramento de Áudio)',
                imagem: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&auto=format&fit=crop&q=80'
            },
            {
                nome: 'GUITARRA MEMPHIS 32',
                descricao: 'Guitarras elétricas Memphis reguladas com precisão para gravação em linha e solos nítidos.',
                preco: 50.0,
                categoria: 'CORDAS',
                tag: 'MEMPHIS',
                especificacao: 'Gravação e Edição inclusos',
                imagem: 'https://images.unsplash.com/photo-1525201548942-d8732f6617a0?w=600&auto=format&fit=crop&q=80'
            }
        ];

        for (const m of materiaisSeed) {
            db.run('INSERT INTO materiais (nome, descricao, preco, categoria, tag, especificacao, imagem) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [m.nome, m.descricao, m.preco, m.categoria, m.tag, m.especificacao, m.imagem]);
        }
    }

    // SEED DE CLIENTE DEMO
    const countCli = queryOne(db, 'SELECT count(*) as c FROM clientes');
    if (!countCli || countCli.c === 0) {
        db.run('INSERT INTO clientes (nome, email, telefone, senha, pin, cpf, cidade, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            ['Lucas Silva (Cliente)', 'cliente@fps.com', '(11) 98765-4321', '123456', '1234', '123.456.789-00', 'São Paulo', 'SP']);
    }

    // SEED DE PEDIDOS & MOVIMENTAÇÕES (Demonstrando A Receber e A Pagar)
    const countPed = queryOne(db, 'SELECT count(*) as c FROM pedidos');
    if (!countPed || countPed.c === 0) {
        const clienteRow = queryOne(db, 'SELECT id FROM clientes LIMIT 1');
        const cliId = clienteRow ? clienteRow.id : 1;
        const hoje = new Date().toISOString().substring(0, 10);
        const anteontem = new Date(Date.now() - 86400000 * 2).toISOString().substring(0, 10);

        // Pedido 1: MÚSICA AUTORAL (COM ARRANJO) (R$ 200) + BATERIA ACUSTICA (R$ 150) = R$ 350. Parcial: 50% pago (R$ 175) e 50% a receber (R$ 175)
        db.run('INSERT INTO pedidos (clienteId, servicos, materiais, status, data, total, parcial, faixas, qtdFaixas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [cliId, JSON.stringify([1]), JSON.stringify([1]), 'em_andamento', hoje, 350.0, 1, 1, 1]);
        
        // Pedido 2: VINHETA PROFISSIONAL (R$ 150) - Concluído, quitado (R$ 150)
        db.run('INSERT INTO pedidos (clienteId, servicos, materiais, status, data, total, parcial, faixas, qtdFaixas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [cliId, JSON.stringify([5]), '[]', 'concluido', anteontem, 150.0, 0, 1, 1]);

        // Movimentações:
        // Entrada confirmada: 1ª parcela do Pedido 1 (R$ 175)
        db.run('INSERT INTO movimentacoes (tipo, descricao, valor, data, categoria, pagamento, pedidoId) VALUES (?, ?, ?, ?, ?, ?, ?)',
            ['entrada', '1ª Parcela (50%) - Pedido #1', 175.0, hoje, 'servico', 'confirmado', 1]);
        
        // Entrada confirmada: Pedido 2 integral (R$ 150)
        db.run('INSERT INTO movimentacoes (tipo, descricao, valor, data, categoria, pagamento, pedidoId) VALUES (?, ?, ?, ?, ?, ?, ?)',
            ['entrada', 'Pagamento Integral - Pedido #2', 150.0, anteontem, 'servico', 'confirmado', 2]);
        
        // Saída operacional: Manutenção de cabos e fones
        db.run('INSERT INTO movimentacoes (tipo, descricao, valor, data, categoria, pagamento) VALUES (?, ?, ?, ?, ?, ?)',
            ['saida', 'Cabos Santo Angelo e adaptadores', 80.0, hoje, 'outro', 'confirmado']);
    }

    if (!process.env.VERCEL) saveDb(db);
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