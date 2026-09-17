const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

if (!code.includes("document.getElementById('pedidoHoraInicial').value = p.horaInicial || '';")) {
    code = code.replace(
        "document.getElementById('pedidoQtdFaixas').value = p.qtdFaixas || 1;",
        `document.getElementById('pedidoQtdFaixas').value = p.qtdFaixas || 1;
    if(document.getElementById('pedidoHoraInicial')) document.getElementById('pedidoHoraInicial').value = p.horaInicial || '';
    if(document.getElementById('pedidoHoraFinal')) document.getElementById('pedidoHoraFinal').value = p.horaFinal || '';`
    );
    fs.writeFileSync('/app/applet/app.js', code);
}
