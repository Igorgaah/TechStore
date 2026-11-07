const express = require('express');
const rotas = require('./rotas');

const app = express();
const porta = Number(process.env.PORT || 3000);

// Log de acesso só com metadados. Antes ele trazia também o corpo inteiro da resposta: cada resposta
// era serializada duas vezes (log e cliente) e gravada de forma síncrona no stdout, com nome e e-mail
// de clientes no log (diagnostico/00-linha-de-base/log-api.txt).
app.use((req, res, next) => {
  const inicio = Date.now();
  const enviarJson = res.json.bind(res);
  res.json = (corpo) => {
    console.log(JSON.stringify({
      metodo: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duracao_ms: Date.now() - inicio,
    }));
    return enviarJson(corpo);
  };
  next();
});

app.use(rotas);

app.use((req, res) => {
  res.status(404).json({ erro: 'rota nao encontrada' });
});

app.use((erro, req, res, next) => {
  console.error(erro);
  res.status(500).json({ erro: 'erro interno' });
});

app.listen(porta, () => {
  console.log(`API ouvindo na porta ${porta}`);
});
