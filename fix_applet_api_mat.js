const fs = require('fs');
let code = fs.readFileSync('/app/applet/api/[action].js', 'utf8');
code = code.replace(
    /const \{ nome, descricao, preco, estoque, categoria, imagem \} = req\.body;/g,
    'const { nome, descricao, preco, categoria, imagem } = req.body;'
);
code = code.replace(
    /db\.run\('INSERT INTO materiais \(nome, descricao, preco, estoque, categoria, imagem\) VALUES \(\?, \?, \?, \?, \?, \?\)',\n                        \[nome, descricao \|\| '', preco \|\| 0, estoque \|\| 0, categoria \|\| 'outro', imagem \|\| ''\]\);/g,
    `db.run('INSERT INTO materiais (nome, descricao, preco, categoria, imagem) VALUES (?, ?, ?, ?, ?)',
                        [nome, descricao || '', preco || 0, categoria || 'outro', imagem || '']);`
);
code = code.replace(
    /db\.run\('UPDATE materiais SET nome=\?, descricao=\?, preco=\?, estoque=\?, categoria=\?, imagem=\? WHERE id=\?',\n                        \[nome, descricao, preco, estoque, categoria, imagem, id\]\);/g,
    `db.run('UPDATE materiais SET nome=?, descricao=?, preco=?, categoria=?, imagem=? WHERE id=?',
                        [nome, descricao, preco, categoria, imagem, id]);`
);
fs.writeFileSync('/app/applet/api/[action].js', code);
