const fs = require('fs');
const sqlite3 = require('/app/applet/node_modules/sqlite-sync');
sqlite3.connect('/app/applet/fps-studio.db');
console.log(sqlite3.run('PRAGMA table_info(pedidos)'));
