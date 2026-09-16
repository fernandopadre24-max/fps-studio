const fs = require('fs');
let code = fs.readFileSync('/app/applet/api/[action].js', 'utf8');

const replacement = `
            // BIBLIOTECA
            case 'biblioteca':
                if (method === 'GET') {
                    if (query.clienteId) {
                        result = queryAll(db, 'SELECT * FROM bibliotecas WHERE clienteId = ? ORDER BY id DESC', [query.clienteId]);
                    } else {
                        result = queryAll(db, 'SELECT * FROM bibliotecas ORDER BY id DESC');
                    }
                } else if (method === 'POST') {
                    const { clienteId, arquivoNome, audio, descricao, duracao } = req.body;
                    db.run('INSERT INTO bibliotecas (clienteId, arquivoNome, audio, descricao, data, hora, duracao) VALUES (?, ?, ?, ?, date("now", "localtime"), time("now", "localtime"), ?)',
                        [clienteId, arquivoNome || '', audio || '', descricao || '', duracao || 0]);
                    const r = queryOne(db, 'SELECT last_insert_rowid() as id');
                    saveDb(db);
                    result = { id: r.id };
                } else if (method === 'PUT') {
                    const { clienteId, arquivoNome, audio, descricao, duracao } = req.body;
                    db.run('UPDATE bibliotecas SET clienteId=?, arquivoNome=?, audio=?, descricao=?, duracao=? WHERE id=?',
                        [clienteId, arquivoNome, audio, descricao, duracao, id]);
                    saveDb(db);
                    result = { ok: true };
                } else if (method === 'DELETE') {
                    db.run('DELETE FROM bibliotecas WHERE id=?', [id]);
                    saveDb(db);
                    result = { ok: true };
                }
                break;

            // CONFIGURAÇÕES
`;
code = code.replace(/\/\/ CONFIGURAÇÕES/, replacement.trim());
fs.writeFileSync('/app/applet/api/[action].js', code);
