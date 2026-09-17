const { execSync } = require('child_process');
try {
  const getRes = execSync('curl -s http://localhost:3000/api/servicos');
  const d = JSON.parse(getRes.toString());
  console.log("QTD DB:", d.length);
} catch(e) { console.log(e); }
