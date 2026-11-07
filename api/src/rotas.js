const express = require('express');
const { consultar } = require('./db');

const rotas = express.Router();

const STATUS_VALIDOS = ['pago', 'entregue', 'cancelado', 'pendente'];
const TAMANHO_PAGINA = 20;
const MAX_DIAS_RELATORIO = 31;

function inteiroPositivo(valor) {
  if (typeof valor !== 'string' || !/^\d+$/.test(valor)) return null;
  const numero = Number(valor);
  return numero > 0 && Number.isSafeInteger(numero) ? numero : null;
}

function dataValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const data = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor ? data : null;
}

function assincrono(manipulador) {
  return (req, res, next) => manipulador(req, res).catch(next);
}

function formatarCliente(linha) {
  return {
    id: linha.id,
    nome: linha.nome,
    email: linha.email,
    cidade: linha.cidade,
    criado_em: linha.criado_em,
  };
}

rotas.get('/saude', (req, res) => {
  res.json({ status: 'ok' });
});

rotas.get('/clientes', assincrono(async (req, res) => {
  const email = req.query.email;
  if (typeof email !== 'string' || email.trim() === '') {
    return res.status(400).json({ erro: 'informe o parametro email' });
  }

  const linhas = await consultar(
    'SELECT * FROM clientes WHERE lower(email) = lower($1) ORDER BY id',
    [email.trim()],
  );
  res.json(linhas.map(formatarCliente));
}));

rotas.get('/clientes/:id', assincrono(async (req, res) => {
  const id = inteiroPositivo(req.params.id);
  if (id === null) return res.status(400).json({ erro: 'id invalido' });

  const linhas = await consultar('SELECT * FROM clientes WHERE id = $1', [id]);
  if (linhas.length === 0) return res.status(404).json({ erro: 'cliente nao encontrado' });
  res.json(formatarCliente(linhas[0]));
}));

rotas.get('/clientes/:id/pedidos', assincrono(async (req, res) => {
  const id = inteiroPositivo(req.params.id);
  if (id === null) return res.status(400).json({ erro: 'id invalido' });

  // Uma consulta só, em vez de 1 por pedido + 1 por item (N+1: 17 idas ao banco para um cliente com
  // 5 pedidos). Mesma ordem do código original: pedidos do mais recente para o mais antigo (desempate
  // por id) e itens por id. LEFT JOIN a partir de clientes: cliente inexistente = nenhuma linha (404);
  // cliente sem pedidos = uma linha com pedido nulo ([]); pedido sem itens aparece com total 0.
  const linhas = await consultar(
    `SELECT p.id AS pedido_id, p.status, p.criado_em,
            i.produto_id, pr.nome AS produto_nome, i.quantidade, i.preco_unitario_centavos
       FROM clientes c
       LEFT JOIN pedidos p ON p.cliente_id = c.id
       LEFT JOIN itens_pedido i ON i.pedido_id = p.id
       LEFT JOIN produtos pr ON pr.id = i.produto_id
      WHERE c.id = $1
      ORDER BY p.criado_em DESC, p.id DESC, i.id`,
    [id],
  );
  if (linhas.length === 0) return res.status(404).json({ erro: 'cliente nao encontrado' });

  const resposta = [];
  let atual = null;
  for (const linha of linhas) {
    if (linha.pedido_id === null) continue;
    if (atual === null || atual.id !== linha.pedido_id) {
      atual = { id: linha.pedido_id, status: linha.status, criado_em: linha.criado_em, total_centavos: 0, itens: [] };
      resposta.push(atual);
    }
    if (linha.produto_id === null) continue;
    atual.itens.push({
      produto_id: linha.produto_id,
      produto_nome: linha.produto_nome,
      quantidade: linha.quantidade,
      preco_unitario_centavos: linha.preco_unitario_centavos,
    });
    atual.total_centavos += linha.quantidade * linha.preco_unitario_centavos;
  }

  res.json(resposta);
}));

rotas.get('/pedidos', assincrono(async (req, res) => {
  const status = req.query.status;
  if (!STATUS_VALIDOS.includes(status)) {
    return res.status(400).json({ erro: `status deve ser um de: ${STATUS_VALIDOS.join(', ')}` });
  }

  const pagina = req.query.pagina === undefined ? 1 : inteiroPositivo(req.query.pagina);
  if (pagina === null) return res.status(400).json({ erro: 'pagina invalida' });

  // Total exato do status, mantido por trigger em pedidos_por_status (banco/08-resumo-pedidos-status.sql).
  // Status sem nenhum pedido não tem linha: coalesce devolve 0, como o count(*) original.
  const [contagem] = await consultar(
    'SELECT coalesce((SELECT total FROM pedidos_por_status WHERE status = $1), 0) AS total',
    [status],
  );
  // "Deferred join": a subconsulta escolhe os ids da página só pelo índice (status, criado_em DESC,
  // id DESC), sem ler a tabela para as linhas puladas pelo OFFSET (index-only scan); depois busca só
  // as 20 linhas da página. Mesma ordenação (com desempate por id), então os mesmos pedidos na mesma ordem.
  const linhas = await consultar(
    `SELECT p.id, p.cliente_id, p.status, p.criado_em
       FROM (SELECT id FROM pedidos
              WHERE status = $1
              ORDER BY criado_em DESC, id DESC
              LIMIT $2 OFFSET $3) AS pagina
       JOIN pedidos p ON p.id = pagina.id
      ORDER BY p.criado_em DESC, p.id DESC`,
    [status, TAMANHO_PAGINA, (pagina - 1) * TAMANHO_PAGINA],
  );

  res.json({
    pagina,
    tamanho_pagina: TAMANHO_PAGINA,
    total: Number(contagem.total),
    pedidos: linhas.map((linha) => ({
      id: linha.id,
      cliente_id: linha.cliente_id,
      status: linha.status,
      criado_em: linha.criado_em,
    })),
  });
}));

rotas.get('/produtos/busca', assincrono(async (req, res) => {
  const termo = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (termo.length < 3) return res.status(400).json({ erro: 'o termo de busca precisa ter pelo menos 3 caracteres' });

  const linhas = await consultar(
    "SELECT * FROM produtos WHERE nome ILIKE '%' || $1 || '%' ORDER BY nome, id LIMIT 20",
    [termo],
  );
  res.json(linhas.map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    categoria: linha.categoria,
    preco_centavos: linha.preco_centavos,
  })));
}));

rotas.get('/relatorios/vendas-por-dia', assincrono(async (req, res) => {
  const inicio = dataValida(req.query.inicio);
  const fim = dataValida(req.query.fim);
  if (inicio === null || fim === null) {
    return res.status(400).json({ erro: 'informe inicio e fim no formato AAAA-MM-DD' });
  }
  const dias = (fim - inicio) / 86400000 + 1;
  if (dias < 1 || dias > MAX_DIAS_RELATORIO) {
    return res.status(400).json({ erro: `o periodo deve ter entre 1 e ${MAX_DIAS_RELATORIO} dias` });
  }

  // Soma os totais por pedido (banco/10-totais-pedido.sql, mantidos por trigger), uma linha por dia.
  // Equivale ao JOIN original: pedidos não cancelados com pelo menos um item (itens > 0), contados uma
  // vez cada; itens e receita somados sobre os itens desses pedidos. dia = criado_em::date, o mesmo dia
  // que o código original obtinha com criado_em.toISOString() (timestamp sem fuso, API em TZ=UTC).
  // Dias sem venda continuam fora da resposta. count/sum chegam do pg como texto e viram número.
  const linhas = await consultar(
    `SELECT to_char(dia, 'YYYY-MM-DD') AS dia,
            count(*) AS pedidos,
            sum(unidades) AS itens,
            sum(receita_centavos) AS receita_centavos
       FROM totais_pedido
      WHERE dia BETWEEN $1 AND $2
        AND ativo AND itens > 0
      GROUP BY totais_pedido.dia
      ORDER BY totais_pedido.dia`,
    [req.query.inicio, req.query.fim],
  );

  res.json(linhas.map((linha) => ({
    dia: linha.dia,
    pedidos: Number(linha.pedidos),
    itens: Number(linha.itens),
    receita_centavos: Number(linha.receita_centavos),
  })));
}));

rotas.get('/relatorios/top-produtos', assincrono(async (req, res) => {
  const limite = req.query.limite === undefined ? 10 : inteiroPositivo(req.query.limite);
  if (limite === null || limite > 50) return res.status(400).json({ erro: 'limite deve ser um inteiro entre 1 e 50' });

  // A soma por produto (sem pedidos cancelados) é mantida por triggers em receita_por_produto
  // (banco/05-resumo-top-produtos.sql); a rota só lê o Top-N, na mesma ordem de antes.
  // itens > 0: só produtos com algum item de pedido não cancelado, como no JOIN original.
  const linhas = await consultar(
    `SELECT pr.id, pr.nome, pr.categoria, r.unidades, r.receita_centavos
       FROM receita_por_produto r
       JOIN produtos pr ON pr.id = r.produto_id
      WHERE r.itens > 0
      ORDER BY r.receita_centavos DESC, r.produto_id
      LIMIT $1`,
    [limite],
  );

  res.json(linhas.map((linha) => ({
    produto_id: linha.id,
    nome: linha.nome,
    categoria: linha.categoria,
    unidades: Number(linha.unidades),
    receita_centavos: Number(linha.receita_centavos),
  })));
}));

module.exports = rotas;
