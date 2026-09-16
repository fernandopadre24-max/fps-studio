const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

const regex = /const novoPedido = \{([\s\S]*?)horaFinal\n    \};/;
const replacement = `const novoPedido = {$1horaFinal,
        qtdFaixas: parseInt(document.getElementById('clientPedidoQtdFaixas').value) || 1,
        audios: []
    };
    
    // Anexar áudios
    const fileInput = document.getElementById('clientPedidoAudios');
    if (fileInput && fileInput.files.length > 0) {
        for (let i = 0; i < fileInput.files.length; i++) {
            const b64 = await fileToBase64(fileInput.files[i]);
            novoPedido.audios.push({
                nome: fileInput.files[i].name,
                base64: b64,
                data: new Date().toISOString()
            });
        }
    }
`;
code = code.replace(regex, replacement);

// And when the Client modal is opened, clear the files
const oldAbrirClientModal = "function openModal(id) {";
const newAbrirClientModal = `function openModal(id) {
    if (id === 'novoPedidoClientModal') {
        const fileInput = document.getElementById('clientPedidoAudios');
        if (fileInput) fileInput.value = '';
        const qtdInput = document.getElementById('clientPedidoQtdFaixas');
        if (qtdInput) qtdInput.value = '1';
    }`;
code = code.replace(oldAbrirClientModal, newAbrirClientModal);

fs.writeFileSync('/app/applet/app.js', code);
