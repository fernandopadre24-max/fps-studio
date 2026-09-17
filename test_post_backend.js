const { execSync } = require('child_process');
try {
  const r = execSync('curl -s -X POST -H "Content-Type: application/json" -d \'{"nome":"Teste Categoria","descricao":"","preco":10,"categoria":"mixagem"}\' http://localhost:3000/api/servicos');
  console.log("Servico:", r.toString());
} catch(e) { console.log(e); }
