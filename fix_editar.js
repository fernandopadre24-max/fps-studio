const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

const regexEditServ = /function editarServico\(id\) \{[\s\S]*?openModal\('servicoModal'\);\n\}/;
const replaceEditServ = `function editarServico(id) {
    const s = DB.servicos.find(x => x.id === parseInt(id) || x.id === id);
    if (!s) return;
    clearForm('servico');
    document.getElementById('servicoId').value = s.id;
    document.getElementById('servicoNome').value = s.nome;
    document.getElementById('servicoDescricao').value = s.descricao;
    
    // Convert to string formatted for the mask if needed, but let's just set the string.
    let precoFmt = Number(s.preco).toFixed(2).replace('.', ',');
    document.getElementById('servicoPreco').value = precoFmt;
    
    if (document.getElementById('servicoDuracao')) document.getElementById('servicoDuracao').value = s.duracao || '';
    if (document.getElementById('servicoIcone')) document.getElementById('servicoIcone').value = s.icone || 'fa-cog';
    if (document.getElementById('servicoCategoria')) document.getElementById('servicoCategoria').value = s.categoria || 'outro';
    
    if (s.imagem) {
        document.getElementById('servicoImagemPreview').src = s.imagem;
        document.getElementById('servicoImagemPreview').style.display = 'block';
    }
    openModal('servicoModal');
}`;

const regexEditMat = /function editarMaterial\(id\) \{[\s\S]*?openModal\('materialModal'\);\n\}/;
const replaceEditMat = `function editarMaterial(id) {
    const m = DB.materiais.find(x => x.id === parseInt(id) || x.id === id);
    if (!m) return;
    clearForm('material');
    document.getElementById('materialId').value = m.id;
    document.getElementById('materialNome').value = m.nome;
    document.getElementById('materialDescricao').value = m.descricao;
    
    let precoFmt = Number(m.preco).toFixed(2).replace('.', ',');
    document.getElementById('materialPreco').value = precoFmt;

    if (document.getElementById('materialCategoria')) document.getElementById('materialCategoria').value = m.categoria || 'outro';
    
    if (m.imagem) {
        document.getElementById('materialImagemPreview').src = m.imagem;
        document.getElementById('materialImagemPreview').style.display = 'block';
    }
    openModal('materialModal');
}`;

code = code.replace(regexEditServ, replaceEditServ);
code = code.replace(regexEditMat, replaceEditMat);
fs.writeFileSync('/app/applet/app.js', code);
