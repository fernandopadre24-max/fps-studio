const fs = require('fs');
let code = fs.readFileSync('/app/applet/index.html', 'utf8');

// The first time I replaced it in admin modal, it was correct because I matched `<div class="form-group">\s*<label>Desconto \(R\$\)<\/label>`
const adminRegex = /<div class="form-group">\s*<label>Desconto \(R\$\)<\/label>\s*<input type="text" id="pedidoDesconto" inputmode="decimal" value="0" placeholder="0,00" oninput="mascaraMoedaBR\(this\); updatePedidoTotal\(\)">\s*<\/div>/;

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
code = code.replace(adminRegex, adminField.trim());

const clientRegex = /<div class="form-group">\s*<label>Anexar Áudios/;
const clientField = `
                <div class="form-group">
                    <label>Quantidade de Faixas</label>
                    <input type="number" id="clientPedidoQtdFaixas" min="1" value="1">
                </div>
                <div class="form-group">
                    <label>Anexar Áudios`;

code = code.replace(clientRegex, clientField.trim());

// For "Biblioteca", the user wants the Admin to be able to listen, download, or delete MP3s based on the number of tracks.
// I will create a new "adminBiblioteca" module.
const bibliotecaTab = `
                <a href="#" class="nav-item" data-page="adminFinanceiro">
                    <i class="fas fa-chart-line"></i><span>Financeiro</span>
                </a>
                <a href="#" class="nav-item" data-page="adminBiblioteca">
                    <i class="fas fa-music"></i><span>Biblioteca</span>
                </a>
`;
code = code.replace(/<a href="#" class="nav-item" data-page="adminFinanceiro">[\s\S]*?<\/a>/, bibliotecaTab.trim());

const bibliotecaPage = `
                <!-- BIBLIOTECA -->
                <div class="page" id="adminBiblioteca">
                    <div class="page-header">
                        <h2>Biblioteca de Áudios</h2>
                    </div>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Pedido ID</th>
                                    <th>Cliente</th>
                                    <th>Faixas Previstas</th>
                                    <th>Áudios Anexados</th>
                                    <th>Arquivos</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody id="bibliotecaBody"></tbody>
                        </table>
                    </div>
                </div>
`;
code = code.replace(/<!-- FINANCEIRO -->/, bibliotecaPage + "\\n                <!-- FINANCEIRO -->");

fs.writeFileSync('/app/applet/index.html', code);
