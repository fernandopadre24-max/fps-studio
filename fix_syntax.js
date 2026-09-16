const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

code = code.replace(/renderMovimentacoes\(\);\\n\s*if/, "renderMovimentacoes();\n            if");
fs.writeFileSync('/app/applet/app.js', code);
