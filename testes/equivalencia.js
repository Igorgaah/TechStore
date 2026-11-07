// Equivalência ampla: compara, URL por URL, as respostas de duas APIs (status HTTP e corpo JSON,
// inclusive a ordem dos campos e dos itens). Complementa o contrato (42 casos fixos) com centenas
// de URLs sorteadas com semente fixa, em todas as rotas.
//
//   testes/api-original.sh            # sobe o código ORIGINAL da API na porta 3001, no mesmo banco
//   node testes/equivalencia.js http://127.0.0.1:3001 http://127.0.0.1:3000
//
// Os índices e tabelas de resumo não mudam o resultado das consultas originais, então a API original
// rodando contra o banco otimizado é a referência do que cada rota deve devolver.
const [, , URL_REFERENCIA, URL_CANDIDATA] = process.argv;
if (!URL_REFERENCIA || !URL_CANDIDATA) {
  console.error('uso: node testes/equivalencia.js <url-referencia> <url-candidata>');
  process.exit(2);
}

let estado = 20261107;
function aleatorio() { // mulberry32, determinístico
  estado = (estado + 0x6d2b79f5) >>> 0;
  let t = estado;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const inteiro = (min, max) => min + Math.floor(aleatorio() * (max - min + 1));
const dia = (n) => new Date(Date.UTC(2024, 0, 1) + n * 86400000).toISOString().slice(0, 10);

const urls = [];
for (let i = 0; i < 150; i += 1) urls.push(`/clientes/${inteiro(1, 100000)}`);
for (let i = 0; i < 100; i += 1) {
  const n = inteiro(1, 100000);
  const email = [`cliente${n}@exemplo.com`, `Cliente${n}@Exemplo.com`, `CLIENTE${n}@EXEMPLO.COM`][i % 3];
  urls.push(`/clientes?email=${encodeURIComponent(email)}`);
}
for (let i = 0; i < 250; i += 1) urls.push(`/clientes/${inteiro(1, 100001)}/pedidos`);
for (const status of ['pago', 'entregue', 'cancelado', 'pendente']) {
  for (const pagina of [1, 2, 50, 999, 1000, 1250, 2500, 6250, 15000, 15001]) urls.push(`/pedidos?status=${status}&pagina=${pagina}`);
  for (let i = 0; i < 25; i += 1) urls.push(`/pedidos?status=${status}&pagina=${inteiro(1, 1000)}`);
}
const termos = ['cadeira', 'mesa', 'lumin', 'teclado', 'monitor', 'ergo', 'sem fio', 'portatil', 'modelo 12', 'slim',
  'reforcada', 'webcam', 'Mouse', 'PRO', 'caderno basica', 'modelo 1999', 'xyz', 'abc', 'odelo 2', 'garrafa'];
for (const termo of termos) urls.push(`/produtos/busca?q=${encodeURIComponent(termo)}`);
for (let i = 0; i < 120; i += 1) {
  const inicio = inteiro(-5, 735);
  urls.push(`/relatorios/vendas-por-dia?inicio=${dia(inicio)}&fim=${dia(inicio + inteiro(0, 30))}`);
}
for (let limite = 1; limite <= 50; limite += 7) urls.push(`/relatorios/top-produtos?limite=${limite}`);
urls.push('/relatorios/top-produtos', '/relatorios/top-produtos?limite=50');

async function chamar(base, caminho) {
  const resposta = await fetch(`${base}${caminho}`);
  return `${resposta.status} ${await resposta.text()}`;
}

(async () => {
  const porRota = new Map();
  const diferentes = [];
  for (const caminho of urls) {
    const rota = caminho.replace(/\d+/g, ':n').replace(/=[^&]*/g, '=');
    const [a, b] = await Promise.all([chamar(URL_REFERENCIA, caminho), chamar(URL_CANDIDATA, caminho)]);
    const r = porRota.get(rota) || { iguais: 0, diferentes: 0 };
    // Compara o texto da resposta: mesmo status, mesmos campos, valores e ordem (o JSON.stringify do
    // Express preserva a ordem dos campos), sem margem de tolerância.
    if (a === b) r.iguais += 1; else { r.diferentes += 1; diferentes.push(caminho); }
    porRota.set(rota, r);
  }
  console.log(`referência: ${URL_REFERENCIA}   candidata: ${URL_CANDIDATA}`);
  console.log(`${urls.length} URLs comparadas (texto da resposta, inclusive status e ordem)\n`);
  for (const [rota, r] of porRota) console.log(`${String(r.iguais).padStart(4)} iguais  ${String(r.diferentes).padStart(3)} diferentes  ${rota}`);
  console.log(diferentes.length === 0
    ? `\nEquivalência mantida: as ${urls.length} respostas são idênticas.`
    : `\nEquivalência QUEBRADA em ${diferentes.length} URLs, por exemplo:\n${diferentes.slice(0, 10).join('\n')}`);
  process.exit(diferentes.length === 0 ? 0 : 1);
})().catch((erro) => { console.error(erro); process.exit(2); });
