const fs = require('fs');
const content = fs.readFileSync('/app/applet/app.js', 'utf8');
const index = content.indexOf('\\n');
console.log(index > -1 ? content.substring(index - 20, index + 20) : "Not found in app.js");

const html = fs.readFileSync('/app/applet/index.html', 'utf8');
const hIndex = html.indexOf('\\n');
console.log(hIndex > -1 ? html.substring(hIndex - 20, hIndex + 20) : "Not found in html");
