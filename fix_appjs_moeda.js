const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');
code = code.replace(
    /const precoFloat = parseFloat\(strPreco\.replace\(\/\\\.(\/g, '')\.replace\(',', '\.'\)\) \|\| 0;/g,
    `const precoFloat = parseFloat(strPreco.replace(/\\./g, '').replace(',', '.')) || 0;`
);
// just double check the parse logic
fs.writeFileSync('/app/applet/app.js', code);
