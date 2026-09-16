const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('/app/applet/app.db');
db.all("SELECT * FROM servicos", (err, rows) => {
    console.log("Servicos:", rows.map(r => r.preco));
});
db.all("SELECT * FROM materiais", (err, rows) => {
    console.log("Materiais:", rows.map(r => r.preco));
});
