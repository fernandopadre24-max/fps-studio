const fs = require('fs');
let code = fs.readFileSync('/app/applet/index.html', 'utf8');

code = code.replace(
    '<input type="file" id="servicoImagem" accept="image/*" style="display:none" onchange="previewImagem(this, \'servicoImgPreview\')">',
    '<input type="file" id="servicoImagem" accept="image/*" style="display:none" onchange="previewImagem(this, \'servicoImagemPreview\')">\\n                        <img id="servicoImagemPreview" style="display:none; width:100%; height:120px; object-fit:cover; border-radius:4px; margin-bottom:10px;">'
);

code = code.replace(
    '<input type="file" id="materialImagem" accept="image/*" style="display:none" onchange="previewImagem(this, \'materialImgPreview\')">',
    '<input type="file" id="materialImagem" accept="image/*" style="display:none" onchange="previewImagem(this, \'materialImagemPreview\')">\\n                        <img id="materialImagemPreview" style="display:none; width:100%; height:120px; object-fit:cover; border-radius:4px; margin-bottom:10px;">'
);

fs.writeFileSync('/app/applet/index.html', code);
