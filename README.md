# TechStore: desafio de performance em Node.js e PostgreSQL

API de uma loja fictícia (Node.js 20, Express, `pg` e PostgreSQL 16, em Docker Compose) que funcionava, mas não aguentava carga. O desafio, da vaga de estágio em Pesquisa e Inovação 2026 da Tech for Humans, era deixá-la mais rápida e mais barata de rodar sem mudar nenhuma resposta, e provar cada passo com medição. Os dados são sintéticos e gerados na primeira subida: 100 mil clientes, 20 mil produtos, 500 mil pedidos e 1,5 milhão de itens.

## Resultado

Com 20 usuários simultâneos e os mesmos 1,5 vCPU, a API passou de 2,34 para 199,07 requisições por segundo, e o p95 caiu de 27 s para 178 ms. Depois cortei a CPU do banco pela metade e fiquei com 177,56 req/s. As 42 respostas do contrato ficaram iguais nas 51 execuções, e uma comparação com o código original em 790 URLs não encontrou nenhuma diferença.

| Estado | req/s | p95 | CPU média (banco · API) | CPU alocada | Custo estimado por milhão de req. |
|---|---|---|---|---|---|
| 00 · linha de base | 2,34 | 27.087 ms | 95% · 10% | 1,5 vCPU | US$ 7,60 |
| 14 · mais rápido | 199,07 | 178 ms | 42% · 49% | 1,5 vCPU | US$ 0,09 |
| 15 · mais barato | 177,56 | 201 ms | 41% · 46% | 1,0 vCPU | US$ 0,07 |
| 16 · final (15 + triggers corrigidos) | 109,57 (48,91 a 174,94) | 429 ms | 50% · 27% | 1,0 vCPU | US$ 0,11 |

Cada valor é a mediana de 3 execuções do `scripts/medir.sh`, calculada por script a partir de `resultados/` ([analise/medianas.md](analise/medianas.md)). Nenhum número foi digitado à mão. A CPU está em % de 1 CPU. O custo aplica as tarifas por segundo do AWS Fargate aos limites do compose, num modelo linear: serve para comparar eficiência, não é fatura.

O código da `main` é o estado 16. Ele não muda nenhuma consulta de leitura da 15, só corrige os triggers, que rodam na escrita. A diferença entre as duas linhas fica dentro do ruído: a própria série 16 variou 3,6× entre execuções iguais, medida num Windows com outros programas abertos (detalhes em [Limites](#limites-da-medição)).

## Onde estava o tempo

Na linha de base o banco ficava em 95% de 1 CPU e a API, em 10%. Não era falta de máquina: o banco refazia, a cada chamada, trabalho que não precisava fazer. O coletor em [diagnostico/](diagnostico/) salva o plano de cada consulta, as consultas e conexões por rota e o que o banco executa sob a mesma carga do `medir.sh`. Na [linha de base](diagnostico/00-linha-de-base/) ele mostrou que:

- só havia índice nas chaves primárias. A busca de itens por pedido tomava 40,5% do tempo do banco, e a tabela de itens foi lida inteira 152 vezes em ~70 s de carga ([carga-consultas.txt](diagnostico/00-linha-de-base/carga-consultas.txt), [carga-tabelas.txt](diagnostico/00-linha-de-base/carga-tabelas.txt));
- `GET /clientes/:id/pedidos` era um N+1, e cada consulta abria uma conexão nova: 17 numa única chamada para o cliente 42. Uma conexão nova custava 5,9× uma reaproveitada ([consultas-por-rota.txt](diagnostico/00-linha-de-base/consultas-por-rota.txt), [custo-conexao.txt](diagnostico/00-linha-de-base/custo-conexao.txt));
- top-produtos levava 3,9 s com o banco ocioso, e os planos usavam 2 workers paralelos num container de 1 CPU ([explain.txt](diagnostico/00-linha-de-base/explain.txt));
- relatórios e contagens recalculavam tudo a cada chamada, somando 1,5 milhão de itens ou contando até 300 mil pedidos;
- havia em média 14 sessões disputando 1 CPU, e cada requisição gerava ~1,1 KB de log, com nome e e-mail de clientes ([carga-atividade.txt](diagnostico/00-linha-de-base/carga-atividade.txt), [log-api.txt](diagnostico/00-linha-de-base/log-api.txt)).

## O que mudou

Uma mudança por commit, aplicada sobre a anterior, conferida pelo contrato e medida três vezes com o mesmo rótulo. Considero que houve **ganho claro** numa métrica quando a pior execução depois da mudança é melhor que a melhor execução antes dela. Com variação acima de 30% entre execuções iguais, uma mediana melhor sem isso pode ser ruído.

| # | Mudança | req/s | p95 | Ganho claro (req/s; p95) |
|---|---|---|---|---|
| 00 | Aplicação original | 2,34 | 27.087 ms | – |
| 01 | Índices nas FKs `itens_pedido(pedido_id)` e `pedidos(cliente_id)` | 2,40 | 26.252 ms | não; não |
| 02 | Índice `pedidos(status, criado_em DESC, id DESC)` para a página por status | 3,85 | 18.355 ms | sim¹; não |
| 03 | Top-produtos lido de um resumo por produto mantido por trigger | 3,99 | 16.565 ms | não; não |
| 04 | Índice na expressão `criado_em::date` para vendas-por-dia | 4,10 | 17.877 ms | não; não |
| 05 | `pg.Pool` no lugar de uma conexão por consulta | 10,68 | 7.084 ms | sim; sim |
| 06 | Índice em `lower(email)` | 16,52 | 4.804 ms | sim; não |
| 07 | Vendas-por-dia agregado no SQL, e não no Node | 19,89 | 3.702 ms | não; não |
| 08 | Total por status lido de uma contagem mantida por trigger | 40,84 | 1.856 ms | sim; sim |
| 09 | Página de `/pedidos` por *deferred join* (ids pelo índice, depois as 20 linhas) | 36,73 | 2.104 ms | não; não |
| 10 | Pedidos do cliente numa consulta só, com JOIN (fim do N+1) | 45,10 | 1.130 ms | não; sim |
| 11 | Consulta paralela desligada (`max_parallel_workers_per_gather=0`) | 82,98 | 595 ms | sim; sim |
| 12 | Índice GIN `pg_trgm` para a busca de produtos por trecho do nome | 130,47 | 391 ms | sim; sim |
| 13 | Log de acesso sem o corpo da resposta | 130,38 | 400 ms | não; não |
| 14 | Vendas-por-dia lido de totais por pedido mantidos por trigger | 199,07 | 178 ms | sim; sim |
| 15 | Limite de CPU do banco de 1,0 para 0,5 | 177,56 | 201 ms | não; não |
| 16 | Correções nos triggers dos resumos | 109,57 | 429 ms | não; não |

¹ Claro só na série que ficou. Somando a série descartada do mesmo código, o ganho em req/s é provável, não claro ([experimentos.md](experimentos.md#tabela)).

Cada linha tem hipótese, fonte, CPU por requisição, pastas de resultados e conclusão em [experimentos.md](experimentos.md). O que a sequência ensinou:

Com o banco saturado, consertar uma consulta só passava a fila para a próxima. Foi o que aconteceu na 01, na 03, na 04 e na 09: a rota-alvo melhorou, o req/s geral não. No começo eu escolhia o alvo pela fatia de tempo do `pg_stat_statements`, que é tempo de relógio e inclui a espera por CPU. Num banco saturado essa fatia não coincide com o trabalho de cada consulta. A partir da 10, passei a considerar também o tempo de cada consulta com o banco ocioso (EXPLAIN), multiplicado pelo peso da rota na carga.

Os cinco ganhos claros nas duas métricas vieram de tirar trabalho repetido do banco: o pool (05), a contagem pronta (08), o fim da consulta paralela (11), os trigramas (12) e os totais por pedido (14). A 11 é uma linha de configuração. Com 1 CPU e uma fila de sessões, os workers paralelos só disputavam a mesma CPU e acrescentavam coordenação. Depois da 14 o banco caiu para 42% de CPU, e a API passou a usar quase todo o seu limite (48,6% de 50%). Foi isso que abriu espaço para a 15: com o gargalo na API, reservar 1 CPU inteira para o banco é pagar por CPU ociosa.

A 13 refutou a hipótese. Eu esperava que o log do corpo inteiro custasse CPU por gravar de forma síncrona, mas no container o stdout é um pipe, e em POSIX o Node grava em pipe de forma assíncrona. A mudança ficou por outro motivo: o log passou de 1.147 para 84 bytes por requisição e deixou de carregar nomes e e-mails de clientes. O e-mail ainda aparece na URL de `/clientes?email=`.

Os resumos mantidos por trigger (03, 08 e 14) são a parte de maior risco: custam na escrita, e um defeito no trigger corrompe o resumo. Só os usei onde a consulta não tinha como ficar barata, porque somava tudo a cada chamada. Como o trigger roda na mesma transação da escrita, o resumo muda junto com os dados, sem a defasagem de uma materialized view ou de um cache. Vendas-por-dia guarda totais por pedido, e não por dia, para que as gravações do mesmo dia não disputem a mesma linha. Na revisão encontrei três defeitos que a carga, só de leitura, nunca mostraria: uma corrida entre inserir um item e cancelar o pedido, a ordem de disparo quando pedido e item mudam no mesmo comando, e overflow em `integer`. A 16 corrige os três.

### O que ficou de fora

Descartei a paginação por keyset porque ela quebra o parâmetro `pagina` do contrato. Materialized view e cache na API mudam o que a API devolve logo depois de uma escrita, e o cache ainda teria uma taxa de acerto artificial neste teste, já que a carga sorteia só 12 termos de busca e uma única URL de top-produtos.

Não medi PgBouncer nem mais recurso. Com uma instância da API, não vejo o que o PgBouncer acrescentaria ao pool. Quanto a mais CPU, minha aposta é que o banco só faria o mesmo trabalho inútil mais depressa; medir a linha de base com mais recurso é o teste 17 de [proximos-testes.md](proximos-testes.md), onde estão também as outras ideias pesquisadas e não testadas, com fonte e o jeito de testar cada uma.

## Corretude

- **Contrato:** `scripts/verificar-contrato.sh comparar` (42 casos) terminou em "Contrato mantido" antes de cada série e no `contrato.txt` de todas as 51 execuções.
- **Equivalência ampla:** [testes/equivalencia.js](testes/equivalencia.js) sobe o código original (commit `ea4cd8d`) na porta 3001, no mesmo banco, e compara o texto das respostas das duas APIs em 790 URLs sorteadas com semente fixa. Todas idênticas nos estados 10, 15 e 16.
- **Triggers:** [testes/resumos.sql](testes/resumos.sql) aplica 20 passos de escrita (inserções, trocas de status, preço, data, TRUNCATE, valores acima de 2³¹ e outros) e, depois de cada um, confere cada resumo contra o agregado calculado do zero. Roda dentro de uma transação e termina com ROLLBACK.
- **Concorrência:** [testes/concorrencia.sh](testes/concorrencia.sh) abre duas sessões reais, uma cancelando o pedido e outra inserindo item nele, nas duas ordens. Com os triggers de 03 a 14 o resumo ficava errado ([antes](diagnostico/16-triggers-corrigidos/concorrencia-antes-da-correcao.txt)); com a 16, uma transação espera a outra ([depois](diagnostico/16-triggers-corrigidos/concorrencia.txt)).

Ainda não coberto: um DELETE de pedido e itens no mesmo comando (CTE) não é descontado de top-produtos, e inserções concorrentes de itens dos mesmos produtos em ordem oposta dão deadlock. Uma das transações é abortada com 40P01 ([testes/deadlock.sh](testes/deadlock.sh), [saída](diagnostico/16-triggers-corrigidos/deadlock.txt)).

## Limites da medição

Medi num Windows 11 com Docker Desktop sobre WSL 2, com 4 CPUs para a VM ([ambiente-host.txt](diagnostico/ambiente-host.txt)), e com um jogo aberto, que ocupava cerca de 2 dos 4 núcleos numa amostra feita entre as séries 15 e 16 ([host-cpu.txt](diagnostico/host-cpu.txt)). É por isso que uso a regra de ganho claro e não confio em ganhos pequenos de uma mudança isolada. O ganho total, de duas ordens de grandeza, não depende disso.

A carga só lê, então o custo dos triggers na escrita não foi medido. O modelo também é fechado (20 usuários fixos, sem pausa): se o tráfego real chega em taxa aberta, a latência na mesma vazão pode ser pior. E três execuções por rótulo mostram a dispersão, mas não bastam para um intervalo de confiança.

## Documentos

| Arquivo | Conteúdo |
|---|---|
| [artigo/artigo.md](artigo/artigo.md) | Diagnóstico, estado da arte, alternativas, escolha, resultados e limites |
| [experimentos.md](experimentos.md) | Ficha de cada mudança: fonte, hipótese, antes, depois, pastas e conclusão; séries descartadas e correções |
| [analise/medianas.md](analise/medianas.md) | Medianas gerais e por rota, recursos, CPU por requisição e custo, gerados de `resultados/` |
| [proximos-testes.md](proximos-testes.md) | O que pode derrubar ou melhorar o resultado, com fonte e como testar |
| [pesquisa/fontes.md](pesquisa/fontes.md) | As 81 fontes consultadas, com as citações literais conferidas |
| [diagnostico/](diagnostico/) | Planos de execução, consultas por rota e atividade do banco em 00, 01, 02, 05, 08, 13, 15 e 16 |

## Como reproduzir

### Requisitos

- Docker com Compose v2 (`docker compose version`): Docker Desktop no [macOS](https://docs.docker.com/desktop/setup/install/mac-install/) e no [Windows](https://docs.docker.com/desktop/setup/install/windows-install/), [Docker Engine](https://docs.docker.com/engine/install/) no Linux
- Git, `bash`, `curl` e cerca de 2 GB livres em disco
- Node.js 20, só para a equivalência ampla e os scripts de `analise/`; o resto roda em containers

No Windows, o caminho mais simples é rodar tudo dentro do [WSL 2](https://learn.microsoft.com/pt-br/windows/wsl/install), com o repositório na pasta do Linux (`~`), e não em `/mnt/c`. Eu rodei pelo Git Bash: nesse caso, exporte `MSYS_NO_PATHCONV=1` antes dos scripts, senão ele converte caminhos como `/carga/teste-carga.js` em caminhos do Windows.

### Subir a aplicação

```bash
git clone https://github.com/Igorgaah/TechStore.git
cd TechStore
docker compose up -d --build
curl http://127.0.0.1:3000/saude      # {"status":"ok"}
```

O `up -d` só volta quando o banco está saudável. Na primeira subida o PostgreSQL roda os scripts de `banco/` em ordem alfabética: cria as tabelas, gera os dados (de segundos a 3 minutos, conforme a máquina) e aplica os índices, resumos e triggers de `03-` a `11-`. Para acompanhar, em outro terminal: `docker compose logs -f banco`.

```bash
curl http://127.0.0.1:3000/clientes/1
# {"id":1,"nome":"Bruno Almeida","email":"cliente1@exemplo.com","cidade":"Fortaleza","criado_em":"2022-01-01T02:11:59.000Z"}

curl "http://127.0.0.1:3000/produtos/busca?q=mesa"
# [{"id":10061,"nome":"Mesa Basica Modelo 10061","categoria":"Moveis","preco_centavos":481580}, ...]

curl http://127.0.0.1:3000/clientes/abc
# {"erro":"id invalido"}
```

### Medir

O `contrato/base.json` já está no repositório: foi gravado com a aplicação original, antes de qualquer mudança (commit `f73b4d2`). Não regrave. Para medir o estado atual:

```bash
scripts/verificar-contrato.sh comparar     # precisa terminar em "Contrato mantido"
scripts/medir.sh 16-triggers-corrigidos    # ~1 min 30 s; rode 3 vezes com o mesmo rótulo
```

O `medir.sh` confere se a API está no ar, aquece por 15 s (fora do resultado) e roda 20 usuários virtuais por 60 s, cada um fazendo requisições em sequência, sem pausa. Durante a carga coleta CPU e memória de todos os containers e, no fim, roda o verificador de contrato de novo. Cada execução cria uma pasta nova em `resultados/<data>-<hora>-<rotulo>/`; nada é sobrescrito.

| Arquivo | Conteúdo |
| --- | --- |
| `resumo.txt` | req/s, erros e tempo de resposta (mediana, p95, p99), no geral e por rota |
| `recursos.txt` | CPU e memória, média e máximo, de cada container durante a carga |
| `recursos.csv` | As amostras do `docker stats` usadas no `recursos.txt` |
| `contexto.txt` | Parâmetros, commit medido, arquivos alterados sem commit e limites dos containers |
| `contrato.txt` | Saída do verificador rodado logo depois da carga |
| `resumo-k6.json` | Todas as métricas do k6 |

O `cpu_max` do `recursos.txt` às vezes sai menor que a média, porque o `awk` da régua compara os valores como texto. Como a régua não pode mudar, a análise recalcula médias e máximos a partir do `recursos.csv`.

Para medir a linha de base de novo (outra máquina ou outros parâmetros deixam as medições antigas incomparáveis):

```bash
git switch --detach f73b4d2
docker compose down -v && docker compose up -d --build
scripts/medir.sh 00-linha-de-base          # três vezes
git switch main
docker compose down -v && docker compose up -d --build
```

Os parâmetros da carga vêm de variáveis de ambiente. Use os mesmos valores em tudo o que for comparar; todas as medições deste repositório usam os padrões.

| Variável | Padrão | O que controla |
| --- | --- | --- |
| `VUS` | `20` | Usuários virtuais simultâneos |
| `DURACAO` | `60s` | Duração da medição |
| `AQUECIMENTO` | `15s` | Duração do aquecimento |
| `SEMENTE` | `42` | Semente do sorteio das URLs; a mesma semente repete as mesmas requisições |
| `PORTA_API` | `3000` | Porta da API no host, usada só para conferir se ela está no ar |

### Ciclo de uma mudança

1. Faça só aquela mudança e commite. O `contexto.txt` registra o commit e precisa mostrar `arquivos alterados sem commit: 0`; qualquer arquivo esquecido invalida a série.
2. Aplique. Mudança na API, no Dockerfile ou no compose: `docker compose up -d --build`. Arquivo `.sql` novo em `banco/`: `docker compose down -v && docker compose up -d --build`, porque os scripts dessa pasta só rodam com o banco criado do zero.
3. Rode `scripts/verificar-contrato.sh comparar`. Se der "Contrato quebrado", corrija ou desfaça antes de medir.
4. Meça 3 vezes com o mesmo rótulo (`scripts/medir.sh 17-<o-que-mudou>`) e compare a mediana com a do estado anterior.
5. Commite as pastas de `resultados/` num commit separado.

Para as séries partirem do mesmo estado, recriei o banco antes de cada uma (menos nas mudanças só de API 05 e 07) e rodei `ferramentas/preparar-medicao.sh`, que espera o autovacuum pós-carga terminar antes da 1ª execução. A 1ª série da 09 foi descartada justamente por rodar com o cache do banco frio, depois de um diagnóstico que o reiniciou; as outras séries descartadas, e os motivos, estão em [experimentos.md](experimentos.md#ambiente-e-cuidados).

### Diagnóstico, testes e análise

```bash
diagnostico/coletar.sh 99-teste diagnostico/consultas/15-atuais.sql   # evidências do estado atual (~3 min)

testes/api-original.sh                                                # sobe o código original na porta 3001
node testes/equivalencia.js http://127.0.0.1:3001 http://127.0.0.1:3000
testes/api-original.sh parar

docker compose exec -T banco psql -U loja -d loja -X < testes/resumos.sql   # triggers; termina com ROLLBACK
testes/concorrencia.sh     # corrida entre inserir item e cancelar o pedido (faz COMMIT num pedido de teste)
testes/deadlock.sh         # inserções de itens em ordem oposta (idem)

node analise/medianas.js && node analise/graficos.js && node analise/experimentos.js   # tabelas e gráficos
```

O `coletar.sh` liga o `pg_stat_statements` só durante o diagnóstico e reinicia o banco, então a carga dele começa com o cache frio e o req/s dela não é comparável ao do `medir.sh`.

## Rotas

| Rota | Parâmetros | Devolve | Peso na carga |
| --- | --- | --- | --- |
| `GET /saude` | | `{"status":"ok"}` | – |
| `GET /clientes/:id` | | Um cliente | 25% |
| `GET /clientes?email=` | `email`, sem diferenciar maiúsculas | Clientes com esse e-mail | 15% |
| `GET /clientes/:id/pedidos` | | Pedidos do cliente, do mais recente para o mais antigo, com itens e total | 20% |
| `GET /pedidos?status=&pagina=` | `status`: `pago`, `entregue`, `cancelado` ou `pendente`; `pagina` a partir de 1 | Página de 20 pedidos, do mais recente para o mais antigo, e o total do status | 15% |
| `GET /produtos/busca?q=` | `q` com pelo menos 3 caracteres | Até 20 produtos cujo nome contém o termo | 15% |
| `GET /relatorios/vendas-por-dia?inicio=&fim=` | datas `AAAA-MM-DD`, período de até 31 dias | Pedidos, itens e receita por dia, sem pedidos cancelados | 8% |
| `GET /relatorios/top-produtos?limite=` | `limite` de 1 a 50, padrão 10 | Produtos com maior receita, sem pedidos cancelados | 2% |

Valores em dinheiro estão em centavos, e as datas saem em UTC. Os pesos vêm de [carga/teste-carga.js](carga/teste-carga.js).

## Regras do desafio

Pode mudar o código da API e o `Dockerfile`, o `docker-compose.yml` (limites, configuração e serviços novos) e o banco, por meio de arquivos `.sql` novos em `banco/` a partir de `03-`. Recurso a mais conta como custo: se um limite de CPU ou memória sobe, ou entra um serviço novo, o ganho tem de vir junto com esse custo.

Não pode mudar:

- o que cada rota devolve: status HTTP, campos, valores e ordem;
- a régua: `carga/`, `contrato/verificar.js`, `scripts/` e o `contrato/base.json` depois de gravado;
- os dados: `banco/01-estrutura.sql` e `banco/02-dados.sql`.

## Banco

```bash
docker compose exec banco psql -U loja -d loja
```

De fora, com DBeaver ou pgAdmin: host `127.0.0.1`, porta `5432`, usuário `loja`, banco `loja`, sem senha. A porta só aceita conexões da própria máquina. Os logs da API saem em `docker compose logs --tail 50 api`.

Parâmetros do PostgreSQL ficam no `command` do serviço `banco`, para que outra pessoa repita o experimento. É ali que está a mudança 11:

```yaml
  banco:
    image: postgres:16.4
    command: ["postgres", "-c", "max_parallel_workers_per_gather=0"]
```

Aplique com `docker compose up -d`; o banco reinicia sem perder os dados. Para conferir: `docker compose exec banco psql -U loja -d loja -c 'SHOW max_parallel_workers_per_gather;'`.

Para voltar ao estado inicial do banco, `docker compose down -v && docker compose up -d --build`. O que for feito direto no `psql` se perde aí; o que precisa ficar vai num `.sql` em `banco/`.

## Problemas comuns

- **`Cannot connect to the Docker daemon`:** no macOS e no Windows, abra o Docker Desktop e espere ele terminar de iniciar; no Windows, confira também a [integração com o WSL](https://docs.docker.com/desktop/features/wsl/). No Linux, `sudo systemctl start docker`, e siga os [passos pós-instalação](https://docs.docker.com/engine/install/linux-postinstall/) se der `permission denied`.
- **`docker: 'compose' is not a docker command`:** Docker desatualizado. O `docker-compose` antigo, com hífen, não serve.
- **`permission denied: scripts/medir.sh`:** os scripts perderam a permissão de execução, o que acontece quando a pasta vem de um ZIP. Rode `chmod +x scripts/*.sh testes/*.sh diagnostico/*.sh ferramentas/*.sh`.
- **`$'\r': command not found`:** o Git converteu as quebras de linha. Rode `git config --global core.autocrlf false` e clone de novo, de preferência dentro do WSL.
- **Arquivo não encontrado, com um caminho do Windows no lugar de `/carga/teste-carga.js`:** é o Git Bash convertendo o caminho; rode `export MSYS_NO_PATHCONV=1`.
- **Porta 3000 ou 5432 em uso:** troque o lado esquerdo do mapeamento em `ports:` no `docker-compose.yml`. Se trocar a da API, meça com `PORTA_API=<porta> scripts/medir.sh ...`.
- **`medir.sh` diz que a API não respondeu:** o banco provavelmente ainda está gerando os dados (`docker compose logs --tail 50 banco`).

## Estrutura

```
├── api/                    # código da API (Express + pg) e Dockerfile
├── banco/                  # 01 e 02 criam e populam o banco; 03 a 11 são as mudanças
├── carga/teste-carga.js    # teste de carga (k6); régua, não muda
├── contrato/               # verificador e respostas gravadas; régua, não muda
├── scripts/                # medir.sh e verificar-contrato.sh; régua, não muda
├── resultados/             # uma pasta por execução do medir.sh
├── analise/                # medianas, gráficos e tabelas geradas de resultados/
├── diagnostico/            # coletor e evidências salvas por estado
├── testes/                 # equivalência, triggers, concorrência e deadlock
├── ferramentas/            # preparar-medicao.sh
├── artigo/                 # artigo e gráficos
├── pesquisa/fontes.md      # fontes e citações conferidas
├── experimentos.md
├── proximos-testes.md
└── docker-compose.yml
```

O `AGENTS.md` e o `CLAUDE.md` que vêm na pasta original do desafio ficaram fora deste repositório.
