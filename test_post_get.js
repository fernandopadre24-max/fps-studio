const { execSync } = require('child_process');
try {
  execSync('curl -s -X POST -H "Content-Type: application/json" -d \'{"nome":"Servico 1","descricao":"","preco":10}\' http://localhost:3000/api/servicos');
  const getRes = execSync('curl -s http://localhost:3000/api/servicos');
  console.log(getRes.toString());
} catch(e) { console.log(e); }
