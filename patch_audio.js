const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

code = code.replace(
    /descricao: 'Enviado pelo Chat do Cliente',\n        duracao: 0/,
    `descricao: 'Enviado pelo Chat do Cliente',
        duracao: 0,
        data: new Date().toISOString().split('T')[0],
        hora: new Date().toISOString().split('T')[1].slice(0,5)`
);

fs.writeFileSync('/app/applet/app.js', code);
