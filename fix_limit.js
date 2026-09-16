const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

const regex = /input\.files = validFiles\.files;\\n\}/g;
code = code.replace(regex, "input.files = validFiles.files;\n}");

fs.writeFileSync('/app/applet/app.js', code);
