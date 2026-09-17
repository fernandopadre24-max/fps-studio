const { execSync } = require('child_process');
try {
  const getRes = execSync('curl -s http://localhost:3000/api/servicos');
  console.log(getRes.toString());
} catch(e) { console.log(e); }
