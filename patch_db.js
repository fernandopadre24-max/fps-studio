const fs = require('fs');
let code = fs.readFileSync('/app/applet/api/db.js', 'utf8');

const regex = /try { db.run\('ALTER TABLE pedidos ADD COLUMN audios TEXT DEFAULT "\\\[\\\]"'\); } catch\(e\) {}/;
const replace = `try { db.run('ALTER TABLE pedidos ADD COLUMN audios TEXT DEFAULT "[]"'); } catch(e) {}
    try { db.run('ALTER TABLE pedidos ADD COLUMN qtdFaixas INTEGER DEFAULT 1'); } catch(e) {}`;

code = code.replace(regex, replace);
fs.writeFileSync('/app/applet/api/db.js', code);
