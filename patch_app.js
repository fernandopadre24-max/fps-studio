const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

code = code.replace(/renderServicosList\(\)/g, 'renderServicos()');
code = code.replace(/renderMateriaisList\(\)/g, 'renderMateriais()');
code = code.replace(/renderPedidosList\(\)/g, 'renderPedidos()');
code = code.replace(/renderFinanceiroList\(\)/g, 'renderMovimentacoes()');
code = code.replace(/renderClientesList\(\)/g, 'renderClientes()');

code = code.replace(/renderClientPedidos\(\)/g, 'renderPedidosClient()');
code = code.replace(/if\(pageId === 'clientPerfil'\) renderClientPerfil\(\);/g, '');

const oldBadge = `        document.getElementById('chatBadge').textContent = count;
        document.getElementById('chatBadge').style.display = count > 0 ? 'block' : 'none';
    } else {
        const chatKey = \`admin_\${currentUser.id}\`;
        const msgs = DB.chats[chatKey] || [];
        const unread = msgs.filter(m => m.remetente === 'admin' && !m.lida).length;
        document.getElementById('chatBadgeClient').textContent = unread;
        document.getElementById('chatBadgeClient').style.display = unread > 0 ? 'block' : 'none';`;

const newBadge = `        const b = document.getElementById('chatBadge');
        if (b) { b.textContent = count; b.style.display = count > 0 ? 'block' : 'none'; }
    } else {
        const chatKey = \`admin_\${currentUser.id}\`;
        const msgs = DB.chats[chatKey] || [];
        const unread = msgs.filter(m => m.remetente === 'admin' && !m.lida).length;
        const b = document.getElementById('chatBadgeClient');
        if (b) { b.textContent = unread; b.style.display = unread > 0 ? 'block' : 'none'; }`;

code = code.replace(oldBadge, newBadge);

fs.writeFileSync('/app/applet/app.js', code);
