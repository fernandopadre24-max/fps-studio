const { execSync } = require('child_process');
try {
  const postRes = execSync('curl -v -s -X POST -H "Content-Type: application/json" -d \'{"nome":"Material 1","descricao":"","preco":20}\' http://localhost:3000/api/materiais 2>&1');
  console.log("POST RES:", postRes.toString());
} catch(e) { console.log(e); }
