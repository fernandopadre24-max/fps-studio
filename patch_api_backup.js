const fs = require('fs');
let code = fs.readFileSync('/app/applet/api/[action].js', 'utf8');

code = code.replace(/pedidos: pedidos\.map\(p => \(\{ \.\.\.p, servicos: JSON\.parse\(p\.servicos \|\| '\[\]'\), materiais: JSON\.parse\(p\.materiais \|\| '\[\]'\) \}\)\),/g, "pedidos: pedidos.map(p => ({ ...p, servicos: JSON.parse(p.servicos || '[]'), materiais: JSON.parse(p.materiais || '[]'), audios: JSON.parse(p.audios || '[]') })),");

code = code.replace(/const insPedido = ins\('pedidos', \['id', 'clienteId', 'servicos', 'materiais', 'desconto', 'status', 'data', 'total', 'parcial', 'descontoPct', 'dataPref', 'horarioPref', 'dataInicial', 'horaInicial', 'dataFinal', 'horaFinal'\]\);/g, "const insPedido = ins('pedidos', ['id', 'clienteId', 'servicos', 'materiais', 'desconto', 'status', 'data', 'total', 'parcial', 'descontoPct', 'dataPref', 'horarioPref', 'dataInicial', 'horaInicial', 'dataFinal', 'horaFinal', 'qtdFaixas', 'audios']);");

code = code.replace(/\(\(data\.pedidos \|\| \[\]\)\.map\(p => \(\{ \.\.\.p, servicos: JSON\.stringify\(p\.servicos \|\| \[\]\), materiais: JSON\.stringify\(p\.materiais \|\| \[\]\) \}\)\)\)\.forEach\(insPedido\);/g, "((data.pedidos || []).map(p => ({ ...p, servicos: JSON.stringify(p.servicos || []), materiais: JSON.stringify(p.materiais || []), audios: JSON.stringify(p.audios || []) }))).forEach(insPedido);");

fs.writeFileSync('/app/applet/api/[action].js', code);
