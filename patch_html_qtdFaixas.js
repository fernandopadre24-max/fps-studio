const fs = require('fs');
let code = fs.readFileSync('/app/applet/index.html', 'utf8');

const adminField = `
                    <div class="form-group">
                        <label>Desconto (R$)</label>
                        <input type="text" id="pedidoDesconto" inputmode="decimal" value="0" placeholder="0,00" oninput="mascaraMoedaBR(this); updatePedidoTotal()">
                    </div>
                    <div class="form-group">
                        <label>Qtd de Faixas</label>
                        <input type="number" id="pedidoQtdFaixas" min="1" value="1">
                    </div>
`;
code = code.replace(/<div class="form-group">\s*<label>Desconto \(R\$\)<\/label>\s*<input type="text" id="pedidoDesconto" [^>]+>\s*<\/div>/, adminField.trim());

const clientField = `
                    <div class="form-group" style="display:none;" id="clientPedidoFaixasWrap">
                        <label>Quantidade de Faixas</label>
                        <input type="number" id="clientPedidoQtdFaixas" min="1" value="1">
                    </div>
                </div>
                <div class="pedido-total">
`;
code = code.replace(/<\/div>\s*<div class="pedido-total">/, clientField);

fs.writeFileSync('/app/applet/index.html', code);
