const { initDb, getDb, saveDb, queryAll, queryOne } = require('./db');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await initDb();
        const db = await getDb();
        const { method, query } = req;
        const action = query.action;
        const id = query.id ? parseInt(query.id) : null;

        let result;

        switch (action) {
            // SERVIÇOS
            case 'servicos':
                if (method === 'GET') {
                    result = queryAll(db, 'SELECT * FROM servicos ORDER BY id');
                } else if (method === 'POST') {
                    const { nome, descricao, preco, duracao, icone, imagem } = req.body;
                    db.run('INSERT INTO servicos (nome, descricao, preco, duracao, icone, imagem) VALUES (?, ?, ?, ?, ?, ?)',
                        [nome, descricao || '', preco || 0, duracao || '', icone || 'fa-cog', imagem || '']);
                    const r = queryOne(db, 'SELECT last_insert_rowid() as id');
                    saveDb(db);
                    result = { id: r.id };
                } else if (method === 'PUT') {
                    const { nome, descricao, preco, duracao, icone, imagem } = req.body;
                    db.run('UPDATE servicos SET nome=?, descricao=?, preco=?, duracao=?, icone=?, imagem=? WHERE id=?',
                        [nome, descricao, preco, duracao, icone, imagem, id]);
                    saveDb(db);
                    result = { ok: true };
                } else if (method === 'DELETE') {
                    db.run('DELETE FROM servicos WHERE id=?', [id]);
                    saveDb(db);
                    result = { ok: true };
                }
                break;

            // MATERIAIS
            case 'materiais':
                if (method === 'GET') {
                    result = queryAll(db, 'SELECT * FROM materiais ORDER BY id');
                } else if (method === 'POST') {
                    const { nome, descricao, preco, estoque, categoria, imagem } = req.body;
                    db.run('INSERT INTO materiais (nome, descricao, preco, estoque, categoria, imagem) VALUES (?, ?, ?, ?, ?, ?)',
                        [nome, descricao || '', preco || 0, estoque || 0, categoria || 'outro', imagem || '']);
                    const r = queryOne(db, 'SELECT last_insert_rowid() as id');
                    saveDb(db);
                    result = { id: r.id };
                } else if (method === 'PUT') {
                    const { nome, descricao, preco, estoque, categoria, imagem } = req.body;
                    db.run('UPDATE materiais SET nome=?, descricao=?, preco=?, estoque=?, categoria=?, imagem=? WHERE id=?',
                        [nome, descricao, preco, estoque, categoria, imagem, id]);
                    saveDb(db);
                    result = { ok: true };
                } else if (method === 'DELETE') {
                    db.run('DELETE FROM materiais WHERE id=?', [id]);
                    saveDb(db);
                    result = { ok: true };
                }
                break;

            // CLIENTES
            case 'clientes':
                if (method === 'GET') {
                    result = queryAll(db, 'SELECT * FROM clientes ORDER BY id');
                } else if (method === 'POST') {
                    const { nome, email, telefone, senha, pin } = req.body;
                    db.run('INSERT INTO clientes (nome, email, telefone, senha, pin) VALUES (?, ?, ?, ?, ?)',
                        [nome, email, telefone || '', senha, pin || '']);
                    const r = queryOne(db, 'SELECT last_insert_rowid() as id');
                    saveDb(db);
                    result = { id: r.id };
                } else if (method === 'PUT') {
                    const { nome, email, telefone, senha, pin } = req.body;
                    db.run('UPDATE clientes SET nome=?, email=?, telefone=?, senha=?, pin=? WHERE id=?',
                        [nome, email, telefone, senha, pin, id]);
                    saveDb(db);
                    result = { ok: true };
                } else if (method === 'DELETE') {
                    db.run('DELETE FROM clientes WHERE id=?', [id]);
                    saveDb(db);
                    result = { ok: true };
                }
                break;

            // PEDIDOS
            case 'pedidos':
                if (method === 'GET') {
                    const rows = queryAll(db, 'SELECT * FROM pedidos ORDER BY id DESC');
                    result = rows.map(p => ({
                        ...p,
                        servicos: JSON.parse(p.servicos || '[]'),
                        materiais: JSON.parse(p.materiais || '[]')
                    }));
                } else if (method === 'POST') {
                    const { clienteId, servicos, materiais, desconto, status, total } = req.body;
                    db.run('INSERT INTO pedidos (clienteId, servicos, materiais, desconto, status, total) VALUES (?, ?, ?, ?, ?, ?)',
                        [clienteId, JSON.stringify(servicos || []), JSON.stringify(materiais || []), desconto || 0, status || 'pendente', total || 0]);
                    const r = queryOne(db, 'SELECT last_insert_rowid() as id');
                    saveDb(db);
                    result = { id: r.id };
                } else if (method === 'PUT') {
                    const { clienteId, servicos, materiais, desconto, status, total } = req.body;
                    db.run('UPDATE pedidos SET clienteId=?, servicos=?, materiais=?, desconto=?, status=?, total=? WHERE id=?',
                        [clienteId, JSON.stringify(servicos || []), JSON.stringify(materiais || []), desconto, status, total, id]);
                    saveDb(db);
                    result = { ok: true };
                } else if (method === 'DELETE') {
                    db.run('DELETE FROM pedidos WHERE id=?', [id]);
                    saveDb(db);
                    result = { ok: true };
                }
                break;

            // MOVIMENTAÇÕES
            case 'movimentacoes':
                if (method === 'GET') {
                    result = queryAll(db, 'SELECT * FROM movimentacoes ORDER BY data DESC, id DESC');
                } else if (method === 'POST') {
                    const { tipo, descricao, valor, categoria, pagamento, data, pedidoId } = req.body;
                    db.run('INSERT INTO movimentacoes (tipo, descricao, valor, categoria, pagamento, data, pedidoId) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [tipo, descricao, valor || 0, categoria || 'outro', pagamento || 'pix', data, pedidoId || null]);
                    const r = queryOne(db, 'SELECT last_insert_rowid() as id');
                    saveDb(db);
                    result = { id: r.id };
                } else if (method === 'PUT') {
                    const { tipo, descricao, valor, categoria, pagamento, data, pedidoId } = req.body;
                    db.run('UPDATE movimentacoes SET tipo=?, descricao=?, valor=?, categoria=?, pagamento=?, data=?, pedidoId=? WHERE id=?',
                        [tipo, descricao, valor || 0, categoria || 'outro', pagamento || 'pix', data, pedidoId || null, id]);
                    saveDb(db);
                    result = { ok: true };
                } else if (method === 'DELETE') {
                    db.run('DELETE FROM movimentacoes WHERE id=?', [id]);
                    saveDb(db);
                    result = { ok: true };
                }
                break;

            // CHAT
            case 'chat':
                if (method === 'GET') {
                    const clienteId = parseInt(query.clienteId);
                    result = queryAll(db, 'SELECT * FROM chats WHERE clienteId=? ORDER BY data', [clienteId]);
                } else if (method === 'POST') {
                    const { tipo, remetente, clienteId: cid, mensagem, descricao, valor, validade, desconto, status, pedidoId, imagem } = req.body;
                    db.run('INSERT INTO chats (tipo, remetente, clienteId, mensagem, descricao, valor, validade, desconto, status, pedidoId, imagem) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [tipo || 'mensagem', remetente || 'client', cid, mensagem || '', descricao || '', valor || 0, validade || '', desconto || 0, status || '', pedidoId || null, imagem || '']);
                    const r = queryOne(db, 'SELECT last_insert_rowid() as id');
                    saveDb(db);
                    result = { id: r.id };
                } else if (method === 'PUT') {
                    const { lida, status, desconto, tipo, mensagem, descricao, valor, validade, pedidoId, imagem } = req.body;
                    if (status !== undefined && id !== null) {
                        const cur = queryOne(db, 'SELECT * FROM chats WHERE id=?', [id]);
                        const novoDesconto = desconto !== undefined ? desconto : (cur && cur.desconto ? cur.desconto : 0);
                        db.run('UPDATE chats SET status=?, desconto=? WHERE id=?', [status, novoDesconto, id]);
                    } else if (lida !== undefined) {
                        db.run('UPDATE chats SET lida=? WHERE clienteId=?', [lida ? 1 : 0, req.body.clienteId]);
                    } else if (id !== null) {
                        db.run('UPDATE chats SET tipo=?, mensagem=?, descricao=?, valor=?, validade=?, desconto=?, pedidoId=?, imagem=? WHERE id=?',
                            [tipo || 'mensagem', mensagem || '', descricao || '', valor || 0, validade || '', desconto || 0, pedidoId || null, imagem || '', id]);
                    }
                    saveDb(db);
                    result = { ok: true };
                } else if (method === 'DELETE') {
                    if (id !== null) {
                        db.run('DELETE FROM chats WHERE id=?', [id]);
                        saveDb(db);
                        result = { ok: true };
                    } else {
                        throw new Error('id obrigatório');
                    }
                }
                break;

            // CONFIGURAÇÕES
            case 'config':
                if (method === 'GET') {
                    const rows = queryAll(db, 'SELECT chave, valor FROM config');
                    const obj = {};
                    rows.forEach(r => { try { obj[r.chave] = JSON.parse(r.valor); } catch(e) { obj[r.chave] = r.valor; } });
                    result = obj;
                } else if (method === 'POST') {
                    const data = req.body || {};
                    Object.keys(data).forEach(chave => {
                        db.run('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor',
                            [chave, JSON.stringify(data[chave])]);
                    });
                    saveDb(db);
                    result = { ok: true };
                }
                break;

            // BACKUP / RESTAURAÇÃO
            case 'backup_export':
                if (method === 'GET') {
                    const configRows = queryAll(db, 'SELECT chave, valor FROM config');
                    const configObj = {};
                    configRows.forEach(r => { try { configObj[r.chave] = JSON.parse(r.valor); } catch(e) { configObj[r.chave] = r.valor; } });
                    const pedidos = queryAll(db, 'SELECT * FROM pedidos ORDER BY id');
                    result = {
                        tipo: 'fps-studio-backup',
                        versao: 1,
                        exportadoEm: new Date().toISOString(),
                        config: configObj,
                        servicos: queryAll(db, 'SELECT * FROM servicos ORDER BY id'),
                        materiais: queryAll(db, 'SELECT * FROM materiais ORDER BY id'),
                        clientes: queryAll(db, 'SELECT * FROM clientes ORDER BY id'),
                        pedidos: pedidos.map(p => ({ ...p, servicos: JSON.parse(p.servicos || '[]'), materiais: JSON.parse(p.materiais || '[]') })),
                        movimentacoes: queryAll(db, 'SELECT * FROM movimentacoes ORDER BY id'),
                        chats: queryAll(db, 'SELECT * FROM chats ORDER BY id')
                    };
                } else {
                    throw new Error('Use GET para exportar backup');
                }
                break;

            case 'backup_import':
                if (method === 'POST') {
                    const data = req.body || {};
                    if (data.tipo !== 'fps-studio-backup') throw new Error('Arquivo de backup inválido');

                    const ins = (tabela, colunas) => (row) => {
                        const vals = colunas.map(c => row[c] === undefined ? null : row[c]);
                        db.run(`INSERT INTO ${tabela} (${colunas.join(', ')}) VALUES (${colunas.map(() => '?').join(', ')})`, vals);
                    };

                    db.run('BEGIN');
                    try {
                        db.run('DELETE FROM config'); db.run('DELETE FROM chats'); db.run('DELETE FROM movimentacoes');
                        db.run('DELETE FROM pedidos'); db.run('DELETE FROM clientes'); db.run('DELETE FROM materiais');
                        db.run('DELETE FROM servicos');

                        if (data.config && typeof data.config === 'object' && Object.keys(data.config).length) {
                            Object.keys(data.config).forEach(chave => {
                                db.run('INSERT INTO config (chave, valor) VALUES (?, ?)', [chave, JSON.stringify(data.config[chave])]);
                            });
                        }

                        const insServico = ins('servicos', ['id', 'nome', 'descricao', 'preco', 'duracao', 'icone', 'imagem']);
                        (data.servicos || []).forEach(insServico);
                        const insMaterial = ins('materiais', ['id', 'nome', 'descricao', 'preco', 'estoque', 'categoria', 'imagem']);
                        (data.materiais || []).forEach(insMaterial);
                        const insCliente = ins('clientes', ['id', 'nome', 'email', 'telefone', 'senha', 'pin']);
                        (data.clientes || []).forEach(insCliente);
                        const insPedido = ins('pedidos', ['id', 'clienteId', 'servicos', 'materiais', 'desconto', 'status', 'data', 'total']);
                        ((data.pedidos || []).map(p => ({ ...p, servicos: JSON.stringify(p.servicos || []), materiais: JSON.stringify(p.materiais || []) }))).forEach(insPedido);
                        const insMov = ins('movimentacoes', ['id', 'tipo', 'descricao', 'valor', 'categoria', 'pagamento', 'data', 'pedidoId']);
                        (data.movimentacoes || []).forEach(insMov);
                        const insChat = ins('chats', ['id', 'tipo', 'remetente', 'clienteId', 'mensagem', 'descricao', 'valor', 'validade', 'data', 'lida', 'desconto', 'status', 'pedidoId', 'imagem']);
                        (data.chats || []).forEach(insChat);

                        db.run('COMMIT');
                        saveDb(db);
                    } catch (e) {
                        db.run('ROLLBACK');
                        throw e;
                    }

                    result = {
                        ok: true,
                        contagens: {
                            servicos: (data.servicos || []).length,
                            materiais: (data.materiais || []).length,
                            clientes: (data.clientes || []).length,
                            pedidos: (data.pedidos || []).length,
                            movimentacoes: (data.movimentacoes || []).length,
                            chats: (data.chats || []).length
                        }
                    };
                } else {
                    throw new Error('Use POST para restaurar backup');
                }
                break;

            default:
                return res.status(400).json({ error: 'Ação inválida' });
        }

        res.status(200).json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};
