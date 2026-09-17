const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

// Also update salvarPedido to extract and validate it
code = code.replace(
    /const \{t, desc\} = updatePedidoTotal\(\);/,
    `const {t, desc} = updatePedidoTotal();
    const horaInicial = document.getElementById('pedidoHoraInicial') ? document.getElementById('pedidoHoraInicial').value : '';
    const horaFinal = document.getElementById('pedidoHoraFinal') ? document.getElementById('pedidoHoraFinal').value : '';
    if (horaInicial || horaFinal) {
        if (!validarHorarioEstudio(horaInicial, horaFinal)) return;
    }`
);

// We should also store it in `data`?
code = code.replace(
    /qtdFaixas: parseInt\(document\.getElementById\('pedidoQtdFaixas'\)\.value\) \|\| 1/,
    `qtdFaixas: parseInt(document.getElementById('pedidoQtdFaixas').value) || 1,
        horaInicial, horaFinal`
);

fs.writeFileSync('/app/applet/app.js', code);
