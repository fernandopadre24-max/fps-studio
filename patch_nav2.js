const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

code = code.replace(/if\(pageId === 'adminFinanceiro'\) renderMovimentacoes\(\);/, "if(pageId === 'adminFinanceiro') renderMovimentacoes();\\n            if(pageId === 'adminBiblioteca') renderBiblioteca();");

fs.writeFileSync('/app/applet/app.js', code);
