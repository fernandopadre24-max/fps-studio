const fs = require('fs');
let code = fs.readFileSync('/app/applet/index.html', 'utf8');

const extra = `                    <div class="form-group">
                        <label>Quantidade de Faixas</label>
                        <input type="number" id="clientPedidoQtdFaixas" min="1" value="1">
                    </div>
                </div>`;
                
// It's in the orcamento section around line 1464
code = code.replace(extra, "</div>"); // Just replace it with the closing div that was originally there.
fs.writeFileSync('/app/applet/index.html', code);
