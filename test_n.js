const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');
const lines = code.split('\n');
lines.forEach((l, i) => {
    if (l.includes('\\n')) console.log(i + 1, l);
});
