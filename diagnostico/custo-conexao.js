// Micro-benchmark de diagnóstico: quanto custa abrir uma conexão nova a cada consulta
// (como o api/src/db.js original faz) em comparação com reaproveitar uma conexão aberta (pool).
// Roda dentro do container da API, com os mesmos limites de CPU dela e o banco ocioso:
//   docker compose exec -T api node - < diagnostico/custo-conexao.js
const { Client, Pool } = require('pg');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'loja',
  database: process.env.DB_NAME || 'loja',
};
const N = Number(process.env.N || 300);
const SQL = 'SELECT * FROM clientes WHERE id = $1';

async function conexaoPorConsulta(n) {
  for (let i = 1; i <= n; i += 1) {
    const cliente = new Client(config);
    await cliente.connect();
    await cliente.query(SQL, [i]);
    await cliente.end();
  }
}

async function pool(n) {
  const p = new Pool({ ...config, max: 1 });
  for (let i = 1; i <= n; i += 1) await p.query(SQL, [i]);
  await p.end();
}

async function medir(nome, fn) {
  await fn(20); // aquecimento
  const cpu0 = process.cpuUsage();
  const t0 = process.hrtime.bigint();
  await fn(N);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const cpu = process.cpuUsage(cpu0);
  const cpuMs = (cpu.user + cpu.system) / 1000;
  return { nome, total_ms: ms, por_consulta_ms: ms / N, cpu_node_por_consulta_ms: cpuMs / N };
}

(async () => {
  const a = await medir('conexão nova por consulta (db.js original)', conexaoPorConsulta);
  const b = await medir('pool (1 conexão reaproveitada)', pool);
  console.log(`consultas por cenário: ${N} (SELECT por chave primária, banco ocioso)`);
  for (const r of [a, b]) {
    console.log(`${r.nome.padEnd(45)} ${r.por_consulta_ms.toFixed(3)} ms/consulta  | CPU do Node ${r.cpu_node_por_consulta_ms.toFixed(3)} ms/consulta | total ${r.total_ms.toFixed(0)} ms`);
  }
  console.log(`razão tempo (nova/pool): ${(a.por_consulta_ms / b.por_consulta_ms).toFixed(1)}x`);
})().catch((erro) => { console.error(erro); process.exit(1); });
