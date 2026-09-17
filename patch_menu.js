const fs = require('fs');
let code = fs.readFileSync('/app/applet/index.html', 'utf8');

code = code.replace(
    '<i class="fas fa-music"></i><span>Biblioteca</span>',
    '<i class="fas fa-folder-open"></i><span>Áudios de Pedidos</span>'
);

code = code.replace(
    '<i class="fas fa-music"></i><span>Bibliotecas</span>',
    '<i class="fas fa-compact-disc"></i><span>Áudios Avulsos</span>'
);

code = code.replace(
    '<h2>Biblioteca de Áudios</h2>',
    '<h2>Áudios de Pedidos (Referências)</h2>'
);

// Note: second replace for the second page header
code = code.replace(
    '<h2>Biblioteca de Áudios</h2>',
    '<h2>Áudios Avulsos (Enviados via Chat)</h2>'
);

fs.writeFileSync('/app/applet/index.html', code);
