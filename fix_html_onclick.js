const fs = require('fs');
let code = fs.readFileSync('/app/applet/index.html', 'utf8');

code = code.replace(/onclick="openModal\('pedidoModal'\)"/g, "onclick=\"abrirNovoPedidoModalAdmin()\"");

fs.writeFileSync('/app/applet/index.html', code);
