const { execSync } = require('child_process');
try {
  const r = execSync('curl -s -X POST -H "Content-Type: application/json" -d \'{"nome":"Teste","descricao":"","preco":10}\' http://localhost:3000/api/servicos');
  console.log("Servico:", r.toString());
} catch(e) { console.log(e); }

try {
  const r2 = execSync('curl -s -X POST -H "Content-Type: application/json" -d \'{"nome":"Teste M","descricao":"","preco":10}\' http://localhost:3000/api/materiais');
  console.log("Material:", r2.toString());
} catch(e) { console.log(e); }
