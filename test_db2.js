const fs = require('fs');
const code = fs.readFileSync('/app/applet/app.js', 'utf8');
const result = code.match(/async function salvarServico\(\) \{[\s\S]*?showToast\('Serviço salvo', 'success'\);/);
console.log(result ? result[0] : "Not found");
