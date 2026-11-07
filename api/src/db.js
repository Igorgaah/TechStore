const { Pool } = require('pg');

// Um pool de conexões reaproveitadas, em vez de abrir e fechar uma conexão por consulta.
// Cada conexão nova custa um processo novo no PostgreSQL e um handshake
// (diagnostico/00-linha-de-base/custo-conexao.txt).
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'loja',
  database: process.env.DB_NAME || 'loja',
  max: Number(process.env.DB_POOL_MAX || 10),
});

// Uma conexão ociosa que cai (ex.: banco reiniciado) emite 'error' no pool; sem este
// tratador, o processo inteiro cairia. O pool descarta a conexão e abre outra quando precisar.
pool.on('error', (erro) => {
  console.error(JSON.stringify({ erro: 'conexao ociosa do pool falhou', detalhe: erro.message }));
});

async function consultar(sql, parametros = []) {
  const resultado = await pool.query(sql, parametros);
  return resultado.rows;
}

module.exports = { consultar };
