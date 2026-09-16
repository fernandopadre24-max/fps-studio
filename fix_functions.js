const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

const regexServico = /async function salvarServico\(\) \{[\s\S]*?showToast\('Serviço salvo', 'success'\);\n\}/;
const replaceServico = `
async function salvarServico() {
    const id = document.getElementById('servicoId').value;
    const imgEl = document.getElementById('servicoImagemPreview');
    const img = imgEl.style.display !== 'none' ? imgEl.src : null;
    
    let strPreco = document.getElementById('servicoPreco').value || '0';
    const precoFloat = parseFloat(strPreco.replace(/\\./g, '').replace(',', '.')) || 0;

    const data = {
        nome: document.getElementById('servicoNome').value,
        descricao: document.getElementById('servicoDescricao').value,
        preco: precoFloat,
        duracao: document.getElementById('servicoDuracao') ? document.getElementById('servicoDuracao').value : '',
        icone: document.getElementById('servicoIcone') ? document.getElementById('servicoIcone').value : 'fa-cog',
        categoria: document.getElementById('servicoCategoria') ? document.getElementById('servicoCategoria').value : 'outro',
        imagem: img
    };
    
    if (id) {
        const item = DB.servicos.find(x => x.id === parseInt(id) || x.id === id);
        if (item) {
            Object.assign(item, data);
            if (DBReady) await DB_SERVICE.updateServico(item.id, data);
        }
    } else {
        if (DBReady) {
            const res = await DB_SERVICE.addServico(data);
            data.id = res.id;
        } else {
            data.id = 'serv_' + Date.now();
        }
        DB.servicos.push(data);
    }
    
    closeAllModals();
    renderServicos();
    showToast('Serviço salvo', 'success');
}
`;

const regexMaterial = /async function salvarMaterial\(\) \{[\s\S]*?showToast\('Material salvo', 'success'\);\n\}/;
const replaceMaterial = `
async function salvarMaterial() {
    const id = document.getElementById('materialId').value;
    const imgEl = document.getElementById('materialImagemPreview');
    const img = imgEl.style.display !== 'none' ? imgEl.src : null;
    
    let strPreco = document.getElementById('materialPreco').value || '0';
    const precoFloat = parseFloat(strPreco.replace(/\\./g, '').replace(',', '.')) || 0;

    const data = {
        nome: document.getElementById('materialNome').value,
        descricao: document.getElementById('materialDescricao').value,
        preco: precoFloat,
        categoria: document.getElementById('materialCategoria') ? document.getElementById('materialCategoria').value : 'outro',
        imagem: img
    };
    
    if (id) {
        const item = DB.materiais.find(x => x.id === parseInt(id) || x.id === id);
        if (item) {
            Object.assign(item, data);
            if (DBReady) await DB_SERVICE.updateMaterial(item.id, data);
        }
    } else {
        if (DBReady) {
            const res = await DB_SERVICE.addMaterial(data);
            data.id = res.id;
        } else {
            data.id = 'mat_' + Date.now();
        }
        DB.materiais.push(data);
    }
    
    closeAllModals();
    renderMateriais();
    showToast('Material salvo', 'success');
}
`;

code = code.replace(regexServico, replaceServico.trim());
code = code.replace(regexMaterial, replaceMaterial.trim());

if (!code.includes('function mascaraMoedaBR')) {
    code += `\nwindow.mascaraMoedaBR = function(i) {
        let v = i.value.replace(/\\D/g, '');
        v = (v / 100).toFixed(2) + '';
        v = v.replace('.', ',');
        v = v.replace(/(\\d)(?=(\\d{3})+(?!\\d))/g, '$1.');
        i.value = v;
    };\n`;
}

fs.writeFileSync('/app/applet/app.js', code);
