const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

code = code.replace(
    "const imgEl = document.getElementById('servicoImagemPreview');\\n    const img = imgEl.style.display !== 'none' ? imgEl.src : null;",
    "const imgEl = document.getElementById('servicoImagemPreview');\\n    const img = (imgEl && imgEl.style.display !== 'none') ? imgEl.src : null;"
);

code = code.replace(
    "const imgEl = document.getElementById('materialImagemPreview');\\n    const img = imgEl.style.display !== 'none' ? imgEl.src : null;",
    "const imgEl = document.getElementById('materialImagemPreview');\\n    const img = (imgEl && imgEl.style.display !== 'none') ? imgEl.src : null;"
);

fs.writeFileSync('/app/applet/app.js', code);
