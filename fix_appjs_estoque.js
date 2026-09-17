const fs = require('fs');
let code = fs.readFileSync('/app/applet/app.js', 'utf8');

// remove references to estoque since it's not in the db
code = code.replace(
    /\<span class="item-card-badge \$\{m\.estoque > 0 \? 'badge-estoque' : 'badge-sem-estoque'\}"\>\$\{m\.estoque > 0 \? `\$\{m\.estoque\} disponível` : 'Esgotado'\}\<\/span\>/g,
    ''
);

code = code.replace(
    /if \(mat && mat\.estoque > 0\) mat\.estoque--;/g,
    ''
);

code = code.replace(
    /DB\.materiais\.filter\(m => m\.estoque <= 3\)\.slice\(0, 5\)\.forEach\(m => \{[\s\S]*?\}\);/g,
    ''
);

fs.writeFileSync('/app/applet/app.js', code);
