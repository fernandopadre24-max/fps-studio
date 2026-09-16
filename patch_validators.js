const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

const funcs = `
window.validateAudioFile = function(file) {
    // Apenas MP3
    if (file.type !== 'audio/mpeg' && !file.name.toLowerCase().endsWith('.mp3')) {
        showToast('Apenas arquivos .mp3 são permitidos.', 'error');
        return false;
    }
    // Tamanho máximo (15MB)
    const maxSize = 15 * 1024 * 1024;
    if (file.size > maxSize) {
        showToast('O arquivo excede o limite de 15MB.', 'error');
        return false;
    }
    return true;
};

window.enviarAudioBiblioteca = async function(input) {
    if (!currentUser || currentUser.role !== 'client') return;
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    if (!validateAudioFile(file)) {
        input.value = '';
        return;
    }
    
    const b64 = await fileToBase64(file);
    const audioObj = {
        clienteId: currentUser.id,
        arquivoNome: file.name,
        audio: b64,
        descricao: 'Enviado pelo Chat do Cliente',
        duracao: 0
    };
    
    DB.bibliotecas = DB.bibliotecas || [];
    DB.bibliotecas.push(audioObj);
    
    if (DBReady) {
        const docId = await DB_SERVICE.addBiblioteca(audioObj);
        audioObj.id = docId.id;
    }
    
    showToast('Áudio enviado para a Biblioteca do estúdio!', 'success');
    input.value = '';
};

window.renderBibliotecas = function() {
    const list = document.getElementById('bibliotecasBody');
    if (!list) return;
    
    let dados = DB.bibliotecas || [];
    
    const filtroCli = document.getElementById('biblioFiltroCliente')?.value;
    if (filtroCli) {
        dados = dados.filter(b => b.clienteId == filtroCli);
    }
    
    const dtInicio = document.getElementById('biblioDataInicio')?.value;
    const dtFim = document.getElementById('biblioDataFim')?.value;
    if (dtInicio) dados = dados.filter(b => b.data >= dtInicio);
    if (dtFim) dados = dados.filter(b => b.data <= dtFim);
    
    const busca = document.getElementById('biblioBusca')?.value?.toLowerCase();
    if (busca) {
        dados = dados.filter(b => b.arquivoNome.toLowerCase().includes(busca) || b.descricao.toLowerCase().includes(busca));
    }
    
    if (dados.length === 0) {
        list.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum áudio encontrado.</td></tr>';
        return;
    }
    
    list.innerHTML = dados.map(b => {
        const cliente = DB.clientes.find(c => c.id === b.clienteId);
        const cliNome = cliente ? cliente.nome : 'Desconhecido';
        return \`
        <tr>
            <td>\${cliNome}</td>
            <td>
                <strong>\${b.arquivoNome}</strong>
                <br><small class="text-muted">\${b.descricao}</small>
            </td>
            <td>\${formatDate(b.data)} \${b.hora || ''}</td>
            <td>
                \${b.audio ? \`<audio controls src="\${b.audio}" style="height:30px;width:150px;"></audio>\` : '-'}
            </td>
            <td>
                \${b.audio ? \`<a href="\${b.audio}" download="\${b.arquivoNome}" class="btn-icon" title="Baixar"><i class="fas fa-download"></i></a>\` : ''}
                <button class="btn-icon text-danger" onclick="excluirBibliotecaAudio(\${b.id})" title="Excluir"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
        \`;
    }).join('');
};

window.excluirBibliotecaAudio = async function(id) {
    if(!confirm('Excluir este áudio da biblioteca?')) return;
    DB.bibliotecas = DB.bibliotecas.filter(x => x.id !== id);
    if(DBReady) await DB_SERVICE.deleteBiblioteca(id);
    renderBibliotecas();
    showToast('Áudio excluído!', 'success');
};
`;

code += "\n" + funcs;

// We also need to fix `abrirUploadAudioAdmin` to validate files.
code = code.replace(/const b64 = await fileToBase64\(file\);/, `if(!validateAudioFile(file)) continue;
            const b64 = await fileToBase64(file);`);

// And limitAudiosClient
const limitReplace = `function limitAudiosClient(input) {
    if (input.files.length > 10) {
        showToast('Você pode anexar no máximo 10 áudios.', 'error');
        const dt = new DataTransfer();
        for (let i = 0; i < 10; i++) dt.items.add(input.files[i]);
        input.files = dt.files;
    }
    
    const validFiles = new DataTransfer();
    for(let i=0; i<input.files.length; i++) {
        if(validateAudioFile(input.files[i])) {
            validFiles.items.add(input.files[i]);
        }
    }
    input.files = validFiles.files;
}`;
code = code.replace(/function limitAudiosClient\(input\) \{[\s\S]*?input\.files = dt\.files;\n    \}/, limitReplace);

fs.writeFileSync('/app/applet/app.js', code);
