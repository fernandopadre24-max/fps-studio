const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

const bibliotecaFunc = `
window.renderBiblioteca = function() {
    const list = document.getElementById('bibliotecaBody');
    if (!list) return;
    
    // Sort by most recent
    const pedidosComAudio = DB.pedidos.filter(p => p.audios && p.audios.length > 0 || p.qtdFaixas > 0).sort((a,b) => b.id - a.id);
    
    if (pedidosComAudio.length === 0) {
        list.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum áudio encontrado.</td></tr>';
        return;
    }
    
    list.innerHTML = pedidosComAudio.map(p => {
        const cliente = DB.clientes.find(c => c.id === p.clienteId);
        const cliNome = cliente ? cliente.nome : 'Desconhecido';
        const audios = p.audios || [];
        
        let arquivosHtml = '';
        if (audios.length > 0) {
            arquivosHtml = audios.map((a, idx) => \`
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;background:var(--bg-lighter);padding:4px 8px;border-radius:4px;font-size:12px;">
                    <i class="fas fa-music text-primary"></i>
                    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="\${a.nome}">\${a.nome}</span>
                    <audio controls src="\${a.base64}" style="height:24px;width:120px;"></audio>
                    <a href="\${a.base64}" download="\${a.nome}" class="btn-icon" title="Baixar"><i class="fas fa-download"></i></a>
                    <button class="btn-icon text-danger" onclick="excluirAudioPedido(\${p.id}, \${idx})" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
            \`).join('');
        } else {
            arquivosHtml = '<span class="text-muted">Nenhum áudio enviado</span>';
        }
        
        return \`
        <tr>
            <td>#\${p.id}</td>
            <td>\${cliNome}</td>
            <td>\${p.qtdFaixas || 1}</td>
            <td>\${audios.length} / \${p.qtdFaixas || 1}</td>
            <td style="max-width:300px;">\${arquivosHtml}</td>
            <td>
                <button class="btn-primary btn-sm" onclick="abrirUploadAudioAdmin(\${p.id})" title="Enviar novo áudio"><i class="fas fa-upload"></i> Upload</button>
            </td>
        </tr>
        \`;
    }).join('');
};

window.excluirAudioPedido = async function(pedidoId, audioIdx) {
    if (!confirm('Excluir este áudio?')) return;
    const p = DB.pedidos.find(x => x.id === pedidoId);
    if (p && p.audios) {
        p.audios.splice(audioIdx, 1);
        if (DBReady && p.docId) await DB_SERVICE.updatePedido(p.docId, p);
        renderBiblioteca();
        showToast('Áudio excluído!', 'success');
    }
};

window.abrirUploadAudioAdmin = function(pedidoId) {
    const p = DB.pedidos.find(x => x.id === pedidoId);
    if(!p) return;
    
    // We'll create a hidden file input on the fly
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.multiple = true;
    
    input.onchange = async (e) => {
        if (!e.target.files || e.target.files.length === 0) return;
        
        const novosAudios = [];
        for (let i = 0; i < e.target.files.length; i++) {
            const file = e.target.files[i];
            const b64 = await fileToBase64(file);
            novosAudios.push({
                nome: file.name,
                base64: b64,
                data: new Date().toISOString()
            });
        }
        
        p.audios = p.audios || [];
        p.audios.push(...novosAudios);
        
        if (DBReady && p.docId) await DB_SERVICE.updatePedido(p.docId, p);
        renderBiblioteca();
        showToast('Áudios enviados com sucesso!', 'success');
    };
    
    input.click();
};
`;

code = code + "\\n" + bibliotecaFunc;
fs.writeFileSync('/app/applet/app.js', code);
