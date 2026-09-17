const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');
code = code.replace(
    `const img = (imgEl && imgEl.style.display !== 'none') ? imgEl.src : null;`,
    `const img = (imgEl && imgEl.style.display !== 'none' && imgEl.src) ? imgEl.src : null;`
);
fs.writeFileSync('/app/applet/app.js', code);
