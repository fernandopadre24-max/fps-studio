const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

code = code.replace("\\nwindow.renderBiblioteca = function() {", "\nwindow.renderBiblioteca = function() {");
fs.writeFileSync('/app/applet/app.js', code);
