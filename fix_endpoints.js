const fs = require('fs');
let code = fs.readFileSync('/app/applet/api/[action].js', 'utf8');

const regex = /\/\/ SERVIÇOS\s+case 'servicos':[\s\S]*?(?=\/\/ MOVIMENTAÇÕES)/;

const replacement = `// SERVIÇOS
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
                    result = queryAll(db, 'SELECT * FROM clientes ORDER BY id DESC');
                } else if (method === 'POST') {
                    const { nome, email, telefone, senha, pin, cpf, endereco, numero, complemento, bairro, cep, cidade, estado, tipoPessoa, cnpj, instagram } = req.body;
                    db.run('INSERT INTO clientes (nome, email, telefone, senha, pin, cpf, endereco, numero, complemento, bairro, cep, cidade, estado, tipoPessoa, cnpj, instagram) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [nome, email, telefone || '', senha, pin || '', cpf || '', endereco || '', numero || '', complemento || '', bairro || '', cep || '', cidade || '', estado || '', tipoPessoa || 'fisica', cnpj || '', instagram || '']);
                    const r = queryOne(db, 'SELECT last_insert_rowid() as id');
                    saveDb(db);
                    result = { id: r.id };
                } else if (method === 'PUT') {
                    const { nome, email, telefone, senha, pin, cpf, endereco, numero, complemento, bairro, cep, cidade, estado, tipoPessoa, cnpj, instagram } = req.body;
                    db.run('UPDATE clientes SET nome=?, email=?, telefone=?, senha=?, pin=?, cpf=?, endereco=?, numero=?, complemento=?, bairro=?, cep=?, cidade=?, estado=?, tipoPessoa=?, cnpj=?, instagram=? WHERE id=?',
                        [nome, email, telefone, senha, pin, cpf, endereco, numero, complemento, bairro, cep, cidade, estado, tipoPessoa, cnpj, instagram, id]);
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
                        materiais: JSON.parse(p.materiais || '[]'),
                        audios: JSON.parse(p.audios || '[]')
                    }));
                } else if (method === 'POST') {
                    const { clienteId, servicos, materiais, desconto, status, total, parcial, descontoPct, dataPref, horarioPref, dataInicial, horaInicial, dataFinal, horaFinal, qtdFaixas, audios } = req.body;
                    db.run('INSERT INTO pedidos (clienteId, servicos, materiais, desconto, status, total, parcial, descontoPct, dataPref, horarioPref, dataInicial, horaInicial, dataFinal, horaFinal, qtdFaixas, audios) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [clienteId, JSON.stringify(servicos || []), JSON.stringify(materiais || []), desconto || 0, status || 'pendente', total || 0, parcial ? 1 : 0, descontoPct || 0, dataPref || '', horarioPref || '', dataInicial || '', horaInicial || '', dataFinal || '', horaFinal || '', qtdFaixas || 1, JSON.stringify(audios || [])]);
                    const r = queryOne(db, 'SELECT last_insert_rowid() as id');
                    saveDb(db);
                    result = { id: r.id };
                } else if (method === 'PUT') {
                    const { clienteId, servicos, materiais, desconto, status, total, parcial, descontoPct, dataPref, horarioPref, dataInicial, horaInicial, dataFinal, horaFinal, qtdFaixas, audios } = req.body;
                    db.run('UPDATE pedidos SET clienteId=?, servicos=?, materiais=?, desconto=?, status=?, total=?, parcial=?, descontoPct=?, dataPref=?, horarioPref=?, dataInicial=?, horaInicial=?, dataFinal=?, horaFinal=?, qtdFaixas=?, audios=? WHERE id=?',
                        [clienteId, JSON.stringify(servicos || []), JSON.stringify(materiais || []), desconto, status, total, parcial ? 1 : 0, descontoPct || 0, dataPref || '', horarioPref || '', dataInicial || '', horaInicial || '', dataFinal || '', horaFinal || '', qtdFaixas || 1, JSON.stringify(audios || []), id]);
                    saveDb(db);
                    result = { ok: true };
                } else if (method === 'DELETE') {
                    db.run('DELETE FROM pedidos WHERE id=?', [id]);
                    saveDb(db);
                    result = { ok: true };
                }
                break;

            `;

code = code.replace(regex, replacement);
fs.writeFileSync('/app/applet/api/[action].js', code);
