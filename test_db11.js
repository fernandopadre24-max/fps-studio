const { execSync } = require('child_process');
try {
  const getRes = execSync('curl -s http://localhost:3000/api/pedidos');
  const d = JSON.parse(getRes.toString());
  console.log("PEDIDOS DB:", JSON.stringify(d, null, 2));
} catch(e) { console.log(e); }
