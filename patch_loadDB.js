const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

code = code.replace("DB.config = await DB_SERVICE.getConfig();", "DB.config = await DB_SERVICE.getConfig();\\n    DB.bibliotecas = await DB_SERVICE.getBiblioteca();");

fs.writeFileSync('/app/applet/app.js', code);
