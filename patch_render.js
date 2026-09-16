const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

code = code.replace(
    "<div style=\"font-weight:bold;margin:10px 0;color:var(--primary-color);\">\\${formatCurrency(s.preco)} \\${s.isPorHora ? '/ hora' : ''}</div>",
    "<div style=\"font-weight:bold;margin:10px 0;color:var(--primary-color);\">\\${formatCurrency(s.preco)} \\${s.duracao ? ' | ' + s.duracao : ''}</div>"
);

fs.writeFileSync('/app/applet/app.js', code);
