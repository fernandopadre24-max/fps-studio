const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

const regex = /const list = document\.getElementById\('bibliotecasBody'\);\n    if \(!list\) return;\n\n    const selectCli/g;
code = code.replace(regex, "const selectCli");

fs.writeFileSync('/app/applet/app.js', code);
