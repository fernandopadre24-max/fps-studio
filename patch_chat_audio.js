const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

const replacement = `
    if (DBReady) {
        const docId = await DB_SERVICE.addBiblioteca(audioObj);
        audioObj.id = docId.id;
    }
    
    // Send a message in the chat to notify the admin!
    const chatKey = 'admin_' + currentUser.id;
    if (!DB.chats[chatKey]) DB.chats[chatKey] = [];
    
    const msgData = {
        tipo: 'mensagem',
        remetente: 'client',
        clienteId: currentUser.id,
        mensagem: '🎵 Enviei um novo arquivo de áudio (' + file.name + ') para a Biblioteca Avulsa.',
        data: new Date().toISOString(),
        lida: false
    };
    DB.chats[chatKey].push(msgData);
    if (DBReady) await DB_SERVICE.sendMessage(msgData);
    if (document.getElementById('chatMessagesClient')) renderChatMessagesClient();
    
    showToast('Áudio enviado para a Biblioteca do estúdio!', 'success');
`;

code = code.replace(
    /if \(DBReady\) \{\n\s*const docId = await DB_SERVICE\.addBiblioteca\(audioObj\);\n\s*audioObj\.id = docId\.id;\n\s*\}\n\s*showToast\('Áudio enviado para a Biblioteca do estúdio!', 'success'\);/,
    replacement
);

fs.writeFileSync('/app/applet/app.js', code);
