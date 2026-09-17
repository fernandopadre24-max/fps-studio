const { execSync } = require('child_process');
try {
  const getRes = execSync('curl -s http://localhost:3000/api/materiais');
  const d = JSON.parse(getRes.toString());
  console.log("QTD MATERIAIS DB:", d.length);
} catch(e) { console.log(e); }
