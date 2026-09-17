const fs = require('fs');
let code = fs.readFileSync('/app/applet/index.html', 'utf8');

code = code.replace(
    /<input type="time" id="pedidoHoraInicial">/g,
    `<input type="time" id="pedidoHoraInicial" onchange="validarHorarioEstudio(this.value, document.getElementById('pedidoHoraFinal').value)">`
);

code = code.replace(
    /<input type="time" id="pedidoHoraFinal">/g,
    `<input type="time" id="pedidoHoraFinal" onchange="validarHorarioEstudio(document.getElementById('pedidoHoraInicial').value, this.value)">`
);

code = code.replace(
    /<input type="time" id="clientPedidoHoraInicial">/g,
    `<input type="time" id="clientPedidoHoraInicial" onchange="validarHorarioEstudio(this.value, document.getElementById('clientPedidoHoraFinal').value)">`
);

code = code.replace(
    /<input type="time" id="clientPedidoHoraFinal">/g,
    `<input type="time" id="clientPedidoHoraFinal" onchange="validarHorarioEstudio(document.getElementById('clientPedidoHoraInicial').value, this.value)">`
);

fs.writeFileSync('/app/applet/index.html', code);
