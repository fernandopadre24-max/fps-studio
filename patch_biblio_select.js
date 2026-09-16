const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

const regex = /window\.renderBibliotecas = function\(\) \{/;
const replacement = `window.renderBibliotecas = function() {
    const list = document.getElementById('bibliotecasBody');
    if (!list) return;

    const selectCli = document.getElementById('biblioFiltroCliente');
    if (selectCli && selectCli.options.length <= 1) {
        selectCli.innerHTML = '<option value="">Todos os clientes</option>' + DB.clientes.map(c => \`<option value="\${c.id}">\${c.nome}</option>\`).join('');
    }`;
code = code.replace(regex, replacement);

fs.writeFileSync('/app/applet/app.js', code);
