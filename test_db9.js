const { execSync } = require('child_process');
try {
  const getRes = execSync('curl -s http://localhost:3000/api/servicos');
  const d = JSON.parse(getRes.toString());
  console.log("SERVICOS DB:", d);
} catch(e) { console.log(e); }
