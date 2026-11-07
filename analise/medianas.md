# Medianas das medições

Gerado por `node analise/medianas.js` a partir de `resultados/` (não editar à mão). Cada linha é a **mediana** das execuções do rótulo; entre colchetes, o menor e o maior valor das execuções.
"Antes" de cada mudança é o rótulo anterior na ordem numérica; a última coluna compara também com a linha de base.

## Geral

| Rótulo | Exec. | Commit | req/s | p95 (ms) | p50 (ms) | Erros | vs anterior (req/s, p95) | Ganho claro vs anterior? (req/s; p95) | vs linha de base (req/s, p95) | Contrato |
|---|---|---|---|---|---|---|---|---|---|---|
| 00-linha-de-base | 3 | f73b4d2 | 2.34 [2.02–2.51] | 27087 [26125–34641] | 1598 | 0.00% | - | - | - | mantido |
| 01-indices-fk | 3 | 47d499c | 2.40 [1.73–3.38] | 26252 [17484–40556] | 2300 | 0.00% | 1.0x req/s, 1.0x menor | não; não | 1.0x req/s, 1.0x menor | mantido |
| 02-indice-status | 3 | c05803a | 3.85 [3.80–4.40] | 18355 [14849–19006] | 1857 | 0.00% | 1.6x req/s, 1.4x menor | sim; não | 1.6x req/s, 1.5x menor | mantido |
| 03-resumo-top-produtos | 3 | f24add0 | 3.99 [3.07–5.69] | 16565 [13883–21296] | 2093 | 0.00% | 1.0x req/s, 1.1x menor | não; não | 1.7x req/s, 1.6x menor | mantido |
| 04-indice-dia | 3 | 29fa6dd | 4.10 [3.31–7.31] | 17877 [11116–24675] | 1959 | 0.00% | 1.0x req/s, 0.9x menor | não; não | 1.8x req/s, 1.5x menor | mantido |
| 05-pool-conexoes | 3 | ca04720 | 10.68 [9.00–13.26] | 7084 [5476–8031] | 877 | 0.00% | 2.6x req/s, 2.5x menor | sim; sim | 4.6x req/s, 3.8x menor | mantido |
| 06-indice-email | 3 | 37a4838 | 16.52 [14.45–17.90] | 4804 [4517–5741] | 537 | 0.00% | 1.5x req/s, 1.5x menor | sim; não | 7.1x req/s, 5.6x menor | mantido |
| 07-vendas-agregado-sql | 3 | dd0df8d | 19.89 [14.40–29.94] | 3702 [2397–5361] | 402 | 0.00% | 1.2x req/s, 1.3x menor | não; não | 8.5x req/s, 7.3x menor | mantido |
| 08-contagem-status | 3 | 20fef6f | 40.84 [40.77–42.81] | 1856 [1737–1888] | 207 | 0.00% | 2.1x req/s, 2.0x menor | sim; sim | 17.4x req/s, 14.6x menor | mantido |
| 09-pagina-deferred-join | 3 | 6c88411 | 36.73 [33.88–42.14] | 2104 [1885–2373] | 206 | 0.00% | 0.9x req/s, 0.9x menor | não; não | 15.7x req/s, 12.9x menor | mantido |
| 10-pedidos-cliente-join | 3 | cf6d102 | 45.10 [38.26–50.71] | 1130 [1002–1398] | 307 | 0.00% | 1.2x req/s, 1.9x menor | não; sim | 19.3x req/s, 24.0x menor | mantido |
| 11-sem-paralelismo | 3 | e9f2260 | 82.98 [68.45–85.06] | 595 [590–689] | 187 | 0.00% | 1.8x req/s, 1.9x menor | sim; sim | 35.4x req/s, 45.5x menor | mantido |
| 12-indice-trigramas | 3 | 1f3aaea | 130.47 [126.74–133.73] | 391 [390–399] | 110 | 0.00% | 1.6x req/s, 1.5x menor | sim; sim | 55.7x req/s, 69.2x menor | mantido |
| 13-log-sem-corpo | 3 | 7a0aa11 | 130.38 [129.96–131.22] | 400 [399–400] | 108 | 0.00% | 1.0x req/s, 1.0x menor | não; não | 55.7x req/s, 67.8x menor | mantido |
| 14-totais-pedido | 3 | 3051546 | 199.07 [186.47–202.96] | 178 [176–191] | 98.0 | 0.00% | 1.5x req/s, 2.2x menor | sim; sim | 85.0x req/s, 152.4x menor | mantido |
| 15-banco-meia-cpu | 3 | b8ab565 | 177.56 [162.47–197.22] | 201 [182–262] | 100 | 0.00% | 0.9x req/s, 0.9x menor | não; não | 75.8x req/s, 134.8x menor | mantido |

"2.0x req/s" = o dobro de requisições por segundo; "3.0x menor" = p95 três vezes menor.
"Ganho claro" = as faixas das execuções não se sobrepõem: a pior execução depois da mudança é melhor que a melhor execução antes dela. Com 3 execuções e variação acima de 30% entre elas, uma mediana melhor sem isso pode ser ruído.

## Recursos (CPU e memória durante a carga) e custo

CPU em % de 1 CPU (100% = 1 CPU). "CPU/req" = milissegundos de CPU gastos por requisição. Limites = soma do que o `docker-compose.yml` reserva para os containers (o custo de rodar).

| Rótulo | api: CPU média / máx | banco: CPU média / máx | api: memória média / máx (MiB) | banco: memória média / máx (MiB) | api: CPU/req (ms) | banco: CPU/req (ms) | Limites (CPU / memória) |
|---|---|---|---|---|---|---|---|
| 00-linha-de-base | 9.7% / 20.7% | 95.3% / 109.8% | 29.7 / 38.3 | 385.0 / 446.2 | 35.02 | 341.38 | 1.50 CPU / 768 MiB (banco 1 CPU/512 MiB; api 0.5 CPU/256 MiB) |
| 01-indices-fk | 13.6% / 36.0% | 103.8% / 147.2% | 37.0 / 47.6 | 367.7 / 424.2 | 46.76 | 338.64 | 1.50 CPU / 768 MiB (banco 1 CPU/512 MiB; api 0.5 CPU/256 MiB) |
| 02-indice-status | 18.8% / 40.5% | 101.7% / 128.3% | 34.1 / 41.6 | 431.5 / 496.1 | 45.21 | 225.25 | 1.50 CPU / 768 MiB (banco 1 CPU/512 MiB; api 0.5 CPU/256 MiB) |
| 03-resumo-top-produtos | 21.8% / 37.7% | 107.0% / 132.0% | 34.3 / 42.3 | 444.4 / 469.5 | 47.19 | 249.73 | 1.50 CPU / 768 MiB (banco 1 CPU/512 MiB; api 0.5 CPU/256 MiB) |
| 04-indice-dia | 22.5% / 55.0% | 109.6% / 131.3% | 33.1 / 43.5 | 412.2 / 463.7 | 52.40 | 254.93 | 1.50 CPU / 768 MiB (banco 1 CPU/512 MiB; api 0.5 CPU/256 MiB) |
| 05-pool-conexoes | 37.4% / 64.3% | 100.7% / 142.8% | 34.5 / 47.1 | 462.7 / 492.3 | 30.52 | 86.35 | 1.50 CPU / 768 MiB (banco 1 CPU/512 MiB; api 0.5 CPU/256 MiB) |
| 06-indice-email | 42.8% / 60.0% | 86.5% / 127.0% | 33.0 / 41.7 | 459.5 / 489.6 | 26.28 | 51.14 | 1.50 CPU / 768 MiB (banco 1 CPU/512 MiB; api 0.5 CPU/256 MiB) |
| 07-vendas-agregado-sql | 15.6% / 33.6% | 103.0% / 141.2% | 24.5 / 26.1 | 457.3 / 490.6 | 7.75 | 51.91 | 1.50 CPU / 768 MiB (banco 1 CPU/512 MiB; api 0.5 CPU/256 MiB) |
| 08-contagem-status | 23.9% / 41.9% | 101.4% / 123.0% | 26.6 / 26.9 | 463.6 / 494.9 | 5.84 | 24.75 | 1.50 CPU / 768 MiB (banco 1 CPU/512 MiB; api 0.5 CPU/256 MiB) |
| 09-pagina-deferred-join | 24.0% / 50.4% | 104.2% / 122.0% | 25.8 / 27.2 | 460.7 / 477.0 | 6.37 | 27.68 | 1.50 CPU / 768 MiB (banco 1 CPU/512 MiB; api 0.5 CPU/256 MiB) |
| 10-pedidos-cliente-join | 15.9% / 39.6% | 104.3% / 128.0% | 26.3 / 27.0 | 469.6 / 489.0 | 3.37 | 21.42 | 1.50 CPU / 768 MiB (banco 1 CPU/512 MiB; api 0.5 CPU/256 MiB) |
| 11-sem-paralelismo | 23.4% / 51.2% | 104.2% / 118.5% | 26.5 / 27.0 | 482.4 / 489.4 | 2.97 | 12.51 | 1.50 CPU / 768 MiB (banco 1 CPU/512 MiB; api 0.5 CPU/256 MiB) |
| 12-indice-trigramas | 38.3% / 56.1% | 102.8% / 119.7% | 26.7 / 27.3 | 477.0 / 482.4 | 2.85 | 7.84 | 1.50 CPU / 768 MiB (banco 1 CPU/512 MiB; api 0.5 CPU/256 MiB) |
| 13-log-sem-corpo | 36.0% / 61.0% | 97.6% / 119.7% | 26.7 / 27.2 | 473.2 / 480.0 | 2.74 | 7.45 | 1.50 CPU / 768 MiB (banco 1 CPU/512 MiB; api 0.5 CPU/256 MiB) |
| 14-totais-pedido | 48.6% / 59.5% | 41.6% / 70.1% | 27.1 / 27.8 | 459.2 / 468.9 | 2.43 | 2.05 | 1.50 CPU / 768 MiB (banco 1 CPU/512 MiB; api 0.5 CPU/256 MiB) |
| 15-banco-meia-cpu | 46.0% / 57.6% | 41.3% / 60.9% | 26.9 / 27.8 | 422.3 / 443.2 | 2.61 | 2.32 | 1.00 CPU / 768 MiB (banco 0.5 CPU/512 MiB; api 0.5 CPU/256 MiB) |

## Custo estimado (proxy)

Tarifas por segundo do [AWS Fargate](https://aws.amazon.com/fargate/pricing/) (Linux/x86, US East, consultadas em 2026-11-07): US$ 0,000011244 por vCPU e US$ 0,000001235 por GB. Custo = CPU e memória **reservadas** (os limites do compose), não o consumo. "Por milhão de requisições" usa o req/s mediano da carga, em que o sistema está sempre no limite: é uma medida de eficiência, não uma fatura.

| Rótulo | vCPU reservada | Memória reservada (GB) | US$/hora | US$ por milhão de requisições | vs linha de base |
|---|---|---|---|---|---|
| 00-linha-de-base | 1.50 | 0.75 | 0.0641 | 7.5985 | 1.0x menor |
| 01-indices-fk | 1.50 | 0.75 | 0.0641 | 7.4153 | 1.0x menor |
| 02-indice-status | 1.50 | 0.75 | 0.0641 | 4.6234 | 1.6x menor |
| 03-resumo-top-produtos | 1.50 | 0.75 | 0.0641 | 4.4627 | 1.7x menor |
| 04-indice-dia | 1.50 | 0.75 | 0.0641 | 4.3396 | 1.8x menor |
| 05-pool-conexoes | 1.50 | 0.75 | 0.0641 | 1.6662 | 4.6x menor |
| 06-indice-email | 1.50 | 0.75 | 0.0641 | 1.0769 | 7.1x menor |
| 07-vendas-agregado-sql | 1.50 | 0.75 | 0.0641 | 0.8947 | 8.5x menor |
| 08-contagem-status | 1.50 | 0.75 | 0.0641 | 0.4357 | 17.4x menor |
| 09-pagina-deferred-join | 1.50 | 0.75 | 0.0641 | 0.4844 | 15.7x menor |
| 10-pedidos-cliente-join | 1.50 | 0.75 | 0.0641 | 0.3945 | 19.3x menor |
| 11-sem-paralelismo | 1.50 | 0.75 | 0.0641 | 0.2144 | 35.4x menor |
| 12-indice-trigramas | 1.50 | 0.75 | 0.0641 | 0.1364 | 55.7x menor |
| 13-log-sem-corpo | 1.50 | 0.75 | 0.0641 | 0.1365 | 55.7x menor |
| 14-totais-pedido | 1.50 | 0.75 | 0.0641 | 0.0894 | 85.0x menor |
| 15-banco-meia-cpu | 1.00 | 0.75 | 0.0438 | 0.0685 | 110.9x menor |

## p95 por rota (ms, mediana das execuções)

| Rótulo | cliente | cliente-por-email | pedidos-do-cliente | pedidos-por-status | busca-produtos | vendas-por-dia | top-produtos |
|---|---|---|---|---|---|---|---|
| 00-linha-de-base | 601 | 2874 | 30040 | 17700 | 1318 | 14608 | 44228 |
| 01-indices-fk | 2282 | 3570 | 27503 | 24214 | 2776 | 34322 | 51403 |
| 02-indice-status | 1391 | 3322 | 21975 | 5452 | 2708 | 13070 | 22716 |
| 03-resumo-top-produtos | 1732 | 4557 | 21974 | 6048 | 2282 | 14532 | 1104 |
| 04-indice-dia | 1717 | 4004 | 24599 | 7770 | 3022 | 10823 | 1253 |
| 05-pool-conexoes | 1118 | 2711 | 10422 | 5710 | 1479 | 5806 | 797 |
| 06-indice-email | 878 | 992 | 7131 | 3458 | 1283 | 3263 | 987 |
| 07-vendas-agregado-sql | 503 | 497 | 6159 | 3863 | 870 | 4077 | 311 |
| 08-contagem-status | 194 | 216 | 2562 | 1677 | 571 | 1084 | 167 |
| 09-pagina-deferred-join | 260 | 287 | 3344 | 588 | 627 | 2495 | 301 |
| 10-pedidos-cliente-join | 520 | 594 | 615 | 1197 | 1017 | 3849 | 494 |
| 11-sem-paralelismo | 282 | 290 | 295 | 493 | 670 | 1294 | 260 |
| 12-indice-trigramas | 187 | 187 | 195 | 318 | 223 | 815 | 188 |
| 13-log-sem-corpo | 188 | 191 | 194 | 313 | 218 | 825 | 198 |
| 14-totais-pedido | 156 | 162 | 166 | 201 | 178 | 168 | 150 |
| 15-banco-meia-cpu | 180 | 181 | 208 | 270 | 196 | 186 | 176 |

Nas medições em que uma rota tem poucas requisições (veja a tabela abaixo), o p95 dela oscila muito: compare pelo resultado geral.

## p50 (mediana) por rota (ms, mediana das execuções)

| Rótulo | cliente | cliente-por-email | pedidos-do-cliente | pedidos-por-status | busca-produtos | vendas-por-dia | top-produtos |
|---|---|---|---|---|---|---|---|
| 00-linha-de-base | 382 | 1604 | 23491 | 11397 | 807 | 11286 | 28254 |
| 01-indices-fk | 583 | 2004 | 12945 | 12812 | 1232 | 16956 | 28988 |
| 02-indice-status | 578 | 2011 | 14168 | 2121 | 1012 | 6093 | 16001 |
| 03-resumo-top-produtos | 584 | 1888 | 13376 | 3687 | 1117 | 7315 | 745 |
| 04-indice-dia | 681 | 1921 | 11277 | 3091 | 1253 | 3539 | 589 |
| 05-pool-conexoes | 205 | 1064 | 4061 | 1102 | 489 | 1953 | 505 |
| 06-indice-email | 151 | 188 | 3269 | 866 | 420 | 1219 | 118 |
| 07-vendas-agregado-sql | 139 | 111 | 2235 | 829 | 397 | 1097 | 156 |
| 08-contagem-status | 89.2 | 95.7 | 1316 | 242 | 285 | 571 | 86.4 |
| 09-pagina-deferred-join | 88.3 | 94.3 | 1366 | 190 | 313 | 684 | 88.3 |
| 10-pedidos-cliente-join | 204 | 214 | 208 | 418 | 536 | 1014 | 198 |
| 11-sem-paralelismo | 118 | 116 | 128 | 251 | 389 | 583 | 123 |
| 12-indice-trigramas | 97.3 | 97.5 | 101 | 189 | 112 | 418 | 101 |
| 13-log-sem-corpo | 97.3 | 96.4 | 100 | 189 | 112 | 426 | 97.7 |
| 14-totais-pedido | 91.9 | 91.8 | 96.4 | 121 | 101 | 97.6 | 94.4 |
| 15-banco-meia-cpu | 95.2 | 95.3 | 100 | 133 | 103 | 98.6 | 94.5 |

## Requisições por rota (mediana das execuções)

| Rótulo | cliente | cliente-por-email | pedidos-do-cliente | pedidos-por-status | busca-produtos | vendas-por-dia | top-produtos |
|---|---|---|---|---|---|---|---|
| 00-linha-de-base | 47 | 31 | 37 | 17 | 23 | 12 | 2 |
| 01-indices-fk | 47 | 34 | 38 | 21 | 30 | 11 | 3 |
| 02-indice-status | 65 | 42 | 59 | 31 | 44 | 19 | 5 |
| 03-resumo-top-produtos | 61 | 43 | 57 | 31 | 41 | 20 | 4 |
| 04-indice-dia | 61 | 45 | 59 | 29 | 41 | 19 | 4 |
| 05-pool-conexoes | 172 | 93 | 136 | 90 | 100 | 45 | 10 |
| 06-indice-email | 267 | 158 | 208 | 142 | 154 | 69 | 17 |
| 07-vendas-agregado-sql | 314 | 183 | 247 | 170 | 186 | 86 | 18 |
| 08-contagem-status | 640 | 359 | 513 | 345 | 374 | 192 | 42 |
| 09-pagina-deferred-join | 585 | 332 | 469 | 314 | 343 | 180 | 36 |
| 10-pedidos-cliente-join | 693 | 396 | 575 | 378 | 425 | 211 | 46 |
| 11-sem-paralelismo | 1298 | 729 | 1041 | 719 | 740 | 384 | 88 |
| 12-indice-trigramas | 1981 | 1154 | 1634 | 1155 | 1176 | 628 | 138 |
| 13-log-sem-corpo | 1999 | 1153 | 1636 | 1154 | 1169 | 627 | 136 |
| 14-totais-pedido | 2979 | 1753 | 2454 | 1736 | 1840 | 977 | 222 |
| 15-banco-meia-cpu | 2659 | 1559 | 2214 | 1555 | 1617 | 880 | 198 |

## Pastas de cada rótulo

- **00-linha-de-base** (20 VUs, 60s, semente 42; arquivos alterados sem commit: 0): [20261107-015412-00-linha-de-base](../resultados/20261107-015412-00-linha-de-base/resumo.txt), [20261107-015607-00-linha-de-base](../resultados/20261107-015607-00-linha-de-base/resumo.txt), [20261107-015813-00-linha-de-base](../resultados/20261107-015813-00-linha-de-base/resumo.txt)
- **01-indices-fk** (20 VUs, 60s, semente 42; arquivos alterados sem commit: 0): [20261107-020845-01-indices-fk](../resultados/20261107-020845-01-indices-fk/resumo.txt), [20261107-021059-01-indices-fk](../resultados/20261107-021059-01-indices-fk/resumo.txt), [20261107-021309-01-indices-fk](../resultados/20261107-021309-01-indices-fk/resumo.txt)
- **02-indice-status** (20 VUs, 60s, semente 42; arquivos alterados sem commit: 0): [20261107-025201-02-indice-status](../resultados/20261107-025201-02-indice-status/resumo.txt), [20261107-025411-02-indice-status](../resultados/20261107-025411-02-indice-status/resumo.txt), [20261107-025629-02-indice-status](../resultados/20261107-025629-02-indice-status/resumo.txt)
- **03-resumo-top-produtos** (20 VUs, 60s, semente 42; arquivos alterados sem commit: 0): [20261107-024245-03-resumo-top-produtos](../resultados/20261107-024245-03-resumo-top-produtos/resumo.txt), [20261107-024438-03-resumo-top-produtos](../resultados/20261107-024438-03-resumo-top-produtos/resumo.txt), [20261107-024630-03-resumo-top-produtos](../resultados/20261107-024630-03-resumo-top-produtos/resumo.txt)
- **04-indice-dia** (20 VUs, 60s, semente 42; arquivos alterados sem commit: 0): [20261107-030242-04-indice-dia](../resultados/20261107-030242-04-indice-dia/resumo.txt), [20261107-030438-04-indice-dia](../resultados/20261107-030438-04-indice-dia/resumo.txt), [20261107-030630-04-indice-dia](../resultados/20261107-030630-04-indice-dia/resumo.txt)
- **05-pool-conexoes** (20 VUs, 60s, semente 42; arquivos alterados sem commit: 0): [20261107-082338-05-pool-conexoes](../resultados/20261107-082338-05-pool-conexoes/resumo.txt), [20261107-082533-05-pool-conexoes](../resultados/20261107-082533-05-pool-conexoes/resumo.txt), [20261107-082725-05-pool-conexoes](../resultados/20261107-082725-05-pool-conexoes/resumo.txt)
- **06-indice-email** (20 VUs, 60s, semente 42; arquivos alterados sem commit: 0): [20261107-083735-06-indice-email](../resultados/20261107-083735-06-indice-email/resumo.txt), [20261107-083927-06-indice-email](../resultados/20261107-083927-06-indice-email/resumo.txt), [20261107-084117-06-indice-email](../resultados/20261107-084117-06-indice-email/resumo.txt)
- **07-vendas-agregado-sql** (20 VUs, 60s, semente 42; arquivos alterados sem commit: 0): [20261107-084436-07-vendas-agregado-sql](../resultados/20261107-084436-07-vendas-agregado-sql/resumo.txt), [20261107-084633-07-vendas-agregado-sql](../resultados/20261107-084633-07-vendas-agregado-sql/resumo.txt), [20261107-084825-07-vendas-agregado-sql](../resultados/20261107-084825-07-vendas-agregado-sql/resumo.txt)
- **08-contagem-status** (20 VUs, 60s, semente 42; arquivos alterados sem commit: 0): [20261107-085516-08-contagem-status](../resultados/20261107-085516-08-contagem-status/resumo.txt), [20261107-085655-08-contagem-status](../resultados/20261107-085655-08-contagem-status/resumo.txt), [20261107-085835-08-contagem-status](../resultados/20261107-085835-08-contagem-status/resumo.txt)
- **09-pagina-deferred-join** (20 VUs, 60s, semente 42; arquivos alterados sem commit: 0): [20261107-092522-09-pagina-deferred-join](../resultados/20261107-092522-09-pagina-deferred-join/resumo.txt), [20261107-092705-09-pagina-deferred-join](../resultados/20261107-092705-09-pagina-deferred-join/resumo.txt), [20261107-092849-09-pagina-deferred-join](../resultados/20261107-092849-09-pagina-deferred-join/resumo.txt)
- **10-pedidos-cliente-join** (20 VUs, 60s, semente 42; arquivos alterados sem commit: 0): [20261107-094122-10-pedidos-cliente-join](../resultados/20261107-094122-10-pedidos-cliente-join/resumo.txt), [20261107-094303-10-pedidos-cliente-join](../resultados/20261107-094303-10-pedidos-cliente-join/resumo.txt), [20261107-094444-10-pedidos-cliente-join](../resultados/20261107-094444-10-pedidos-cliente-join/resumo.txt)
- **11-sem-paralelismo** (20 VUs, 60s, semente 42; arquivos alterados sem commit: 0): [20261107-095534-11-sem-paralelismo](../resultados/20261107-095534-11-sem-paralelismo/resumo.txt), [20261107-095715-11-sem-paralelismo](../resultados/20261107-095715-11-sem-paralelismo/resumo.txt), [20261107-095855-11-sem-paralelismo](../resultados/20261107-095855-11-sem-paralelismo/resumo.txt)
- **12-indice-trigramas** (20 VUs, 60s, semente 42; arquivos alterados sem commit: 0): [20261107-100352-12-indice-trigramas](../resultados/20261107-100352-12-indice-trigramas/resumo.txt), [20261107-100528-12-indice-trigramas](../resultados/20261107-100528-12-indice-trigramas/resumo.txt), [20261107-100705-12-indice-trigramas](../resultados/20261107-100705-12-indice-trigramas/resumo.txt)
- **13-log-sem-corpo** (20 VUs, 60s, semente 42; arquivos alterados sem commit: 0): [20261107-101229-13-log-sem-corpo](../resultados/20261107-101229-13-log-sem-corpo/resumo.txt), [20261107-101412-13-log-sem-corpo](../resultados/20261107-101412-13-log-sem-corpo/resumo.txt), [20261107-101552-13-log-sem-corpo](../resultados/20261107-101552-13-log-sem-corpo/resumo.txt)
- **14-totais-pedido** (20 VUs, 60s, semente 42; arquivos alterados sem commit: 0): [20261107-102849-14-totais-pedido](../resultados/20261107-102849-14-totais-pedido/resumo.txt), [20261107-103032-14-totais-pedido](../resultados/20261107-103032-14-totais-pedido/resumo.txt), [20261107-103211-14-totais-pedido](../resultados/20261107-103211-14-totais-pedido/resumo.txt)
- **15-banco-meia-cpu** (20 VUs, 60s, semente 42; arquivos alterados sem commit: 0): [20261107-103825-15-banco-meia-cpu](../resultados/20261107-103825-15-banco-meia-cpu/resumo.txt), [20261107-104003-15-banco-meia-cpu](../resultados/20261107-104003-15-banco-meia-cpu/resumo.txt), [20261107-104142-15-banco-meia-cpu](../resultados/20261107-104142-15-banco-meia-cpu/resumo.txt)
