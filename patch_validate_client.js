const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

if (!code.includes('if (!validarHorarioEstudio(horaInicial, horaFinal)) return;')) {
    code = code.replace(
        "const horaFinal = document.getElementById('clientPedidoHoraFinal').value || '';",
        `const horaFinal = document.getElementById('clientPedidoHoraFinal').value || '';
    if (horaInicial || horaFinal) {
        if (!validarHorarioEstudio(horaInicial, horaFinal)) return;
    }`
    );
    fs.writeFileSync('/app/applet/app.js', code);
}
