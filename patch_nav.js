const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

code = code.replace("if(pageId === 'adminBiblioteca') renderBiblioteca();", "if(pageId === 'adminBiblioteca') renderBiblioteca();\\n            if(pageId === 'adminBibliotecas') renderBibliotecas();");

fs.writeFileSync('/app/applet/app.js', code);
