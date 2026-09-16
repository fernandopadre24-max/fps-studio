const fs = require('fs');
let code = fs.readFileSync('/app/applet/index.html', 'utf8');

// Undo the wrong replacement
code = code.replace(/<div class="form-group" style="display:none;" id="clientPedidoFaixasWrap">\s*<label>Quantidade de Faixas<\/label>\s*<input type="number" id="clientPedidoQtdFaixas" min="1" value="1">\s*<\/div>/, "");

// Do the right replacement in the client modal
const clientModalIdx = code.indexOf('id="novoPedidoClientModal"');
const clientTotalIdx = code.indexOf('<div class="pedido-total">', clientModalIdx);
const beforeClientTotal = code.substring(0, clientTotalIdx);
const afterClientTotal = code.substring(clientTotalIdx);

const lastDivIdx = beforeClientTotal.lastIndexOf('</div>');
const newBefore = beforeClientTotal.substring(0, lastDivIdx) + `
                    <div class="form-group">
                        <label>Quantidade de Faixas</label>
                        <input type="number" id="clientPedidoQtdFaixas" min="1" value="1">
                    </div>
                </div>
` + beforeClientTotal.substring(lastDivIdx + 6); // actually just insert

fs.writeFileSync('/app/applet/index.html', newBefore + afterClientTotal);
