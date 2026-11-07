const express = require('express');
const rotas = require('./rotas');

const app = express();
const porta = Number(process.env.PORT || 3000);

// Log de acesso só com metadados. Antes ele trazia também o corpo inteiro da resposta: cada resposta
// era serializada duas vezes (log e cliente), ~1,1 KB de log por requisição, com nome e e-mail de
// clientes (diagnostico/00-linha-de-base/log-api.txt). Observação: no container (Linux) o stdout é um
// pipe, e a doc do Node 20 diz que escrita em pipe é assíncrona em POSIX; a hipótese original da
// mudança 13 supunha escrita síncrona (ver experimentos.md).
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
