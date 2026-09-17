const { execSync } = require('child_process');
try {
  execSync('curl -s -X POST -H "Content-Type: application/json" -d \'{"nome":"Material 1","descricao":"","preco":20}\' http://localhost:3000/api/materiais');
  const getRes = execSync('curl -s http://localhost:3000/api/materiais');
  const d = JSON.parse(getRes.toString());
  console.log("MATERIAIS:", d);
} catch(e) { console.log(e); }
