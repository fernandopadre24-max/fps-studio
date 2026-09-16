const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

// Fix editarPedido to populate all fields
const oldEditarPedido = `
    document.getElementById('pedidoId').value = p.id;
    document.getElementById('pedidoCliente').innerHTML = DB.clientes.map(c => \`<option value="\${c.id}">\${c.nome}</option>\`).join('');
    document.getElementById('pedidoCliente').value = p.clienteId;
    document.getElementById('pedidoStatus').value = p.status;
    document.getElementById('pedidoData').value = p.data;
    document.getElementById('pedidoTotal').value = p.total;
`;
const newEditarPedido = `
    document.getElementById('pedidoId').value = p.id;
    document.getElementById('pedidoCliente').innerHTML = DB.clientes.map(c => \`<option value="\${c.id}">\${c.nome}</option>\`).join('');
    document.getElementById('pedidoCliente').value = p.clienteId;
    document.getElementById('pedidoStatus').value = p.status;
    
    // Checkboxes for servicos and materiais
    const servicosHtml = DB.servicos.map(s => \`<label><input type="checkbox" value="\${s.id}" \${p.servicos.includes(s.id) ? 'checked' : ''} onchange="updatePedidoTotal()"> \${s.nome} (\${formatCurrency(s.preco)})</label>\`).join('');
    document.getElementById('pedidoServicos').innerHTML = servicosHtml;
    
    const materiaisHtml = DB.materiais.map(m => \`<label><input type="checkbox" value="\${m.id}" \${p.materiais.includes(m.id) ? 'checked' : ''} onchange="updatePedidoTotal()"> \${m.nome} (\${formatCurrency(m.preco)})</label>\`).join('');
    document.getElementById('pedidoMateriais').innerHTML = materiaisHtml;
    
    document.getElementById('pedidoDesconto').value = p.desconto ? fmtCalc(p.desconto) : '0,00';
    document.getElementById('pedidoQtdFaixas').value = p.qtdFaixas || 1;
`;
code = code.replace(oldEditarPedido.trim(), newEditarPedido.trim());

// Also make openModal('pedidoModal') render the checkboxes for a new order
// Actually, new orders should have empty checkboxes. We should add a function `abrirNovoPedido()` or update it inside `openModal`. Let's just create `abrirNovoPedidoModalAdmin()`.
const newAbrirPedido = `
window.abrirNovoPedidoModalAdmin = function() {
    clearForm('pedido');
    document.getElementById('pedidoId').value = '';
    document.getElementById('pedidoCliente').innerHTML = DB.clientes.map(c => \`<option value="\${c.id}">\${c.nome}</option>\`).join('');
    
    const servicosHtml = DB.servicos.map(s => \`<label><input type="checkbox" value="\${s.id}" onchange="updatePedidoTotal()"> \${s.nome} (\${formatCurrency(s.preco)})</label>\`).join('');
    document.getElementById('pedidoServicos').innerHTML = servicosHtml;
    
    const materiaisHtml = DB.materiais.map(m => \`<label><input type="checkbox" value="\${m.id}" onchange="updatePedidoTotal()"> \${m.nome} (\${formatCurrency(m.preco)})</label>\`).join('');
    document.getElementById('pedidoMateriais').innerHTML = materiaisHtml;
    
    document.getElementById('pedidoDesconto').value = '0,00';
    document.getElementById('pedidoQtdFaixas').value = '1';
    
    openModal('pedidoModal');
    updatePedidoTotal();
}
`;
code = code + newAbrirPedido;

// Fix salvarPedido
const oldSalvarPedido = `
async function salvarPedido() {
    const id = document.getElementById('pedidoId').value;
    const data = {
        clienteId: document.getElementById('pedidoCliente').value,
        status: document.getElementById('pedidoStatus').value,
        data: document.getElementById('pedidoData').value,
        total: Number(document.getElementById('pedidoTotal').value),
    };
`;
const newSalvarPedido = `
window.updatePedidoTotal = function() {
    let t = 0;
    [...document.querySelectorAll('#pedidoServicos input:checked')].forEach(cb => {
        const s = DB.servicos.find(x => x.id === parseInt(cb.value));
        if(s) t += s.preco;
    });
    [...document.querySelectorAll('#pedidoMateriais input:checked')].forEach(cb => {
        const m = DB.materiais.find(x => x.id === parseInt(cb.value));
        if(m) t += m.preco;
    });
    const descStr = document.getElementById('pedidoDesconto').value;
    const desc = parseFloat((descStr || '0').replace(/\\./g, '').replace(',', '.'));
    t = Math.max(0, t - desc);
    const prev = document.getElementById('pedidoTotalPreview');
    if(prev) prev.textContent = formatCurrency(t);
    return {t, desc};
};

async function salvarPedido() {
    const id = document.getElementById('pedidoId').value;
    const {t, desc} = updatePedidoTotal();
    const servicos = [...document.querySelectorAll('#pedidoServicos input:checked')].map(cb => parseInt(cb.value));
    const materiais = [...document.querySelectorAll('#pedidoMateriais input:checked')].map(cb => parseInt(cb.value));
    
    const data = {
        clienteId: parseInt(document.getElementById('pedidoCliente').value),
        status: document.getElementById('pedidoStatus').value,
        servicos, materiais,
        desconto: desc,
        total: t,
        qtdFaixas: parseInt(document.getElementById('pedidoQtdFaixas').value) || 1
    };
`;
code = code.replace(oldSalvarPedido.trim(), newSalvarPedido.trim());
fs.writeFileSync('/app/applet/app.js', code);
