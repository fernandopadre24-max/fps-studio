const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

// Fixing Categoria extraction for POST API mapping
code = code.replace(
    `duracao: document.getElementById('servicoDuracao') ? document.getElementById('servicoDuracao').value : '',`,
    `duracao: document.getElementById('servicoDuracao') ? document.getElementById('servicoDuracao').value : '',`
);

fs.writeFileSync('/app/applet/app.js', code);
