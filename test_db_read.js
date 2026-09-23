const initSqlJs = require('/app/applet/node_modules/sql.js');
const fs = require('fs');
async function run() {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync('/app/applet/fps-studio.db'));
  const res = db.exec('SELECT * FROM materiais');
  console.log("materiais:", JSON.stringify(res, null, 2));
}
run();
