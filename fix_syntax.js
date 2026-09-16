const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

code = code.replace(/renderBiblioteca\(\);\\\\n\s*if/g, "renderBiblioteca();\\n            if");
code = code.replace(/renderBiblioteca\(\);\\n\s*if/g, "renderBiblioteca();\\n            if");
fs.writeFileSync('/app/applet/app.js', code);
