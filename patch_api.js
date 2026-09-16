const fs = require('fs');
let code = fs.readFileSync('/app/applet/api/[action].js', 'utf8');

let newPost = `
                } else if (method === 'POST') {
                    const { clienteId, servicos, materiais, desconto, status, total, parcial, descontoPct, dataPref, horarioPref, dataInicial, horaInicial, dataFinal, horaFinal, qtdFaixas, audios } = req.body;
                    db.run('INSERT INTO pedidos (clienteId, servicos, materiais, desconto, status, total, parcial, descontoPct, dataPref, horarioPref, dataInicial, horaInicial, dataFinal, horaFinal, qtdFaixas, audios) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [clienteId, JSON.stringify(servicos || []), JSON.stringify(materiais || []), desconto || 0, status || 'pendente', total || 0, parcial ? 1 : 0, descontoPct || 0, dataPref || '', horarioPref || '', dataInicial || '', horaInicial || '', dataFinal || '', horaFinal || '', qtdFaixas || 1, JSON.stringify(audios || [])]);
`;

code = code.replace(/} else if \(method === 'POST'\) \{[\s\S]*?horaFinal \|\| ''\]\);/, newPost.trim());

let newPut = `
                } else if (method === 'PUT') {
                    const { clienteId, servicos, materiais, desconto, status, total, parcial, descontoPct, dataPref, horarioPref, dataInicial, horaInicial, dataFinal, horaFinal, qtdFaixas, audios } = req.body;
                    db.run('UPDATE pedidos SET clienteId=?, servicos=?, materiais=?, desconto=?, status=?, total=?, parcial=?, descontoPct=?, dataPref=?, horarioPref=?, dataInicial=?, horaInicial=?, dataFinal=?, horaFinal=?, qtdFaixas=?, audios=? WHERE id=?',
                        [clienteId, JSON.stringify(servicos || []), JSON.stringify(materiais || []), desconto, status, total, parcial ? 1 : 0, descontoPct || 0, dataPref || '', horarioPref || '', dataInicial || '', horaInicial || '', dataFinal || '', horaFinal || '', qtdFaixas || 1, JSON.stringify(audios || []), id]);
`;
code = code.replace(/} else if \(method === 'PUT'\) \{[\s\S]*?id\]\);/, newPut.trim());

// We also need to fix GET where it parses JSON
const oldGet = `
                    result = rows.map(p => ({
                        ...p,
                        servicos: JSON.parse(p.servicos || '[]'),
                        materiais: JSON.parse(p.materiais || '[]')
                    }));
`;
const newGet = `
                    result = rows.map(p => ({
                        ...p,
                        servicos: JSON.parse(p.servicos || '[]'),
                        materiais: JSON.parse(p.materiais || '[]'),
                        audios: JSON.parse(p.audios || '[]')
                    }));
`;
code = code.replace(oldGet.trim(), newGet.trim());

fs.writeFileSync('/app/applet/api/[action].js', code);
