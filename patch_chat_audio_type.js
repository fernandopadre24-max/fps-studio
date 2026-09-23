const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

code = code.replace(
    /tipo: 'mensagem',\n        remetente: 'client',\n        clienteId: currentUser.id,\n        mensagem: '🎵 Enviei um novo arquivo de áudio \(' \+ file\.name \+ '\) para a Biblioteca Avulsa\.',\n        data: new Date\(\)\.toISOString\(\),\n        lida: false/,
    `tipo: 'audio',
        remetente: 'client',
        clienteId: currentUser.id,
        arquivoNome: file.name,
        audio: b64,
        mensagem: '🎵 Enviei um novo arquivo de áudio (' + file.name + ') para a Biblioteca Avulsa.',
        data: new Date().toISOString(),
        lida: false`
);

fs.writeFileSync('/app/applet/app.js', code);
