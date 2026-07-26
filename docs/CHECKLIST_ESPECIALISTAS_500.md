# Checklist Mestre — Painel de Especialistas (1280 itens)

> **Estado em 26/07/2026** — 607 de 1280 itens tratados (47%), com **860 testes** passando,
> `tsc --noEmit` limpo e build funcionando.
>
> | Status | Itens | Significado |
> |---|---|---|
> | `[x]` | 88 | Já existia no repositório e foi **verificado no código**. Inclui itens que eu havia marcado como pendentes por erro de auditoria (053, 1077) e itens descartados com justificativa (1064, 1066). |
> | `[~]` | 519 | **Entregue** ao longo das rodadas, com teste. |
> | `[ ]` | 673 | Pendente. |
>
> **A seção 44 é a mais importante deste documento.** Ela registra o primeiro relato do jogador
> vendo o jogo numa tela — e encontrou, em cinco frases, defeitos que os 696 testes não pegariam,
> porque nenhum é falha de lógica. `depthTest: false` roda. A fase invertida da lua roda. O relay
> que não está de pé devolve `null` exatamente como escrito.
>
> **Como este documento foi produzido.** Simulamos uma banca de especialistas, cada um auditando o
> Crom Planebox sob a sua própria lente. Todos os itens foram escritos **depois** de ler o código
> real deste repositório, por isso muitos apontam arquivo e função concretos. As seções cresceram
> conforme o trabalho revelou o que faltava — daí o número final ser mais que o dobro do inicial.
>
> **Prioridade**: `P0` bloqueia o objetivo declarado (jogo completo + IA que modifica tudo com
> save), `P1` é essencial para a experiência, `P2` é refinamento, `P3` é ambição de longo prazo.

---

## A ressalva que vale mais que qualquer marcação

**Nada do que foi entregue foi visto rodando numa tela.** Os testes provam lógica, não aparência.
Três sistemas injetam GLSL que nenhum teste compila (curvatura, tingimento sazonal, aparição de
chunk) — se a injeção estiver malformada, o sintoma é o terreno sumir, e só aparece abrindo o jogo.
Dois sistemas alteram o terreno em si (biomas no worldgen, construções espalhadas).

Um item marcado `[~]` significa "escrito, ligado e coberto por teste". **Não** significa
"conferido visualmente".

## O padrão que mais custou a este projeto

**Código presente não é código ativo.** Cinco vezes encontramos funcionalidade completa,
comentada e cuidadosa que **nada chamava**:

| O que | Como se descobriu |
|---|---|
| `setViewRange` | `scene.fog` era `null`; o `if (f)` falhava em silêncio |
| `applyCurvature` | `invR: 0` e `start: 500`, além da distância desenhada |
| `UndoManager.recordBatch` | Nenhum chamador — nenhuma construção da IA era desfazível |
| Estações do ano | Mudavam clima e painel F3, e nada que o jogador visse |
| Biomas no worldgen | O gerador decidia superfície por limiares paralelos e ignorava o módulo |

A resposta foi passar a escrever **testes de "está ligado?"**, não só de unidade: os blocos da
construção aparecem no chunk gerado, a injeção chega ao shader, o diamante não existe no deserto
*no terreno varrido*, o pacote do mod **não tem onde guardar** um segredo.

---


## Índice

| # | Especialista | Itens | Foco |
|---|---|---|---|
| 01 | Diretor de Game Design | 001–024 | Loop de jogo Minecraft/Terraria |
| 02 | Arquiteto de Engine Voxel | 025–048 | Chunks, mundo, escala de miniblocos |
| 03 | Engenheiro de Renderização | 049–072 | Look "Lay of the Land" |
| 04 | Diretor de Arte Técnica | 073–096 | Paleta, miniblocos, materiais |
| 05 | Engenheiro de Worldgen | 097–120 | Biomas, ruído, cavernas |
| 06 | Designer de Sobrevivência | 121–144 | Vida, fome, progressão |
| 07 | Designer de Combate | 145–168 | Armas, inimigos, bosses |
| 08 | Engenheiro de IA de Entidades | 169–192 | NPCs, pathfinding, ecologia |
| 09 | Designer de Crafting & Economia | 193–216 | Receitas, tiers, comércio |
| 10 | Engenheiro de Física | 217–240 | Colisão, fluidos, gravidade |
| 11 | Engenheiro de Iluminação | 241–264 | Luz propagada, ciclo dia/noite |
| 12 | Engenheiro de Persistência | 265–288 | Save, migração, integridade |
| 13 | **Arquiteto do Sistema de Mods** | 289–320 | **IA modificando o jogo com save** |
| 14 | Engenheiro de Agente IA / MCP | 321–352 | Ferramentas, planejamento, visão |
| 15 | Engenheiro de Segurança | 353–376 | Sandbox de scripts gerados |
| 16 | Engenheiro de Rede | 377–400 | P2P, autoridade, sync de mods |
| 17 | Engenheiro de Performance | 401–424 | Frame budget, memória, workers |
| 18 | Designer de UI/UX | 425–448 | HUD, inventário, acessibilidade |
| 19 | Engenheiro de QA | 449–476 | Testes automatizados |
| 20 | Engenheiro de Áudio | 477–494 | Som posicional, ambiência |
| 21 | Designer de Conteúdo Terraria-like | 495–512 | Camadas verticais, eventos |
| 22 | DevOps & Build | 513–520 | CI, versionamento, distribuição |
| 36 | Auditoria de Desempenho | 883–906 | Correção do travamento relatado |
| 37 | Interface e Controle de Câmera | 907–948 | Telas separadas, pointer lock, voz |
| 38 | Aparição de Chunk (*fade in*) | 1001–1011 | Como o Minecraft moderno faz |
| 39 | Céu Noturno | 1012–1031 | Lua, fases, estrelas, claridade variável |
| 40 | Curvatura do Mundo | 1032–1042 | *Curvature Shader* |
| 41 | Estado de Interface | 1043–1062 | O bug do "clique não volta ao jogo" |
| 42 | Atmosfera, Clima e Estações | 1063–1130 | *Biome Blending*, *Color Grading*, *Fog Interpolation* |

---

## 01 — Diretor de Game Design (loop Minecraft/Terraria)

*Parecer: a engine tem cinco modos de jogo e sobrevivência básica, mas falta o "porquê" — um
loop de objetivos que puxe o jogador do primeiro dia até um chefe final.*

- [x] 001 `P0` Cinco modos de jogo distintos (`classic`, `survival`, `ghost`, `creative`, `adventure`) — `src/game/GameModeManager.ts`
- [x] 002 `P0` Ciclo básico de sobrevivência com vida e fome — `src/game/SurvivalSystem.ts`
- [x] 003 `P0` Quebrar/colocar blocos com tier de ferramenta — `src/player/interaction.ts`
- [x] 004 `P1` Drops de item ao quebrar blocos — `src/game/ItemDropSystem.ts`
- [x] 005 `P1` Bancada de crafting com receitas — `src/crafting/CraftingSystem.ts`
- [~] 006 `P0` Definir e documentar o **loop central de 30 minutos** (acordar → coletar → craftar → abrigar → explorar) — `docs/LOOP_CENTRAL.md`, com os quinze passos, os portões que obrigam a ordem, e uma seção final do que o loop **ainda não tem**
- [~] 007 `P0` Sistema de objetivos/conquistas guiando o jogador novato ("faça sua primeira picareta") — `src/game/Objetivos.ts` + cartão no HUD, 21 testes de lógica e 9 de fiação
- [~] 008 `P0` Curva de progressão em tiers de material (madeira → pedra → ferro → diamante) com gate real de acesso — a corrente vai de 1 a 4 sem buraco, **cada degrau coleta algo que o anterior não coletava**, e o último tem porta própria (obsidiana, itens 1287/1293). O gate é "quebra mas não dropa", não parede: gateia a *aquisição* sem trancar ninguém no cenário
- [~] 009 `P1` Primeira noite como evento de tensão — **auditado**: a regra de luz já faz isso. `effectiveLight = max(sky * sunScale, block)`; ao meio-dia a superfície dá 15 e nada nasce, de madrugada dá ~1,8 e passa do limiar 6. Caverna nasce de dia também, que é o certo. Falta só o enquadramento da PRIMEIRA noite como evento (item 1345)
- [~] 010 `P1` Sistema de "camas"/ponto de renascimento definido pelo jogador — bloco `B.BED`, receita do primeiro dia, clique direito define o ponto; ver a seção 61
- [~] 011 `P1` Morte com penalidade escolhível por mundo (dropar inventário / manter / hardcore) — `src/game/penalidadeDeMorte.ts`, escolhida na criação do mundo; ver a seção 60
- [ ] 012 `P1` Diário de bordo no mundo registrando marcos alcançados
- [ ] 013 `P2` Estrutura de "vilas" geradas com NPCs que dão missões simples
- [ ] 014 `P2` Sistema de reputação com facções (o `faction` das entidades já existe e está ocioso)
- [ ] 015 `P2` Modo Aventura com mapas curados que proíbem quebrar blocos fora de regras
- [ ] 016 `P2` Eventos sazonais no mundo (chuva de meteoros, lua de sangue) usando `EventSystem`
- [ ] 017 `P2` Sistema de encantamentos/afixos em ferramentas
- [ ] 018 `P3` Dimensões alternativas (submundo estilo Nether/Corruption)
- [ ] 019 `P3` Boss final com arena gerada proceduralmente
- [ ] 020 `P3` New Game+ carregando conquistas entre mundos
- [ ] 021 `P1` Tutorial contextual não intrusivo nos primeiros 5 minutos
- [ ] 022 `P2` Balanceamento por telemetria local (tempo até 1ª ferramenta, mortes por hora)
- [ ] 023 `P2` Modo criativo com "paleta de projeto" salvável e reutilizável
- [ ] 024 `P3` Editor de aventura para o jogador publicar mundos curados

## 02 — Arquiteto de Engine Voxel

*Parecer: a base de chunks e a escala de miniblocos (`SCALE`) estão corretas; o gargalo é
verticalidade limitada e ausência de LOD.*

- [x] 025 `P0` Mundo em chunks com geração em worker — `src/world/genWorker.ts`
- [x] 026 `P0` Escala de minibloco (`SCALE`) separando bloco lógico de voxel visual — `src/world/chunk.ts`
- [x] 027 `P0` `World.setBlock`/`getBlock` marcando chunks sujos para re-mesh — `src/world/world.ts`
- [x] 028 `P1` Ruído e RNG determinísticos por semente — `src/core/noise.ts`, `src/core/rng.ts`
- [ ] 029 `P0` Aumentar o limite vertical do mundo (hoje varreduras assumem `y < 128`)
- [~] 030 `P0` **`WORLD_MAX_Y` e `TOPO_VARREDURA` em `world/chunk.ts`** — e a extração revelou um teto silencioso de 8 voxels
- [ ] 031 `P1` LOD de chunks distantes (mesh simplificado além de N chunks)
- [ ] 032 `P1` Descarregar chunks fora do raio de render liberando memória de GPU
- [ ] 033 `P1` Paletização de chunk (índices locais + tabela) para reduzir memória
- [ ] 034 `P1` Compressão RLE de chunks salvos
- [ ] 035 `P2` Chunks verticais (seções de 16³) em vez de coluna inteira
- [ ] 036 `P2` Sistema de "tick" de bloco agendado (crescimento, fluido, fornalha)
- [ ] 037 `P2` Metadados por bloco (rotação, estado) além do id numérico
- [ ] 038 `P2` Blocos com entidade associada (baú, fornalha, placa) e seus dados salvos
- [ ] 039 `P1` API pública estável de mundo para mods (`getBlock`, `setBlock`, `fillBox`, `queryRegion`)
- [ ] 040 `P2` Sistema de eventos do mundo (`onBlockPlaced`, `onBlockBroken`) assinável por mods
- [ ] 041 `P2` Regiões protegidas (claim) que bloqueiam edição por script ou por outro jogador
- [ ] 042 `P3` Streaming infinito real em ambos os eixos horizontais sem perda de precisão
- [ ] 043 `P3` Grafo de conectividade para colapso estrutural mais realista
- [ ] 044 `P1` `World.fillBox` nativo (hoje o preenchimento é laço em `MCPExecutors`, duplicado 3×)
- [ ] 045 `P1` Batch de re-mesh: agrupar N `setBlock` numa única invalidação por chunk
- [ ] 046 `P2` Undo/redo com limite de memória configurável — base em `src/storage/UndoManager.ts`
- [ ] 047 `P2` Snapshot/clone de região (copiar-colar estruturas grandes)
- [ ] 048 `P3` Determinismo verificável: hash do mundo gerado por semente em teste de regressão

## 03 — Engenheiro de Renderização (look "Lay of the Land")

*Parecer inicial: "falta oclusão de ambiente, sombras suaves e neblina atmosférica". Duas
correções depois: a **oclusão já existia** (erro meu na leitura do código), e a **neblina foi
entregue** na rodada de desempenho — junto com a descoberta de que `setViewRange` ajustava as
propriedades de uma névoa que nunca havia sido criada, e portanto não fazia nada.*

*Do parecer original, resta a sombra suave (055).*

- [x] 049 `P0` Mesher próprio com faces por bloco e sombreamento direcional — `src/world/mesher.ts`
- [x] 050 `P1` Jitter procedural de cor por voxel (`hash3`) evitando superfícies chapadas
- [x] 051 `P1` Blocos decorativos renderizados como caixinhas menores (`addDecor`)
- [x] 052 `P1` Camada de água separada com topo rebaixado
- [x] 053 `P0` **Ambient occlusion por vértice** — já existia em `mesher.ts` (`vertexAO`, side1/side2/corner) desde a primeira auditoria; estava marcado como pendente por engano meu
- [~] 054 `P0` **Neblina atmosférica com a cor do céu**, acompanhando o ciclo dia/noite e a distância de render — fecha a estética alvo
- [ ] 055 `P1` Sombras suaves (PCF) com cascata ajustada à distância de render
- [ ] 056 `P1` Céu procedural com gradiente por hora do dia em vez de cor fixa
- [ ] 057 `P1` Nuvens volumétricas em camada de voxels lentos
- [ ] 058 `P2` Bloom sutil restrito a blocos emissivos (`GLOWSTONE`, `LAVA`)
- [ ] 059 `P2` Correção de cor / tonemapping filmico leve
- [ ] 060 `P2` Água com reflexo de tela (SSR barato) e distorção de onda
- [ ] 061 `P2` Partículas: poeira ao quebrar, respingo na água, fagulha na lava
- [ ] 062 `P2` Rastro de chuva e neve por bioma
- [ ] 063 `P1` Contorno do bloco alvo mais legível (outline com profundidade)
- [ ] 064 `P2` Animação de quebra em estágios (rachaduras progressivas)
- [ ] 065 `P2` Vento animando capim e folhas por vertex shader
- [ ] 066 `P1` Instanciamento de decorativos para reduzir draw calls
- [ ] 067 `P2` Frustum culling explícito por chunk antes de enviar à GPU
- [ ] 068 `P2` Modo de qualidade (baixo/médio/alto) exposto nas configurações
- [ ] 069 `P3` Iluminação global aproximada por probes de chunk
- [ ] 070 `P3` Suporte a shader packs carregáveis por mod
- [ ] 071 `P1` Fallback gracioso quando WebGL2 não estiver disponível
- [ ] 072 `P2` Teste de regressão visual por hash de imagem em cena fixa

## 04 — Diretor de Arte Técnica (paleta e miniblocos)

*Parecer: a paleta atual é coerente e sóbria; o risco é a explosão de blocos criados pela IA
destruir essa coerência sem um guia de cor obrigatório.*

- [x] 073 `P1` Paleta central declarativa com cores por face (topo/lateral/base) — `src/world/blocks.ts`
- [x] 074 `P1` 28 blocos base cobrindo terreno, minerais, vegetação e fluidos
- [~] 075 `P0` Blocos criados pela IA passam pelo mesmo `def()` da paleta base — `src/world/blocks.ts`
- [~] 076 `P0` **Validador de contraste perceptual** no caminho de criação, com sugestão de direção
- [ ] 077 `P1` Derivação automática de cor lateral/base a partir do topo (escurecimento consistente)
- [ ] 078 `P1` Guia de arte escrito para a IA seguir ao inventar blocos (saturação e luminância alvo)
- [ ] 079 `P1` Suporte a textura procedural por bloco (ruído, listras, xadrez) além de cor sólida
- [ ] 080 `P2` Variantes de bloco (musgo, rachado, polido) geradas automaticamente
- [ ] 081 `P2` Blocos com transparência parcial (vidro colorido)
- [ ] 082 `P2` Blocos emissivos com intensidade configurável
- [ ] 083 `P1` Ícone de bloco no inventário gerado a partir das 3 cores reais
- [ ] 084 `P2` Miniblocos com formas alternativas (escada, laje, poste, cerca)
- [ ] 085 `P2` Rotação de bloco em 4 direções para peças direcionais
- [ ] 086 `P2` Modelos compostos (mesa, cadeira) montados de vários miniblocos
- [ ] 087 `P1` Padronizar altura de personagem em miniblocos e documentar (hoje só no system prompt)
- [ ] 088 `P2` Escala de referência visível no modo criativo (régua de miniblocos)
- [ ] 089 `P2` Biblioteca de paletas por bioma para a IA reutilizar
- [ ] 090 `P3` Editor visual de bloco no jogo (o jogador cria blocos sem a IA)
- [ ] 091 `P2` Exportar/importar paleta de mod como JSON
- [ ] 092 `P1` Limite máximo de blocos customizados por mundo com aviso claro
- [ ] 093 `P2` Deduplicação: avisar quando a IA registrar um bloco quase idêntico a outro
- [ ] 094 `P2` Nomes de bloco normalizados (sem duplicatas com acento/caixa diferentes)
- [ ] 095 `P3` Suporte a atlas de textura carregado por mod
- [ ] 096 `P2` Modo daltonismo ajustando a paleta de blocos críticos

## 05 — Engenheiro de Worldgen

- [x] 097 `P0` Geração procedural por semente com ruído multi-oitava — `src/world/worldgen.ts`
- [x] 098 `P1` Biomas com vegetação distinta (pinheiros, capim, flores, juncos)
- [x] 099 `P1` Geração fora da thread principal em worker
- [~] 100 `P0` **Cavernas conectadas por ruído 3D (túneis ridged em interseção + câmaras) — `src/world/underground.ts`**
- [~] 101 `P0` **Veios de minério por profundidade e raridade (carvão → ferro → ouro → diamante)**
- [ ] 102 `P1` Mapa de biomas por temperatura × umidade em vez de ruído único
- [ ] 103 `P1` Transições suaves entre biomas (blend de altura e cor)
- [ ] 104 `P1` Rios e lagos conectados seguindo o gradiente do terreno
- [ ] 105 `P1` Praias geradas na fronteira água/terra
- [ ] 106 `P2` Montanhas com penhascos e camadas de rocha expostas
- [ ] 107 `P2` Estruturas geradas: vilas, ruínas, masmorras
- [ ] 108 `P2` Baús de tesouro com loot table por estrutura
- [ ] 109 `P2` Bioma de deserto com cactos e oásis
- [ ] 110 `P2` Bioma de pântano com água escura e vegetação própria
- [ ] 111 `P2` Bioma nevado com acúmulo dinâmico de neve
- [ ] 112 `P3` Erosão hidráulica simulada no pós-processamento do terreno
- [ ] 113 `P1` Preview do terreno no assistente de criação de mundo
- [ ] 114 `P1` Semente exibida e copiável na UI
- [ ] 115 `P2` Parâmetros de geração ajustáveis por mundo (amplitude, escala, nível do mar)
- [ ] 116 `P2` Geradores alternativos (superflat, ilhas, amplificado)
- [~] 117 `P1` **Mods podem injetar blocos no gerador** via estruturas registradas
- [ ] 118 `P2` Mods podem registrar biomas inteiros
- [ ] 119 `P2` Regeneração de região preservando construções do jogador
- [ ] 120 `P3` Geração guiada por IA ("faça um vale entre duas montanhas aqui")

## 06 — Designer de Sobrevivência

- [x] 121 `P0` Vida e fome com drenagem ao longo do tempo — `src/game/SurvivalSystem.ts`
- [x] 122 `P0` Dano de queda proporcional à altura
- [x] 123 `P1` Tier de ferramenta exigido para dropar minérios — `minToolTier`
- [~] 124 `P0` **Comida real: itens comestíveis restaurando fome (tecla F) — `FOOD_VALUE`**
- [~] 125 `P0` **Regeneração de vida com fome alta — verificado em teste**
- [ ] 126 `P1` Afogamento com barra de oxigênio embaixo d'água
- [ ] 127 `P1` Dano por lava e por queimadura persistente
- [ ] 128 `P1` Temperatura por bioma exigindo abrigo ou roupa
- [~] 129 `P1` **Durabilidade de ferramentas com quebra, e barra de desgaste na hotbar**
- [ ] 130 `P1` Armadura reduzindo dano recebido
- [ ] 131 `P2` Efeitos de status (veneno, regeneração, velocidade)
- [ ] 132 `P2` Poções craftáveis
- [ ] 133 `P2` Agricultura: plantar, crescer por tick, colher
- [ ] 134 `P2` Criação de animais e reprodução
- [ ] 135 `P2` Pesca
- [ ] 136 `P2` Fornalha com combustível e tempo de queima
- [ ] 137 `P1` Baús com inventário persistente por posição
- [ ] 138 `P2` Peso/limite de inventário opcional
- [ ] 139 `P1` Sono passando a noite quando todos os jogadores dormem
- [ ] 140 `P2` Sede como terceiro recurso (opcional por mundo)
- [ ] 141 `P2` Dificuldade configurável afetando dano e spawn
- [ ] 142 `P2` Modo hardcore com mundo apagado na morte
- [ ] 143 `P1` HUD mostrando causa da morte
- [ ] 144 `P2` Estatísticas por mundo (blocos quebrados, distância, mortes)

## 07 — Designer de Combate

- [~] 145 `P0` **Sistema de dano jogador↔entidade com alcance e cooldown — `src/entities/Combat.ts`**
- [~] 146 `P0` **Inimigos hostis com spawn noturno e em cavernas — `src/entities/MobSpawner.ts`**
- [~] 147 `P0` **Armas corpo a corpo com dano por tier (`damageForTier`)**
- [ ] 148 `P1` Arco e flecha com projétil balístico
- [~] 149 `P1` **Knockback ao receber dano, com componente vertical**
- [~] 150 `P1` **Invulnerabilidade temporária pós-dano (i-frames) — impede stun lock**
- [~] 151 `P1` **Barra de vida sobre entidades hostis, criada ao primeiro dano**
- [~] 152 `P1` **Drops de inimigo alimentando o próprio ciclo (carvão → tocha; ferro → picareta)**
- [ ] 153 `P2` Bloqueio/parry com escudo
- [ ] 154 `P2` Ataque carregado
- [ ] 155 `P2` Inimigos com resistências elementais
- [ ] 156 `P2` Bosses com fases e padrões de ataque
- [ ] 157 `P2` Arenas de boss com invocação por item
- [ ] 158 `P2` Inimigos voadores com pathfinding 3D
- [ ] 159 `P2` Armadilhas colocáveis
- [ ] 160 `P2` Torres/defesas automáticas
- [~] 161 `P1` **Feedback visual claro de acerto (piscada vermelha + barra de vida)**
- [ ] 162 `P2` PvP opcional por mundo com toggle
- [ ] 163 `P2` Zonas seguras onde não há spawn hostil
- [ ] 164 `P3` Combate montado
- [ ] 165 `P3` Magias com custo de mana
- [~] 166 `P1` **Mods podem definir inimigos com script de comportamento próprio**
- [ ] 167 `P2` Mods podem definir armas com efeito customizado
- [ ] 168 `P2` Escalonamento de dificuldade por progresso do jogador

## 08 — Engenheiro de IA de Entidades

*Parecer: o `EntitySystem` já anima e faz wandering, mas as entidades **não sobrevivem ao
reload** e o pathfinding ignora obstáculos verticais.*

- [x] 169 `P1` Entidades voxel com partes 3D montáveis — `src/entities/EntitySystem.ts`
- [x] 170 `P1` Animação de caminhada (pernas/braços) por ciclo
- [x] 171 `P1` Encaixe no chão imediato ao spawnar (`groundSnap`)
- [x] 172 `P1` Script de comportamento por entidade compilado em runtime
- [x] 173 `P1` Possessão de entidade pelo jogador (`takeControlOf`)
- [~] 174 `P0` **Entidades persistidas no save e restauradas ao recarregar o mundo**
- [~] 175 `P0` **Pathfinding A* respeitando colisão e altura de pulo — `src/entities/Pathfinding.ts`**
- [~] 176 `P1` **Colisão de entidade com blocos — mobs pararam de atravessar parede**
- [~] 177 `P1` **Máquina de estados (ocioso, perseguir, atacar)**
- [~] 178 `P1` **Percepção com raio de visão (`aggroRange`)**
- [~] 179 `P1` **Limite de entidades hostis ativas (`MAX_HOSTILES`)**
- [ ] 180 `P1` Congelar update de entidades fora do raio de render
- [ ] 181 `P2` Rotinas diárias de NPC (dormir, trabalhar, socializar)
- [ ] 182 `P2` Diálogo com NPC e árvore de conversa
- [ ] 183 `P2` Comércio com NPC
- [ ] 184 `P2` Facções com relações hostis/aliadas (campo `faction` já existe)
- [ ] 185 `P2` Grupos/manadas com comportamento coletivo
- [ ] 186 `P2` Ecologia: predador/presa, reprodução, população estável
- [ ] 187 `P1` Nome/etiqueta de entidade legível a distância com escala
- [ ] 188 `P2` Entidade montável
- [ ] 189 `P2` Entidade transportando itens
- [ ] 190 `P3` Comportamento gerado por LLM em tempo real com cache
- [ ] 191 `P1` Orçamento de tempo por frame para scripts de comportamento
- [ ] 192 `P1` Isolar erro de script de uma entidade sem derrubar as demais

## 09 — Designer de Crafting & Economia

- [x] 193 `P0` Grade de crafting com receitas por padrão — `src/crafting/CraftingSystem.ts`
- [x] 194 `P1` Templates de estrutura colocáveis como item — `src/crafting/StructureTemplates.ts`
- [~] 195 `P0` **Corrente de ferramentas fechada de 1 a 4** — faltava a picareta de diamante
- [~] 196 `P0` **Receitas sem forma (shapeless) além das com forma — já existiam ambas; verificado**
- [ ] 197 `P1` Livro de receitas na UI mostrando o que é craftável agora
- [ ] 198 `P1` Fundição com receitas próprias
- [ ] 199 `P1` Bancadas especializadas desbloqueando receitas
- [ ] 200 `P2` Reparo de ferramentas
- [ ] 201 `P2` Reciclagem de itens
- [ ] 202 `P2` Moeda e mercado com NPCs
- [ ] 203 `P2` Economia de vila com oferta e demanda
- [ ] 204 `P2` Encomendas/contratos como missões
- [~] 205 `P1` **Mods podem registrar estruturas colocáveis novas**
- [ ] 206 `P1` Mods podem registrar receitas novas
- [ ] 207 `P2` Mods podem registrar itens não-bloco (ferramentas, comida)
- [ ] 208 `P1` Validação de receita: recusar receita que produza bloco inexistente
- [ ] 209 `P2` Autocrafting de itens intermediários
- [ ] 210 `P2` Favoritar receitas
- [ ] 211 `P2` Ordenação e busca no inventário
- [ ] 212 `P1` Stack máximo por item configurável
- [ ] 213 `P2` Arrastar e soltar entre inventário e hotbar
- [ ] 214 `P2` Pré-visualização 3D do item craftado
- [ ] 215 `P3` Cadeia de produção automatizada (esteiras, funis)
- [ ] 216 `P2` Estatísticas de uso de receita por mundo

## 10 — Engenheiro de Física

- [x] 217 `P0` Colisão AABB do jogador com o mundo — `src/world/physics.ts`
- [x] 218 `P0` Gravidade, pulo e voo criativo — `src/player/controller.ts`
- [x] 219 `P1` Blocos com gravidade (areia, cascalho) caindo sem suporte
- [x] 220 `P1` Colapso estrutural de blocos `structural` sem apoio
- [x] 221 `P0` ~~Água escoando por níveis~~ — **auditado, já existe** em `world/fluids.ts` (`WATER_SPREAD`, escoamento por nível)
- [x] 222 `P0` ~~Lava escoando e solidificando~~ — **auditado, já existe**: `LAVA_SPREAD` e água+lava → obsidiana
- [ ] 223 `P1` Empuxo e natação com física própria
- [ ] 224 `P1` Escadas e trepadeiras alterando o movimento vertical
- [ ] 225 `P1` Agachar impedindo cair da borda
- [ ] 226 `P1` Correr com consumo de fome
- [ ] 227 `P2` Atrito por tipo de bloco (gelo escorregadio)
- [ ] 228 `P2` Empurrão entre entidades
- [ ] 229 `P2` Explosões destruindo blocos por raio e resistência
- [ ] 230 `P2` Resistência à explosão por bloco
- [ ] 231 `P2` Projéteis com gravidade e colisão
- [ ] 232 `P2` Plataformas móveis
- [ ] 233 `P2` Pistões empurrando blocos
- [ ] 234 `P3` Redstone / circuitos lógicos
- [ ] 235 `P1` Passo de física com timestep fixo independente do frame rate
- [ ] 236 `P1` Proteção contra atravessar parede em alta velocidade (sweep test)
- [ ] 237 `P2` Colisão precisa com blocos decorativos menores
- [~] 238 `P1` **Blocos de mod respeitam `solid`/`opaque` na física e no mesher**
- [ ] 239 `P2` Mods podem definir física customizada por bloco (bounce, slow)
- [ ] 240 `P2` Testes automatizados de física com cenários fixos

## 11 — Engenheiro de Iluminação

- [x] 241 `P1` Sombreamento direcional por face no mesher
- [x] 242 `P1` Blocos emissivos marcados como interativos (`GLOWSTONE`, `LAVA`)
- [~] 243 `P0` **Propagação de luz por flood fill (luz solar + luz de bloco) — `src/world/lighting.ts`**
- [~] 244 `P0` **Escuridão real em cavernas exigindo tocha**
- [~] 245 `P1` **Ciclo dia/noite com sol animado em arco e céu que muda de cor**
- [~] 246 `P1` **Cor da luz variando ao amanhecer/entardecer (laranja rasante)**
- [~] 247 `P1` **Tochas colocáveis emitindo luz (bloco `TORCH`, craftável com carvão)**
- [~] 248 `P1` **Recalcular luz incrementalmente com **remoção correta** e enfileirado por frame**
- [~] 249 `P2` **Luz atravessando blocos translúcidos com atenuação (água, folhagem, vidro)**
- [~] 250 `P2` **Luz da lua com intensidade por fase**
- [ ] 251 `P2` Luz colorida por bloco emissivo
- [~] 252 `P1` **Mods podem definir nível de luz emitido pelo bloco** (`lightLevel`) — na rodada 3 era só metadado; agora o motor de luz realmente o consome
- [ ] 253 `P2` Sombra projetada por entidades
- [ ] 254 `P2` Adaptação de exposição ao sair de uma caverna
- [~] 255 `P2` **Spawn de inimigos condicionado ao nível de luz — consome o motor da rodada 4**
- [ ] 256 `P2` Debug view mostrando o mapa de luz
- [~] 257 `P1` **Custo de luz espalhado por frame em vez de pico no clique (fila com orçamento)**
- [ ] 258 `P2` Limite de propagação configurável por performance
- [ ] 259 `P3` Reflexão de luz difusa entre blocos próximos
- [ ] 260 `P2` Iluminação suave interpolada por vértice
- [ ] 261 `P2` Bloco "barreira de luz" para builders
- [~] 262 `P1` **Persistir o horário do mundo no save (`WorldRecord.timeOfDay`)**
- [ ] 263 `P2` Comando para fixar o horário
- [~] 264 `P2` **Testes do algoritmo de propagação em grade conhecida (26 testes)**

## 12 — Engenheiro de Persistência

*Parecer: o save de blocos e jogador está sólido e em lote; o buraco crítico era o mundo salvar
ids de bloco que **não existiam mais** depois do reload — resolvido nesta rodada.*

- [x] 265 `P0` Persistência em IndexedDB via Dexie — `src/storage/Database.ts`
- [x] 266 `P0` Save de modificações de bloco em lote — `WorldRepository.saveBlockModBatch`
- [x] 267 `P0` Save de jogador por mundo (posição, vida, inventário, OP)
- [x] 268 `P1` Histórico de chat por mundo e por thread
- [x] 269 `P1` Exportar/importar mundo em JSON
- [x] 270 `P1` Reparo de mensagens órfãs de chat
- [x] 271 `P1` Customizações de UI da IA persistidas por mundo
- [~] 272 `P0` **Mods persistidos por mundo (blocos, entidades, estruturas)** — `Database` v4
- [~] 273 `P0` **Instâncias de entidade persistidas e restauradas no load**
- [~] 274 `P0` **Ids de bloco customizado estáveis entre sessões**
- [~] 275 `P1` **Mods incluídos no export/import de mundo**
- [~] 276 `P0` **Migração de save versionada e idempotente — `src/storage/SaveMigration.ts`**
- [~] 277 `P1` **Backup automático antes de migrar (mundo + mods, no localStorage)**
- [ ] 278 `P1` Verificação de integridade ao carregar (ids órfãos, coordenadas inválidas)
- [ ] 279 `P1` Compactação do save de blocos (RLE por chunk)
- [ ] 280 `P2` Save incremental em background sem travar o frame
- [~] 281 `P2` **Indicador de estado no painel de diagnóstico (fila de luz, malhas em voo)**
- [ ] 282 `P2` Quota de armazenamento monitorada com aviso
- [ ] 283 `P2` Exportar mundo como arquivo binário compacto
- [ ] 284 `P2` Importar mundo mesclando em vez de sobrescrever
- [ ] 285 `P2` Clonar mundo
- [~] 286 `P1` **Apagar mundo removendo todas as tabelas relacionadas** — `WorldRepository.deleteWorld`
- [ ] 287 `P2` Histórico de versões do mundo com rollback
- [ ] 288 `P2` Testes de round-trip export→import preservando tudo

## 13 — Arquiteto do Sistema de Mods ⭐

*Parecer: este era o **buraco central** do pedido. `registerCustomBlock` existia mas era efêmero:
adicionava um bloco ao array em memória e nada era salvo. Ao recarregar, o bloco sumia e as
posições salvas apontavam para um id inexistente — o mesher lia `BLOCKS[t].colors` de um buraco.
Nesta rodada o sistema foi reconstruído do zero com identidade estável e persistência.*

- [~] 289 `P0` **Formato de pacote de mod** com blocos, entidades e estruturas — `src/mods/ModTypes.ts`
- [~] 290 `P0` **Registro puro e testável de mods** — `src/mods/ModRegistry.ts`
- [~] 291 `P0` **Alocação determinística de id de bloco a partir de uma base fixa** (`CUSTOM_BLOCK_ID_BASE`)
- [~] 292 `P0` **Ids reservados não deixam buracos no array `BLOCKS`** (slots placeholder)
- [~] 293 `P0` **Persistência de mods por mundo** — tabela `mods` (Database v4)
- [~] 294 `P0` **Reaplicação automática dos mods ao carregar o mundo** — hook em `main.ts`
- [~] 295 `P0` **Entidades de mod instanciadas no mundo são salvas e restauradas**
- [~] 296 `P0` **Estruturas de mod carimbáveis com blocos do próprio mod**
- [~] 297 `P0` **Referência de bloco por chave simbólica** (`meumod:rubi`) resolvida na aplicação
- [~] 298 `P1` **Habilitar/desabilitar mod sem perder as definições**
- [~] 299 `P1` **Remover mod com limpeza dos blocos colocados no mundo**
- [~] 300 `P1` **Exportar mod como JSON portátil**
- [~] 301 `P1` **Importar mod JSON em outro mundo**
- [~] 302 `P1` **Validação do pacote antes de aplicar** (nome, cores, chaves duplicadas)
- [~] 303 `P1` **Limite de blocos por mundo com erro claro em vez de corromper**
- [~] 304 `P1` **Listar mods instalados com contagem de conteúdo**
- [~] 305 `P1` **Dependências entre mods → ver seção 26 (item 655), redesenhado com o modelo de sessões**
- [~] 306 `P1` **Versionamento de mod com histórico e rollback — `ModRevision` + `rollback_mod`**
- [ ] 307 `P1` Conflito de chave entre mods detectado e reportado
- [ ] 308 `P2` Mods registrando receitas de crafting
- [ ] 309 `P2` Mods registrando itens não-bloco
- [ ] 310 `P2` Mods registrando biomas
- [ ] 311 `P2` Mods registrando eventos de mundo
- [ ] 312 `P2` Mods assinando hooks (`onBlockPlaced`, `onTick`)
- [~] 313 `P2` **Painel de gerenciamento de mods → parcialmente coberto pela seleção de mod na sessão**
- [ ] 314 `P2` Recarga a quente de mod sem reiniciar o mundo
- [~] 315 `P2` **Sandbox de permissões por mod → escrita já escopada ao mod da sessão (item 701)**
- [ ] 316 `P2` Galeria/compartilhamento de mods entre jogadores
- [ ] 317 `P2` Sincronizar mods para os convidados no multiplayer P2P
- [ ] 318 `P3` Mods com assets (sons, texturas) empacotados
- [ ] 319 `P3` Assinatura/verificação de integridade do pacote
- [~] 320 `P0` **Cobertura de testes automatizados do ciclo completo de mod**

## 14 — Engenheiro de Agente IA / MCP

*Parecer: o conjunto de ferramentas é forte (execução de script, visão multi-ângulo, autocorreção
por log de erro). Faltava a ferramenta mais importante do pedido: criar **modificações inteiras**
que sobrevivem ao save.*

- [x] 321 `P0` Registro de ferramentas MCP tipado — `src/ai/MCPRegistry.ts`
- [x] 322 `P0` Execução de script JS gerado pela IA com API de mundo — `execute_voxel_script`
- [x] 323 `P0` Visão computacional: snapshot e multi-ângulo — `capture_snapshot`, `capture_multi_angle`
- [x] 324 `P1` Percepção de área e resumo do mundo — `src/ai/WorldPerception.ts`
- [x] 325 `P1` Log de erros recentes para autocorreção — `list_recent_errors`
- [x] 326 `P1` Carimbo de estruturas prontas — `stamp_structure`
- [x] 327 `P1` Modificação agêntica da própria UI — `src/ai/UIExecutors.ts`
- [x] 328 `P1` Eventos de mundo em larga escala — `trigger_world_event`
- [x] 329 `P1` Guarda de tempo de 4s contra loop infinito no script
- [~] 330 `P0` **`create_mod`: criar uma modificação inteira e salvá-la no mundo**
- [~] 331 `P0` **`define_mod_block`: adicionar bloco a um mod existente**
- [~] 332 `P0` **`define_mod_entity`: adicionar espécie de entidade a um mod**
- [~] 333 `P0` **`define_mod_structure`: adicionar estrutura a um mod**
- [~] 334 `P0` **`spawn_mod_entity`: instanciar entidade do mod no mundo, persistida**
- [~] 335 `P0` **`place_mod_structure`: carimbar estrutura do mod no mundo, persistida**
- [~] 336 `P1` **`list_mods`: inspecionar o que já foi criado antes de duplicar**
- [~] 337 `P1` **`set_mod_enabled` / `delete_mod`: ciclo de vida completo**
- [~] 338 `P1` **`export_mod`: devolver o JSON do mod para o usuário guardar**
- [~] 339 `P1` **`registerCustomBlock` dentro do script agora persiste de verdade**
- [ ] 340 `P1` Planejador multi-etapa explícito (a IA declara o plano antes de executar)
- [ ] 341 `P1` Ferramenta de dry-run: simular a modificação e reportar o impacto sem aplicar
- [~] 342 `P1` **Desfazer a última ação da IA via `undo_last_action`**, revertendo mundo e save
- [ ] 343 `P1` Orçamento de blocos por chamada com aviso quando estourar
- [~] 344 `P2` **Progresso de construções longas visível no painel (malhas em voo, fila de luz)**
- [ ] 345 `P2` Memória de longo prazo do agente por mundo (o que já construiu e onde)
- [ ] 346 `P2` Ferramenta de busca semântica no histórico (hoje é `includes` literal)
- [ ] 347 `P2` Cache de snapshots para evitar re-render idêntico
- [ ] 348 `P2` Ferramenta de medição (distância, área livre) antes de construir
- [ ] 349 `P2` Modo "arquiteto": a IA propõe 3 variantes e o usuário escolhe
- [ ] 350 `P2` Limitar ferramentas disponíveis por modo de jogo
- [ ] 351 `P1` Mensagens de erro das ferramentas sempre acionáveis (o que fazer a seguir)
- [~] 352 `P1` **Documentação das ferramentas sincronizada com o registro** — `docs/MCP_TOOLS.md`

## 15 — Engenheiro de Segurança

*Parecer: scripts da IA rodam via `new Function` com acesso ao escopo global do navegador. Para
um jogo local single-player o risco é baixo, mas o vetor "prompt injection → script" é real e
deve ser tratado antes de qualquer compartilhamento de mods.*

- [x] 353 `P1` Sanitização de HTML injetado pela IA (remoção de scripts inline) — `UIExecutors`
- [x] 354 `P1` Guarda de tempo abortando escritas após 4s
- [x] 355 `P1` Erro de script isolado e reportado sem derrubar o jogo
- [~] 356 `P1` **Validação estrita do pacote de mod antes de persistir**
- [~] 357 `P1` **Script de comportamento de entidade compilado com falha isolada**
- [ ] 358 `P0` Executar scripts da IA em Web Worker isolado sem acesso a `window`/`fetch` — **dimensionado na seção 51: exige tornar a API de mods assíncrona, e esse é o custo real**
- [~] 359 `P0` **Escopo global sombreado** — `fetch`, `window`, `document`, `localStorage`, `indexedDB` e cia. entram como parâmetros `undefined`. Barra o acesso direto; **não é fronteira de segurança** (ver 358)
- [ ] 360 `P1` Limite de iterações além do limite de tempo
- [ ] 361 `P1` Limite de memória/blocos por script
- [ ] 362 `P1` Nunca persistir chave de API em texto claro sem aviso ao usuário
- [ ] 363 `P1` Confirmação do usuário antes de ações destrutivas (`reset_world`, `delete_mod`)
- [ ] 364 `P1` Aviso claro ao importar mod de terceiros (contém código executável)
- [ ] 365 `P2` Sandbox de permissões por mod
- [ ] 366 `P2` Assinatura de mod e verificação na importação
- [ ] 367 `P2` CSP restritiva na página do jogo
- [ ] 368 `P2` Rate limit de chamadas de ferramenta por minuto
- [ ] 369 `P2` Log de auditoria de tudo que a IA alterou no mundo
- [ ] 370 `P2` Reversão em massa de tudo que um mod alterou
- [ ] 371 `P1` Validar coordenadas recebidas das ferramentas (NaN, infinito, fora de limites)
- [ ] 372 `P1` Validar tamanho de `fill_box` antes de alocar
- [ ] 373 `P2` Relay de sinalização nunca recebendo dados de mundo (já é o desenho; adicionar teste)
- [ ] 374 `P2` Validação de mensagens P2P contra payload malicioso
- [ ] 375 `P2` Modo "somente leitura" para a IA
- [ ] 376 `P2` Documentar o modelo de ameaça em `docs/`

## 16 — Engenheiro de Rede

- [x] 377 `P1` Multiplayer P2P via WebRTC com relay só de sinalização — `src/net/`
- [x] 378 `P1` Modelo host-autoritativo documentado — `docs/NETWORK_PROTOCOL.md`
- [x] 379 `P1` Sync completo de blocos ao entrar (`full_sync`)
- [x] 380 `P1` Retransmissão de blocos alterados pela IA (`onBlocksChanged`)
- [~] 381 `P0` **Sincronizar mods com os convidados** (`full_sync.mods` + `mod_sync`)
- [~] 382 `P0` **Criaturas sincronizadas** por retrato a 6 Hz, com o anfitrião como autoridade única
- [ ] 383 `P1` Interpolação de posição de jogadores remotos
- [ ] 384 `P1` Reconexão automática com re-sync incremental
- [ ] 385 `P1` Delta sync em vez de mundo inteiro ao reconectar
- [~] 386 `P1` **Compressão das mensagens de bloco — gzip nativo no `full_sync`**
- [ ] 387 `P1` Validação de permissão (OP) no host antes de aplicar edição do convidado
- [ ] 388 `P2` Chat multiplayer separado do chat da IA
- [ ] 389 `P2` Lista de jogadores com latência
- [ ] 390 `P2` Kick/ban por jogador
- [ ] 391 `P2` Migração de host quando o host sai
- [ ] 392 `P2` Limite de convidados configurável
- [~] 393 `P2` **Indicador de estado de conexão — papel, peers e banda no painel F3**
- [~] 394 `P2` **Fila de mensagens com fragmentação — `src/net/wire.ts`**
- [ ] 395 `P2` Testes do protocolo com peers simulados
- [ ] 396 `P2` Modo offline explícito desabilitando toda a rede
- [ ] 397 `P3` Servidor dedicado opcional
- [ ] 398 `P3` Replicação de entidades por interesse (área)
- [~] 399 `P2` **Versionamento implícito por formato: peer antigo continua entendido, porque texto e binário convivem no mesmo canal**
- [~] 400 `P2` **Métricas de banda por sessão — `PeerSync.getTrafficStats`**

## 17 — Engenheiro de Performance

- [x] 401 `P0` Geração de chunk fora da thread principal
- [x] 401b `P0` Save de blocos em lote (era 2N round-trips, virou 2 escritas)
- [~] 402 `P0` **Orçamento de quadro adaptativo** — havia um limite por contagem; faltava reagir ao custo real
- [~] 403 `P0` **Mesh em Web Worker — `src/world/meshWorker.ts`, com buffers transferidos nos dois sentidos**
- [~] 404 `P1` **Pool de buffers reaproveitados em vez de realocar 300 KB por re-mesh**
- [~] 405 `P1` **`dispose()` do chunk anterior ao aplicar a malha nova**
- [ ] 406 `P1` Instanced mesh para decorativos e entidades repetidas
- [ ] 407 `P1` Reduzir draw calls agrupando chunks vizinhos
- [~] 408 `P1` **Profiling embutido (F3)** com FPS, custo por sistema, chunks, entidades, vozes, rede e memória
- [ ] 409 `P1` Distância de render adaptativa ao FPS medido
- [ ] 410 `P2` Cache de resultado de `getGroundY` por coluna
- [ ] 411 `P2` Estruturas tipadas (`Uint8Array`) em vez de `Map<string, number>` no hot path
- [~] 412 `P2` **Evitada a concatenação de string por voxel no acesso à luz (cache de chunk)**
- [ ] 413 `P2` Web Worker dedicado para persistência
- [ ] 414 `P2` Debounce já existe no save de jogador; estender ao save de blocos
- [ ] 415 `P1` Limite de entidades simuladas por frame
- [ ] 416 `P2` Throttle de scripts de comportamento por distância
- [ ] 417 `P2` Benchmark automatizado de mesher em cena fixa
- [ ] 418 `P2` Benchmark de geração de 100 chunks
- [ ] 419 `P2` Teste de regressão de performance no CI
- [ ] 420 `P2` Lazy load do módulo de IA (só quando o chat abre)
- [ ] 421 `P2` Code splitting do bundle
- [ ] 422 `P2` Reduzir tamanho do bundle Three.js (imports seletivos)
- [ ] 423 `P3` WebGPU como caminho alternativo
- [ ] 424 `P2` Detectar e avisar sobre GPU fraca

## 18 — Designer de UI/UX & Acessibilidade

- [x] 425 `P1` Menu principal, assistente de criação de mundo, pausa — `src/ui/`
- [x] 426 `P1` HUD com hotbar e toasts
- [x] 427 `P1` Inventário criativo com abas
- [x] 428 `P1` Chat com threads e histórico por mundo
- [x] 429 `P1` Gerenciador central de UI com lock de ponteiro
- [x] 430 `P0` ~~Painel de mods na UI~~ — **auditado, já existe** em `ModsPage`: listar, ativar, remover, exportar
- [ ] 431 `P1` Feedback visual quando a IA está construindo (progresso, não só spinner)
- [ ] 432 `P1` Remapeamento de teclas
- [ ] 433 `P1` Suporte a gamepad
- [ ] 434 `P1` Sensibilidade de mouse configurável
- [ ] 435 `P1` Legendas/indicadores para efeitos sonoros importantes
- [ ] 436 `P1` Modo daltonismo
- [ ] 437 `P1` Escala de UI configurável
- [ ] 438 `P2` Redutor de movimento (desligar balanço de câmera)
- [ ] 439 `P2` Contraste alto no HUD
- [ ] 440 `P2` Navegação por teclado em todos os menus
- [ ] 441 `P2` Rótulos ARIA nos elementos interativos
- [~] 442 `P2` **Tela de configurações unificada — áudio e atalhos no hub**
- [ ] 443 `P2` Minimapa
- [ ] 444 `P2` Bússola e coordenadas opcionais
- [ ] 445 `P2` Tela de morte com resumo
- [ ] 446 `P2` Tooltip de bloco com propriedades (inclusive blocos de mod)
- [ ] 447 `P2` Busca no inventário
- [ ] 448 `P3` Suporte a toque/mobile

## 19 — Engenheiro de QA & Testes Automatizados

*Parecer: 46 testes passando é uma base honesta, mas cobrem só lógica pura. O sistema de mods
precisava nascer com teste, porque a falha dele é silenciosa e corrompe o save.*

- [x] 449 `P0` Vitest configurado com `npm test`
- [x] 450 `P1` Testes de `blocks.ts` (solidez, opacidade, tiers)
- [x] 451 `P1` Testes de `CommandSystem`
- [x] 452 `P1` Testes de `CraftingSystem`
- [x] 453 `P1` Testes de `GameModeManager`
- [x] 454 `P1` Testes de `StructureTemplates`
- [x] 455 `P1` Testes de `SurvivalSystem`
- [~] 456 `P0` **Testes do `ModRegistry`** (alocação de id, validação, resolução simbólica)
- [~] 457 `P0` **Testes de estabilidade de id entre sessões** (o bug que corrompia o save)
- [~] 458 `P0` **Testes de round-trip de mod** (criar → serializar → recarregar → aplicar)
- [~] 459 `P0` **Testes de registro de bloco customizado sem buracos no array**
- [~] 460 `P1` **Testes das ferramentas MCP de mod com repositório fake**
- [~] 461 `P1` **Testes de resolução de referência simbólica de bloco em estruturas**
- [ ] 462 `P1` Testes de `WorldRepository` com IndexedDB fake
- [ ] 463 `P1` Testes de `physics.ts` com cenários de colisão fixos
- [ ] 464 `P1` Testes de `worldgen` verificando determinismo por semente
- [ ] 465 `P1` Testes de `mesher` contando faces geradas em grade conhecida
- [ ] 466 `P1` Testes de `UndoManager`
- [ ] 467 `P1` Testes de `WorldPerception`
- [ ] 468 `P2` Testes de `EntitySystem` com cena Three mockada
- [ ] 469 `P2` Testes do protocolo de rede com peers simulados
- [ ] 470 `P2` Cobertura mínima exigida no CI (ex.: 60% em `src/`)
- [ ] 471 `P2` Testes end-to-end com Playwright (criar mundo, colocar bloco, recarregar)
- [ ] 472 `P2` Teste de regressão visual do mesher
- [ ] 473 `P2` Testes de migração de save entre versões
- [ ] 474 `P2` Fixtures de mundo para cenários repetíveis
- [ ] 475 `P2` Testes de carga (10k blocos, 200 entidades)
- [ ] 476 `P2` `npm run test:watch` documentado no guia de desenvolvimento

## 20 — Engenheiro de Áudio

- [~] 477 `P0` **Sistema de áudio com Web Audio API e síntese procedural — zero asset, zero download**
- [~] 478 `P0` **Som por material ao quebrar/colocar, derivado da paleta (bloco de mod herda som coerente)**
- [~] 479 `P1` **Passos variando por bloco pisado, com cadência por distância andada**
- [~] 480 `P1` **Áudio posicional: atenuação por distância com corte, e panorâmica estéreo**
- [ ] 481 `P1` Ambiência por bioma
- [ ] 482 `P1` Música dinâmica por contexto (dia, noite, caverna, combate)
- [~] 483 `P1` **Volume separado por canal (mestre, efeitos, ambiente, música, UI)**
- [~] 484 `P1` **Som de dano, morte, acerto, queimadura e ferramenta quebrando**
- [ ] 485 `P2` Som de água e lava por proximidade
- [ ] 486 `P2` Reverb em cavernas
- [ ] 487 `P2` Abafamento embaixo d'água
- [~] 488 `P2` **Som de UI (pegar item, abrir painel)**
- [~] 489 `P2` **Mods podem tocar sons pelo catálogo — `api.audio.play`**
- [~] 490 `P2` **Limite de vozes simultâneas com liberação garantida**
- [~] 491 `P2` **Ruído gerado uma vez e reaproveitado, sem travar o boot**
- [ ] 492 `P2` Silenciar ao perder o foco da aba
- [ ] 493 `P3` Síntese procedural de som de bloco a partir do material
- [~] 494 `P2` **Testes de que todo som é válido e nenhum sai da faixa audível**

## 21 — Designer de Conteúdo Terraria-like

- [ ] 495 `P0` Camadas verticais com identidade (superfície, subsolo, caverna, inferno)
- [ ] 496 `P0` Recursos exclusivos por camada
- [ ] 497 `P1` Perigos crescentes com a profundidade
- [ ] 498 `P1` Masmorras com chave/mecanismo de abertura
- [ ] 499 `P1` Eventos de invasão temporizados
- [ ] 500 `P1` Bosses invocáveis com item de convocação
- [ ] 501 `P1` NPCs que se mudam para a base quando há condições (casa válida)
- [~] 502 `P1` Validador de "casa" — **o miolo existe**: `estaAbrigado` (seção 58) já responde "este espaço é fechado?" por busca em largura, que é a parte difícil. Faltam os outros três critérios (porta, luz mínima, mobília), e a **porta ainda não existe como bloco** (item 1323)
- [ ] 503 `P2` Biomas corrompidos que se espalham
- [ ] 504 `P2` Item de mobilidade progressiva (gancho, planador, botas)
- [ ] 505 `P2` Acessórios com efeitos combináveis
- [ ] 506 `P2` Baús de bioma com loot único
- [ ] 507 `P2` Sistema de trofeus/coleções
- [ ] 508 `P2` Modo dificuldade "pós-boss" alterando o mundo
- [ ] 509 `P2` Pesca com raridades
- [ ] 510 `P3` Modo construção 2D lateral opcional
- [ ] 511 `P2` Mapa de mundo revelado por exploração
- [ ] 512 `P2` Marcadores/waypoints no mapa

## 22 — DevOps & Build

- [x] 513 `P1` Vite + TypeScript com `npm run build` e `npm test`
- [~] 514 `P0` **CI rodando `tsc --noEmit`, `vitest run` e build a cada push — `.github/workflows/ci.yml`**
- [ ] 515 `P1` Lint (ESLint) e formatação (Prettier) padronizados
- [ ] 516 `P1` `strict` do TypeScript revisado e sem `any` implícito nas APIs públicas
- [ ] 517 `P1` Versionamento semântico com CHANGELOG gerado
- [ ] 518 `P2` Build de produção com source maps publicáveis
- [ ] 519 `P2` Deploy automatizado (GitHub Pages / estático)
- [ ] 520 `P2` Documentação de contribuição e de arquitetura mantida em `docs/`

---

## Resumo executivo desta rodada

**Bloqueio crítico encontrado e corrigido.** `registerCustomBlock()` em `src/world/blocks.ts`
criava blocos apenas em memória. Consequências concretas no código anterior:

1. Ao recarregar o mundo, `BLOCKS` voltava a ter 29 entradas.
2. Os `blockMods` salvos ainda referenciavam ids ≥ 29.
3. `src/world/mesher.ts:142` faz `const def = BLOCKS[t]` e em seguida lê `def.colors` — com um id
   órfão isso é `undefined.colors`, quebrando o mesh do chunk inteiro.

Ou seja: **toda modificação de bloco criada pela IA corrompia o mundo no reload.** Os itens
marcados `[~]` acima são a correção estrutural: identidade de bloco estável, persistência por
mundo, reaplicação no load e cobertura de testes.

### Rodada 6 — concluído

| Item | Entrega |
|---|---|
| 175 | A* em grade de voxels: os mobs contornam quinas em vez de encostar na parede e travar |
| 129/152 | Durabilidade com quebra e loot que realimenta o ciclo de luz e de picareta |
| 621–641 | **Mod = sessão de chat**, com versionamento, rollback e quarentena |
| 701–703 | Escrita escopada ao mod da sessão; leitura continua ampla |

**Decisão de modelagem que vale registrar:** o pedido original sugeria 1 sessão ↔ 1 mod. Amarrar
assim obrigaria a carregar toda a conversa anterior no contexto para continuar um mod antigo. O
vínculo autoritativo ficou em `ChatThreadRecord.modId` (1 mod → N sessões), e `originThreadId`
guarda só a proveniência.

**Sessão livre** foi acrescentada como terceiro estado: sem mod vinculado, o agente lê o mundo e
os outros mods mas nenhuma ferramenta de escrita funciona. É o que impede uma conversa
exploratória de alterar o jogo por engano.

**Biomas e construções espalhadas** foram desenhados e registrados na seção 27, mas **não
implementados** nesta rodada, a pedido — o esboço do `BiomeDef` e da regra de espalhamento está
descrito lá para a implementação ser direta.

### Rodada 5 — concluído

| Item | Entrega |
|---|---|
| 145/147/149/150 | Núcleo de combate puro: dano por tier, alcance com **cone de mira**, cooldown, i-frames, recuo |
| 146/255 | Hostis nascem **só no escuro** — o motor de luz da rodada 4 virou mecânica de jogo |
| 151/161 | Barra de vida flutuante e piscada vermelha ao acertar |
| 176–179 | Mobs colidem com o mundo, sobem degrau, percebem, perseguem e atacam |
| 124–125 | Comida (tecla F) e regeneração — a fome deixou de ser só um cronômetro de morte |

Três arquétipos com posturas distintas: zumbi lento e resistente, aranha rápida e frágil,
esqueleto no meio. A verificação de balanceamento está em teste — nenhum mob mata de um golpe,
e o jogador de mão vazia derrota qualquer um entre 2 e 12 golpes.

**A tocha virou ferramenta tática:** iluminar a área é literalmente o que impede o spawn, porque
`effectiveLight` faz a luz de bloco valer integralmente a qualquer hora, enquanto a luz de céu
despenca à noite.

### Rodada 4 — concluído

| Item | Entrega |
|---|---|
| 243–244 | Motor de luz por flood fill: sol + luz de bloco, com escuridão real nas cavernas |
| 245–246 | Ciclo dia/noite: sol em arco, céu azul → laranja → noite |
| 247 | Tocha colocável (`B.TORCH`), craftável com carvão + tronco |
| 248 | Recálculo incremental — colocar tocha ou furar o teto acende/apaga na hora |
| 249/252 | Água, folhagem e vidro atenuam de formas diferentes; `lightLevel` de mod passou a valer |
| 262 | Hora do mundo entrou no save |
| — | Receitas de minério → bloco refinado, fechando a cadeia aberta na rodada 3 |

**Bug real encontrado:** as folhas retornavam opacidade `Infinity` porque são `opaque` na paleta
(para o mesher não desenhar as faces internas da copa). Para a luz isso significava que toda
árvore projetaria uma sombra preta sólida. A folhagem agora é filtro (custo 1), tratada **antes**
da checagem de opacidade.

### Rodada 3 — concluído

| Item | Entrega |
|---|---|
| 100–101 | Cavernas por ruído 3D e veios de minério — o subsolo deixou de ser rocha maciça |
| 540 | Lava com a mesma geometria de minibloco da água |
| 543 | Queimadura persistente: sair da lava não apaga o fogo, só a água |
| 342 | `undo_last_action` — e `recordBatch` passou a ser chamado (o undo existia mas estava morto) |
| 381/608 | Mods sincronizados no P2P, com os ids preservados |
| 286 | `deleteWorld` deixou de vazar players, threads, UI e mods |

Densidade medida no subsolo: **10,6% de caverna**, com gradiente de raridade
carvão 1,24% → ferro 0,92% → ouro 0,12% → diamante 0,022%.

**Prioridade recomendada para a próxima rodada** (maior impacto primeiro):

| Ordem | Item | Por quê |
|---|---|---|
| 1 | 665–669 (biomas com recursos próprios) | Desenhado e registrado; é o que dá razão para explorar o mapa |
| 1b | 721–728 (`mod.env` + cofre) | Pré-requisito de qualquer integração externa; ver a ordem da seção 30 |
| 2 | 681–684 (construções espalhadas) | Não há nada para encontrar explorando hoje |
| 3 | 642 (painel de mods na UI) | Versionamento e rollback existem, mas só via ferramenta da IA |
| 4 | 704–705 (atribuir blocos ao mod da sessão) | Fecha o cerco: hoje `set_block` ainda escreve fora do escopo |
| 5 | 148 (arco e flecha) | Sem ataque à distância, todo combate é encostar e bater |
| 6 | 130 (armadura) | O combate existe, mas defender-se ainda não é decisão |
| 7 | 403 (mesh em worker) | O re-mesh do ciclo dia/noite tornou o custo de malha mais visível |
| 8 | 514 (CI) | Impede regressão silenciosa nos 285 testes |

---

# Adendo — Rodada 2 (itens 521–620)

> Requisitos levantados pelo usuário depois da primeira entrega, com três especialistas novos
> convocados para a banca. A pesquisa sobre o **Lay of the Land** (Southern Cross Interactive,
> 2026) foi feita e confirmou a direção: o jogo usa voxels de verdade em vez de blocos grandes,
> e *tudo* obedece física — estruturas colapsam sob carga e objetos rolam ladeira abaixo. Isso
> ancora tanto a mecânica de fluidos quanto o desmoronamento de areia pedidos aqui.

| # | Especialista | Itens | Foco |
|---|---|---|---|
| 23 | Engenheiro de Fluidos & Materiais | 521–556 | Água/lava finitas, areia com ângulo de repouso |
| 24 | Diretor de Personagem & Câmera | 557–600 | Avatar estilo Hytale, 1ª/3ª pessoa, customização |
| 25 | Arquiteto Client-Side | 601–620 | Tudo no navegador, inclusive no P2P |

## 23 — Engenheiro de Fluidos & Materiais

*Parecer: a água era um preenchimento de cavidade ligado ao nível do mar — comportava-se como
fonte infinita e não tinha noção de volume. A lava não escoava de forma alguma. Reescrito como
transporte de massa conservada em mini-voxels.*

- [~] 521 `P0` **Água e lava como voxels discretos e finitos** — `src/world/fluids.ts`
- [~] 522 `P0` **Massa conservada: o sistema move fluido, nunca cria**
- [~] 523 `P0` **Sem fonte infinita — a poça espalha, afina e para**
- [~] 524 `P0` **Queda: o fluido desce enquanto a célula de baixo aceitar**
- [~] 525 `P0` **Cair restaura o orçamento de espalhamento** (cachoeira volta a se abrir embaixo)
- [~] 526 `P0` **Busca de beirada: o líquido prefere a direção com degrau para baixo**
- [~] 527 `P0` **Pressão hidrostática: só espalha em plano se houver coluna por cima**
- [~] 528 `P1` **Voxel isolado não rasteja — fica onde caiu**
- [~] 529 `P1` **Lava mais viscosa que água** (alcance lateral menor)
- [~] 530 `P1` **Água + lava → obsidiana**
- [~] 531 `P1` **Fluido atravessa vegetação decorativa em vez de ficar preso**
- [~] 532 `P1` **Reativação: cavar sob uma poça parada faz o fluido voltar a escoar**
- [~] 533 `P1` **Orçamento por frame — dilúvio não derruba o FPS**
- [~] 534 `P1` **Escoamento persiste no save e é replicado no P2P pelo anfitrião**
- [~] 535 `P0` **Areia/cascalho desmoronam para o lado em declive íngreme** (`findSlideTarget`)
- [~] 536 `P1` **Ângulo de repouso: só escorrega se houver degrau vazio, não em encosta apoiada**
- [~] 537 `P1` **Desempate de direção alternado, sem viés para um lado**
- [~] 538 `P1` **Empurrão horizontal no destroço, para o grão rolar visivelmente**
- [~] 539 `P0` **Cobertura de testes da mecânica de fluidos e desmoronamento** (20 testes)
- [~] 540 `P1` **Lava renderizada com a mesma geometria rebaixada da água**
- [ ] 541 `P1` Altura visual do voxel proporcional ao volume restante
- [ ] 542 `P1` Nadar e boiar com física própria dentro do fluido
- [~] 543 `P1` **Dano por lava e queimadura persistente** (só a água apaga)
- [ ] 544 `P1` Balde: pegar e despejar uma quantidade finita
- [ ] 545 `P2` Correnteza empurrando jogador e entidades
- [ ] 546 `P2` Evaporação lenta de poças rasas expostas ao sol
- [ ] 547 `P2` Congelamento de água em bioma nevado
- [ ] 548 `P2` Lava esfriando em pedra longe de fonte de calor
- [ ] 549 `P2` Fluido girando moinho/turbina (energia mecânica)
- [ ] 550 `P2` Som posicional de fluido escoando
- [ ] 551 `P2` Partículas de respingo ao cair
- [ ] 552 `P2` Fluidos customizados via mod (ácido, mel) com viscosidade própria
- [ ] 553 `P2` Simulação de fluido movida para Web Worker
- [ ] 554 `P2` Compactar o estado ativo do fluido no save (hoje o orçamento é transitório)
- [ ] 555 `P3` Pressão em tubulação fechada (fluido sobe)
- [ ] 556 `P2` Benchmark: 5.000 voxels de fluido ativos sem queda de frame

## 24 — Diretor de Personagem & Câmera

*Parecer: não existia personagem — o jogador era uma câmera flutuante e os outros jogadores no
P2P eram só um nome numa lista, sem corpo. Construído do zero com silhueta estilo Hytale.*

- [~] 557 `P0` **Modelo 3D do jogador com anatomia estilo Hytale** — `src/player/PlayerModel.ts`
- [~] 558 `P0` **Proporções distintas do Minecraft: cabeça grande, membros finos, peças destacadas**
- [~] 559 `P0` **Cabelo em 4 estilos** (curto, longo, moicano, careca)
- [~] 560 `P0` **Peças extras de silhueta: cinto, botas, mãos, olhos**
- [~] 561 `P1` **Pivôs no ombro/quadril/pescoço — o braço gira do ombro, não da barriga**
- [~] 562 `P1` **Ciclo de caminhada com amplitude proporcional à velocidade**
- [~] 563 `P1` **Pose de salto distinta quando fora do chão**
- [~] 564 `P1` **Cabeça acompanha a mira vertical, com limite de pescoço**
- [~] 565 `P1` **Balanço sutil do corpo ao andar**
- [~] 566 `P1` **Materiais compartilhados por cor — não cria material por peça**
- [~] 567 `P0` **O jogo começa em primeira pessoa**
- [~] 568 `P0` **Câmera em terceira pessoa orbital atrás do personagem**
- [~] 569 `P0` **F5 alterna 1ª/3ª pessoa** (Ctrl+4 também seleciona direto)
- [~] 570 `P1` **Roda do mouse ajusta a distância da 3ª pessoa**
- [~] 571 `P1` **Câmera se aproxima ao encostar em parede, em vez de entrar no terreno**
- [~] 572 `P1` **Terceira pessoa mantém a mesma física da primeira**
- [~] 573 `P1` **Modelo oculto em 1ª pessoa** (a câmera fica dentro da cabeça)
- [~] 574 `P1` **Terceira pessoa listada no menu de pausa**
- [~] 575 `P0` **Página de customização do personagem** — `src/ui/CharacterCreator.ts`
- [~] 576 `P0` **Preview 3D girando, com renderer próprio criado só ao abrir**
- [~] 577 `P0` **Cor por parte do corpo: 7 slots pintáveis**
- [~] 578 `P0` **Paleta sugerida + seletor de cor livre**
- [~] 579 `P1` **Arrastar no preview para girar o personagem**
- [~] 580 `P1` **Botão "Aleatório" gerando visual coerente**
- [~] 581 `P1` **Ajuste de porte (0.9–1.1)**
- [~] 582 `P1` **Nome do personagem editável**
- [~] 583 `P0` **A aparência é salva** — tabela `profiles` (Database v5)
- [~] 584 `P0` **Perfil global ao jogador, não por mundo** — o personagem acompanha todos os mundos
- [~] 585 `P0` **Outros jogadores veem o personagem customizado online** — `AvatarManager`
- [~] 586 `P0` **Aparência viaja no `player_state` do protocolo P2P**
- [~] 587 `P1` **Avatares remotos com interpolação de posição** (pacotes a ~10 Hz)
- [~] 588 `P1` **Etiqueta de nome legível sobre o avatar, sempre virada para a câmera**
- [~] 589 `P1` **Avatar reconstruído quando o peer troca de visual em tempo real**
- [~] 590 `P1` **Avatar sumindo depois de 12s sem estado** (queda de conexão silenciosa)
- [~] 591 `P0` **Aparência recebida da rede é higienizada antes de virar cor/escala**
- [~] 592 `P1` **F4 abre a customização; a tela entra no gerenciador de UI bloqueante**
- [~] 593 `P1` **Cobertura de testes da aparência e da anatomia** (20 testes)
- [ ] 594 `P1` Primeira pessoa mostrando braços e ferramenta na tela
- [ ] 595 `P1` Peças de equipamento visíveis (capacete, peitoral) sobre o modelo
- [ ] 596 `P2` Emotes e animações de gesto
- [ ] 597 `P2` Mais opções de rosto (sobrancelha, barba, boca)
- [ ] 598 `P2` Presets de personagem salvos e nomeados
- [ ] 599 `P2` Ombro esquerdo/direito na câmera de 3ª pessoa
- [ ] 600 `P2` Compartilhar o personagem como código/JSON entre jogadores

## 25 — Arquiteto Client-Side

*Parecer: a regra "tudo roda no navegador" já era respeitada e continua sendo, inclusive no
multiplayer. Vale registrá-la explicitamente para nenhuma feature futura quebrar a premissa.*

- [x] 601 `P0` Jogo 100% client-side: nenhum backend de jogo existe
- [x] 602 `P0` Persistência local em IndexedDB, nunca em servidor
- [x] 603 `P0` Multiplayer P2P direto entre navegadores via WebRTC DataChannel
- [x] 604 `P0` Relay enxerga só sinalização — nunca blocos, inventário ou chat
- [x] 605 `P0` Chamadas de rede externas restritas ao provedor de IA configurado
- [~] 606 `P0` **Aparência do personagem trafega P2P, sem servidor de perfil**
- [~] 607 `P0` **Fluidos simulados no cliente; o anfitrião é a autoridade e replica o resultado**
- [~] 608 `P1` **Sincronizar mods para os convidados — o convidado registra no mesmo id do anfitrião**
- [ ] 609 `P1` Sincronizar entidades e seu estado
- [ ] 610 `P1` Documentar a premissa client-side no `ARCHITECTURE.md` como regra de projeto
- [ ] 611 `P1` Teste automatizado garantindo que o relay não recebe payload de mundo
- [ ] 612 `P1` Modo offline explícito, desabilitando toda a rede
- [ ] 613 `P2` Funcionar como PWA instalável e jogável sem conexão
- [ ] 614 `P2` Service worker com cache de assets
- [ ] 615 `P2` Aviso claro de uso de quota do IndexedDB
- [ ] 616 `P2` Exportar/importar todo o perfil do jogador
- [ ] 617 `P2` Migração de host quando o anfitrião sai
- [ ] 618 `P2` Validação de todas as mensagens P2P recebidas contra payload malicioso
- [ ] 619 `P2` Limite de convidados configurável
- [ ] 620 `P3` Servidor dedicado opcional, sem quebrar o modo local

---

# Adendo — Rodada 3 de requisitos (itens 621–720)

> Três especialistas novos convocados para os requisitos de **mod como sessão de chat**,
> **biomas com recursos próprios** e **construções espalhadas**.

| # | Especialista | Itens | Foco |
|---|---|---|---|
| 26 | Arquiteto de Sessões & Versionamento | 621–664 | Mod = sessão de chat, versões, isolamento |
| 27 | Designer de Biomas & Distribuição | 665–700 | Biomas com recursos exclusivos, estruturas espalhadas |
| 28 | Engenheiro de Ferramentas do Agente | 701–720 | Escopo, leitura ampla, escrita restrita |

## 26 — Arquiteto de Sessões & Versionamento ⭐

*Parecer: o pedido tem uma intuição forte — se a conversa **é** a modificação, o agente sempre
sabe onde escrever, e o usuário ganha um histórico legível do porquê de cada mudança. O risco a
evitar era amarrar 1 sessão ↔ 1 mod: continuar um mod antigo obrigaria a carregar toda a conversa
anterior no contexto. Resolvido com 1 mod → N sessões.*

- [~] 621 `P0` **`ChatThreadRecord.modId` é o vínculo autoritativo entre sessão e mod**
- [~] 622 `P0` **`ModPackage.originThreadId` guarda a proveniência (onde o mod nasceu)**
- [~] 623 `P0` **Cardinalidade 1 mod → N sessões** — continuar um mod sem herdar o histórico
- [~] 624 `P0` **Sessão livre (sem mod): lê tudo, não escreve nada**
- [~] 625 `P0` **Criar sessão permite escolher mod existente, nomear um novo, ou ficar livre**
- [~] 626 `P0` **`create_mod` vincula a sessão atual automaticamente**
- [~] 627 `P0` **`attach_session_to_mod` troca ou solta o vínculo**
- [~] 628 `P0` **`get_session_context` diz ao agente onde ele está antes de modificar**
- [~] 629 `P0` **`mod_id` virou opcional nas ferramentas de escrita** (usa o mod da sessão)
- [~] 630 `P0` **Snapshot do estado ANTES de cada alteração** (`ModRevision`)
- [~] 631 `P0` **`list_mod_revisions` com resumo do que mudou em cada versão**
- [~] 632 `P0` **`rollback_mod` reverte mundo e save**
- [~] 633 `P0` **O rollback é reversível: o estado atual vira revisão antes de voltar**
- [~] 634 `P1` **Histórico linear: a revisão avança mesmo voltando no conteúdo**
- [~] 635 `P0` **Quarentena: mod que falha ao aplicar é isolado e o mundo carrega**
- [~] 636 `P0` **Aplicação mod a mod** — antes uma exceção travava o carregamento inteiro
- [~] 637 `P1` **Mod em quarentena não é reaplicado nos loads seguintes**
- [~] 638 `P1` **Aviso na UI quando um mod é isolado, com o motivo**
- [~] 639 `P0` **`export_mod` entrega a ESTRUTURA, sem conversa, quarentena ou ids locais**
- [~] 640 `P1` **Database v6 com a tabela `modRevisions`**
- [~] 641 `P1` **Cobertura de testes de sessão, versionamento e isolamento** (15 testes)
- [x] 642 `P0` ~~Painel de mods com versões e rollback~~ — **auditado, já existe**: aba Versões e `rollbackMod`
- [ ] 643 `P1` Aba de sessões mostrando a qual mod cada uma pertence
- [ ] 644 `P1` Diff legível entre duas revisões ("+2 blocos, −1 estrutura")
- [ ] 645 `P1` Limite de revisões por mod, com poda das mais antigas
- [ ] 646 `P1` Rollback parcial (só os blocos, só as estruturas)
- [ ] 647 `P1` Reverter do mundo os blocos colocados por uma revisão descartada
- [ ] 648 `P1` Tirar da quarentena manualmente, depois de corrigir o mod
- [ ] 649 `P1` Diagnóstico do motivo da quarentena legível para o usuário leigo
- [ ] 650 `P2` Renomear e descrever a sessão a partir do conteúdo do mod
- [ ] 651 `P2` Arquivar sessão sem apagar o mod
- [ ] 652 `P2` Apagar sessão perguntando o que fazer com o mod
- [ ] 653 `P2` Mesclar dois mods num só
- [ ] 654 `P2` Dividir um mod em dois
- [ ] 655 `P2` Dependência declarada entre mods, com ordem de carga
- [ ] 656 `P2` Detectar conflito quando dois mods alteram a mesma coisa
- [ ] 657 `P2` Marcar revisão como "estável" para servir de ponto de retorno
- [ ] 658 `P2` Comparar o mod com a versão exportada (o que mudou desde então)
- [ ] 659 `P2` Importar mod já vinculando a uma sessão nova
- [ ] 660 `P2` Histórico de quem alterou o quê no multiplayer
- [ ] 661 `P2` Exportar a sessão (conversa) separadamente, como registro de decisões
- [ ] 662 `P3` Reproduzir um mod a partir da conversa, do zero
- [ ] 663 `P2` Migração de mods antigos sem `revision` nem `originThreadId`
- [ ] 664 `P2` Teste de que uma revisão restaurada gera exatamente o mesmo mundo

## 27 — Designer de Biomas & Distribuição

*Parecer: hoje o gerador escolhe o bloco de superfície por uma sequência de `if` dentro de
`column()` — praia, montanha, rio. Isso descreve **relevo**, não bioma. Falta o que faz um bioma
importar num jogo de sobrevivência: ter algo que só existe ali, obrigando a expedição. E o mundo
não tem nenhuma construção espalhada — nada para encontrar explorando.*

**Desenho proposto (já esboçado e guardado aqui em vez de implementado agora):**
`BiomeDef` declarativo com faixa de clima, superfície, vegetação e **recursos com abundância
própria**; seleção por pontuação contínua (`biomeScore`) em vez de teste booleano, para as
fronteiras serem graduais e para um bioma de mod competir em igualdade com os base.

- [~] 665 `P0` **`BiomeDef` declarativo: clima, cor, névoa, saturação, estação e minérios**
- [~] 666 `P0` **Seleção por pontuação contínua — `pesosDeBioma`, fronteiras graduais por construção**
- [~] 667 `P0` **Abundância por bioma: ouro no deserto, diamante na tundra**
- [~] 668 `P0` ****Recurso exclusivo**: não há diamante no deserto, por mais fundo que se cave**
- [~] 669 `P0` **Oito biomas de clima + três de relevo (oceano, praia, montanha)**

#### O mundo não tinha biomas — só atmosfera de bioma

Ao voltar para esta seção encontrei o mesmo padrão que já tinha pegado nas estações: o módulo de
biomas existia, alimentava névoa, cor, clima e estação, e **o gerador de terreno o ignorava**. A
superfície e a vegetação saíam de limiares próprios, paralelos e independentes.

O sintoma disso é invisível até alguém reparar: o horizonte podia dizer "deserto" enquanto o chão
sob os pés dizia outra coisa. Duas fontes para a mesma decisão divergem em silêncio.

Agora `ColumnInfo.bioma` sai da mesma função que governa tudo o mais, e decide superfície,
espécie de árvore, densidade de vegetação e abundância de minério.

**Uma função a mais, e a razão dela.** `pesosDeBioma` monta e ordena um vetor — certo para
misturar cor, errado para chamar uma vez por coluna: a geração de um chunk faria mais de mil
vetores curtos, e o custo real não é a aritmética, é a pressão de coleta de lixo dentro do Web
Worker. `biomaDominanteRapido` faz o mesmo sem alocar, e há um teste que varre o domínio inteiro
fixando a equivalência entre as duas — duas implementações da mesma regra é precisamente o que
diverge sem avisar.

**Precedência descoberta por teste:** rio e estrada mandam mais que o bioma. Um leito de rio é
feito de leito de rio, atravesse ele o bioma que atravessar. O teste acusou areia numa coluna de
montanha e a causa era essa; virou uma asserção explícita em vez de uma exceção silenciosa.

**Densidade de árvore zero no deserto e na tundra** é decisão de leitura, não de realismo: uma
árvore isolada no meio da areia destrói o reconhecimento do bioma mais do que qualquer outro
detalhe.

- [ ] 670 `P1` Vegetação por bioma (densidade de árvore, capim, decoração característica)
- [ ] 671 `P1` Bioma influencia a paleta de superfície e subsolo
- [ ] 672 `P1` Bioma de montanha condicionado à altura, não só ao clima
- [ ] 673 `P1` Transição suave de altura entre biomas vizinhos
- [ ] 674 `P1` Mob hostil característico por bioma
- [ ] 675 `P1` Temperatura do bioma afetando o jogador (item 128)
- [ ] 676 `P0` **Mods podem registrar biomas** — a base para o agente criar biomas
- [ ] 677 `P0` `define_mod_biome` como ferramenta MCP
- [ ] 678 `P1` Bioma de mod entra na seleção em igualdade com os base
- [ ] 679 `P1` Nome do bioma atual no HUD e em `query_world_area`
- [ ] 680 `P2` Mapa de biomas consultável pelo agente antes de construir
- [~] 681 `P0` **`src/world/scatter.ts` — construções distribuídas proceduralmente, ligadas ao `worldgen`**
- [~] 682 `P0` **Regra por bioma e peso; espaçamento garantido pela grade única**
- [~] 683 `P0` ****Uma estrutura por célula, vencedor único** — as regras competem pela célula**
- [~] 684 `P0` **Assenta no ponto mais baixo da pegada, com fundação e limpeza acima**

#### Um defeito de desenho que só o teste mostrou

A primeira versão deu uma **grade por regra**, copiando o que as árvores fazem. A garantia de
espaçamento valia dentro de cada regra e não entre elas: na savana, que aceita casa *e* muro, as
duas grades tinham arestas diferentes e as estruturas nasceram sobrepostas. O teste apontou o par
exato — `small_house@5873,5689` colidindo com `wall@5884,5690`.

A correção **não** foi rejeitar colisões depois de gerar. Isso quebraria a localidade: a rejeição
passaria a depender do que mais estivesse na janela de varredura, e uma estrutura na fronteira de
dois chunks apareceria num e não no outro. A correção foi **uma grade só** — a célula sorteia se
tem estrutura, e as regras válidas para aquele bioma competem por ela. O espaçamento volta a ser
garantia por construção, e a decisão continua local.

#### O que faz ser construção, e não caixa jogada no terreno

- **Limpa o volume acima da base** antes de colocar. Sem isso o terreno que sobe dentro da pegada
  atravessa a parede, e capim nasce dentro da sala.
- **Preenche o vão até o chão.** O sítio assenta no ponto mais *baixo* da pegada — assentar no
  mais alto deixaria a construção sobre pernas de ar no lado da descida.
- **Rejeita encosta** antes de tentar consertar: terreno acidentado demais simplesmente não
  recebe construção. Mais barato e mais bonito que nivelar depois.
- **Margem de varredura maior que a das árvores** (14 contra 8): uma casa ancorada logo fora do
  chunk invade vários voxels dele, e sem isso apareceria cortada na fronteira.

E o teste que importa mais que todos: os blocos aparecem **no chunk gerado**. Sem ele, `scatter.ts`
seria mais um módulo completo, testado e inerte.

- [ ] 685 `P1` Ruínas, torres abandonadas e acampamentos como conteúdo base
- [ ] 686 `P1` Baú de loot dentro da estrutura, com tabela por tipo
- [ ] 687 `P1` Estruturas subterrâneas ligadas às cavernas
- [ ] 688 `P1` Aldeias com várias estruturas e caminho ligando
- [ ] 689 `P0` **Mods podem registrar regras de espalhamento** — base para mods de estrutura
- [ ] 690 `P0` `define_mod_scatter` como ferramenta MCP
- [ ] 691 `P1` Estrutura espalhada respeita o bioma declarado na regra
- [ ] 692 `P1` Densidade de espalhamento configurável por mundo
- [ ] 693 `P1` Estruturas espalhadas entram no save como blocos normais
- [ ] 694 `P2` Marcar no mapa as estruturas já encontradas
- [ ] 695 `P2` Estrutura com variação procedural (não duas iguais)
- [ ] 696 `P2` Estrutura com entidades pré-posicionadas
- [ ] 697 `P2` Comando/ferramenta para localizar a estrutura mais próxima
- [ ] 698 `P2` Bioma corrompido que se espalha (item 503)
- [ ] 699 `P2` Testes de determinismo do espalhamento por semente
- [ ] 700 `P2` Testes de que nenhuma estrutura nasce dentro de outra

## 28 — Engenheiro de Ferramentas do Agente

*Parecer: o pedido separa bem **leitura** de **escrita** — o agente lê o projeto inteiro e os
outros mods, mas só escreve dentro do mod da sessão. Isso é o que contém o estrago de um mod
malfeito. Falta fechar o cerco nas ferramentas que ainda escrevem fora do escopo.*

- [~] 701 `P0` **Escrita escopada ao mod da sessão** (`targetMod` + orientação padronizada)
- [~] 702 `P0` **Leitura ampla continua liberada** (`list_mods`, `query_world_area`, snapshots)
- [~] 703 `P1` **Mensagem única e acionável ao tentar escrever numa sessão livre**
- [~] 704 `P0` **Toda escrita do agente passa por um caminho atribuído** ao mod da sessão
- [~] 705 `P0` **Reversão precisa dos blocos de um mod** — o registro existia e nada revertia; e ele guardava o bloco errado
- [ ] 706 `P1` `read_mod` para inspecionar outro mod sem poder alterá-lo
- [ ] 707 `P1` Ferramenta de leitura do projeto (arquivos/estrutura) para o agente se situar
- [ ] 708 `P1` Orçamento de alterações por sessão, com aviso ao estourar
- [ ] 709 `P1` Dry-run: simular a modificação e reportar o impacto antes de aplicar
- [ ] 710 `P1` Toda ferramenta de escrita gera entrada no histórico da sessão
- [ ] 711 `P2` Permissões por mod (o que ele pode tocar)
- [ ] 712 `P2` Ferramentas de escrita desabilitadas em mod em quarentena
- [ ] 713 `P2` Confirmação do usuário antes de operação destrutiva na sessão
- [ ] 714 `P2` Log de auditoria por sessão, exportável
- [ ] 715 `P2` Agente consegue citar a mensagem que originou cada alteração
- [ ] 716 `P2` Sugerir automaticamente dividir a sessão quando o mod cresce demais
- [ ] 717 `P2` Detectar que a conversa mudou de assunto e propor sessão nova
- [ ] 718 `P2` Limite de contexto: resumir a sessão longa preservando as decisões
- [ ] 719 `P3` Agente propõe o plano do mod antes de executar, e o usuário aprova
- [ ] 720 `P2` Teste de que nenhuma ferramenta de escrita funciona em sessão livre

---

# Adendo — Rodada 4 de requisitos (itens 721–800)

> Requisito: **todo mod nasce com um arquivo de configuração estilo `.env`** para as chaves que
> ele precisa, podendo herdar do ambiente global ou ser definido manualmente. E não só para IA:
> APIs de terceiros em geral — clima local para simular uma cidade, captura de áudio do usuário,
> geração de voz. Modular e escalável na horizontal, respeitando a estrutura vertical.
>
> Dois especialistas convocados. O segundo existe porque este requisito **cruza a premissa
> arquitetural do projeto** (tudo client-side, o relay nunca vê dados do mundo) e mexe com
> segredos que hoje não existem no sistema.

| # | Especialista | Itens | Foco |
|---|---|---|---|
| 29 | Engenheiro de Configuração & Segredos | 721–760 | `mod.env`, herança, nunca vazar chave |
| 30 | Arquiteto de Capacidades & Integrações | 761–800 | Rede, áudio, permissões, escala horizontal |

## 29 — Engenheiro de Configuração & Segredos de Mod

*Parecer: a ideia de herdar do ambiente global (`AI_API_MOD_KEY=AI_API_KEY`) é a parte elegante
do pedido — o mod declara **de que chave precisa** sem nunca conter o valor. O perigo mora no
caso oposto: assim que um mod puder guardar o valor literal, `export_mod` e o sync P2P viram
vazamento de credencial. A regra que sustenta tudo: **o mod carrega a referência, o cofre carrega
o valor.***

**Formato proposto** (`mod.env` por mod, editável na UI e pelo agente):

```
# Referência: puxa do cofre global. O valor NUNCA fica no mod.
AI_MOD_ROUTER=$AI_ROUTER
AI_API_MOD_KEY=$AI_API_KEY

# Literal: só para valores não sensíveis (modelo, idioma, limites)
AI_MOD_MODEL=anthropic/claude-sonnet-4.5
VOICE_LANG=pt-BR
CITY_SIM_UNITS=metric
```

O `$` marca a herança. Sem ele é literal — e todo literal é tratado como público, porque é
exatamente isso que ele será no momento em que alguém exportar o mod.

- [~] 721 `P0` **`mod.env` criado por padrão em todo mod novo, com cabeçalho explicativo**
- [~] 722 `P0` **Herança `CHAVE=$GLOBAL` resolvida **em tempo de execução**, nunca na gravação**
- [~] 723 `P0` **Valores literais para configuração não sensível (modelo, idioma, cidade)**
- [~] 724 `P0` **`export_mod` leva o **esquema** e nunca os valores — não há o que filtrar**
- [~] 725 `P0` **`mod_sync` idem: os valores nunca estiveram no `ModPackage`**
- [~] 726 `P0` **Cofre em tabela própria (`modSecrets`, schema v8), fora de `mods`**
- [~] 727 `P0` **Chaves obrigatórias vs opcionais, com descrição de cada uma**
- [~] 728 `P0` **Mod não carrega se faltar chave obrigatória — quarentena com o motivo**

#### A separação é estrutural, não uma regra a lembrar

Um `mod.env` tem duas metades: o **esquema** (quais chaves existem, para que servem) e os
**valores** (o que está preenchido nesta instalação). O esquema é parte do mod e viaja; os valores
vivem num cofre à parte e nunca viajam.

A razão de a separação ser **estrutural**: se os valores morassem no `ModPackage`, `export_mod` e
`mod_sync` teriam de *filtrar* algo sensível a cada vez — e bastaria um caminho novo esquecer o
filtro para a chave de API do jogador sair pela rede. Estando fora, não há o que filtrar. O teste
que fixa isso não verifica um filtro; verifica que **o pacote não tem onde guardar um valor**.

Defesa em profundidade, para o caso de alguém tentar: **chave sensível não pode ter valor padrão
literal**. Um padrão viaja com o esquema, e um segredo com valor padrão é um segredo publicado —
o tipo de erro que se comete uma vez, por conveniência, e que não dá sintoma até vazar.

#### Onde a fronteira NÃO está, para não haver ilusão

O script do mod roda no mesmo cliente, com os mesmos privilégios do jogo. Esconder o valor **dele**
não seria segurança, seria teatro: um script que precisa da chave para chamar uma API precisa da
chave. A fronteira real é o que **sai da máquina** — exportação, `mod_sync` e histórico de conversa.
O agente é remoto, e por isso vê `descreverEnv` (metadados e se está preenchida) e não os valores.

#### Dois detalhes de uso que o teste pegou

- **Salvar sem mexer não apaga o segredo.** O texto mostra `********`; se o parse gravasse isso, o
  jogador que abrisse a tela e clicasse em salvar destruiria a chave — por uma ação que ele leu
  como "não fiz nada".
- **Referência para global inexistente vira ausência**, não a string `"$AI_ROUTER"`. Passar o
  literal adiante faria o mod mandar isso como token e receber um erro de autenticação, com o
  sintoma longe da causa.

Sem armazenamento (navegação privada, IndexedDB bloqueado) o cofre fica em memória e o mundo
carrega assim mesmo: derrubar o carregamento porque não há onde guardar chaves seria trocar um
problema pequeno por um total.

- [~] 729 `P1` **Editor de `mod.env` na página de mods, com a chave que falta em destaque**

#### A ponte com a configuração de IA do jogo

`AI_MOD_ROUTER=$AI_ROUTER` funciona **sem o jogador colar a mesma chave duas vezes** — é o que o
pedido descrevia. As globais `AI_ROUTER`, `AI_API_KEY` e `AI_MODEL` são **derivadas** da
configuração de IA já existente, não copiadas para o cofre: copiar criaria uma segunda cópia da
chave, que envelheceria em silêncio quando o jogador trocasse a das configurações.

Global gravada vence a derivada, para quem quiser uma conta separada só para os mods.

#### Um campo por chave, não uma caixa de texto

A caixa de texto livre obrigaria o jogador a conhecer a sintaxe para preencher uma chave, e a
descrição de cada uma — que é o que explica *para que serve* — não teria onde aparecer. A edição
do arquivo inteiro continua possível no editor de código.

Detalhe que evita destruição acidental: **chave sensível nasce com o campo vazio** e o marcador
`(preenchida — digite para substituir)`. Mostrar a máscara num `input` faria o jogador apagá-la
para digitar, e campo vazio significaria zerar. Apagar de propósito tem botão próprio.

- [~] 730 `P1` **As chaves exigidas aparecem no painel do mod, com descrição, antes de ligar**
- [ ] 731 `P1` Validação de formato por chave (URL, token, enum de modelos)
- [~] 732 `P1` **Aviso quando não há armazenamento persistente — as chaves valem só a sessão**
- [~] 733 `P1` **Chave sensível em campo `password`, com botão próprio para apagar**
- [ ] 734 `P1` Ferramenta MCP `set_mod_env` para as chaves não sensíveis (modelo, idioma)
- [~] 735 `P0` **Agente não lê valor de segredo** — auditado: `descreverEnv` devolve só metadados (nome, obrigatória, sensível, preenchida), e `modEnv` não é ferramenta do agente, só da API do script
- [~] 736 `P0` **Segredo redigido do log e das mensagens de erro**, na GRAVAÇÃO e não na exibição
- [ ] 737 `P1` Redação automática: qualquer valor de segredo é mascarado ao ser impresso
- [ ] 738 `P1` `mod.env` versionado junto do mod (o esquema entra no `ModRevision`)
- [ ] 739 `P1` Rollback de mod restaura o esquema, não os valores
- [ ] 740 `P1` Chave global editável em um lugar só, e todos os mods que a herdam acompanham
- [ ] 741 `P1` Sobrescrita por mod: herdar do global por padrão, poder fixar um valor próprio
- [ ] 742 `P2` Perfis de ambiente (dev/prod) por mundo
- [ ] 743 `P2` Verificar a chave contra o provedor antes de salvar ("testar conexão")
- [ ] 744 `P2` Aviso de expiração / falha de autenticação atribuída ao mod certo
- [ ] 745 `P2` Chave de um mod não é visível para outro mod
- [ ] 746 `P2` Escopo: mod declara quais chaves usa, e só recebe essas
- [ ] 747 `P2` Rotação de chave sem reeditar cada mod
- [ ] 748 `P2` Importar/exportar o cofre separadamente, com aviso explícito
- [ ] 749 `P2` Cofre opcionalmente cifrado com senha do usuário
- [ ] 750 `P2` Limpar todas as chaves de uma vez ("sair da máquina")
- [ ] 751 `P1` Documentar no `mod.env` gerado que literais são públicos ao exportar
- [ ] 752 `P1` Bloquear salvar em literal algo com cara de segredo (`sk-`, `Bearer`, JWT)
- [ ] 753 `P2` Sugerir converter literal suspeito em referência ao cofre
- [ ] 754 `P2` Herança encadeada com valor padrão (`$CHAVE:-padrao`)
- [ ] 755 `P2` Comentários preservados ao editar o arquivo pela UI
- [ ] 756 `P2` `mod.env.example` gerado no export, para quem importa saber o que preencher
- [ ] 757 `P2` Diff de esquema entre revisões ("+1 chave obrigatória")
- [ ] 758 `P2` Migração quando um mod passa a exigir uma chave nova
- [ ] 759 `P2` Testes de que nenhum caminho de export/sync carrega valor de segredo
- [ ] 760 `P2` Testes de resolução de herança, sobrescrita e chave faltante

## 30 — Arquiteto de Capacidades & Integrações Externas

*Parecer: aqui está o item mais delicado de todo o checklist, e vale dizer por quê antes de
listar tarefas.*

*O Crom Planebox é **100% client-side** — é premissa declarada do projeto (seção 25), e o relay
existe só para sinalização WebRTC. Mods que chamam APIs de terceiros não quebram essa premissa
(a chamada sai do navegador do usuário, não de um servidor do jogo), mas **abrem três frentes
que hoje não existem**:*

1. *Exfiltração. Um mod que lê o mundo e faz `fetch` para um host arbitrário pode mandar para
   fora qualquer coisa que enxergue. O agente escreve o código do mod, e o agente pode ser
   manipulado por injeção de prompt vinda de um mod importado.*
2. *Superfície sensível. Microfone e geolocalização são pedidos do usuário aqui, mas passam a
   ser capacidades que **qualquer** mod poderia solicitar depois.*
3. *Confiança transitiva. Importar mod de terceiro passa a significar executar as integrações
   dele, não só carregar blocos.*

*Nada disso é motivo para não fazer — é motivo para o desenho começar por **capacidades
declaradas e consentidas**, em vez de um `fetch` livre que depois precisaria ser retirado. Sobre
a escala pedida: a horizontal vem das capacidades (cada mod declara as suas, e elas se somam sem
se conhecer); a vertical vem da estrutura do mod, que permanece a hierarquia já existente
(pacote → blocos/entidades/estruturas → env → capacidades).*

**Manifesto de capacidades proposto** (declarativo, no mesmo espírito do `mod.env`):

```jsonc
{
  "capabilities": {
    "network": { "allow": ["api.openweathermap.org", "api.elevenlabs.io"] },
    "microphone": { "reason": "comandos de voz do jogador" },
    "geolocation": { "reason": "clima local para simular a cidade", "precision": "cidade" }
  }
}
```

- [ ] 761 `P0` Manifesto de capacidades por mod, declarativo e versionado
- [ ] 762 `P0` **Allowlist de hosts por mod** — sem host declarado, sem rede
- [ ] 763 `P0` Consentimento explícito do usuário na primeira ativação, host a host
- [ ] 764 `P0` `fetch` do mod passa por um wrapper que aplica a allowlist
- [~] 765 `P0` **Mod não alcança mais o `fetch` global** por acesso direto — com a mesma ressalva do 359
- [ ] 766 `P0` Capacidade sensível (microfone, geolocalização) exige consentimento separado
- [ ] 767 `P0` Revogar capacidade a qualquer momento, sem desinstalar o mod
- [ ] 768 `P0` Log de auditoria: que mod chamou que host, quando, com que volume
- [ ] 769 `P1` Painel mostrando as capacidades ativas por mod, em linguagem simples
- [ ] 770 `P1` Importar mod de terceiro exibe as capacidades pedidas **antes** de instalar
- [ ] 771 `P1` Rate limit e cota de chamadas por mod, por sessão
- [ ] 772 `P1` Timeout e retry com backoff no wrapper, para o jogo não travar na rede
- [ ] 773 `P1` Falha de rede não derruba o mod — degrada para o comportamento offline
- [ ] 774 `P1` Modo offline global desliga toda integração externa de uma vez
- [ ] 775 `P0` **Nada do mundo é enviado sem o mod declarar que envia** (dados de saída também são capacidade)
- [ ] 776 `P1` Resposta de API externa é tratada como **não confiável**: nunca vira código nem instrução para o agente
- [ ] 777 `P1` Sanitizar resposta externa antes de exibir na UI ou no chat
- [ ] 778 `P1` Documentar o modelo de ameaça de mods com rede em `docs/`
- [ ] 779 `P1` CORS: documentar que só APIs com CORS aberto funcionam do navegador
- [ ] 780 `P1` Mensagem clara quando a API falha por CORS, em vez de erro genérico
- [ ] 781 `P1` Cache de resposta por mod, com TTL declarado
- [ ] 782 `P2` Capacidade "áudio de entrada": captura de microfone com indicador visível de gravação
- [ ] 783 `P2` Capacidade "áudio de saída": geração/reprodução de voz
- [ ] 784 `P2` Capacidade "geolocalização" com precisão reduzida por padrão (cidade, não coordenada)
- [ ] 785 `P2` Capacidade "clima" como integração de exemplo, documentada ponta a ponta
- [ ] 786 `P2` Mod de exemplo: cidade que reage ao clima real do jogador
- [ ] 787 `P2` Mod de exemplo: comando de voz mapeado para ferramenta do jogo
- [ ] 788 `P2` Capacidade "LLM próprio": o mod usa um modelo diferente do agente principal
- [ ] 789 `P2` Orçamento de tokens/custo por mod, visível ao usuário
- [ ] 790 `P2` Fila de chamadas externas fora do frame, para não travar o render
- [ ] 791 `P2` Web Worker dedicado para integrações, isolado do `window`
- [ ] 792 `P2` Capacidades compõem sem se conhecer (escala horizontal de verdade)
- [ ] 793 `P2` Registro de capacidades extensível: uma nova não exige mudar o núcleo
- [ ] 794 `P2` Versionar o contrato de capacidade, com migração
- [ ] 795 `P2` Mod declara o que faz **sem** rede, para funcionar degradado
- [ ] 796 `P2` Indicador no HUD quando um mod está usando rede, microfone ou localização
- [ ] 797 `P2` Multiplayer: capacidades do mod do anfitrião não valem no cliente do convidado
- [ ] 798 `P2` Quarentena automática de mod que abusa da cota ou chama host não declarado
- [ ] 799 `P2` Testes de que o wrapper bloqueia host fora da allowlist
- [ ] 800 `P2` Testes de que revogar capacidade interrompe as chamadas em andamento

### Ordem recomendada para esta área

O caminho seguro é o inverso do intuitivo: **não comece pelo `fetch`.**

| Ordem | Itens | Por quê |
|---|---|---|
| 1 | 721–728 | `mod.env` com herança e o cofre separado — sem isso não há onde guardar chave |
| 2 | 724–725, 735–737 | Fechar o vazamento **antes** de existir o que vazar |
| 3 | 761–765 | Manifesto e wrapper de rede com allowlist, já no lugar do `fetch` livre |
| 4 | 763, 766–770 | Consentimento e auditoria, antes da primeira integração real |
| 5 | 785–787 | Só então os exemplos pedidos: clima, voz, cidade reativa |

---

# Adendo — Rodada 5 de requisitos (itens 801–880)

> Requisito: **mods precisam poder executar funções**, não só declarar dados. E o jogo precisa de
> **novas páginas GUI**, entre elas um **editor de código estilo VSCode** que permita manter o
> jogo em tempo real — com os mods e a base do mundo modificáveis com facilidade.

| # | Especialista | Itens | Foco |
|---|---|---|---|
| 31 | Engenheiro de Runtime de Mod | 801–844 | API de funções, hooks, isolamento de erro |
| 32 | Designer de Ferramentas Internas | 845–880 | Páginas GUI e editor de código |

## 31 — Engenheiro de Runtime de Mod

*Parecer: hoje um mod é **só dados** — blocos, entidades, estruturas. Ele descreve o que existe,
nunca o que acontece. Dar comportamento a ele é o que falta para "a IA modificar todo o jogo"
deixar de significar "a IA coloca blocos".*

*Três decisões precisam vir antes do primeiro `eval`:*

*1. **API injetada, não global.** O script recebe um objeto `api` e não enxerga `window`,
`fetch` nem `document`. Hoje `execute_voxel_script` usa `new Function` com o escopo global
vazando (itens 358–359) — repetir isso no runtime de mod multiplicaria o problema por N mods.
A superfície precisa ser uma lista fechada, auditável lendo um arquivo só.*

*2. **Erro de mod não derruba o jogo.** Um erro dentro de `tick` é lançado 60 vezes por segundo:
sem desligamento automático, ele enche o log e come o frame. O script que falhar N vezes sai de
cena sozinho, e o mundo continua.*

*3. **Escrita escopada e atribuída.** Toda alteração feita por script fica registrada como
pertencente àquele mod — é o que faltava nos itens 704–705 para desfazer um mod com precisão.*

**Esboço da superfície** (o que não estiver na lista, o mod não alcança):

```js
api.on('tick', (dt) => { ... })              // load, unload, tick, blockPlaced,
api.on('blockBroken', ({ x, y, z, block }) => { ... })  // blockBroken, playerDamaged,
                                              // entityDeath, dayPhase
api.world.setBlock(x, y, z, 'meu_cristal')   // aceita id, chave do mod ou nome da paleta
api.world.fillBox(x1,y1,z1, x2,y2,z2, 'pedra', true)
api.world.findNearest('diamante', 24)
api.entities.spawn('guardiao', x, y, z)
api.player.position() / .teleport() / .give()
api.ui.toast('...')
api.storage.get/set                           // chave-valor do mod
api.console.log(...)                          // vai para o painel, não para o console do navegador
api.B                                         // paleta base, sem decorar ids
```

- [~] 801 `P0` **Campo `scripts` no `ModPackage`, versionado junto do resto**
- [~] 802 `P0` **API injetada como objeto — sem `window`, `fetch`, `document`, `setTimeout` ou `import`**
- [~] 803 `P0` **Oito eventos: load, unload, tick, blockPlaced, blockBroken, playerDamaged, entityDeath, dayPhase**
- [~] 804 `P0` **`api.on(evento, fn)` registrando handler na carga do script**
- [~] 805 `P0` **Handler protegido — exceção não escapa para o loop do jogo**
- [~] 806 `P0` **Script desligado sozinho após 5 erros, com o motivo no log**
- [~] 807 `P0` **Orçamento de 20.000 blocos por chamada**
- [~] 808 `P0` **Orçamento de 4 ms por frame, somado entre todos os mods**
- [~] 809 `P0` **Bloco escrito por script é gravado com a autoria do mod (`blockMods.modId`)**
- [~] 810 `P0` **`deleteMod` desfaz por autoria **e** por tipo — pedra do jogador não é arrastada junto**
- [~] 811 `P1` **`api.world`: getBlock, setBlock, fillBox, getGroundY, findNearest**
- [~] 812 `P1` **Referência de bloco por id, chave do mod ou nome da paleta**
- [~] 813 `P1` **`api.entities`: spawn de espécie do próprio mod, list, damage**
- [~] 814 `P1` **`api.player`: position, teleport, health, give**
- [~] 815 `P1` **`api.ui.toast` com limite de tamanho**
- [~] 816 `P1` **`api.storage` chave-valor por mod, isolado**
- [~] 817 `P1` **`api.console` no log do mod, limitado a 300 linhas**
- [~] 818 `P1` **`api.B` com a paleta base**
- [~] 819 `P1` **Recarregar script sem reiniciar o mundo**
- [~] 820 `P1` **`unload` disparado antes de recarregar**
- [~] 821 `P1` **Handlers removidos ao recarregar — sem duplicação**
- [ ] 822 `P1` Ordem de execução previsível entre mods (por ordem de carga)
- [~] 823 `P1` **`set_mod_script_enabled` desliga um script sem desabilitar o mod**
- [~] 824 `P1` **`define_mod_script` — compila e carrega na mesma chamada**
- [ ] 825 `P1` Ferramenta MCP `run_mod_script` para testar sem instalar
- [~] 826 `P1` **Erro de script devolvido ao agente na mesma volta, mais `get_mod_script_logs`**
- [ ] 827 `P2` `api.world.queryRegion` devolvendo histograma de blocos
- [~] 828 `P2` **`api.time`: fração do dia e `isNight()`**
- [ ] 829 `P2` `api.random` semeado pelo mundo, para script determinístico
- [ ] 830 `P2` `api.recipes` para registrar receita de crafting
- [ ] 831 `P2` `api.biomes` para registrar bioma (liga com a seção 27)
- [ ] 832 `P2` `api.scatter` para registrar construção espalhada
- [ ] 833 `P2` `api.commands` para registrar comando de chat
- [ ] 834 `P2` `api.hud` para desenhar indicador próprio
- [ ] 835 `P2` Tipagem TypeScript da API publicada, para autocomplete no editor
- [ ] 836 `P2` Documentação da API gerada a partir do próprio código
- [ ] 837 `P2` Script rodando em Web Worker (junta com 358–359)
- [ ] 838 `P2` Perfilador: quanto tempo cada mod consome por frame
- [ ] 839 `P2` Desligar automaticamente o mod que estoura o orçamento de frame
- [ ] 840 `P2` Multiplayer: script roda só no anfitrião, resultado replica
- [ ] 841 `P2` Sandbox de permissões por script (liga com a seção 30)
- [~] 842 `P2` **Testes de isolamento: mod que lança exceção não afeta os outros**
- [~] 843 `P2` **Testes do desligamento automático após N erros**
- [~] 844 `P2` **Testes de que a API não expõe global implícito nem evento inexistente**

## 32 — Designer de Ferramentas Internas (páginas GUI)

*Parecer: o jogo tem menu, pausa, inventário e chat — tudo voltado a **jogar**. Não há nenhuma
tela voltada a **manter o jogo**. Hoje, ver o que um mod contém, voltar uma versão ou entender
por que um mod foi isolado só é possível pedindo à IA, o que é um caminho indireto para uma
informação que deveria estar à mão.*

*Sobre o editor estilo VSCode: a escolha de biblioteca importa mais do que parece. Monaco é
literalmente o editor do VSCode, mas pesa ~5 MB e é difícil de empacotar com Vite; num jogo que
hoje entrega 853 KB, ele seria o maior componente do produto. **CodeMirror 6** dá o essencial —
numeração de linha, destaque de sintaxe, dobra, autocomplete — em ~150 KB gzipado, com
empacotamento limpo. Um editor feito à mão (textarea + overlay) evita a dependência e é
coerente com o resto do projeto, que é todo artesanal, mas não entrega autocomplete nem
diagnóstico, que é justamente o que torna a manutenção em tempo real viável.*

*Recomendação: CodeMirror 6, carregado sob demanda (`import()` dinâmico) para não pesar no boot
de quem nunca abre o editor.*

- [~] 845 `P0` **Página de Mods: lista, conteúdo, ativar/desativar, quarentena com motivo — `src/ui/ModsPage.ts`**
- [~] 846 `P0` **Histórico de versões na página, com rollback em um clique**
- [~] 847 `P0` **Exportar/importar mod pela página, sem passar pela IA**
- [ ] 848 `P1` Qual sessão de chat originou o mod, com link para abri-la
- [~] 849 `P1` **Aviso visual de mod em quarentena, com o erro legível**
- [~] 850 `P0` **Página de Editor com árvore de arquivos do mod — `src/ui/CodeEditorPage.ts`**
- [~] 851 `P0` **CodeMirror 6 carregado sob demanda (chunk separado de ~489 KB, fora do boot)**
- [~] 852 `P0` **Salvar gera nova revisão do mod**
- [~] 853 `P0` **Executar/recarregar o script sem reiniciar o mundo**
- [~] 854 `P0` **Painel de console mostrando `api.console` e erros do script**
- [ ] 855 `P1` Erro aponta linha e coluna, com salto para o ponto no editor
- [ ] 856 `P1` Autocomplete da API do mod (usa a tipagem do item 835)
- [ ] 857 `P1` Editar também o `mod.env` pela mesma árvore (seção 29)
- [ ] 858 `P1` Editar as definições de bloco/entidade/estrutura como JSON no editor
- [ ] 859 `P1` Validação ao salvar, recusando JSON inválido antes de gravar
- [~] 860 `P1` **Ctrl+S salva e recarrega**
- [ ] 861 `P1` Buscar e substituir dentro do arquivo
- [~] 862 `P1` **Estado do editor preservado ao fechar e reabrir**
- [ ] 863 `P1` Editor não bloqueia o jogo: pausa opcional enquanto está aberto
- [ ] 864 `P2` Diff entre a versão salva e a editada, antes de salvar
- [ ] 865 `P2` Desfazer/refazer com histórico próprio do editor
- [ ] 866 `P2` Modelos de script prontos (reagir a bloco, gerar estrutura, ciclo do dia)
- [~] 867 `P2` **Modelo de script inserido em todo script novo**
- [ ] 868 `P2` **Página de Diagnóstico**: FPS, chunks, entidades, memória, custo por mod
- [ ] 869 `P2` **Página de Mundo**: semente, hora, regras, distância de render, regenerar região
- [ ] 870 `P2` **Página de Blocos**: navegar a paleta, ver propriedades, ir até um bloco no mundo
- [ ] 871 `P2` **Página de Entidades**: listar, seguir, remover, editar espécie
- [ ] 872 `P2` **Página de Rede**: peers, latência, o que está sendo sincronizado
- [~] 873 `P2` **Navegação unificada entre as páginas, com atalho único (ESC)**
- [~] 874 `P2` **Páginas registradas no `UIManager` como telas bloqueantes (F6 e F7)**
- [ ] 875 `P2` Páginas acessíveis por teclado, com foco visível
- [ ] 876 `P2` Tema claro/escuro consistente entre as páginas
- [ ] 877 `P2` As páginas respeitam a customização de UI feita pela IA
- [ ] 878 `P2` Editor aberto em modo somente-leitura para mod importado de terceiro
- [ ] 879 `P2` Aviso ao editar mod sincronizado no multiplayer
- [ ] 880 `P2` Testes de que salvar no editor gera revisão e não corrompe o pacote
## 33 — Redator Técnico do Agente (documentação da API para a IA)

*Parecer: de nada adianta a API existir se o agente não souber que ela existe. E o agente não lê
o repositório a cada mensagem — ele lê o **prompt do sistema** e as **descrições das ferramentas**.
Toda capacidade que não aparecer nesses dois lugares é, na prática, inexistente para ele.*

*Isso já aconteceu neste projeto: `registerCustomBlock` existia há tempos e a IA continuava
gerando blocos efêmeros, porque nada no prompt dizia como usá-la corretamente. A documentação
aqui não é cortesia — é o mecanismo de ativação da funcionalidade.*

- [~] 881 `P0` **Seção de script no prompt do sistema, com o fluxo completo**
- [~] 882 `P0` **Cada evento documentado com o formato do payload**
- [~] 883 `P0` **Cinco exemplos executáveis — e um teste garante que compilam**
- [~] 884 `P0` **Documentado que a sessão define o mod e que a escrita é escopada**
- [~] 885 `P0` **Documentado explicitamente o que **não** existe (fetch, window, setTimeout, import)**
- [~] 886 `P0` **`get_mod_api_reference` devolvendo a superfície completa sob demanda**
- [ ] 887 `P1` `docs/MOD_API.md` como fonte única, e o prompt referenciando-a
- [ ] 888 `P1` Referência gerada a partir do código, para não divergir silenciosamente
- [~] 889 `P1` **Teste que falha se um evento sumir da referência entregue à IA**
- [~] 890 `P1` **Erros do runtime citando o script e a mensagem original**
- [ ] 891 `P1` `get_session_context` incluindo o que o mod atual já registra (eventos, scripts)
- [ ] 892 `P1` Receitas prontas: "reagir a bloco quebrado", "gerar estrutura", "ciclo do dia"
- [ ] 893 `P1` Documentar o orçamento de blocos e de tempo, para o agente dividir a tarefa
- [ ] 894 `P2` Documentar como ler outros mods sem poder alterá-los
- [ ] 895 `P2` Changelog da API versionado, para mods antigos continuarem válidos
- [~] 896 `P2` **Seção de erros comuns na referência**
- [ ] 897 `P2` Guia de arte e de escala junto da API (proporção do jogador em mini-voxels)
- [~] 898 `P2` **Documentação em português, alinhada ao projeto**
- [ ] 899 `P2` `list_recent_errors` correlacionando erro com a função da API envolvida
- [ ] 900 `P2` Teste de que toda função pública da API aparece na documentação

---

# 🎯 Ordem de execução recomendada

> Análise pedida: **o que precisa ser feito primeiro.** São 900 itens; a ordem abaixo é a que
> maximiza o que fica protegido e utilizável a cada etapa, não a que entrega mais features.

## Onda 0 — Proteger o que já existe `~1 rodada`

*Barato, e sem isso todo o resto anda sobre areia.*

| Item | Por quê agora |
|---|---|
| 514 CI (`tsc --noEmit` + `vitest run`) | Há **285 testes** e nada os executa automaticamente. Uma regressão passa despercebida até alguém rodar à mão |
| 276 Migração de save versionada | O schema foi de v2 a **v6 em poucos dias**. Não existe caminho de migração: um usuário com mundo antigo é risco real de perda de dados |
| 277 Backup antes de migrar | Consequência direta do anterior |
| 278 Verificação de integridade no load | A quarentena de mod já cobre parte; falta o mesmo para blocos e entidades órfãos |

## ✅ Onda 1 — CONCLUÍDA

*O objetivo do projeto é "a IA modificar todo o jogo com save no mundo". Um mod era **só dados**:
descrevia o que existe, nunca o que acontece. Agora tem comportamento.*

| Entregue | O que mudou |
|---|---|
| 801–810 | Runtime com API injetada, isolamento, orçamento e autoria de bloco |
| 811–821, 823, 828 | Superfície de funções: mundo, entidades, jogador, tempo, storage, console |
| 824, 826 | `define_mod_script` compila e carrega **na mesma chamada** — o agente recebe o erro na hora |
| 881–886, 889 | `get_mod_api_reference` + seção no prompt, com teste que falha se a doc divergir do código |

**Bug encontrado pelo próprio teste:** cada handler fecha sobre o `api` recebido na compilação,
mas o despacho construía um `api` novo a cada evento e drenava o objeto errado. Resultado: bloco
colocado dentro de um evento nunca era salvo nem sincronizado. Corrigido reaproveitando uma
instância por script.

## Onda 1 (registro original) — Fechar a lacuna que o próprio objetivo declara

*O objetivo do projeto é "a IA modificar todo o jogo com save no mundo". Hoje um mod é só
**dados**: descreve o que existe, nunca o que acontece. Esta é a lacuna central que sobrou.*

| Item | Por quê agora |
|---|---|
| 801–810 Runtime de mod | API injetada, isolamento de erro, orçamento, atribuição de blocos |
| 809–810 + 704–705 | Bloco alterado por script fica atribuído ao mod → reverter passa a ser exato |
| 824–826 Ferramentas de script | Sem elas o agente não alcança o runtime |
| **881–886 Documentação para o agente** | **Capacidade não documentada no prompt é capacidade inexistente.** Já aconteceu aqui: `registerCustomBlock` existia e a IA seguia gerando blocos efêmeros |

## ✅ Onda 2 — CONCLUÍDA

| Entregue | O que mudou |
|---|---|
| 845–849 | Página de Mods (F6): conteúdo, versões, rollback em um clique, export/import, quarentena legível |
| 850–854, 860 | Editor de código (F7) com CodeMirror sob demanda, Ctrl+S salva→revisão→recarrega, console ao vivo |
| 918–919 | Cache de rotas do A*, com estatística de acerto e invalidação ao alterar o mundo |

O CodeMirror ficou em chunks separados (~489 KB) carregados só ao abrir o editor; o bundle
principal subiu 53 KB. Quem nunca abre o editor não paga nada no boot.

## Onda 2 (registro original) — Tornar o jogo mantenível

*Versionamento, rollback e quarentena existem, mas só a IA os alcança. O usuário não tem como
ver o que um mod contém nem voltar uma versão sem pedir a ela.*

| Item | Por quê agora |
|---|---|
| 845–849 Página de Mods | Expõe o que já foi construído: conteúdo, versões, rollback, quarentena |
| 850–855 Editor de código | Viabiliza a manutenção em tempo real pedida |
| 857 Editar `mod.env` na mesma árvore | Só depois da Onda 3 ter definido o formato |

## Onda 3 — Segredos antes de integrações `~1 rodada`

*A ordem aqui é contraintuitiva de propósito: **fechar o vazamento antes de existir o que vazar**.*

| Item | Por quê nesta ordem |
|---|---|
| 721–728 `mod.env` + cofre | Sem cofre não há onde guardar chave |
| 724–725, 735–737 | `export_mod` e `mod_sync` **já existem**: no dia em que um mod puder guardar valor de credencial, os dois viram vazamento automático |
| 761–765 Manifesto + wrapper de rede | Substituir o `fetch` livre **antes** da primeira integração, não depois — retirar permissão concedida quebra mod existente |
| 785–787 Exemplos (clima, voz, cidade) | Só aqui, com o cerco já fechado |

## Onda 4 — Dar motivo para explorar `~2 rodadas`

*O mundo tem cavernas, minérios e inimigos, mas a superfície é homogênea e não há nada para
encontrar. Falta a razão de andar até o horizonte.*

| Item | Por quê |
|---|---|
| 665–669 Biomas com recursos exclusivos | Desenho já registrado na seção 27; é o que obriga a expedição |
| 681–684 Construções espalhadas | Hoje não existe nada para descobrir explorando |
| 676–677, 689–690 | Biomas e espalhamento registráveis por mod — a base pedida para o agente |

## ✅ Onda 5 — desempenho e áudio concluídos

| Entregue | Resultado |
|---|---|
| 477–494 | Áudio sintetizado: o jogo deixou de ser mudo |
| 961–969 | Regressões de luz corrigidas: 69 ms → ~11 ms por bloco, e enfileirado |
| 403/971 | Malha em Web Worker, com bundle do worker em 7,5 KB |
| 972/404 | Buffers de malha reciclados entre thread e worker |
| 982/990 | Tela inicial como página: simulação suspensa e canvas escondido |
| 970/974/408 | Painel F3 medindo o frame **no navegador**, com custo por sistema |

**Ressalva que continua valendo:** os ganhos acima foram medidos em bancada (Node). O painel F3
existe justamente para conferir isso no navegador — mas essa conferência ainda não foi feita
com o jogo rodando de verdade.

## Onda 5 (registro original) — em andamento

**Áudio (477–494): entregue.** O jogo deixou de ser mudo. Tudo sintetizado via Web Audio —
o projeto não tem asset de som, e trazê-los custaria megabytes num bundle de 900 KB.

Duas decisões que valem registrar:

- **`materialOf` deriva o som das propriedades do bloco**, não de uma tabela por id. Um bloco
  criado por mod herda som coerente sem declarar nada; sem isso, todo bloco novo soaria como pedra.
- **A especificação é pura** (`synth.ts` devolve parâmetros, não toca nada). Dá para testar que
  vidro é mais brilhante que terra sem abrir navegador.

Falta: ambiência por bioma (481), música por contexto (482), reverb em caverna (486).

## Onda 5 (registro original) — Pilares ausentes e desempenho

| Item | Nota |
|---|---|
| 477–494 Áudio | **Pilar inteiro ausente.** O jogo é mudo: sem som de passo, de quebra ou de dano |
| 403 Mesh em worker | O re-mesh do ciclo dia/noite tornou o custo visível |
| 358–359 Sandbox em Worker | Junta com 837; pré-requisito para compartilhar mod de terceiro |
| 609 Sync de entidades no P2P | Última lacuna grande do multiplayer |
| 130, 148 Armadura e arco | Combate existe, mas defender-se e atacar à distância ainda não são decisão |
| 053–054 AO por vértice e neblina | Os dois itens que faltam para fechar a estética alvo |

## O próximo passo, em uma linha

**Onda 0 inteira** — CI e migração de save. São as duas coisas que, se continuarem faltando,
transformam qualquer avanço futuro em risco: a primeira deixa regressão passar, a segunda deixa
mundo de usuário quebrar a cada mudança de schema.

---

# Anexo — Avaliação do `crompressor.wasm`

> Pedido: avaliar se o `crompressor` ajuda em desempenho e segurança, inclusive na troca de
> dados P2P — e se a deduplicação ajudaria também em blocos e outras áreas.
>
> **Resposta curta: nos dados deste jogo, não.** O gzip nativo do navegador venceu em todos os
> cenários medidos, inclusive no cenário que o crompressor foi desenhado para atacar. Abaixo o
> que foi medido, o porquê provável, e o que fazer com essa informação.

## O que o binário é

`github.com/MrJc01/crompressor`, Go 1.25.7, **10,9 MB**. Arquitetura interna:

| Componente | Função |
|---|---|
| `pkg/cromlib` | `PackBytes` / `UnpackBytes` / `Metrics` |
| `internal/chunker` | fatiamento em blocos de conteúdo |
| `internal/codebook` | dicionário compartilhado (`OpenFromBytes`, `ParseHeader`) |
| `internal/search` | LSH, distância de Hamming (com caminho SIMD), similaridade |
| `internal/delta` | `XOR`, `ApplyPatch`, pools zstd |
| `internal/crypto` | `Decrypt`, `DeriveKey` |
| `internal/entropy`, `internal/fractal` | Shannon, polinômios |

API exposta ao JS: **`cromPack(bytes)` e `cromUnpack(bytes)`**, ambas sem parâmetros extras,
retornando `{ ok, data }`.

## Medições

Todas com round-trip verificado (`unpack(pack(x)) === x`). Comparadas com gzip, que no navegador
é `CompressionStream` — **nativo, zero byte de download**.

| Cenário | gzip | crompressor |
|---|---|---|
| `full_sync` JSON, 40k blocos (1,5 MB) | **10,8x** · 20 ms | 4,0x · 292 ms |
| 1 chunk de terreno (128 KB) | **780x** · 1 ms | 2,7x · 41 ms |
| 16 chunks vizinhos quase iguais (2 MB) | **246x** · 6 ms | 2,7x · 204 ms |
| 48 chunks realistas, separados (6 MB) | **15,3x** · 103 ms | 2,3x · 1780 ms |
| 48 chunks realistas, juntos (6 MB) | **15,4x** · 91 ms | 2,3x · 1146 ms |
| 24 versões quase idênticas (9,4 MB) | **30,1x** · 56 ms | 20,4x · 2424 ms |

## Correção: o que o crompressor é

Registro um erro meu antes da análise. Numa primeira leitura descrevi o crompressor como
"compressor de domínio para pesos de LLM e tensores". **Está errado.** Peguei uma linha de
benchmark num README lido dentro de um projeto de artigo (`crom-artigo-dnai-jl/`), tratei-a como
se fosse a finalidade do projeto, e repeti isso por duas rodadas — generalizei a partir de uma
fonte que não é a declaração de propósito.

A declaração de propósito é o artigo do autor: *"A ilusão da compressão: por que o Crompressor
não é o novo gzip, e sim um Git para dados (CDN, P2P)"*.

**O que ele é:** um motor de **deduplicação com dicionário estático compartilhado**. O modelo é o
do Git e o do CAS (content-addressable storage): treina-se um `.cromdb` sobre dados históricos,
distribui-se esse dicionário aos nós **uma vez**, e a partir daí um bloco reconhecido viaja como
um identificador de 24 bytes em vez do conteúdo. O ganho não está em espremer bytes — está em
**não retransmitir o que o outro lado já consegue reconstruir**.

Os números do autor, no modo pretendido:

| Benchmark | Resultado |
|---|---|
| V5 (chunks de 128 B) | 80,5% de redução de tráfego — o limite dado o overhead de 24 B por chunk |
| V6 (chunks de 4 KB) | 460,81 MB → **2,81 MB (99,38%)** em projetos reais |

Casos declarados como bons: sincronizar imagens Docker por CDN, quadros de CCTV, ISOs de VM,
deduplicação massiva de logs. Casos declarados como ruins: arquivo único sem redundância,
formatos já comprimidos, e **compressão tradicional em sistema isolado** — que é exatamente o
que eu havia medido.

## Por que minha medição não respondeu à pergunta certa

A tabela acima testou **empacotamento autônomo**: cada payload comprimido sozinho, sem dicionário
compartilhado e sem segundo nó. O próprio autor classifica esse uso como inadequado e registra
que nele o arquivo chega a **inflar (125% do original)**.

Os números que medi são coerentes com o que o projeto diz sobre uso isolado. **A medição estava
correta; a pergunta é que estava errada.**

## Segunda correção: eu estava errado, e a medição prova

Eu havia afirmado duas coisas que não se sustentam:

1. *"Não há um segundo nó com dado repetido para deduplicar contra."* — **Falso.** O jogo tem
   multiplayer P2P: o anfitrião roda o mundo e os convidados são a outra ponta. São nós reais.
2. *"Não há plataforma de distribuição."* — **Falso na prática.** O dicionário pode ser enviado
   uma vez pelo anfitrião no `full_sync`, exatamente como o modelo do artigo prevê.

O erro de método foi pior que o de fato: eu testei só o `full_sync` — **um payload grande** — e
concluí sobre o modelo inteiro. Nesse payload o LZ77 do gzip já enxerga a repetição sozinho,
porque tudo está na mesma janela. O regime onde o dicionário compartilhado ganha é o oposto:
**muitas mensagens pequenas**, cada uma curta demais para o compressor achar repetição dentro
dela. E esse é justamente o tráfego real de uma partida.

### Medição no tráfego real de partida

6.000 mensagens (3.000 `block_update` + 3.000 `player_state`), média de 211 bytes cada,
totalizando 1.235 KB:

| Estratégia | Tráfego | Ganho | Nota |
|---|---|---|---|
| **Hoje** (JSON texto puro) | 1.235 KB | 1,0x | mensagem pequena não é comprimida |
| gzip por mensagem | 965 KB | 1,28x | o cabeçalho quase anula o ganho |
| crompressor sem codebook | 988 KB | 1,25x | e 2,6 s para 300 mensagens |
| **deflate + dicionário compartilhado** | **163 KB** | **7,60x** | ← o modelo do artigo funciona |
| **binário por opcode** | **105 KB** | **11,71x** | 5 ms, zero dependência |
| binário + gzip em lote | 10,4 KB | 119x | quando dá para agrupar |

**O modelo está certo.** Dicionário compartilhado entre nós entrega 7,6x onde o gzip entrega
1,28x. A tese central do crompressor — *não retransmitir o que o outro lado consegue
reconstruir* — se confirma neste jogo, e no ponto que eu havia descartado.

### O que foi implementado a partir disso

O modelo validado virou código (itens 922-924), com a implementação nativa:

| Medida | Resultado |
|---|---|
| `block_update` isolado | 9 bytes, contra ~80 do JSON |
| `player_state` | aparência saiu do pacote; sobrou o hash de 4 bytes |
| Tráfego de partida (600 mensagens) | **5,3x** menor que o que era enviado antes |
| Construção de 800 blocos num frame | **7,9x** menor, com um cabeçalho em vez de 800 |

Texto e binário convivem no mesmo canal, distinguidos pelo primeiro byte — então um peer de
versão anterior, que só fala JSON, continua sendo entendido.

### O que isso muda na decisão

Duas coisas separadas, que eu vinha misturando:

**A ideia:** validada, e vale implementar. É ganho de 7 a 12x num tráfego que hoje vai cru.

**A ferramenta:** continua não sendo testável aqui, mas por um motivo concreto e específico —
`cromPack(bytes)` **não tem parâmetro para receber o codebook**. Sem isso, o modo que o artigo
descreve não é alcançável a partir do WASM publicado. O que medi (1,25x) é o modo isolado, que o
próprio autor classifica como mau uso.

**A melhor implementação para este caso é um codebook especializado:** o "dicionário" é o próprio
esquema das mensagens, que os dois lados já conhecem por serem o mesmo programa. Em vez de
transmitir nomes de campo, transmite-se um opcode e os valores em binário — 11,71x, nativo, sem
dependência e sem download. É a mesma ideia do crompressor, especializada num domínio onde o
esquema é conhecido de antemão.

## O ponto do artigo que mais interessa a este projeto

A afirmação de **12,7x ao injetar o motor em simulações em RAM (pathfinding, física),
deduplicando estados matemáticos repetidos** é a mais aplicável — e não tem relação com tamanho
de arquivo.

Este projeto acabou de ganhar A* (`src/entities/Pathfinding.ts`), com vários mobs recalculando
rota contra o mesmo jogador, no mesmo terreno, a cada 0,35 s. São estados repetidos, hoje
recomputados do zero. É memoização de estado — parente direto da deduplicação — e é mensurável
sem depender de plataforma nenhuma.

## Decisão tomada nesta rodada

Implementado com **gzip nativo** (`CompressionStream`), não com o WASM — mas a razão principal
não é mais a razão de compressão, e sim a arquitetura:

1. **A redundância que o crompressor elimina já não existe aqui.** O `full_sync` transmite só as
   alterações do jogador; o terreno o convidado regenera da semente. Não há um segundo nó com
   dado repetido para deduplicar contra.
2. **Não há plataforma de distribuição.** O modelo do artigo pressupõe nós que compartilham um
   codebook treinado. Com um usuário e um navegador, falta o outro nó.
3. **10,9 MB é 13x o bundle inteiro do jogo** (853 KB). Mesmo que 1 e 2 fossem resolvidos, o
   custo de download precisaria ser pago por um ganho que ainda não foi medido neste domínio.

Nenhum desses três pontos é sobre o crompressor ser bom ou ruim — é sobre este jogo, hoje, não
ter o problema que ele resolve. Os itens 918-921 registram o que mudaria essa conclusão.

- [~] 901 `P0` **Compressão do `full_sync` com `CompressionStream` nativo**
- [~] 902 `P0` **Fragmentação de mensagem grande no P2P** — `src/net/wire.ts`
- [~] 903 `P0` **Correção: mensagem acima de ~256 KB derrubava o DataChannel** — quanto mais o anfitrião construía, menor a chance de um convidado conseguir entrar
- [~] 904 `P1` **Remontagem por peer, com descarte de conjunto abandonado**
- [~] 905 `P1` **Mensagem pequena segue como texto puro** (compatível com peer antigo)
- [~] 906 `P1` **21 testes de enquadramento, fragmentação e remontagem**
- [ ] 907 `P1` Medir o ganho real de banda numa sessão P2P de verdade, e registrar
- [ ] 908 `P2` Comprimir também o save de blocos no IndexedDB (mesma função, outro consumidor)
- [ ] 909 `P2` Comprimir o export de mundo e de mod
- [ ] 910 `P2` Delta entre revisões de mod, em vez de snapshot inteiro (ver item 645)
- [ ] 911 `P2` **Reavaliar o crompressor quando `cromPack` aceitar codebook** — o segundo nó existe (anfitrião/convidados); o que falta é a API expor o dicionário
- [~] 922 `P0` **Protocolo binário por opcode — `src/net/codec.ts`, medido 4,4x no pacote e 7,9x no lote**
- [~] 923 `P1` **Aparência enviada só quando muda; nos demais pacotes viaja apenas o hash de 4 bytes**
- [~] 924 `P1` **`block_update` do mesmo frame agrupados em `block_batch` — um cabeçalho em vez de N**
- [ ] 925 `P2` Avaliar dicionário compartilhado (deflate com `dictionary`) para o que sobrar em texto
- [ ] 926 `P2` Medir o ganho real numa sessão P2P de verdade, não em bancada
- [ ] 915 `P3` Medir o cenário de codebook compartilhado: treinar sobre chunks reais, distribuir uma vez, e comparar só o tráfego de índices contra gzip
- [ ] 916 `P3` Pré-requisito do anterior: expor `cromPack(bytes, codebook, modo)` no WASM — a API atual não recebe nenhum dos três
- [ ] 917 `P3` Resolver a distribuição do codebook entre peers (ele próprio é grande, e vira um problema de sync)
- [~] 918 `P1` **Cache de rotas do A* com TTL e invalidação ao alterar o mundo**
- [~] 919 `P2` **Estatísticas de acerto do cache expostas por `getPathCacheStats`**
- [ ] 920 `P3` Reavaliar o crompressor **se** surgir uma galeria de mods/mundos — aí existe o segundo nó contra o qual deduplicar
- [ ] 921 `P2` Documentar que o `full_sync` já elimina a redundância por regeneração via semente (o dicionário custa 4 bytes)
- [ ] 912 `P2` Isolar segredo de dado de terceiro em fluxos comprimidos distintos (CRIME/BREACH)
- [ ] 913 `P2` Documentar em `docs/NETWORK_PROTOCOL.md` o formato de quadro e o limiar de fragmentação

---

# Adendo — Rodada 6 de requisitos (itens 927–960)

> Duas lacunas levantadas por pergunta direta, e ambas confirmadas ausentes:
> **voz nativa entre jogadores** (o microfone só existia como capacidade de mod) e **ver o
> próprio corpo em primeira pessoa** (havia só "braços na tela", item 594, ainda pendente).

## 34 — Engenheiro de Voz P2P

*Parecer: esta é a feature com a melhor relação entre valor e esforço de todo o checklist, e
estava faltando. O motivo é que metade do trabalho já está feito: o `RTCPeerConnection` do
`PeerSync` existe, e o WebRTC transporta **áudio nativamente** — foi para isso que ele nasceu.
Não é preciso codec, nem servidor, nem buffer de jitter: basta acrescentar uma track à conexão
que já está aberta.*

*Duas coisas precisam ser bem feitas, porém, e nenhuma é técnica:*

*1. **Microfone é privacidade, não feature.** O padrão tem de ser desligado, com indicador
visível de que está captando. "Sempre ligado" numa sessão com estranhos é inaceitável, e
push-to-talk resolve isso melhor que qualquer configuração.*

*2. **A permissão é do navegador, e é uma vez só.** Pedir `getUserMedia` no momento errado (no
boot, por exemplo) queima a chance: o usuário nega, e o navegador lembra da negativa. Só pedir
quando ele clicar no botão.*

- [ ] 927 `P0` Botão de microfone no HUD, **desligado por padrão**
- [ ] 928 `P0` Push-to-talk numa tecla dedicada, além do modo alternado
- [ ] 929 `P0` Indicador visível enquanto está captando — nunca captar sem sinal na tela
- [ ] 930 `P0` `getUserMedia` pedido só ao clicar no botão, nunca no boot
- [ ] 931 `P0` Track de áudio adicionada à `RTCPeerConnection` já existente (sem servidor)
- [ ] 932 `P0` Renegociação da conexão ao ligar/desligar o microfone no meio da partida
- [ ] 933 `P1` Mensagem clara quando a permissão é negada, com como reverter
- [ ] 934 `P1` Volume por jogador, e silenciar um jogador específico
- [ ] 935 `P1` Indicador de quem está falando na lista de jogadores
- [ ] 936 `P1` Voz atenuada por distância no mundo (áudio posicional entre jogadores)
- [ ] 937 `P1` Canal de volume próprio para voz, separado de efeitos e música
- [ ] 938 `P1` Supressão de ruído e cancelamento de eco (`echoCancellation`, `noiseSuppression`)
- [ ] 939 `P1` Detecção de silêncio para não transmitir quando ninguém fala
- [ ] 940 `P2` Voz continua funcionando se o anfitrião sair (junta com migração de host)
- [ ] 941 `P2` Silenciar a si mesmo com atalho único, sempre disponível
- [ ] 942 `P2` Indicador de nível de entrada, para o jogador saber se o microfone pegou
- [ ] 943 `P2` Aviso no HUD de que a voz é P2P direta, sem passar por servidor
- [ ] 944 `P2` Limite de participantes com voz simultânea
- [ ] 945 `P2` Testes do ciclo ligar/renegociar/desligar sem derrubar a conexão de dados

## 35 — Diretor de Presença em Primeira Pessoa

*Parecer: o jogo começa em primeira pessoa (item 567) e o modelo do personagem existe e é
completo (557–566), mas em primeira pessoa ele é **totalmente ocultado**. A razão foi correta na
época — a câmera fica dentro da cabeça, e o modelo apareceria como uma parede de textura na
tela. Mas a solução usada é grosseira: esconder tudo. O resultado é que o jogador não tem corpo.*

*O que se faz de verdade: esconder **só a cabeça**, e manter o resto. Aí olhar para baixo mostra
tronco, pernas e pés — que é o que dá presença física. Braços e ferramenta na tela (item 594) são
um problema separado, porque em primeira pessoa eles usam poses exageradas que não correspondem
ao esqueleto real.*

- [~] 946 `P0` **Em primeira pessoa some **apenas a cabeça** — `setPrimeiraPessoa`**
- [~] 947 `P0` **Olhar para baixo mostra tronco, pernas e botas do próprio personagem**
- [~] 948 `P0` **Sem buraco no pescoço: o tronco já termina acima da linha do pescoço**

Dois detalhes que só aparecem implementando:

- **O corpo não gira com o olhar vertical em primeira pessoa.** O `pitch` move a cabeça, que está
  oculta; passá-lo adiante giraria o tronco inteiro e o jogador veria o próprio peito ao olhar
  para cima. Em primeira pessoa o modelo recebe `pitch = 0`.
- **`build()` recria os pivôs**, então a visibilidade precisa ser reaplicada depois. Sem isso,
  trocar de cor na tela de customização faria a cabeça reaparecer na frente da câmera — há teste.

No modo fantasma o corpo some por inteiro, de propósito: ali o jogador atravessa parede, e ver o
próprio corpo passando por dentro de blocos entregaria a ilusão.

- [ ] 949 `P1` Braços em primeira pessoa com pose própria, não a do esqueleto de terceira pessoa
- [ ] 950 `P1` Ferramenta equipada visível na mão, acompanhando a hotbar
- [ ] 951 `P1` Animação de golpe e de quebrar bloco na visão de primeira pessoa
- [ ] 952 `P1` Balanço sutil ao caminhar, com opção de desligar (junta com o redutor de movimento, item 438)
- [ ] 953 `P1` A cor do corpo em primeira pessoa é a mesma da customização — sem divergir
- [ ] 954 `P2` Sombra do próprio personagem visível no chão
- [ ] 955 `P2` Modo fantasma mantém o corpo translúcido, distinguindo-se da primeira pessoa normal
- [ ] 956 `P2` Braço direito e esquerdo distintos, conforme o item na mão
- [ ] 957 `P2` Reação visual ao levar dano na primeira pessoa
- [ ] 958 `P2` Ver o corpo dentro da água com a distorção do fluido
- [ ] 959 `P2` Opção de esconder o corpo, para quem preferir a visão limpa
- [ ] 960 `P2` Testes de que a cabeça está oculta em 1ª pessoa e visível em 3ª

---

# Adendo — Desempenho e interface (itens 961–1000)

> Relato do usuário: *"está muito muito travado"*, *"a GUI ainda não melhorou, não tem uma
> página só do menu inicial"*, *"às vezes dou ESC e não consigo voltar a ter o mouse fixo"*.
>
> As duas primeiras causas de travamento foram **regressões introduzidas por mim** nas rodadas
> de luz e de mods. Ficam registradas com o que era e o que virou.

## 36 — Auditoria de desempenho (rodada de correção)

*Diagnóstico: colocar **um** bloco disparava um recálculo de luz síncrono que zerava 9.261
células, re-semeava 441 colunas inteiras de 128 voxels, e ainda marcava 9 chunks para re-mesh.
Cada acesso à luz montava uma string (`chunkKey`) — mais de 100 mil concatenações por clique. E o
mesher chamava `Math.pow` uma vez por face.*

| Correção | Antes | Depois |
|---|---|---|
| `recalcRegion` (raio 8) | **69 ms** por bloco colocado | **~11 ms**, e enfileirado |
| Custo por frame ao construir | 42 ms (travando) | **2,8 ms** espalhado |
| Consulta de luz no mesher | `Math.pow` por face | tabela de 256 entradas — **16x** |
| Acesso a `getLight/setLight` | string por voxel | cache do último chunk |
| Chunks marcados por alteração | sempre 9 | só os que a região toca |

- [~] 961 `P0` **`recalcRegion` deixou de re-semear colunas inteiras** — lê o sol que chega no teto da caixa
- [~] 962 `P0` **Fila de relight com orçamento de uma região por frame**
- [~] 963 `P0` **Regiões próximas se fundem** antes de processar (célula de 12)
- [~] 964 `P0` **Tabela de luz de 256 entradas** no lugar de `Math.pow` por face
- [~] 965 `P0` **Cache do último chunk** em `getLight`/`setLight`
- [~] 966 `P1` **Só os chunks tocados pela região são marcados**, não os 9 vizinhos
- [~] 967 `P1` **Coluna de sol começa no topo do terreno**, não no topo do mundo
- [~] 968 `P0` **BFS de remoção de luz** — apagar propagava valor velho de volta e a caverna nunca escurecia
- [~] 969 `P0` **Fontes independentes revalidadas** contra o estado final, não o do momento em que foram vistas
- [~] 970 `P0` **Painel de diagnóstico medindo o frame **no navegador** — F3, com custo por sistema**
- [~] 971 `P0` **Mesh em Web Worker: era o maior custo de frame depois da luz corrigida**
- [~] 972 `P1` **Buffers de `padChunk`/`padLight` reciclados entre a thread principal e o worker**
- [ ] 973 `P1` Orçamento de re-mesh por frame também no ciclo dia/noite (hoje marca tudo de uma vez)
- [~] 974 `P1` **Painel F3 com FPS, chunks, entidades, vozes de áudio, mods, rede e cache de rotas**
- [ ] 975 `P1` Distância de render adaptativa ao FPS medido
- [~] 976 `P2` **Custo por sistema medido por média móvel, com o pior frame da janela ao lado**
- [ ] 977 `P2` Teste de regressão de desempenho no CI, com orçamento por operação
- [ ] 978 `P2` Descarregar geometria de chunk fora do alcance de forma mais agressiva

## 37 — Interface: separação de telas e controle de câmera

### Estado após a rodada de correção

Entregue: **hub de navegação** (`GameMenu`) como destino do ESC, com todos os destinos, os
atalhos visíveis ao lado de cada um, volume por canal e saída para a tela inicial. E um
**tema compartilhado** (`theme.ts`), porque cada tela escrevia o próprio `cssText` — a mesma cor
de fundo aparecia com três valores diferentes e o mesmo botão tinha quatro paddings.

**Página inicial separada (982): entregue.** Enquanto ela está aberta, o canvas é escondido e o
loop devolve o quadro imediatamente — antes, voltar ao menu deixava física, criaturas e render
trabalhando atrás dele. O `requestAnimationFrame` continua agendado, para a volta ser instantânea.

Ainda pendente na seção: opções de vídeo e controles (985), remapeamento de teclas (432) e o
layout responsivo (998).


*Parecer: o `MainMenu` existe, mas o jogo não tem uma **página inicial** de verdade — as telas
foram nascendo como overlays sobre a cena, e hoje há sete delas competindo pelo mesmo espaço sem
navegação comum. E o bug do ponteiro é o pior tipo: o jogador perde o controle da câmera e não
tem nenhuma indicação do que fazer.*

*Causa do bug do ESC: `requestPointerLock` **exige gesto do usuário**, e o navegador impõe uma
recusa logo após a saída por ESC. A chamada automática era negada em silêncio (o `catch` engolia)
e nada mais tentava — o mouse ficava solto para sempre.*

- [~] 979 `P0` **Retomada do ponteiro por clique**, que é o gesto que o navegador aceita
- [~] 980 `P0` **Dica "clique para voltar ao jogo"** quando o controle está solto
- [~] 981 `P0` **`pointerlockchange` detecta perda inesperada** e avisa, em vez de deixar o jogador sem saber
- [~] 982 `P0` **Tela inicial como página: canvas escondido e simulação suspensa enquanto ela está aberta**
- [~] 983 `P0` **Navegação comum entre as telas — hub em `src/ui/GameMenu.ts`, aberto pelo ESC**
- [~] 984 `P0` **Porta única em vez de sete atalhos soltos; os atalhos viraram atalhos, não o único caminho**
- [ ] 985 `P1` Tela de opções unificada: vídeo, áudio, controles, acessibilidade
- [~] 986 `P1` **Volume por canal exposto na interface (o sistema já suportava, nada expunha)**
- [~] 987 `P1` **Lista de atalhos visível dentro do jogo, ao lado de cada destino**
- [~] 988 `P1` **Menu de pausa virou uma entrada do hub ("Mundo e rede"), em vez da única porta**
- [~] 989 `P1` **Estilo compartilhado em `src/ui/theme.ts` — tokens e construtores no lugar de CSS repetido**
- [~] 990 `P1` **Transição clara entre "no menu" e "jogando", com o ponteiro coerente nos dois**
- [~] 991 `P2` **Voltar sempre para o hub, e do hub para o jogo**
- [ ] 992 `P2` Indicador de qual tela está aberta
- [ ] 993 `P2` As telas herdam a customização de UI feita pela IA
- [ ] 994 `P2` Navegação por teclado e foco visível em todas as telas
- [ ] 995 `P2` Tela inicial mostrando os mundos com prévia e data
- [ ] 996 `P2` Tela de créditos e versão
- [ ] 997 `P2` Primeira execução com um passo a passo curto
- [ ] 998 `P2` Layout responsivo para janela pequena
- [ ] 999 `P2` Testes de que ESC sempre devolve o controle da câmera
- [ ] 1000 `P2` Testes de navegação entre telas sem estado preso

---

# Adendo — Rodada 7 de requisitos (itens 1001–1042)

> Dois pedidos, ambos pesquisados antes de registrar: **aparição suave dos chunks** como no
> Minecraft moderno, e um **céu noturno de verdade** — lua, estrelas por padrão, e noites com
> claridade variável.

## 38 — Engenheiro de Aparição de Chunk (*fade in*)

*O que a pesquisa mostrou: no Java vanilla o chunk simplesmente **aparece** — o recorte seco que
este projeto também tem. A aparição suave é padrão no **Bedrock**, e no Java vem de mods, sendo o
[Chunks fade in](https://modrinth.com/mod/chunks-fade-in) o mais usado (4,2 milhões de downloads),
com [implementação aberta](https://github.com/kerudion/chunksfadein). O
[fade-in-chunks](https://github.com/Johni0702/fade-in-chunks) descreve o efeito explicitamente
como "estilo Bedrock".*

**A técnica, destrinchada:**

1. Cada chunk guarda o instante em que sua malha ficou pronta.
2. Durante ~0,4–0,8 s, a opacidade vai de 0 a 1. Algumas variantes somam um **deslocamento
   vertical** (o chunk "sobe" para o lugar), que é o toque do Bedrock.
3. Os chunks aparecem **escalonados**, um após o outro, e não todos no mesmo quadro — é isso que
   diferencia de um simples fade global.

**Duas armadilhas que a pesquisa deixa claras, e que valem registro aqui:**

- **Material transparente custa caro e quebra a profundidade.** Fazer o fade exige `transparent`,
  que desativa a escrita no *depth buffer* e reordena o desenho. Se o chunk ficar transparente
  para sempre, o mundo inteiro passa a ser desenhado como translúcido. O material precisa
  **voltar a opaco** ao terminar a animação.
- **Interação com névoa.** Este projeto acabou de ganhar neblina (item 054), e ela já esconde
  parte do surgimento. Fade e névoa precisam ser ajustados juntos, ou o chunk aparece com
  opacidade cheia dentro de uma névoa que deveria escondê-lo.

- [~] 1001 `P0` **`FadeAgenda` registra o instante em que a malha de cada chunk fica pronta**
- [~] 1002 `P0` **0 a 1 ao longo de 0,6 s, com suavização *ease-out***
- [~] 1003 `P0` ****Material nunca fica transparente** — a transição é por descarte (Bayer 4×4)**
- [ ] 1004 `P1` Deslocamento vertical opcional ("sobe para o lugar"), estilo Bedrock
- [~] 1005 `P1` **Aparição escalonada, 45 ms entre chunks**
- [~] 1006 `P1` **Não briga com a neblina: o material é opaco e a névoa age normalmente**
- [~] 1007 `P1` **Re-mesh por alteração **não** refaz a animação — só os recém-carregados**
- [~] 1008 `P2` **Curva *ease-out* isolada em `suavizar()`, trocável num lugar só**
- [~] 1009 `P2` **Aparição de chunk desligável no menu (Câmera & Personagem)**
- [~] 1010 `P2` **A colisão nunca esperou a malha: a física lê os dados do chunk, não a geometria**
- [~] 1011 `P2` **Teste de que todo chunk que começa a aparecer termina, e volta ao material compartilhado**

#### Por que descarte, e não transparência

O item 1003 avisava do custo, e ele é maior do que parecia: material transparente **não escreve no
buffer de profundidade**. O chunk que está chegando deixaria de ocultar o que está atrás dele — o
jogador veria o interior do terreno através do chão que aparece, durante a animação inteira — e o
renderizador ainda teria de ordenar os chunks por distância a cada quadro.

Descartando fragmentos por um padrão de Bayer 4×4, o material continua opaco: escreve
profundidade, dispensa ordenação, e o que varia é a *fração* de pixels desenhados. Em 0,6 s o olho
lê como um esmaecimento.

Dois detalhes que só aparecem ao implementar:

- **`clone()` não serve** para o material da animação. `Material.copy` do three.js não copia
  `onBeforeCompile`, e o clone sairia sem curvatura, sem tingimento e sem o descarte — em
  silêncio. É preciso construir e reaplicar.
- **Array GLSL com índice dinâmico não é portátil** em WebGL1. A tabela de Bayer virou duas
  linhas de aritmética, o que também é mais barato.

O item 1010 (a colisão não pode esperar a animação) já era verdade e foi verificado, não
implementado: a física lê os dados do chunk, nunca a geometria.


## 39 — Diretor de Céu Noturno

*Pesquisa sobre o Minecraft, e uma diferença que importa: o vanilla tem
[oito fases da lua](https://minecraft.wiki/w/Moon), que mudam ao fim de cada amanhecer — mas
**a fase não altera a luminosidade**. A noite tem nível de luz 4 fixo, seja lua cheia ou nova; a
fase só influencia o surgimento de slimes no pântano. Escurecer conforme a fase é justamente o
que mods como [Dynamic Darkness](https://www.curseforge.com/minecraft/mc-mods/dynamic-darkness)
acrescentam.*

*Ou seja: **o pedido vai além do vanilla**, e vai numa direção melhor. Fazer a lua nova ser
realmente escura dá função à fase lunar — a mesma caverna, a mesma base, mudam de dificuldade
conforme a noite. É o tipo de variação que faz o jogador olhar para o céu antes de sair.*

*O motor de luz deste projeto já separa luz de céu de luz de bloco e aplica um `sunScale`
contínuo, então a claridade variável entra sem recalcular nada — basta o `sunScale` noturno
depender da fase. A tocha continua com o mesmo valor, que é exatamente o que se quer.*

- [~] 1012 `P0` **Lua desenhada no céu, oposta ao sol — `src/render/sky.ts`**
- [~] 1013 `P0` **Oito fases lunares, avançando uma por amanhecer**
- [~] 1014 `P0` **Fase persistida no save (`WorldRecord.worldDay`)**
- [~] 1015 `P0` **Claridade da noite varia com a fase — lua nova quase preta, cheia navegável**
- [~] 1016 `P0` **Estrelas por padrão, visíveis só à noite**
- [~] 1017 `P1` **Estrelas surgindo no anoitecer com transição suave**
- [~] 1018 `P1` **Posição das estrelas determinística — o mesmo mundo tem o mesmo céu**
- [~] 1019 `P1` **Brilho das estrelas reduzido nas noites de lua cheia**
- [ ] 1020 `P1` A lua projeta luz direcional fraca, com sombra suave própria
- [~] 1021 `P1` **Piso de luminosidade que nunca chega ao preto absoluto**
- [~] 1022 `P1` **`api.time.moonPhase` e `api.time.isDarkNight` expostos aos mods**
- [~] 1023 `P1` **Bioma e fase da lua no painel F3**
- [~] 1024 `P2` **Lua nova gera hostis a ~1,8× o ritmo da cheia — `intervaloDeSpawn`**
- [ ] 1025 `P2` Céu com gradiente noturno próprio, não só o diurno escurecido
- [ ] 1026 `P2` Via láctea ou faixa de estrelas mais densa, para o céu não ser uniforme
- [ ] 1027 `P2` Nuvens escurecidas à noite, recortando o céu estrelado
- [ ] 1028 `P2` Eclipse raro como evento de mundo
- [ ] 1029 `P2` Ferramenta MCP para consultar e ajustar a fase lunar
- [~] 1030 `P2` **Teste de que a fase avança uma vez por dia e volta ao ciclo após oito**
- [~] 1031 `P2` **Teste de que a lua nova é mais escura que a cheia, e nenhuma é preto absoluto**

## Como isso conversa com o que já existe

| Já entregue | O que o pedido acrescenta |
|---|---|
| Ciclo dia/noite com `sunScale` contínuo (245) | O `sunScale` noturno passa a depender da fase lunar |
| Luz de céu separada da de bloco (243) | A tocha mantém o valor: só a luz de céu escurece |
| Céu que muda de cor (246) | Ganha gradiente noturno próprio, lua e estrelas |
| Spawn por nível de luz (255) | Noite escura vira noite perigosa, sem regra nova |
| Neblina atmosférica (054) | Precisa ser conciliada com o fade de chunk |
| Re-mesh em degraus de `sunScale` (245) | A variação por fase muda de degrau uma vez por dia, não por frame |

**Ordem recomendada:** 1012–1016 primeiro (lua, fases, claridade variável, estrelas) — é o que o
usuário descreveu e o que muda a experiência. O *fade* de chunk (1001–1003) depois, porque mexe
em material e profundidade, e um erro ali degrada o desempenho do mundo inteiro.

### Céu noturno: entregue

Lua com oito fases, estrelas determinísticas pela semente, e a claridade da noite governada pela
fase — lua nova quase preta, cheia navegável. O `sunScale` noturno deixou de ser fixo em 0,12 e
passa a sair de `claridadeNoturna(fase)`; como o motor separa luz de céu de luz de bloco, **a
tocha mantém o mesmo valor em todas as noites**, que é exatamente o comportamento desejado.

Um ajuste que os testes forçaram: o limiar de "noite escura" estava no meio da faixa de brilho,
mas a curva usa raiz e sobe rápido — só a lua nova classificava como escura, e sete das oito
noites seriam "claras". O limiar passou para a **iluminação** do disco, e agora as três noites em
torno da lua nova são as escuras.

Falta desta seção: sombra própria da lua (1020), gradiente noturno dedicado (1025), e ligar a
fase ao spawn de hostis (1024) — que é o que transformaria a lua nova em noite perigosa.

---

# Adendo — Curvatura do Mundo (itens 1032–1042)

> Pedido: registrar a **Curvatura do Mundo** (*World Curvature*), o efeito em que o cenário
> distante se dobra para baixo no horizonte, implementado por um *Curvature Shader*.
>
> **Achado ao verificar o código antes de registrar: já estava implementado — e desligado.**

## 40 — Auditoria da curvatura

O `applyCurvature` em `src/render/scene.ts` já injetava a curvatura no *vertex shader* de todos os
materiais de terreno, água e vidro, com a matemática correta:

```glsl
float cqDist = distance(cqWorld.xz, cameraPosition.xz);
float cqDrop = max(0.0, cqDist - uCurvStart);
cqWorld.y -= cqDrop * cqDrop * uCurvInvR;   // afunda com o QUADRADO da distância
```

Só que **nunca funcionou**, por dois motivos somados:

1. `invR` valia **0** — e o comentário ao lado dizia literalmente *"0 = mundo 100% plano e reto"*.
   Nada no projeto inteiro alterava esse valor.
2. `start` valia **500 voxels**, enquanto a distância de render são ~192 (6 chunks × 32). A
   curvatura começaria além do que existe desenhado. Mesmo que `invR` fosse ligado, não
   apareceria nada.

É o terceiro trecho assim encontrado nesta série: `UndoManager.recordBatch` nunca era chamado
(nenhuma construção da IA era reversível), `setViewRange` ajustava uma névoa que não existia, e
agora a curvatura. Vale como padrão a observar: **código presente não é código ativo.**

### Correção aplicada

- [~] 1032 `P0` **Curvatura ligada por padrão**, com `invR` derivado em vez de fixo
- [~] 1033 `P0` **Início e intensidade derivados da distância de render** — `start` fixo em 500 ficava fora do alcance desenhado
- [~] 1034 `P0` **A intensidade é expressa como "quanto o horizonte afunda no limite da visão"** e o `invR` sai daí. Com `invR` fixo, aumentar a distância dobraria o mundo ao absurdo, porque a queda cresce com o quadrado
- [~] 1035 `P1` **`setCurvature` acompanha a mudança de distância de render**, como a névoa

### Pendente

- [ ] 1036 `P1` Expor a intensidade nas opções, com `queda = 0` deixando o mundo plano
- [ ] 1037 `P1` Conciliar curvatura e neblina: o ponto onde o mundo dobra deve estar dentro da névoa, não além dela
- [ ] 1038 `P1` A curvatura é só visual — verificar que colisão, raycast e A\* continuam no mundo plano
- [ ] 1039 `P2` Aplicar a mesma curvatura às entidades e ao personagem, que hoje ficam retos sobre terreno curvo
- [ ] 1040 `P2` Aplicar às partículas e aos destroços de física
- [ ] 1041 `P2` Curvatura no eixo vertical também, para o efeito "planeta" completo
- [ ] 1042 `P2` Teste de que `queda = 0` restaura o mundo plano exatamente

**Ressalva honesta:** a correção foi verificada por tipos, testes e build, mas o efeito visual em
si **não foi conferido numa tela** — o valor padrão de 26 voxels de queda no limite da visão é um
palpite calibrado, não uma medição. Pode precisar de ajuste ao ver.


---

## 41. Especialista em Estado de Interface e Retomada de Controle (itens 1043–1062)

Relato do usuário: *"as vezes buga e nao consigo clicar para voltar ao jogo"*, com a dica
"Clique para voltar ao jogo" na tela e o clique sem efeito.

### Causa encontrada — estado duplicado

O `UIManager` mantinha uma pilha de ids (`blockingStack`) **e** cada tela mantinha o próprio
`isOpen`. Dois donos da mesma verdade. Como todo botão de fechar chama `close()` direto
(`CodeEditorPage`, `ModsPage`, `InventoryModal`, `PauseMenu`), e `closeBlocking` saía antes da
hora quando a tela já estava fechada, **o id ficava na pilha para sempre**. A partir dali
`isAnyBlockingOpen()` valia `true` eternamente e o ouvinte de clique desistia na primeira linha.

Um agravante: a dica tinha `pointer-events: none` e `z-index: 40` — mandava clicar sem ser
clicável, e ficava **abaixo** de qualquer overlay que tivesse sobrado.

### Entregue

- [~] 1043 `P0` **A pilha deixou de ser a verdade**: `isOpen` de cada tela é a fonte, a pilha guarda só a ordem do ESC
- [~] 1044 `P0` **`podarPilha()` reconcilia antes de qualquer leitura** — remove quem se fechou sozinho e adota quem se abriu sozinho
- [~] 1045 `P0` **`closeBlocking` não desiste mais quando a tela já está fechada** — é exatamente aí que precisa limpar e destravar
- [~] 1046 `P0` **A dica virou botão**: recebe o clique diretamente, com o maior z-index da interface
- [~] 1047 `P0` **Teclado como gesto alternativo** (W/A/S/D/espaço/enter) — se o clique estiver sendo engolido, andar devolve a câmera
- [~] 1048 `P0` **Ouvinte de clique no `document` em captura**, não no canvas: overlay esquecido por cima não engole mais o gesto
- [~] 1049 `P0` **Segundo ouvinte de relock removido do `main.ts`** — tinha lista de modos desatualizada, sem `thirdperson`, e a câmera não voltava em terceira pessoa
- [~] 1050 `P0` **`pointerlockerror` e `blur` tratados** — toda falha rearma a dica em vez de sumir em silêncio
- [~] 1051 `P1` **`shouldRelock` exige partida em curso** — a dica aparecia sobre o menu inicial
- [~] 1052 `P1` **Teste de regressão do vazamento da pilha** (`tests/unit/uiManager.test.ts`, 8 casos)

### Pendente

- [ ] 1053 `P1` Pausar de fato a simulação com qualquer bloqueante aberto (hoje só o menu inicial para o mundo)
- [ ] 1054 `P1` Indicador visível de "pausado" — o jogador não sabe se o mundo continua andando
- [ ] 1055 `P1` Pausa não deve pausar o P2P: em multiplayer o mundo do anfitrião continua
- [ ] 1056 `P1` Sair do lock por troca de aba deve pausar, não deixar o personagem andando com a tecla presa
- [ ] 1057 `P1` Zerar teclas pressionadas ao perder o foco — hoje uma tecla presa na troca de aba continua valendo
- [ ] 1058 `P2` Remapeamento de teclas, com o ESC configurável (ver item 432)
- [ ] 1059 `P2` `UIScreen` com evento `onClose` para as telas avisarem, tornando a poda desnecessária
- [ ] 1060 `P2` Teste de integração com DOM real (jsdom) cobrindo o caminho de pointer lock
- [ ] 1061 `P2` Tela de diagnóstico de estado de UI no F3 — quais telas o gerenciador acha que estão abertas
- [ ] 1062 `P2` Foco de teclado preso dentro do overlay aberto (armadilha de foco), por acessibilidade

---

## 42. Especialista em Atmosfera, Clima e Estações (itens 1063–1130)

Pedido do usuário: *"melhorar o ambiente efeito de clima, fog, cor, estilo Biome Blending, Color
Grading e Fog Interpolation, mudança de clima, o bioma quero que seja facil configurar as estações
do ano, que muda o comportamento do bioma"* — e, textualmente, **"que funcione"**, que é o
lembrete de que a seção 41 acabou de mostrar o custo de escrever código que nunca roda.

### 42.1 Biome Blending — transição entre biomas

Hoje o bioma é decidido por ponto e aplicado direto: a fronteira entre deserto e floresta é uma
linha reta visível. A mistura precisa acontecer em três lugares distintos, e confundi-los é o erro
clássico — misturar a *cor* é barato, misturar a *altura do terreno* muda a geração.

- [~] 1063 `P0` **`pesosDeBioma` devolve `{id, peso}[]` normalizado — `src/world/biomes.ts`**
- [x] 1064 `P0` ~~Amostragem dos vizinhos num raio configurável~~ — **não se aplica**: `temp` e `moist` já são campos de ruído contínuos, então o peso derivado deles é suave por construção. Amostrar vizinhos multiplicaria o custo para obter algo que já se tem de graça
- [~] 1065 `P0` **`misturarCor` mistura grama, folhagem e névoa pelos pesos**
- [x] 1066 `P0` ~~Mistura da altura do terreno pelos pesos~~ — **não se aplica**: a altura aqui não é derivada do bioma, é uma cadeia de ruído independente (continente → montanha → erosão → rio). Não existe degrau de altura na fronteira porque nunca houve fronteira de altura
- [ ] 1067 `P1` Mistura só na cor por padrão; mistura de altura como opção, por custo de geração
- [ ] 1068 `P1` Ruído na fronteira, para a transição não ser um círculo perfeito
- [~] 1069 `P1` **Amostrado a cada 6 quadros, com interpolação temporal cobrindo o intervalo**
- [~] 1070 `P1` **O `worldgen` decide superfície e árvore pelo bioma dominante — não mais por limiares paralelos**
- [~] 1071 `P1` **Densidade de árvore por bioma; deserto e tundra em zero**
- [ ] 1072 `P2` Bioma de transição explícito (praia, orla de floresta) como caso especial
- [~] 1073 `P2` **Teste de continuidade: salto máximo 0,0104 por passo de 0,01, uniforme**
- [~] 1074 `P2` **Teste de que a soma dos pesos é sempre 1, em todo o domínio**

### 42.2 Color Grading — a paleta do *Lay of the Land*

O visual de referência não vem da geometria, vem da **cor**: paleta dessaturada, sombras
azuladas, luz quente. Sem gradação, mini-blocos e AO entregam só metade do resultado.

- [x] 1075 `P0` ~~Passe de pós-processamento com LUT~~ — **dimensionado e RECUSADO por custo**, e a decisão está escrita em `src/render/grading.ts`: um `EffectComposer` custa um alvo de render do tamanho da tela, uma cópia por quadro e um passe sobre cada pixel, num projeto que veio do relato *"está muito muito travado"*. A gradação em seis instruções dentro do fragmento entrega o mesmo visual. **A limitação assumida:** ela alcança terreno, água e vidro — não personagem, criaturas nem céu. Reabrir só se a gradação precisar ficar agressiva. Estava marcado `P0` pendente sem que ninguém fosse fazê-lo
- [~] 1076 `P0` **Exposição por hora do dia — `exposicaoDaHora`, no `toneMappingExposure`**
- [x] 1077 `P0` **Mapeamento de tom ACES — já existia** desde antes desta seção (`renderer.toneMapping = ACESFilmicToneMapping`). Marcá-lo como pendente foi erro meu de auditoria, o segundo do tipo depois do item 053 (oclusão de ambiente)
- [~] 1078 `P1` **Sombra puxada para o azul e luz para o âmbar (tonalização dividida)**
- [~] 1079 `P1` **Saturação por bioma, **multiplicando** a da predefinição**
- [~] 1080 `P1` **Interpolação do tingimento entre biomas, pelos mesmos pesos do 1063**
- [ ] 1081 `P1` Vinheta sutil e aberração cromática mínima nas bordas — desligáveis
- [~] 1082 `P1` **Quatro predefinições selecionáveis no menu: natural, cinema, vívido, nenhuma**
- [ ] 1083 `P2` LUT carregável por mod, para um mod poder dar identidade visual própria
- [ ] 1084 `P2` Custo medido no F3: a gradação é um passe de tela cheia e precisa aparecer no orçamento
- [ ] 1085 `P2` Desligar automaticamente a gradação quando o FPS cair de um limiar
- [~] 1086 `P2` **Teste de que a saturação nunca fica negativa nem estoura**

### 42.3 Fog Interpolation — a névoa que reage

A névoa hoje é uma cor só, derivada da distância de render. Ela deveria ser o principal veículo
de clima e de hora: chuva aproxima e acinzenta, deserto afasta e amarela, noite escurece.

- [~] 1087 `P0` **Cor da névoa interpolada com a hora do dia **e** tingida pelo bioma**
- [~] 1088 `P0` **Cor e alcance da névoa por bioma, misturados pelos pesos**
- [~] 1089 `P0` **Interpolação temporal com meia-vida de 0,5 s, independente da taxa de quadros**
- [ ] 1090 `P1` Névoa exponencial ao quadrado (`FogExp2`) como opção, mais natural que a linear
- [ ] 1091 `P1` A cor do céu no horizonte e a cor da névoa precisam casar, senão o mundo termina numa borda
- [ ] 1092 `P1` Névoa mais densa em altitude baixa (vale com neblina, pico limpo)
- [ ] 1093 `P1` Névoa densa dentro de caverna, independente do bioma da superfície
- [ ] 1094 `P2` Névoa volumétrica barata por camadas, para os raios de luz do amanhecer
- [ ] 1095 `P2` Teste de que a densidade nunca esconde o bloco em que o jogador está mirando

### 42.4 Clima — chuva, neve, tempestade

- [~] 1096 `P0` **Máquina de estados de clima — `src/world/weather.ts` (6 estados)**
- [~] 1097 `P0` **Transição gradual, com duração sorteada e **determinística pela semente****
- [~] 1098 `P0` **Clima traduzido pelo bioma dominante: não neva no deserto, chuva vira neve na tundra**
- [~] 1099 `P0` **Relógio do mundo sincronizado do anfitrião (`world_time`); o clima é derivado dele**
- [~] 1100 `P1` **Partículas de chuva e neve, presas à câmera, com orçamento fixo de 1.400**
- [~] 1101 `P1` **Chuva para no primeiro sólido abaixo — "não chove dentro de casa" sai de graça**
- [~] 1102 `P1` **Som de chuva e trovão pelo sintetizador, sem arquivo de áudio**
- [~] 1103 `P1` **Clarão do relâmpago e trovão atrasado pela distância**
- [~] 1104 `P1` **Chuva escurece a cor do terreno enquanto molha, pelo mesmo canal**
- [~] 1105 `P1` **Neve cai com queda e deriva próprias (acúmulo como bloco fino ainda pendente)**
- [~] 1106 `P1` **Clima modula a névoa e a luz do céu, como multiplicadores**
- [ ] 1107 `P2` Chuva enche recipientes e alimenta os fluidos finitos existentes
- [ ] 1108 `P2` Raio incendeia e pode converter areia em vidro, com chance baixa
- [ ] 1109 `P2` Clima afeta o surgimento de criaturas e a agressividade
- [~] 1110 `P2` **`api.env.get/has/missing` documentado na referência do agente**
- [ ] 1111 `P2` Ferramenta MCP `set_weather` / `get_weather`
- [~] 1112 `P2` **Teste de que a máquina nunca fica presa e sempre termina numa transição válida**

#### O que a implementação do clima revelou

**Uma lacuna pré-existente, encontrada ao tentar cumprir o item 1099:** `timeOfDay` e `worldDay`
**nunca foram sincronizados no P2P**. Cada par contava o próprio tempo desde que entrou — dois
jogadores no mesmo mundo viam horas do dia e fases da lua diferentes. O clima só tornou isso
visível, porque é derivado do dia. Corrigido com a mensagem `world_time`, que o anfitrião manda na
entrada do convidado e a cada 10 s.

O convidado **alcança correndo** (ritmo ±30%) em vez de saltar. Saltar faria o sol pular no céu e,
pior, faria `sunScale` cruzar o limiar de re-mesh de uma vez — o mundo inteiro remontado num
quadro, a cada mensagem de relógio.

**O clima é derivado, não sorteado.** A sequência é função de (semente, dia), o que resolve duas
coisas de graça: não precisa ser gravado no save, e não precisa trafegar no P2P — os dois lados
derivam do mesmo relógio. Só o clima **imposto** (por mod ou pelo anfitrião) viaja.

**A fase da lua não afetava o spawn, e não era óbvio.** O `sunScale` já vinha da fase, mas o
limiar de spawn é 6 e a luz de céu efetiva à noite vai de 0,5 (nova) a 2,9 (cheia): as duas passam
com folga. A fase mudava o quanto se enxerga e nada mais. O que precisava mudar era o **ritmo** —
`intervaloDeSpawn`.

### 42.5 Estações do ano — configuráveis por bioma

Requisito textual do usuário: *"o bioma quero que seja facil configurar as estações do ano, que
muda o comportamento do bioma"*. O ponto central é **configuração declarativa**: uma estação não
deve exigir código, e sim uma tabela que o bioma preenche — é o que permite a IA criar um bioma
com estações próprias sem escrever lógica.

- [~] 1113 `P0` **Calendário de 4 estações × 8 dias, derivado do mesmo `worldDay` da lua**
- [~] 1114 `P0` **`PerfilSazonal` declarativo — **só números**, nenhum `switch` no motor**
- [~] 1115 `P0` **Interpolação entre estações, com platô no coração de cada uma**
- [~] 1116 `P0` **Derivado do `worldDay`, que já é sincronizado pelo `world_time`**
- [~] 1117 `P1` **Folhagem muda de cor na estação **sem regerar o chunk** — canal `aTint` + uniform**
- [ ] 1118 `P1` Inverno cobre de neve e congela a superfície da água — com os fluidos finitos já existentes
- [ ] 1119 `P1` Primavera acelera o crescimento de plantas; inverno o interrompe
- [ ] 1120 `P1` Duração do dia varia com a estação — inverno com noite mais longa
- [~] 1121 `P1` **`sazonal` por bioma **e** perfil próprio via `definirPerfil`**
- [~] 1122 `P1` **A estação traduz o clima: inverno converte chuva em neve onde o bioma permite**
- [~] 1123 `P1` **`api.season.defineProfile` — declaração sem código; painel na página de mods pendente**
- [~] 1124 `P2` **`api.season.current/is/growth/defineProfile`**
- [ ] 1125 `P2` Ferramenta MCP `configure_biome_seasons`, documentada em `ModAPIReference`
- [ ] 1126 `P2` Estação afeta o surgimento de criaturas e o que os aldeões produzem
- [ ] 1127 `P2` Evento sazonal raro (aurora no inverno, tempestade de areia no verão do deserto)
- [~] 1128 `P2` **Teste de que o ciclo de estações fecha e volta ao início**
- [~] 1129 `P2` **Teste de que um bioma sem perfil não quebra nada**
- [~] 1130 `P2` **Teste de que a interpolação nunca produz valor fora da faixa**

### O que já roda

`src/world/biomes.ts` (puro) + `tests/unit/biomes.test.ts` (17 casos), ligado no laço principal do
`main.ts` e no painel F3.

Dois itens desta seção foram **descartados com justificativa** (1064 e 1066) em vez de ficarem
pendentes para sempre: eles pressupunham um bioma discreto por ponto, que este gerador nunca teve.

Um defeito meu, que o teste pegou: a primeira versão truncava a mistura nos 4 maiores pesos. O
teste de continuidade acusou salto de 0,084 contra mediana de 0,0077 — outlier isolado, que é a
assinatura de descontinuidade, não de inclinação. Cortar o quinto peso e renormalizar move todos
de uma vez. Sem truncamento, o salto máximo é 0,0104 e **uniforme**.

#### O que a implementação das estações revelou

**Um defeito de ordem, pego pelo teste.** Eu aplicava a estação antes do bioma, e a regra
"bioma temperado converte neve em chuva" **desfazia** a conversão do inverno — a floresta nunca
veria neve. A ordem certa, lendo de novo, é óbvia: o bioma diz o que é *possível* ali (não neva no
deserto, nunca), e a estação escolhe dentro do possível. Filtrar depois de escolher desfaz a
escolha.

**A estação não mexe nos pesos do sorteio de clima, e isso é deliberado.** Se mexesse, a mesma
semente daria sequências diferentes conforme os perfis sazonais que um mod tivesse registrado — e
o determinismo do P2P passaria a exigir que os dois lados tivessem exatamente os mesmos mods
carregados. A estação é uma lente sobre a sequência, não parte dela.

**Perfis são limpos ao trocar de mundo.** Um mundo com o mod "inverno eterno" contaminaria o
próximo aberto na mesma sessão, e o sintoma apareceria longe de qualquer coisa feita ali.

#### O que a implementação das partículas revelou

**"Não chove dentro de casa" (1101) não precisou de teste de céu aberto.** A regra é "a partícula
para no primeiro bloco sólido abaixo" — e o telhado *é* o primeiro bloco sólido. Uma varanda, uma
caverna com entrada lateral e uma casa com claraboia funcionam sem nenhum caso especial. O teste
de coluna com céu aberto, que era a solução planejada, teria custado mais e acertado menos.

**A varredura acontece ao renascer, não por quadro.** Com 1.400 partículas vivendo ~1,5 s, são
algumas centenas de varreduras por segundo, contra 84.000 se fosse por quadro.

**O clarão não entra no `sunScale`.** Se entrasse, cada raio marcaria todos os chunks como sujos
e o mundo inteiro seria remontado duas vezes por relâmpago. O clarão é de iluminação, não de
geometria — e essa distinção existe porque a luz de céu está assada na cor dos vértices.

**Chuva contínua não cabia no modelo de `play()`,** que é de disparo curto: para soar contínua
seriam dezenas de disparos por segundo, e o teto de 24 vozes estouraria antes de qualquer outro
som do jogo tocar. Foi preciso uma fonte de ruído em laço, viva o tempo todo, com ganho zero
quando não há clima — uma voz fixa e nada mais.

Um teste existente reprovou o trovão por ser mais longo que o som de morte. O invariante era
legítimo, mas sobre **resposta a ação**: nenhum retorno de ato do jogador pode se arrastar mais
que a própria morte. Trovão é atmosférico. O teste foi **escopado**, não afrouxado — encurtar o
trovão para caber nele seria deixar o teste ditar o jogo.

#### O outono sem remontar chunk

Ao terminar as estações percebi que **elas não eram visíveis**: mudavam o clima e o painel F3, e
nada mais. Um sistema inteiro que o jogador não enxerga.

O obstáculo é que a luz e a oclusão estão **assadas na cor dos vértices** — mudar a cor da
folhagem exigiria remontar o chunk, inaceitável para algo que muda todo dia de calendário.

A saída é um canal novo no mesher: **um byte por vértice** dizendo se aquele vértice responde
(0 = não, 1 = folhagem, 2 = grama). A *cor* não vai por vértice; ela vive num uniform. O outono
chega ao mundo inteiro trocando três números.

Três detalhes que decidem se funciona:

- **Multiplicativo, não substitutivo.** Preserva a luz e a oclusão que já estão na cor. Somar ou
  substituir apagaria o relevo, e a folha de pinheiro viraria laranja em vez de escurecer.
- **Só o topo da grama.** A lateral de um bloco de grama é terra; pintá-la de laranja deixaria o
  corte do terreno com cara de bolo.
- **Um `onBeforeCompile` só.** O three.js guarda **um** por material — uma segunda atribuição
  apagaria a curvatura em silêncio, e o sintoma seria "a curvatura parou quando o outono chegou".

Blocos de mod entram sozinhos, pelas propriedades: um bloco `decor` não sólido é folhagem, do
mesmo jeito que já herda o som de folhagem em `materialOf`. Um mod que cria "samambaia" ganha
outono sem declarar nada — e sem isso, todo bioma criado pela IA ficaria congelado no verão.

#### Gradação sem passe de tela cheia

A solução de manual é um `EffectComposer` com LUT: um alvo de render do tamanho da tela, uma cópia
por quadro e um passe de fragmento sobre cada pixel. Este projeto veio de um relato de *"está
muito muito travado"*, e pagar isso por um efeito de cor seria a escolha errada.

O que foi entregue são **seis instruções dentro do fragmento que já ia rodar**, injetadas depois
de `fog_fragment` — depois da névoa, de propósito: antes dela o horizonte destoaria do terreno
exatamente no ponto onde os dois se encontram, que é o mais visível de todos.

**A limitação é real e precisa ficar registrada:** a gradação assim aplicada alcança o terreno, a
água e o vidro — **não** o personagem, as criaturas nem o céu. Com uma gradação sutil, que é o
caso da referência, a diferença não se nota; com uma agressiva, notaria. Os itens 1075 (LUT) e
1083 (LUT por mod) continuam pendentes, e são eles que exigiriam o passe.

A exposição, essa sim, é global: vai no `toneMappingExposure` do renderizador e alcança tudo.

Um detalhe que só aparece medindo: a luminância usa os c### Entregue nesta rodada

- [~] 1147 `P0` **`InventoryModal` migrado para o componente `Tabs`** (Catálogo, Crafting 6x6 e Personagem)
- [~] 1148 `P0` **`PauseMenu` migrado para o componente `Tabs`**
- [~] 1149 `P0` **`ModsPage` migrado para o componente `Tabs`** (Geral, `mod.env`, Versões e Scripts)
- [~] 1150 `P1` **Layout do inventário em duas colunas** (Coluna esquerda: Tabs/Grade; Coluna direita: Personagem/Stats & Equipamentos)
- [~] 1151 `P1` **Barra de vida e fome com números formatados** junto aos ícones SVG
- [~] 1160 `P2` **Teste de integração de UI** em `tests/unit/uiIntegration.test.ts` (garantindo exclusividade de modais)

### Pendente

- [ ] 1152 `P1` Foco preso dentro da tela aberta (armadilha de foco), por acessibilidade
- [ ] 1153 `P1` Animação de entrada e saída das telas, respeitando `prefers-reduced-motion`
- [ ] 1154 `P1` Estado vazio em toda lista (`vazio()` existe e ainda não é usado em todas)
- [ ] 1155 `P1` A tela lembra a última aba aberta, por tela
- [ ] 1156 `P2` Tema claro, já que as cores estão centralizadas
- [ ] 1157 `P2` Teste de que nenhuma tela escreve `cssText` com cor literal fora do tema
- [ ] 1158 `P2` Arrastar item entre grade e hotbar
- [ ] 1159 `P2` Busca dentro do inventário e do crafting

---

## 44. Relato de tela do jogador — 26/07/2026 (o que só se vê rodando)

> Esta seção é a mais valiosa do documento, e o motivo está na ressalva do topo: **nada tinha sido
> visto numa tela**. Um print e cinco frases do jogador encontraram defeitos que 696 testes não
> encontrariam, porque nenhum deles é uma questão de lógica — são de *aparência* e de *integração
> com o mundo real* (um servidor que não está rodando).
>
> Registro aqui a causa raiz de cada um **antes** de corrigir, porque a causa é o que tem valor
> depois; o conserto é consequência dela.

### O relato, literal

1. "online não está funcionando, tentei ligar, ou criar o link e não consegui, **nem local**"
2. "as estrelas e lua **duplicada** aparecem por dentro das árvores, **não tem nuvens nem sol**"
3. "o lado que não bate luz fica **totalmente escuro**"
4. "os menus ainda estão confusos e às vezes ficam **sobrepostos**, como o clique para voltar ao jogo, e **não está bonito**"
5. "o fog à noite **não fica preto**"
6. "as nuvens têm que ser **que nem blocos transparentes** e não uma linha 2D"
7. "o céu está **estático**, e quando tem chuva num local **não tem um concentrado de nuvens**, não está fluido, **nem a água nem onda**"

### Causa raiz de cada um

| # | Sintoma | Causa encontrada no código |
|---|---|---|
| 2a | Estrelas e lua atravessam as árvores | `depthTest: false` nos materiais de `sky.ts`. O motivo original era evitar recorte da cúpula, mas ela tem raio 900 e o plano distante da câmera é 12000 — **nunca houve recorte a evitar**. A opção só criava o problema que deveria prevenir. |
| 2b | Lua **duplicada** | A fase era um segundo disco escuro sobreposto, e `desloca = (1 - iluminacao) * 62` está **invertido**: centra a sombra na lua CHEIA e a afasta na NOVA. O comentário ao lado descrevia o comportamento certo; a expressão fazia o oposto. Pior: **dois discos de mesmo raio não formam lua gibosa** — nas fases entre quarto e cheia o disco escuro escapa e vira um segundo círculo no céu. |
| 2c | Não tem sol nem nuvens | Nunca existiram. `sky.ts` só tinha estrelas e lua. |
| 5 | Névoa não fica preta à noite | `fog.color.lerp(corBiomaAtual, 0.55 * sunScale)`, e `sunScale` tem **piso noturno** (a claridade da lua). O piso impede o fator de chegar a zero, então a cor clara do bioma (0.74, 0.80, 0.85) continua entrando à meia-noite. |
| 3 | Lado sem luz fica preto | Não existe termo ambiente na cena: só direcional (2.2) e hemisférica (0.75). Uma face virada para longe do sol recebe `N·L = 0` e fica só com a hemisférica, que ainda é multiplicada pelo sombreado de face já assado no vértice (0.68 a 0.86) e pela AO. O ACES no fim esmaga o que sobrou. |
| 1 | Online não conecta, nem local | O `relay/server.js` **existe no repositório e não estava rodando** — e não há script npm para ele. Pior: `PauseMenu` começa com o campo de URL **vazio**, então `signaling.configure(null)` faz `isConfigured()` ser falso e `hostRoom()` devolver `null` antes de tentar qualquer coisa. O caminho "nem local" não existia: **não há nenhum modo de conectar sem um processo servidor**, o que contradiz a premissa do projeto de rodar tudo no cliente. |
| 6 | Nuvens 2D | Primeira versão minha foi um plano com ruído no shader. Plano não tem espessura: de cima some, de baixo é decalque, e voar até ele revela uma folha de papel. Num mundo de voxel isso destoa de tudo à volta. |
| 7 | Céu estático / chuva sem nuvem / água sem onda | Nunca foram escritos. O clima já tinha `luz` e `alcanceNeblina`, mas **nada ligava chuva a nuvem** — o céu de tempestade era idêntico ao de dia limpo. |

### Entregue nesta rodada

- [~] 1161 `P0` **`depthTest` ligado no céu** — o mundo oculta o céu, o céu não oculta nada
- [~] 1162 `P0` **Fase da lua por terminador elíptico no shader** — acaba com a lua duplicada por construção, e passa a produzir gibosa, que dois discos não conseguem
- [~] 1163 `P0` **Sol visível**, núcleo mais halo em mistura aditiva, avermelhando rasante
- [~] 1164 `P0` **Sol e lua derivados da MESMA direção** da luz direcional — antes o `z` da lua não batia com o da luz e ela não estava exatamente oposta ao sol
- [~] 1165 `P0` **Nuvens como blocos translúcidos** (`InstancedMesh`), não plano: têm lado, topo e volume atravessável
- [~] 1166 `P1` **Grade de nuvens remontada só na troca de âncora**, com deslize sub-célula — sem isso o vento andaria aos pulos de 12 voxels
- [~] 1167 `P0` **Névoa preta à noite** — `luzDoDia` zera de fato quando o sol se põe, sem o piso da lua que mantinha a cor do bioma
- [~] 1168 `P0` **Termo ambiente na cena** (`AmbientLight`), impedindo o lado sem sol de ficar preto
- [~] 1169 `P0` **Cobertura de nuvens governada pelo clima** em `setWeather` — chuva e tempestade fecham o céu
- [~] 1170 `P0` **Multijogador local sem servidor nenhum**, via `BroadcastChannel` entre abas do mesmo navegador
- [~] 1171 `P0` **Script `npm run relay` e URL padrão `ws://localhost:8787`** no campo do menu
- [~] 1172 `P0` **Mensagens de erro do online com diagnóstico** e instruções claras no UI
- [~] 1173 `P1` **Sinalização manual por colar/copiar token** (offer/answer), para jogar pela internet sem relay
- [~] 1174 `P1` **Onda na água** — deslocamento senoidal duplo de vértices no shader + uniform `uOndaTempo`
- [~] 1175 `P1` **Céu com movimento perceptível mesmo parado** — deriva do vento contínua no tempo
- [~] 1176 `P1` **Nuvem escurece quando chove** — interpolação para tom cinza de tempestade
- [~] 1178 `P2` **Teste de compilação dos shaders GLSL** em `tests/unit/glslShaderCompilation.test.ts`

### Pendente — o resto do relato

- [ ] 1177 `P2` Sombra das nuvens no chão, se der para fazer sem custar o mapa de sombras

> **Lição, a mesma de sempre neste documento e agora com um custo real:** o teste prova que o
> código roda, não que o resultado está certo. `depthTest: false` roda perfeitamente. A fase
> invertida da lua roda perfeitamente. O relay que não está de pé é um `if` que devolve `null`
> exatamente como escrito. Nenhum deles quebra nada — todos os três só ficam **errados na tela**.

---

## 45. Especialista em UI/UX Gaming Architecture — Hub Unificado com Navegação por Abas (itens 1179–1195)

*Parecer: A arquitetura de interface unificada resolve de forma definitiva a fragmentação da UI. Em vez de janelas flutuantes desconectadas ou modais sobrepostos que disputam foco e bloqueiam cliques, o jogo adota uma **estrutura de três camadas fixas**: Barra Superior de Abas (Top Tab Bar), Conteúdo Central Dinâmico (Dynamic Center Container) e Barra de Atalhos no Rodapé (Bottom Bar). O Menu Inicial passa a rodar sobre um Diorama 3D em tempo real, enquanto o Menu In-Game aplica blur atmosférico sobre a cena pausada.*

- [~] 1179 `P0` **Layout Unificado de Três Camadas**: Top Bar (navegação) + Dynamic Center (conteúdo) + Bottom Bar (atalhos)
- [~] 1180 `P0` **Menu Inicial com Diorama 3D em Tempo Real (Live Preview)** rodando na engine do jogo em background
- [~] 1181 `P0` **Navegação no Menu Inicial via Abas Superiores**: Jogar, Carregar Mundo, Opções, Sair deslizando sobre o Diorama 3D
- [~] 1182 `P0` **Menu In-Game (Hub de Pausa) Unificado**: Abas [Inventário] | [Habilidades] | [Missões] | [Mapa] | [Opções] | [Sistema/Sair]
- [~] 1183 `P0` **Efeito Visual de Fundo no Hub In-Game**: `backdrop-filter: blur(12px)` + escurecimento suave (75% opacity) com o jogo pausado visível atrás
- [~] 1184 `P0` **Alternância Rápida de Abas via Teclado e Gamepad**: Atalhos `Q` / `E` e bumpers `L1` / `R1` (`LB` / `RB`) para deslizar entre abas superiores
- [~] 1185 `P1` **Rodapé Fixo com Atalhos Contextuais**: Exibição dos botões permitidos (`[Esc] Voltar`, `[Q/E] Trocar Aba`, `[Espaço] Selecionar`)
- [~] 1186 `P1` **Animações de Transição Fluidas**: Slide horizontal suave + Fade cross-dissolve (`150ms ease-out`), respeitando `prefers-reduced-motion`
- [~] 1187 `P1` **Aba [Inventário]**: Layout 2 colunas com grade de blocos/crafting (esquerda) + diorama do personagem e status (direita)
- [ ] 1188 `P1` **Aba [Habilidades]**: Árvore visual de habilidades/melhorias com painel de descrição e custo
- [~] 1189 `P1` **Aba [Missões]**: o diário está feito (aba "Objetivos" no hub, itens 007/1305). **Falta** o marcador no mapa — e ele depende de objetivos com lugar no mundo, que a corrente atual não tem
- [ ] 1190 `P1` **Aba [Mapa]**: Cartografia expandida do mundo com waypoints, biomas e coordenadas XYZ
- [ ] 1191 `P1` **Aba [Opções]**: Configurações de Vídeo, Áudio, Controles e IA com aplicação instantânea
- [ ] 1192 `P1` **Aba [Sistema/Sair]**: Save management, multiplayer room hosting, e confirmação de saída
- [ ] 1193 `P2` **Armadilha de Foco e Acessibilidade (Focus Trap)**: Garantir foco navegável via teclado/gamepad dentro do container ativo
- [ ] 1194 `P2` **Persistência da Última Aba Aberta**: O Hub lembra a última aba consultada durante a sessão de jogo
- [ ] 1195 `P2` **Testes Automatizados de Navegação por Abas**: Validação da troca de abas via Q/E e isolamento de conteúdo em `tabsNavigation.test.ts`

---

## 46. Segunda rodada do relato — 26/07/2026 (o padrão se repetiu duas vezes)

> **Correção de integridade deste documento.** Numerei esta seção sem conferir o maior número já
> usado e colidi com a seção 45: treze itens ficaram duplicados (1147, 1149, 1170, 1172, 1173 e
> 1179–1185, 1187–1192). Renumerei os meus para 1196–1208 e transformei em prosa as cinco linhas
> que eram só releitura de itens já numerados. A contagem do cabeçalho estava inflada por isso.

> Esta rodada encontrou **mais dois casos do mesmo defeito estrutural** que a seção 44 já
> documentava, elevando a contagem de cinco para sete. Vale registrar porque o padrão agora é
> inegável: neste repositório, o modo dominante de falha **não é código errado — é código certo
> que ninguém invoca**.

| # | O que estava escrito, correto e testado | O que faltava |
|---|---|---|
| 6 | O shader da onda da água, com as duas senoides e o uniform de tempo | `createScene` chamava `applyCurvature(waterMaterial)` **sem o segundo argumento**, então o ramo `ehAgua` era sempre falso. A água nunca ondulou. |
| 7 | A tabela `CAMADA` em `theme.ts`, com o comentário *"concentradas aqui para não haver disputa de z-index entre telas"* | **Sete das nove telas a ignoravam** e escreviam `z-index` literal. |

### A causa de "às vezes os menus ficam sobrepostos"

A palavra que resolve o relato é **"às vezes"**. Quando dois elementos empatam no `z-index`, o
desempate é a ordem no DOM — que depende de qual tela foi construída primeiro. **Um bug que muda
de comportamento sem o código mudar é quase sempre um empate em algum lugar.**

Duas causas, e a segunda é a grave:

1. **Empate.** HUD (aviso), `InventoryModal` e `ChatOverlay` estavam os três em `z-index: 100`.
2. **Ordem invertida.** As telas **bloqueantes** estavam em 60–63 e o chat, que é **flutuante**,
   em 90–100. O chat desenhava por cima da página de mods — a tela que deveria estar bloqueando
   tudo era a que ficava por baixo.

### Entregue

- [~] 1196 `P0` **Onda da água ligada** — `applyCurvature(waterMaterial, true)`, e também na água em aparição, senão o lago pararia de ondular durante os 0,6 s do surgimento do chunk
- [~] 1197 `P0` **Três testes de fiação da onda**, que leem o código fonte de `scene.ts`. Textuais, com a fragilidade que isso implica, e ainda assim válidos: falham exatamente no acidente ocorrido. O ideal seria instanciar `createScene`, mas ela constrói um `WebGLRenderer` e jsdom não tem GPU.
- [~] 1198 `P0` **Todo `z-index` passou a sair de `CAMADA`** — nenhum literal em `src/`
- [~] 1199 `P0` **Regra codificada: bloqueante sempre acima de flutuante**
- [~] 1200 `P1` **Teste que varre `src/ui/` e `main.ts` e reprova `z-index` literal** — a tabela existir nunca impediu ninguém de ignorá-la (item 1157, antecipado)
- [~] 1201 `P1` **Camadas para toast e para a dica de retomada**, que antes eram números soltos
- [~] 1202 `P1` **Uma branch só.** `main` recebeu os 39 commits de `feat/mods-fluidos-personagem`; a branch de trabalho e a `claude/game-system-ai-mods-3f30f7` (worktree órfã) foram removidas local e remotamente, depois de conferido que nenhuma tinha commit exclusivo.

### O que já veio pronto do seu lado

Ao retomar, encontrei no `SignalingClient` e no `PeerSync` o que a seção 44 listava como pendente
em multijogador: **`BroadcastChannel`** para abas do mesmo navegador (o caminho 100% cliente),
sinalização **manual por token** e o seletor de modo no `PauseMenu`. Isso cobre 1170, 1172 e 1173.

Estes já estavam numerados nas seções anteriores e foram apenas **reconferidos** aqui, não recriados: 1147 e 1149 (telas no componente `Tabs`), 1170, 1172 e 1173 (multijogador local, mensagens de erro e sinalização manual).

### Pendente

- [x] 1203 `P1` ~~Layout do inventário em duas colunas~~ — **duplicata de 1150**, que já estava feito. Conferido em `InventoryModal.ts` ("Layout em 2 Colunas", com Stats & Equipamento na direita)
- [x] 1204 `P1` ~~`npm run relay` e URL padrão~~ — **auditado e já feito**: o script existe em `package.json` e o campo abre com `ws://localhost:8787`. Eu tinha escrito "1171 segue aberto" sem conferir.
- [ ] 1205 `P1` Sombra das nuvens no chão
- [~] 1206 `P2` **A metade verificável foi feita** (seção 64): os marcadores de injeção são conferidos contra o `ShaderLib` real do three.js, e cada injeção precisa provar que chegou ao shader. Compilar de verdade continua exigindo WebGL headless, que jsdom não tem — segue aberto, e agora com escopo menor

### Rodada seguinte — a aba que o jogador perdia

Ao migrar as telas encontrei que **você já tinha migrado as duas**: `InventoryModal` e `ModsPage`
usam o componente `Tabs`. Os itens 1147 e 1149 estavam feitos. O que sobrou foi um defeito
adjacente, e é de novo um que só aparece usando:

`renderDetalhe` da `ModsPage` constrói um `Tabs` **novo a cada chamada**, e `render()` é chamado
por sete ações diferentes — ligar um mod, apagar, recarregar, trocar de mod. Como a escolha de aba
morava dentro do componente, cada uma dessas ações jogava o jogador de volta na primeira aba: ele
abria "Versões", clicava em qualquer coisa e estava em "Geral" de novo.

Manter um `Tabs` vivo e só trocar o conteúdo seria pior — os painéis guardam estado do mod
anterior, e a montagem preguiçosa passaria a mostrar dados de outro mod até a aba ser reativada.
A escolha mora fora do componente, e um id desconhecido cai na primeira aba em vez de deixar a
tela em branco.

Estes já estavam numerados nas seções anteriores e foram apenas **reconferidos** aqui, não recriados: 1147 e 1149 (telas no componente `Tabs`), 1170, 1172 e 1173 (multijogador local, mensagens de erro e sinalização manual).
- [~] 1207 `P1` **A tela de mods lembra a aba aberta** entre redesenhos (item 1155, para esta tela)
- [~] 1208 `P1` **Três testes da memória de aba**, inclusive o caso de uma aba gravada que não existe mais numa versão nova

### O console do jogo, lido em 26/07/2026 — o mundo lixo

Você colou o log do navegador, e ele entregou um defeito que nenhum teste pegaria:

```
Carregando mundo ID: "guest-ws://localhost:8787"
Mundo "Visitante de ws://localhost:8787" carregado do zero com sucesso!
```

**A URL do relay virou o id de uma sala.** A causa era uma linha em `main.ts`:
`url.searchParams.get('join') || link`. O `|| link` faz **qualquer texto virar id de sala**.

E havia um segundo defeito, de ordem, empilhado no primeiro: `handleJoinLink` criava o mundo de
visitante, **salvava no banco** e iniciava o jogo — para só então tentar conectar. Cada tentativa
frustrada deixava um mundo vazio permanente na lista, e o jogador caía dentro dele em vez de ler
uma mensagem de erro.

O terceiro: o botão "Conectar" do menu chamava `this.close()` **antes** de tentar. Quando falhava,
a tela que deveria contar o porquê já não existia.

- [~] 1209 `P0` **`idDeSala` recusa o que não é convite** — endereço sem `?join=`, frase colada, id curto. Em módulo próprio (`src/net/convite.ts`), porque virou validação de verdade e uma função dentro de `bootstrap()` não se testa sem subir o jogo
- [~] 1210 `P0` **Conectar primeiro, criar o mundo depois** — tentativa falha não deixa rastro
- [~] 1211 `P0` **O menu só fecha quando a conexão abre**, e a falha aparece embaixo do campo
- [~] 1212 `P1` **`relayDeLink` não decodifica duas vezes** — corromperia um relay com `%` legítimo
- [~] 1213 `P1` **11 testes de convite**, incluindo o caso exato do log
- [~] 1214 `P1` **Armadilha de foco** no `UIManager`: o Tab não escapa da tela aberta, painéis de aba escondidos ficam fora da ordem, e o foco volta ao lugar quando a tela fecha
- [~] 1215 `P1` **13 testes de foco e navegação por abas** (item 1195)
- [x] 1216 `P1` ~~Hub lembra a última aba~~ (1194) — **auditado**: `PauseMenu` guarda o `Tabs` num campo e `iniciar()` sem argumento já reusa a aba ativa. Coberto por teste em vez de reescrito
- [~] 1217 `P2` **Depreciações do three.js**: `Clock` → `Timer`, `PCFSoftShadowMap` → `PCFShadowMap` (o three.js já rebaixava sozinho e avisava a cada abertura)

> **O que o log ensinou.** Três defeitos numa única funcionalidade, e os três invisíveis para a
> suíte: um de validação ausente, um de **ordem** de operações, um de ciclo de vida de tela.
> Nenhum é lógica errada — são todos "a coisa certa na hora errada". Vale mais um log de console
> real do que uma rodada inteira de auditoria de código.

### Oitavo caso, e o teste que devia existir desde o primeiro

`WorldRepository.deleteWorld` estava lá: completa, transacional em nove tabelas (mundo, blocos,
chat, threads, jogadores, customizações, mods, entidades e revisões). **Nada a chamava.** Não
havia como apagar um mundo dentro do jogo — que é como os "Visitante de ws://localhost:8787" das
tentativas frustradas viraram lixo permanente na lista.

Isso encerra a lista dos oito, e deixa clara a natureza do problema:

| # | Funcionalidade | O que faltava |
|---|---|---|
| 1 | `setViewRange` | `scene.fog` era `null`, o `if` falhava em silêncio |
| 2 | `applyCurvature` | o shader existia com `invR = 0` |
| 3 | `UndoManager.recordBatch` | nenhuma edição o chamava |
| 4 | Estações | mudavam o clima e o F3, e nada no mundo |
| 5 | Biomas | o worldgen usava limiares paralelos próprios |
| 6 | Onda da água | `applyCurvature(waterMaterial)` sem o segundo argumento |
| 7 | Tabela `CAMADA` | sete das nove telas escreviam `z-index` literal |
| 8 | `deleteWorld` | não havia botão |

**Os oito tinham todos os testes passando.** Uma função nunca chamada não quebra nada; ela
simplesmente não acontece. Teste de unidade prova que a função funciona — nenhum pergunta se
alguém a usa.

- [~] 1218 `P0` **Botão de apagar mundo**, com confirmação em dois estados no próprio botão. Um `confirm()` do navegador é fácil de despachar no automático e, pior, alguns navegadores o bloqueiam — o mundo sumiria sem pergunta nenhuma
- [~] 1219 `P1` **A lista de mundos se atualiza ao voltar para a aba** (`aoAtivar`), com `montar` e `aoAtivar` de papéis separados: se os dois desenhassem, na primeira ativação os dois rodariam e a lista sairia duplicada — a mesma corrida do `renderBody`
- [~] 1220 `P0` **`tests/unit/fiacao.test.ts`** — guarda os oito casos de uma vez, procurando um chamador fora do arquivo que define. Textual, com a fragilidade que isso implica; a ferramenta ideal seria cobertura de integração com o jogo rodando, e isso exige WebGL que o jsdom não tem
- [~] 1221 `P2` **O varredor testa a si mesmo**: um teste que varresse zero arquivos passaria vazio e daria falsa segurança

## 47. O avatar enterrado — 26/07/2026

Você mandou uma referência de arte voxel e três frases: *"o jogador tem de 4-5 bloquinhos de
altura, a skin tá ficando dentro da terra, e não respeitando as proporções"*. Eram **dois
defeitos distintos**, e o segundo é dos mais instrutivos que apareceram aqui.

### 1. O balanço da marcha era dono da posição de mundo

`main.ts` escrevia a posição do jogador em `playerModel.group.position`. A linha seguinte —
`playerModel.update(...)` — terminava com:

```ts
this.group.position.y = moving ? Math.abs(Math.sin(this.walkCycle * 2)) * 0.02 : 0;
```

O balanço **descartava** o `y` que o `main` tinha acabado de escrever, plantando o avatar em
`y = 0` do mundo. Literalmente "a skin ficando dentro da terra": o boneco enterrado na origem
vertical, e não nos pés do jogador. **Dois donos para a mesma propriedade.** O conserto é
estrutural — um grupo interno (`corpo`) carrega o balanço, e `group` fica só com a transformação
de mundo. Não existe mais caminho para um sobrescrever o outro.

### 2. Duas réguas, e nenhuma ponte entre elas

A física conta em mini-voxels: `HEIGHT = 5.3` em `controller.ts`. O modelo era construído em
metros: `PLAYER_HEIGHT = 1.8` em `Appearance.ts`. **Nada convertia entre os dois.** O avatar saía
com um terço do tamanho do próprio corpo de colisão.

Este é o tipo de defeito que nenhum teste unitário encontra, e vale entender por quê: **os dois
números estavam certos**, cada um na sua régua. Não havia nada a reprovar em `5.3`, nem em `1.8`.
O erro morava no espaço entre os dois arquivos, que é exatamente onde não há teste.

- [~] 1222 `P0` **Grupo `corpo` interno** — o balanço deixa de sobrescrever a posição de mundo
- [~] 1223 `P0` **`ESCALA_MODELO`** liga as duas réguas; `ALTURA_MUNDO` passa a ser a fonte única
- [~] 1224 `P0` **Proporções da referência**: cabeça grande (29%), torso curto, ombros mais estreitos que a cabeça, braços e pernas finos
- [~] 1225 `P0` **Pivôs derivados das proporções** — eram cravados (1,34 / 0,80 / 1,40) e casavam com uma versão antiga. Mudar uma altura girava o braço em torno de um ponto que não era mais o ombro
- [~] 1226 `P1` **Plaquinha de nome e câmera do preview derivadas de `ALTURA_MUNDO`** — as duas estavam calibradas para 1,8; a câmera do criador ficaria dentro do joelho do boneco
- [~] 1227 `P1` **8 testes de ancoragem e proporção**: o balanço não toca na posição de mundo, o balanço continua existindo (a correção não pode ser desligar o efeito), os pés ficam em `y=0`, o corpo tem a altura da colisão, as proporções somam a altura, e as articulações caem onde o corpo muda de peça
- [~] 1228 `P2` **Acessor `pecas`** para teste e acessórios, em vez de acoplamento a `group.children`

> **O que este caso ensina, e é diferente dos oito anteriores.** Aqueles eram código que ninguém
> chamava. Estes dois são código chamado, correto e **em conflito com outro código igualmente
> correto**. Um teste por arquivo não os encontra: só encontra quem olha para a costura. O teste
> que agora existe mede o avatar *no mundo* — caixa envolvente contra a altura da colisão — em vez
> de conferir números dentro de um arquivo só.

## 48. "O mundo não é o mesmo no multiplayer" — 26/07/2026

A causa era total, não sutil. O mundo do convidado era criado assim:

```ts
seed: Math.floor(Math.random() * 1000000),
```

**Uma semente aleatória.** O terreno inteiro é gerado a partir dela — relevo, biomas, cavernas,
minérios, árvores. Cada jogador via um mundo completamente diferente.

### Por que o `full_sync` não salvava

Porque ele carrega apenas o que foi **editado à mão**: `blockMods`, jogadores e mods. Sobre um
terreno gerado de outra semente, essas edições caem no vazio — uma casa construída num morro do
anfitrião aparece flutuando, ou enterrada, no mundo do convidado. Pior que nada: dá a impressão
de que a sincronização "quase funciona".

E a semente não podia simplesmente entrar no `full_sync`: quando ele chega, o convidado **já
gerou terreno**. A informação chegaria tarde.

### A correção

Uma mensagem nova, `world_info`, é a **primeira** coisa que o anfitrião envia a quem conecta — à
frente do `full_sync` e do relógio. Ela leva semente, altura base e nome. E o convidado **espera
por ela antes de criar o mundo**, em vez de gerar o errado e tentar corrigir depois.

O tratamento dela fica **fora** do `switch` do tratador de mensagens, e isso é deliberado: ela
chega antes de o jogo existir, num instante em que não há `world`, nem HUD, nem chat. Qualquer
outro ramo do tratador tocaria em algo ainda não construído.

- [~] 1229 `P0` **`WorldInfoMsg`** no protocolo: semente, altura base e nome do mundo do anfitrião
- [~] 1230 `P0` **O convidado adota a semente do anfitrião** — os dois geram exatamente o mesmo terreno
- [~] 1231 `P0` **A espera acontece antes de criar o mundo**, não depois
- [~] 1232 `P1` **Prazo de 8 s na espera**, com mensagem clara: um anfitrião de versão antiga não conhece `world_info` e travaria a entrada para sempre
- [~] 1233 `P1` **O id do mundo de visitante inclui a semente** — entrar em dois mundos diferentes do mesmo anfitrião não pode reaproveitar o cache de blocos de um no outro
- [~] 1234 `P1` **O convidado herda o NOME do mundo**, em vez de "Visitante de room-xyz"
- [~] 1235 `P1` **4 testes**, incluindo um que reprova a volta de `Math.random()` na semente do convidado e um que verifica a **ordem** (esperar antes de criar)

> **Por que nenhum teste pegou.** A sincronização de blocos tinha testes, e passavam: ela de fato
> transmite os blocos corretamente. O que faltava era uma camada acima — a pergunta "os dois
> jogadores estão no mesmo mundo?" nunca tinha sido feita. Testar bem a parte não diz nada sobre
> o todo quando a peça que falta é a que liga as partes.

## 49. Auditoria de prioridade — 26/07/2026

Você pediu para eu olhar o que o próprio documento chama de prioridade. Contagem dos pendentes:
**41 `P0`**, 219 `P1`, 384 `P2`, 35 `P3`.

O maior agrupamento de `P0` não é jogabilidade nem interface: são **doze itens de segurança do
sandbox de mods** (358, 359, 735, 736, 761–768, 775). Fui verificar a afirmação em vez de repetir
o documento, e ela estava certa — o comentário no código é que estava errado:

```ts
// `new Function` com um único parâmetro: o corpo não recebe `window` nem `globalThis`
const fn = new Function('api', `"use strict";\n${script.code}`);
```

`new Function` isola o corpo do escopo **local** de quem o cria. Nada mais. O código continua
sendo avaliado no escopo **global**, onde `window`, `fetch`, `document`, `localStorage` e
`indexedDB` são variáveis livres perfeitamente alcançáveis. Não passar como argumento não esconde
coisa alguma.

Isso pesa mais aqui que na média: os scripts são **escritos por uma IA** a pedido do jogador e
rodam no navegador dele, na **mesma origem** onde estão os mundos salvos e o cofre de chaves de
API. Um script com `fetch` manda qualquer um dos dois para qualquer lugar.

### O que foi feito, e o que explicitamente NÃO foi

Os nomes perigosos passaram a ser **sombreados**: entram como parâmetros da função com valor
`undefined`, e como parâmetro é ligação léxica, `fetch` dentro do corpo resolve para o parâmetro.

**Isto não é uma fronteira de segurança contra código hostil**, e o teste diz isso em voz alta:
há um caso que **verifica a brecha existir** — `[].constructor.constructor('return this')()`
ainda escapa, porque a função criada por `Function` também é avaliada no escopo global. Ele passa
quando a fuga funciona, de propósito, para ninguém ler os outros nove e concluir demais.

`eval` não está na lista de sombreados e não é esquecimento: em modo estrito ele é proibido como
nome de ligação, então `new Function('eval', …)` é um `SyntaxError`. É mais uma razão para a
fronteira real ser outro reino de execução.

- [~] 1236 `P0` **`src/mods/sandbox.ts`**: escopo global sombreado, com o critério documentado (bloqueia rede, armazenamento, documento e caminhos de volta ao global; preserva `Math`, `JSON`, `Date`, `Promise` — sem eles a plataforma de mods não serve para nada)
- [~] 1237 `P0` **10 testes de sandbox**, sendo um que confirma a brecha restante em vez de escondê-la
- [~] 1238 `P1` **O comentário mentiroso do `ModRuntime` foi corrigido** — ele afirmava a proteção que não existia, que é pior que não comentar nada

### Continua pendente, e agora com o tamanho certo

- [ ] 1239 `P0` **Item 358 é a correção de verdade**: rodar o script em Web Worker sem `fetch`, ou iframe com `sandbox`. Só outro reino de execução fecha a saída pelo construtor
- [~] 1240 `P0` ~~Item 382~~ **FEITO nesta rodada** — item 382 (**sincronizar entidades**) — em aberto e confirmado no código: o convidado roda o próprio `MobSpawner` sem checar o papel, e `EntityUpdateMsg` está **definida no protocolo e nunca enviada nem recebida**. É o nono caso de código dormente, e a continuação direta do "o mundo não é o mesmo no multiplayer"

## 50. As criaturas — a segunda metade de "o mundo não é o mesmo"

A semente resolveu o terreno. Faltava o que se mexe em cima dele: **o convidado rodava o próprio
`MobSpawner`, sem checar o papel**. Cada lado criava as suas criaturas, em lugares diferentes, e
simulava as mesmas de forma independente.

**Duas simulações autônomas do mesmo objeto nunca convergem.** Não é imprecisão que uma correção
periódica conserta — é falta de autoridade. Só um lado pode decidir.

### O nono caso de código dormente

`EntityUpdateMsg` (`id, x, y, z`) estava no protocolo, na união de tipos, e **nunca era enviada
nem recebida**. Nenhuma referência em `main.ts`.

E ela não bastaria. Com só posições, o convidado nunca sabe que uma criatura **nasceu** — não vem
o tipo — nem que **morreu**: a ausência não é um evento, não chega mensagem nenhuma. Um zumbi
morto pelo anfitrião ficaria parado para sempre na tela do convidado.

### Retrato, e não evento por criatura

`MobSyncMsg` leva a lista inteira, seis vezes por segundo. Uma regra só resolve os três casos:
**o que está na lista existe, o que não está deixou de existir.** E é auto-corretivo — uma
mensagem perdida some no retrato seguinte, em vez de deixar estado divergente preso para sempre.

O custo é mandar tudo sempre; com dezenas de criaturas e seis envios por segundo, é irrelevante
perto da robustez que compra.

- [~] 1241 `P0` **`entitySystem.autoridade`** — com `false`, a IA hostil não roda: o convidado desenha onde o anfitrião disser, e nada mais
- [~] 1242 `P0` **O convidado não gera criaturas** (`mobSpawner.enabled` passou a checar o papel)
- [~] 1243 `P0` **`MobSyncMsg`**: retrato a 6 Hz, não por quadro — criatura anda devagar, e 60 Hz seria dez vezes a banda para nenhum ganho visível
- [~] 1244 `P0` **`aplicarRetratoDeHostis`** com mapa id-do-anfitrião → id local. Sem ele cada mensagem criaria criaturas novas, e em segundos haveria centenas
- [~] 1245 `P1` **`mobKind` guardado no registro** — o perfil sozinho não identifica a espécie de volta, e sem isso o convidado desenharia todo mundo como zumbi
- [~] 1246 `P1` **10 testes**, incluindo um que prova que a IA **continua funcionando** no anfitrião: sem ele, "consertar" seria trivial e inútil — bastaria nunca mover ninguém

> **O padrão dos dois relatos de multijogador.** Em ambos, a parte tinha teste e passava. O que
> faltava era a pergunta de cima: *"os dois jogadores estão vendo a mesma coisa?"*. Testar bem
> cada peça não diz nada sobre o todo quando o que falta é a peça que liga as peças.

## 51. Sandbox: de lista de negados para lista de permitidos — e o tamanho real do item 358

A primeira versão sombreava os nomes perigosos passando-os como parâmetros `undefined`. Funciona,
e tem o defeito de toda lista de negados: **o que eu esquecer, ou o que o navegador ganhar depois,
entra livre**.

Agora o corpo do script roda dentro de um `with` sobre um `Proxy` cujo `has` responde **sempre que
sim**. Dentro de um `with`, o motor pergunta ao objeto se ele tem cada nome livre *antes* de
procurar no escopo externo — respondendo sempre que sim, nenhuma busca chega ao global, e o `get`
decide nome a nome. Vira lista de **permitidos**: só cálculo puro passa.

Três detalhes que o teste fixou:

- **`with` é proibido em modo estrito**, então o invólucro é permissivo. O corpo do script,
  dentro dele, é estrito — e precisa ser: em modo permissivo `(function(){return this})()`
  devolve o objeto global, a rota de fuga mais curta que existe.
- Sem o estrito externo, `vazando = 1` criaria um global de verdade. O `set` do Proxy recusa.
- `Symbol.unscopables` precisa devolver `undefined`, senão o motor o interpreta como uma lista de
  nomes a ignorar e o `with` deixa de capturar tudo.

- [~] 1247 `P0` **Escopo por lista de permitidos** (`with` + `Proxy`), no lugar da lista de negados
- [~] 1248 `P0` **Corpo em modo estrito dentro do invólucro permissivo** — fecha a fuga pelo `this`
- [~] 1249 `P1` **A lista de perigosos virou teste executável**: cada nome dela é rodado dentro do sandbox e precisa sair `undefined`. Antes o teste só verificava que a lista *continha* o nome — provava que alguém o escreveu, não que estava bloqueado
- [~] 1250 `P1` **Teste com nomes inventados** (`WebTransport`, `apiQueAindaNaoExiste`) provando o bloqueio por omissão

### O tamanho real do item 358, medido

Fui implementar o Worker e parei para medir. **O obstáculo não é o Worker — é a API.**

`buildModAPI` é **síncrona e de leitura**: `world.getBlock(x,y,z)` devolve o bloco na hora,
`world.findNearest` varre e retorna, `player.position()` responde imediatamente. Um Worker só
conversa por `postMessage`, que é assíncrono. Levar o script para lá obriga **toda** a API a
virar `await`, e isso reescreve o modelo de programação de todo mod já criado.

Não é trabalho de uma passada, e fingir que é seria pior que deixar pendente. O que fica
registrado, para quem for fazer:

- [ ] 1251 `P0` Tornar a API de mods assíncrona (`await api.world.getBlock(...)`) — **pré-requisito do 358**
- [ ] 1252 `P0` Migrar os mods existentes, ou manter um modo compatível para os que já existem
- [ ] 1253 `P1` Só então mover a execução para o Worker, com os globais do Worker apagados (`fetch`, `importScripts`, `indexedDB`) — no Worker isso funciona de verdade, porque a fuga pelo construtor devolve o global **daquele** reino, que está vazio

## 52. O caminho de saída de um segredo não é a rede — é o texto

`api.env.get('API_KEY')` devolve a chave de verdade ao script, e isso está **certo**: ele roda no
mesmo cliente, com os mesmos privilégios do jogo. Um mod que precisa da chave para chamar uma API
precisa da chave. Esconder dele seria teatro.

A fronteira real é o valor **não sair da máquina**. E o caminho mais fácil de saída não é o
`fetch` — que o sandbox já bloqueia. É o texto:

```js
api.log('conectando com', api.env.get('API_KEY'));
```

A chave vai para o log do mod, aparece no painel, entra no diagnóstico e pode acabar no histórico
da conversa que o agente lê. Sai da máquina sem nenhuma chamada de rede envolvida.

E acontece **sem má intenção**: depurar imprimindo a variável é o reflexo mais comum que existe, e
uma IA escrevendo o mod faz exatamente isso.

### Duas decisões de projeto

**Redigir ao gravar, não ao exibir.** Proteger em cada leitor — painel, diagnóstico, contexto do
agente — é uma corrida que se perde na primeira vez que alguém adiciona um leitor e esquece. O
valor nunca chega a ser armazenado, então não há leitor capaz de vazá-lo.

**Comparar por valor, não por origem.** Redigir "o que veio de `env.get`" exigiria rastrear o dado
através de concatenações, interpolações e `JSON.stringify` — impossível sem instrumentar o motor.
Comparar o texto final contra os valores conhecidos é simples e não tem como escapar.

- [~] 1254 `P0` **`src/mods/redacao.ts`**: máscara sobre qualquer ocorrência, em qualquer posição
- [~] 1255 `P0` **Aplicada em `ModContext.log` e em `recordError`** — `fetch(url + chave)` que falha traz a chave no texto da exceção
- [~] 1256 `P1` **Segredos mais longos primeiro**: se um contém outro, redigir o curto antes partiria o longo e deixaria a cauda visível
- [~] 1257 `P1` **Piso de 6 caracteres** — um segredo de dois ou três apareceria por acaso em toda mensagem, e o log viraria uma sopa de asteriscos, escondendo o problema de verdade
- [~] 1258 `P1` **Caractere especial de regex escapado** no valor do segredo
- [~] 1259 `P1` **13 testes**, incluindo chave dentro de objeto serializado e dentro de mensagem de erro
- [~] 1260 `P2` **O stub de teste do host passou a implementar `modEnv`** — a alternativa era guardar a chamada com `?.`, que desligaria a redação em silêncio num host que esquecesse de implementar: exatamente a falha que ela previne

## 53. O teto invisível de 8 voxels — item 030

Item mecânico na aparência: "extrair as constantes de altura mágicas para um `WORLD_MAX_Y`
único". Extrair obrigou a responder **"120 por quê?"**, e a resposta era um defeito.

Seis lugares varriam a coluna de cima para baixo começando em `120`, num mundo de `128`:

```ts
for (let y = 120; y >= 0; y--) { ... }   // acha a superfície
```

**Os oito voxels do topo eram invisíveis para todos eles.** Construa uma torre até y=125 e o
"achar a superfície" devolve o chão lá embaixo. Quem teleporta ou nasce naquela coluna aparece
**dentro** da construção. O `120` provavelmente nasceu como margem de segurança e virou um teto.

O sexto lugar é o pior: `ai/WorldPerception.ts` — **o agente enxergava o mundo com o teto
cortado**. Ele descreveria como "campo aberto" uma coluna com uma torre de 125 blocos.

### Os dois nomes, e por que não é sinônimo à toa

`CY` é a altura de **uma coluna de chunk** — para quem indexa o array. `WORLD_MAX_Y` é o limite do
**mundo** — para quem varre, valida coordenada ou posiciona. Valem o mesmo hoje porque há uma só
camada de chunks na vertical. Separar os nomes é o que permite mudar isso (item 029) sem caçar
cada `CY` para decidir qual dos dois significados ele tinha ali.

- [~] 1261 `P0` **`WORLD_MAX_Y`** e **`TOPO_VARREDURA`**, com o porquê de cada um documentado
- [~] 1262 `P0` **Seis varreduras corrigidas** — `main.ts`, `EventSystem`, `MCPExecutors` (×3) e `WorldPerception`
- [~] 1263 `P1` **Teste que reprova varredura descendente com literal** — o número estava em seis arquivos; sem isso, o sétimo nasce com o mesmo defeito. O regex distingue laço descendente de `for (let y = 0; y < CY; y++)`, que é ascendente e legítimo
- [~] 1264 `P1` **Teste do caso concreto**: torre a `WORLD_MAX_Y - 3` é encontrada pela varredura

## 54. Validador de contraste — item 076

O jogador pede "cria um bloco de pedra escura" e a IA gera um cinza. Já existe um cinza quase
igual. Os dois viram blocos distintos no inventário, com nomes e receitas diferentes, e
**indistinguíveis na tela**. O jogador quebra o errado, constrói com o errado, e nada o avisa.

**Não é um erro que o agente perceba sozinho**: ele não vê a tela, e do ponto de vista dele o
bloco foi criado com sucesso.

### Três decisões

**Distância perceptual, não RGB cru.** `#00FF00`→`#00E000` e `#0000FF`→`#0000E0` têm a mesma
distância numérica em RGB; aos olhos o par verde é muito mais parecido, porque a visão é bem mais
sensível ao verde. A luminância Rec. 709 entra como eixo principal — a mesma ponderação já usada
na gradação de cor, para o jogo ter uma só noção de "quanto isto é claro".

**Fora de `validateModPackage`.** Aquela função roda também na **carga** de um mod salvo. Um bloco
criado antes desta regra existir passaria a reprovar e o mod iria para quarentena sozinho na
próxima abertura — o jogador perderia conteúdo por causa de uma regra nova. A regra vale para o
que está sendo criado **agora**.

**Um conflito, não a lista.** Uma cor parecida com cinco cinzas geraria cinco reclamações sobre o
mesmo problema, e o agente que lê isso tende a tratar como cinco correções separadas.

- [~] 1265 `P0` **`distanciaPerceptual`** ponderada por luminância
- [~] 1266 `P0` **`conflitoDeContraste`** contra blocos nativos e de outros mods, ignorando os do próprio pacote — uma família coerente não deve brigar consigo mesma
- [~] 1267 `P1` **Sugestão com direção** ("clareie" / "escureça"), escolhendo o lado que afasta do vizinho. "Escolha outra cor" devolve o problema para quem não sabe resolvê-lo
- [~] 1268 `P1` **Limiar calibrado em 0,055** — alto demais proibiria variações legítimas, e o agente passaria a inventar cores berrantes para passar na validação: pior que o problema original
- [~] 1269 `P1` **11 testes**, incluindo o que prova a ponderação perceptual (par verde vs par azul de mesma distância RGB)
- [~] 1270 `P2` **Testes do `ModService` ganharam cores reais** — usavam `topColor: 0` como valor descartável, e o validador (corretamente) passou a recusar

## 55. O décimo caso — e um defeito dentro do defeito

Auditei três `P0` antes de escrever código, porque este repositório tem histórico. Dois estavam
**feitos**: o painel de mods (430, 642) já lista, ativa, remove, exporta, mostra versões e faz
rollback. Marcados como verificados, sem retrabalho.

O terceiro, 705, era o **décimo caso de código dormente** — e o mais irônico até agora.

`ModContext.placedBlocks` existia, era preenchido a cada `setBlock` do mod, e trazia o comentário
*"para reverter com precisão"*. **Nada revertia.** Não existia nem função de reverter. O único uso
era `blocksPlaced: ctx.placedBlocks.size`, num relatório de diagnóstico.

### O defeito dentro do defeito

O mapa guardava o bloco **colocado**, não o anterior. Com esse dado a reversão precisa é
**impossível**: dá para saber o que apagar, não o que restaurar no lugar. Um mod que trocou terra
por pedra deixaria um buraco de ar.

Ou seja: mesmo que alguém tivesse escrito a função de reverter, ela não teria como funcionar
direito — e o comentário prometendo precisão estaria mentindo desde sempre.

### A guarda que separa desfazer de voltar no tempo

A reversão só restaura onde o bloco **ainda é o que o mod pôs**. Se o jogador quebrou aquilo
depois, ou construiu por cima, a posição fica em paz. Reverter sobre uma edição do jogador
destruiria trabalho dele para desfazer o de outro.

- [~] 1271 `P0` **`placedBlocks` passou a guardar `{ antes, depois }`** — o `antes` é o que devolve o terreno em vez de abrir um buraco
- [~] 1272 `P0` **`reverterBlocosDoMod`**, com a guarda "só onde ainda é o que o mod pôs"
- [~] 1273 `P1` **Escrita dupla na mesma posição guarda o `antes` da primeira** — o estado que interessa é o do mundo antes de o mod tocar ali, não o que o próprio mod pôs no passo anterior
- [~] 1274 `P1` **6 testes**, incluindo o caso do jogador que construiu por cima
- [x] 430, 642 **Auditados** — o painel de mods já fazia tudo o que os itens pediam

### Item 704 — a reversão que funcionava pela metade

O agente altera o mundo por **dois** caminhos: o script do mod, que já registrava, e as
ferramentas diretas `set_block`, `fill_box` e `execute_voxel_script`. As segundas escreviam no
mundo sem atribuição nenhuma — e **o que não tem dono não pode ser revertido**.

Na prática isso partia a reversão ao meio. O jogador pede "faça uma torre", o agente usa
`fill_box`, e depois "desfaça esse mod" deixa a torre de pé. A metade vinda do script sumia, a
metade vinda da ferramenta ficava. **Pior que não reverter nada**, porque o resultado é um mundo
em estado intermediário que ninguém pediu.

A correção não foi atribuir em cada `case` — foi **fechar o caminho**: existe um só método de
escrita, e um teste conta as chamadas diretas a `world.setBlock` no arquivo, aceitando exatamente
uma (a de dentro do próprio método). Sem isso, o próximo `case` nasce sem atribuição e ninguém
percebe até alguém tentar reverter.

- [~] 1275 `P0` **`escreverBloco`** — caminho único de escrita do agente, com atribuição ao mod da sessão
- [~] 1276 `P0` **Cinco escritas diretas convertidas** (`set_block`, `fill_box`, e três dentro de `execute_voxel_script`)
- [~] 1277 `P1` **Teste que conta as escritas diretas no fonte** e aceita exatamente uma
- [~] 1278 `P1` **Silencioso em sessão livre** — sem mod vinculado não há a quem atribuir, e isso é modo de uso legítimo, não erro

### Item 402 — orçamento que reage ao custo real

Já existia um limite por **contagem**, derivado do alcance de visão: `Math.max(2, viewRadius / 2)`.
É metade do problema, e a metade fácil.

O que faltava é o que dá nome ao item. Numa máquina lenta, ou num momento caro (tempestade com
partículas, muitas criaturas em volta), gerar o mesmo número de malhas transforma um quadro pesado
numa **engasgada visível**. O orçamento agora encolhe quando o quadro passa do alvo e volta a
crescer quando sobra tempo.

A troca é deliberada: **atraso se percebe menos que solavanco.** O mundo carrega um pouco mais
devagar em vez de travar.

Três decisões que os testes fixaram:

- **Desce depressa, sobe devagar.** Um solavanco precisa de resposta imediata; recuperar o ritmo
  pode levar quadros. Simétrico produziria vaivém — um controle que corrige demais passa a causar
  o problema que deveria resolver.
- **Nunca chega a zero.** O custo alto não vem só das malhas, então parar de gerá-las não conserta
  o quadro e ainda congelaria o carregamento para sempre.
- **Zona morta entre 1,1× e 1,5× do alvo**, senão um quadro parado no limite alternaria subir e
  descer indefinidamente.

- [~] 1279 `P0` **`OrcamentoDeQuadro`** em módulo próprio — dentro de `bootstrap()` não seria testável sem subir o jogo
- [~] 1280 `P1` **7 testes**, incluindo a assimetria subida/descida e o piso que impede o congelamento

## 56. Varredura de auditoria dos `P0` restantes

Antes de escrever mais código, varri os `P0` pendentes procurando o que já estava feito. O padrão
se repetiu.

**Feitos, marcados como verificados:**

- **221 e 222 (fluidos).** `world/fluids.ts` já escoa por níveis (`WATER_SPREAD`, `LAVA_SPREAD`) e
  já solidifica água+lava em obsidiana. Os dois itens estavam pendentes por engano de auditoria.

**O buraco que a varredura encontrou — e não estava no checklist:**

As picaretas iam até o tier 3 (ferro). Nenhum bloco exige tier 4, então **nada estava
inalcançável** — não era esse o problema. O problema era mais silencioso: **o diamante era o fim
da corrente sem uso**. O jogador minerava minério de diamante com a picareta de ferro, montava o
bloco de diamante, e acabava ali. O material mais raro do jogo não levava a lugar nenhum.

Uma progressão cujo último degrau não abre nada **termina antes do fim**: o jogador para de
minerar ao perceber que já tem tudo o que importa, no ferro. É um defeito de desenho, não de
código, e por isso nenhum teste o encontraria — foi preciso perguntar "para que serve o diamante?".

- [~] 1281 `P0` **Picareta de diamante** (tier 4), fechando a corrente madeira → pedra → ferro → diamante
- [~] 1282 `P1` **Teste de corrente sem buraco** — um degrau faltando no meio deixaria o jogador com a picareta anterior e nenhuma receita para a seguinte
- [~] 1283 `P1` **Teste "todo tier exigido tem picareta que o alcança"** — um bloco pedindo tier 5 sem ferramenta de tier 5 é conteúdo que existe no mundo e ninguém pega, sem nada avisando
- [~] 1284 `P1` **Teste "o material mais raro leva a alguma coisa"**

### Anotado como faltando, descoberto nesta varredura

- [ ] 1285 `P1` ~~Espada/machado por tier~~ **REDIMENSIONADO** — o jogo não tem *tipo* de ferramenta, só `toolTier` genérico, e `damageForTier` já faz a tier valer no combate. Uma espada seria só outro rótulo com o mesmo efeito. Fazer isso de verdade exige um conceito de **classe de ferramenta** (velocidade por material, dano por tipo) — mudança de desenho, não de receita
- [ ] 1286 `P1` **Diamante sem uso além da picareta** — armadura ou ferramenta especial, senão o tier 4 é um beco
- [~] 1287 `P2` **Nenhum bloco exige tier 4** — feito: a obsidiana passou a exigi-lo (ver "O último degrau ganha porta"). Anotei esta mesma lacuna **duas vezes**, aqui e em 1293, em rodadas diferentes; 1293 é a duplicata

### O teto por saturação — descoberto ao conferir a própria correção anterior

Depois de adicionar a picareta de diamante, fui verificar se ela de fato faz diferença. Não fazia.

`TIER_DAMAGE = [2, 3.5, 5, 7]` ia até o índice 3, e `damageForTier` **satura** no último:

```ts
const t = Math.max(0, Math.min(TIER_DAMAGE.length - 1, Math.floor(tier || 0)));
```

Uma picareta de tier 4 batia **exatamente como a de ferro** — a receita mais cara do jogo, sem
nenhuma diferença. E o comentário logo acima da tabela já falava em *"a picareta de diamante bate
~3× a mão"*, descrevendo uma ferramenta que não existia: estava aspiracional desde que foi escrito.

**Um teto por saturação é o pior tipo de teto**, porque não falha. Não há erro, não há aviso — só
deixa de recompensar em silêncio. Quem jogasse concluiria que o diamante "não vale a pena", sem
nada explicando o porquê.

- [~] 1288 `P1` **`TIER_DAMAGE` estendida ao tier 4** (9,5), mantendo a curva suave
- [~] 1289 `P1` **Teste que amarra a tabela à corrente de receitas** — a tabela precisa ser mais longa que o maior tier que existe, senão a saturação volta calada
- [~] 1290 `P1` **Teste de curva sem degrau parado** e **teto de proporção** — sem o segundo, a correção teria a saída fácil de inflar o último valor e virar um botão de deletar inimigo

### Lacunas anotadas nesta rodada

- [~] 1291 `P1` **Tier passou a afetar a velocidade de quebra** — antes:  — `breakCooldown` é fixo (0,42 / 0,16). Uma picareta melhor hoje só desbloqueia blocos e bate mais forte; minerar pedra com diamante leva o mesmo tempo que com madeira, que é o oposto da expectativa do gênero
- [ ] 1292 `P1` **Não existe classe de ferramenta** (picareta / machado / pá / espada). Sem isso, "espada de ferro" seria só um rótulo diferente para a picareta de ferro
- [~] 1293 `P2` **Duplicata de 1287** — a mesma lacuna anotada duas vezes, em rodadas diferentes. Feita junto

### O último degrau ganha porta — itens 1287/1293

A picareta de diamante existia, batia mais forte e minerava mais rápido, e mesmo assim **não
desbloqueava um único bloco**: o maior `minToolTier` do jogo era 3. O efeito prático da receita
mais cara era "os mesmos blocos, só que antes".

A obsidiana passou a exigir tier 4. Ela é a candidata certa por três motivos, e nenhum deles é ser
a mais escura:

- **Nasce sozinha** no encontro de lava com água (`fluids.ts`), evento comum em caverna profunda —
  a porta aparece no caminho de quem já está no fundo, em vez de exigir uma expedição própria.
- **Não é ingrediente de nada**, então subir a exigência não tranca nenhuma receita anterior. Se
  fosse o minério de ferro, o jogo ficaria sem corrente de progressão nenhuma.
- O portão é **"quebra mas não dropa"** (`awardDrop`), não uma parede: ninguém fica preso atrás de
  obsidiana que não consegue remover — inclusive a que o próprio jogador criou por acidente
  jogando água na lava.

**O teste que faltava era o simétrico do que existia.** Já havia "todo tier exigido tem picareta
que o alcança" — que impede conteúdo inalcançável. Faltava o contrário: "a melhor picareta alcança
algo que as outras não". Sem ele, a ponta da progressão degenera **em silêncio**: a receita sai,
todos os testes passam, e não falha em lugar nenhum. Foi o estado real por uma rodada inteira.

Somei um segundo, mais geral: **cada tier coleta algo que o anterior não coletava**. Um degrau que
não amplia o conjunto de blocos coletáveis é um degrau que o jogador pode pular sem perder nada —
e uma receita cara que ninguém tem motivo para fazer.

- [~] 1296 `P1` **Obsidiana exige tier 4** — o único bloco que a picareta de diamante abre
- [~] 1297 `P1` **Teste "o último degrau abre porta própria"** — o simétrico que faltava
- [~] 1298 `P2` **Teste "cada tier desbloqueia algo a mais que o anterior"** — pega o degrau vazio no meio, não só na ponta

### Item 1291 — a razão de subir de tier

A tier decidia **se** um bloco podia ser quebrado e quanto dano causava em combate, mas não **quão
rápido** se minerava: `breakCooldown` era fixo. Minerar pedra com a picareta de diamante levava
exatamente o mesmo tempo que com a de madeira.

Isso desfazia boa parte da razão de subir de tier — o jogador gasta uma corrente inteira de
progressão para ganhar acesso a blocos novos e **nenhum conforto** nos que já minerava.

Duas regras, as duas para manter a mineração uma decisão e não uma formalidade:

**A vantagem é relativa ao bloco, não absoluta.** Uma picareta de diamante numa pedra que só pede
madeira tem três degraus de vantagem; na obsidiana, que pede ferro, tem um. É o que faz o material
duro continuar duro mesmo com a melhor ferramenta — sem isso, o fim da progressão apagaria a
diferença entre os materiais, e obsidiana viraria terra.

**Só acelera o que resiste.** Terra, areia e folhagem não têm `minToolTier`: já saem num golpe.
Acelerá-las não daria sensação nenhuma e ainda tornaria o modo detalhe difícil de controlar.

- [~] 1294 `P1` **`fatorDeVelocidade`** em módulo próprio, com teto de ~2,2× — sem o piso, uma corrente de tiers longa levaria o fator a zero e o mundo deixaria de ter custo
- [~] 1295 `P1` **8 testes**, incluindo "ferramenta insuficiente não é penalizada aqui" (quem barra o bloco é a regra de tier mínimo; penalizar de novo seria punir duas vezes pelo mesmo motivo, num lugar onde ninguém procuraria)

---

## 57 — O loop central e o guia do novato (itens 006, 007, 008)

O jogo tinha cinco modos, sobrevivência com vida e fome, minérios por profundidade e uma corrente
de ferramentas de quatro degraus — e **nada que dissesse ao jogador o que fazer com isso**.

Não é um defeito de código: cada peça funcionava. É que a progressão inteira era **invisível**.
Nada avisava que a picareta de madeira abre a pedra, que o carvão vira tocha, nem que a tocha é o
que torna a caverna explorável. Descobrir a cadeia exigia ler receitas. O sintoma não é confusão —
é o jogador construir uma casinha, achar que viu tudo, e sair em dez minutos.

### O que foi feito

`docs/LOOP_CENTRAL.md` define os quinze passos com tempo aproximado e, em cada um, **o que obriga o
seguinte**. Três deles são portões de verdade, onde o jogo diz "não" e o jogador precisa voltar um
passo: sem picareta a pedra não rende, sem tocha a caverna é escura demais para achar minério, sem
picareta de ferro o diamante não sai. Sem portões a ordem seria decorativa.

`src/game/Objetivos.ts` é a mesma corrente executável, com três regras:

**Um passo de cada vez.** O HUD mostra **um** objetivo, nunca a lista. Um novato diante de quinze
caixinhas continua sem saber por onde começar — que é exatamente o problema que o guia resolve.

**A ordem é sugestão, não trilho.** Cada evento é testado contra *todos* os pendentes. Ninguém
desce numa caverna seguindo uma lista, e obrigar a refazer o que já foi feito é a maneira mais
rápida de transformar um guia em estorvo.

**Concluído nunca volta a pendente.** Sem isso, gastar as tábuas na bancada desmarcaria "fabrique
tábuas", e o guia mandaria de volta à árvore alguém que já está no ferro.

### O defeito que a própria fiação revelou

Pendurei `amanheceu` na virada do contador de dias — o lugar mais óbvio, e onde o `worldDay++` já
estava. **`timeOfDay = 0` é meia-noite, não amanhecer.** "Sobreviva até o amanhecer" fecharia no
meio da noite, antes da parte perigosa.

Nada falharia: o objetivo marcaria, o toast apareceria, o som tocaria. A única coisa errada seria o
jogo ter dado a vitória cedo demais — e é por isso que virou teste. Passou a estar preso à
transição de fase (`faseAtual === 'amanhecer'`), com uma trava que reprova se alguém o devolver
para perto do `worldDay++`.

- [~] 1299 `P0` **`RastreadorDeObjetivos`** — 21 testes, incluindo "restaurar de vazio zera" (um só rastreador serve todos os mundos da sessão; sem limpar, quem cria um mundo novo depois de jogar outro começa com meia corrente feita)
- [~] 1300 `P0` **Cartão de objetivo no HUD**, canto superior esquerdo, só no Modo Sobrevivência
- [~] 1301 `P1` **9 travas de fiação** — a classe é pura e completamente inerte sozinha; sem os quatro pontos de instrumentação, todos os 21 testes passariam e nenhum objetivo avançaria em jogo
- [~] 1302 `P1` **`amanheceu` preso ao amanhecer**, não à meia-noite — com teste que reprova a regressão
- [~] 1303 `P2` **Som próprio de conquista** (sobe uma oitava, dura o triplo de `pegarItem`) — um clique curto se confunde com pegar item, e a conquista deixa de ser um momento
- [~] 1304 `P2` **Progresso no save do jogador**, por id e não por índice — guardar "estou no passo 4" faria um objetivo inserido no meio deslocar todos os mundos já salvos

### Lacunas que este trabalho revelou

- [~] 1305 `P1` **Aba "Objetivos" no hub de pausa** — a corrente por extenso, com o que vem depois do próximo **esmaecido e não escondido**: esconder o futuro faria o esforço parecer sem destino; mostrar tudo em igualdade tiraria a resposta da pergunta "e agora?"
- [~] 1306 `P1` **O abrigo passou a ser verificado, não contado** — `src/game/abrigo.ts`, busca em largura com orçamento; ver a seção 58
- [ ] 1307 `P1` **O loop não tem segunda volta** — fecha no papel, mas depois da obsidiana não há material melhor nem objetivo maior. Liga-se aos itens 018/019/1286
- [ ] 1308 `P2` **A noite não é perigosa o bastante** para justificar o abrigo do passo 6 — os hostis nascem, mas nada força o jogador a se esconder (item 009)
- [~] 1309 `P2` **A morte passou a custar** (item 011). Segue aberto o 010 — o ponto de renascimento ainda é sempre o spawn original
- [ ] 1310 `P2` **Os tempos da tabela são estimativa, não medição** — nada registra quanto o jogador leva de fato até a primeira ferramenta (item 022)
- [ ] 1311 `P2` **O guia diz o quê, não como se joga** — quem não sabe que se coloca bloco com o botão direito ainda descobre sozinho (item 021)

---

## 58 — O abrigo que não abrigava (itens 1305, 1306)

Duas lacunas anotadas na rodada anterior, feitas na mesma.

### A lista completa (1305)

O cartão do HUD mostra **um** passo, de propósito. Quem quisesse rever o que já fez, ou entender
para onde a corrente vai, não tinha onde — e a resposta não é encher o canto da tela, que devolveria
ao novato exatamente o problema que o guia existe para resolver. São dois públicos e duas telas.

A aba "Objetivos" do hub de pausa mostra a corrente inteira, com **o futuro esmaecido em vez de
escondido**. Esconder faria a corrente parecer curta e o esforço, sem destino: o jogador não teria
como saber que minerar ferro leva a algum lugar. Mostrar tudo em igualdade tiraria a resposta da
pergunta "e agora?". Esmaecer preserva as duas coisas.

A aba **não some** nos modos sem progressão: sumir pareceria defeito. Ela explica por que está
vazia.

### O abrigo que não abrigava (1306)

O objetivo contava **blocos colocados**: doze quaisquer. Doze blocos de terra enfileirados no chão
cumpriam. O jogador recebia a confirmação de ter feito algo que não fez, e a primeira noite o pegava
do lado de fora — com o jogo tendo dito que estava tudo certo.

**Um objetivo que mede a ação errada é pior que objetivo nenhum**: ensina que o guia não sabe do que
está falando, e a partir daí nada que ele disser é levado a sério.

O que define abrigo não é contagem de paredes nem padrão de construção — as duas coisas obrigariam o
jogador a construir do jeito que o código espera. É **o ar em volta ser finito**. Então é uma busca
em largura pelo ar a partir do jogador, com orçamento: se ela se esgota, o espaço é fechado; se
estoura, o ar não acaba e o jogador está lá fora.

A propriedade que fez valer a pena: **um buraco na parede ou no teto derruba o resultado sozinho**,
sem nenhuma regra própria, porque o ar de fora entra pela busca. E uma caverna tapada conta como
abrigo — e deve mesmo: exigir construção seria exigir um estilo de jogo em vez de um resultado.

Duas armadilhas que viraram teste:

**Parede de um mini-voxel.** A busca anda de metro em metro, mas o Modo Detalhe constrói em
mini-voxels. Testar só o ponto de chegada atravessaria a parede em dois de cada três casos — sem
erro em lugar nenhum, só um abrigo que às vezes não conta e ninguém saberia por quê. Cada passo
confere todos os mini-voxels do caminho.

**Soterrado não é abrigado.** Quem está dentro da rocha maciça está preso, não protegido, e dar o
objetivo por cumprido ali premiaria um acidente ruim.

- [~] 1312 `P1` **`estaAbrigado`** com orçamento de 1200 células — é também o teto de custo: a busca nunca visita mais que isso, e um teste conta as leituras para provar
- [~] 1313 `P1` **13 testes de abrigo**, incluindo "doze blocos em fila não abrigam ninguém" (o defeito antigo reproduzido literalmente) e "vidro fecha, capim não"
- [~] 1314 `P2` **`colocou` removido do tipo de evento** — sem objetivo que o consumisse, seria mais uma variante dormente

### Lacunas anotadas nesta rodada

- [~] 1315 `P1` **A casa passou a proteger de spawn** — `mapearAbrigo` devolve o conjunto de células, e o `MobSpawner` recusa qualquer berço dentro dele
- [ ] 1316 `P2` **Um salão acima de ~10×10×10 m conta como "lá fora"** — consequência assumida do orçamento, mas uma base grande legítima seria reprovada sem explicação nenhuma na tela
- [~] 1317 `P2` **Aviso de "você está a céu aberto"**, uma vez por noite e só enquanto o objetivo está pendente

---

## 59 — A casa que não protegia (itens 1315, 1317)

O mapeamento de abrigo tinha um segundo uso óbvio, e não tê-lo feito junto teria deixado o jogo
numa posição pior que a de antes: o objetivo diria "você está abrigado" e o jogador continuaria
acordando com um zumbi dentro do quarto.

**O interior de uma casa fechada é o lugar mais escuro do mundo à noite.** A regra de spawn é
"nasce onde a luz efetiva é ≤ 6", e `MIN_SPAWN_DISTANCE` são 14 mini-voxels — menos de cinco metros.
Somando as duas, o **melhor** berço que o sorteio poderia encontrar era exatamente dentro do abrigo.
O jogador constrói para se proteger e o jogo o pune por ter construído, que é o caminho mais curto
para ele parar de construir.

`mapearAbrigo` passou a devolver **o conjunto de células** em vez de um sim/não. A busca já visita
exatamente essas células; jogá-las fora e recomeçar para cada candidato a spawn custaria uma
varredura por candidato. Com o conjunto, a pergunta "este ponto está dentro da casa?" é uma consulta
de tabela.

Três detalhes que viraram teste porque falham calados:

**O mapa precisa ser limpo ao amanhecer.** Um `Set` que nunca zera deixaria uma bolha permanente sem
spawn onde a casa esteve — seguindo o jogador pelo mundo inteiro, sem nada denunciando por quê.

**O bloqueio não pode matar o spawn.** Sem um teste que exija criaturas nascendo *fora* do abrigo,
"consertar" seria trivial e inútil: bastaria nunca gerar ninguém, e a noite deixaria de existir como
ameaça.

**A condição é `hasSurvival`, não `mobSpawner.enabled`.** O convidado não gera criaturas — quem as
gera é o anfitrião — mas tem objetivos próprios. Prender o mapeamento à autoridade deixaria "esteja
abrigado" impossível para todo mundo que entra num mundo dos outros.

O aviso do 1317 fecha o outro lado: quem levantou as quatro paredes e esqueceu o teto fazia tudo,
nada acontecia, e nada dizia o que faltava. Agora recebe uma frase — **uma vez por noite**, porque a
verificação roda a cada 2 s e trinta toasts por noite deixam de ser aviso e viram ruído que se
aprende a ignorar, inclusive quando estiver certo. E só enquanto o objetivo está pendente: depois de
cumprido, quem sai à noite de propósito já sabe o que está fazendo.

- [~] 1318 `P1` **`mapearAbrigo`** devolvendo o conjunto de células, com `estaAbrigado` como invólucro fino
- [~] 1319 `P1` **4 testes de spawn abrigado**, incluindo "o bloqueio não mata o spawn fora do abrigo"
- [~] 1320 `P1` **3 travas de fiação novas** — o mesmo mapa serve a duas coisas, e ligar só uma era o erro provável

### Lacunas anotadas nesta rodada

- [ ] 1321 `P1` **A criatura já nascida não é expulsa** — a regra vale para o berço, não para quem já está dentro. Quem tapar o buraco com um zumbi dentro fica com ele lá para sempre
- [ ] 1322 `P2` **O abrigo só é mapeado a partir do jogador** — num mundo com dois jogadores, a casa do outro não protege ninguém enquanto ele não estiver dentro dela
- [ ] 1323 `P2` **A porta ainda não existe** — sem um bloco que abra e feche, todo abrigo é selado com bloco e reaberto na pá, e o "buraco derruba o abrigo" fica sendo a mecânica de entrar e sair

---

## 60 — O que a morte custa, e dois callbacks que nunca tocaram (item 011)

### Os casos 11 e 12 de código dormente, e os mais silenciosos até agora

`survivalSystem.onDamage` e `onDeath` são **propriedades**, não listas de assinantes: a segunda
atribuição apaga a primeira. Havia **duas de cada**, separadas por umas sessenta linhas de
`main.ts`.

O que se perdeu: o **som de dano**, o **som de morte** e o evento `playerDamaged` dos mods. Todos
escritos, corretos, comentados — e nunca executados.

Nada falhava. O jogo só era silencioso ao apanhar e ao morrer, e quem notasse pensaria que faltava o
som, não que ele estava lá o tempo todo. É o mesmo modo de falha das dez vezes anteriores, com uma
diferença que vale registrar: **desta vez o código não estava só sem chamador — estava sendo
chamado e imediatamente substituído.** Um `grep` por "quem usa isto?" acharia o chamador e diria que
está tudo bem.

A trava nova conta atribuições, e um segundo teste exige que os sons tenham sobrevivido à fusão —
senão a saída fácil seria apagar o handler "errado" e perder exatamente o que se queria de volta.

### A penalidade de morte

Morrer devolvia o jogador ao spawn com o inventário intacto. O efeito não é "o jogo é fácil": é que
**o risco deixa de ser informação**. Descer 25 metros atrás de diamante e cair na lava custava a
caminhada de volta, e nada mais — então não havia decisão a tomar sobre quando descer, o que levar,
ou quando voltar com o que já se tem.

Três opções, e elas não são uma escala de dificuldade — são três jogos: `manter` (construir sem
atrito), `dropar` (o padrão) e `hardcore` (uma vida).

**A ferramenta não cai.** Regra deliberada: a penalidade é o material que você carregava, não a
progressão que você destravou. Perder a picareta de diamante numa queda apagaria uma corrente
inteira de progressão, e a reação de quem joga não é "vou com mais cuidado" — é parar de descer. O
medo que faz alguém sair do jogo não é o mesmo que faz alguém jogar melhor.

**Dois padrões diferentes, de propósito.** Mundo novo nasce `dropar`; mundo gravado antes deste
campo existir lê como `manter`. Fazer a atualização do jogo mudar em silêncio as regras de um mundo
em andamento é a pior surpresa possível — o jogador perderia o inventário na próxima morte por uma
decisão que ninguém tomou nem comunicou.

**A escolha é na criação, não nas configurações.** Trocá-la no meio da partida permitiria ligar
`hardcore` depois de já estar seguro, ou desligá-lo no instante anterior à morte, e as duas coisas
esvaziam a escolha.

**A recusa do mundo encerrado vive na porta de entrada** (`loadWorldById`), e não na tela que lista
os mundos: há mais de um caminho até lá — o menu, o último mundo aberto ao iniciar, a troca pelo hub
— e proteger cada um seria uma corrida que se perde na primeira vez que alguém acrescentar um
caminho novo.

- [~] 1324 `P0` **Dois callbacks sobrescritos** — som de dano, som de morte e `playerDamaged` voltaram a acontecer
- [~] 1325 `P1` **Trava que conta atribuições** de `onDamage`/`onDeath`, mais a que exige os sons vivos depois da fusão
- [~] 1326 `P1` **`penalidadeDeMorte.ts`** com 15 testes, incluindo "largar sem esvaziar duplicaria o inventário" — o defeito que ninguém reporta como defeito, e sim como "achei um jeito de multiplicar item"
- [~] 1327 `P1` **Seletor "Ao Morrer"** no assistente de criação de mundo, com a consequência escrita em cada opção
- [~] 1328 `P1` **Mundo hardcore encerrado não reabre** — marcado antes de qualquer outra coisa, para que fechar a aba naquela fração de segundo não ressuscite a partida

### Lacunas anotadas nesta rodada

- [~] 1329 `P1` **A lista de mundos mostra o mundo encerrado** — riscado, com a data, e o botão desabilitado. Ele **continua na lista** de propósito: foi uma partida, e apagá-la sozinho seria decidir pelo jogador que aquilo não vale nada
- [ ] 1330 `P1` **Os itens largados não expiram nem são marcados** — quem morre duas vezes no mesmo lugar não distingue as duas pilhas, e nada avisa que elas somem (ou que não somem)
- [ ] 1331 `P2` **A ferramenta não perde durabilidade na morte** — como ela não cai, `dropar` acaba sendo mais brando do que a descrição sugere para quem só carrega ferramenta
- [ ] 1332 `P2` **Hardcore não avisa antes** — nenhuma confirmação ao escolher, e nenhum aviso de vida baixa que reconheça que aquela vida é única

---

## 61 — A cama, e o mundo que aparece encerrado (itens 010, 1329)

### A cama (010)

O ponto de renascimento era sempre o spawn procedural. Com a penalidade de morte recém-ligada
(item 011), isso ficou desproporcional: morrer a 25 metros de profundidade custava os itens **e**
uma travessia inteira do mundo para voltar a eles — e itens que expiram numa caminhada dessas são,
na prática, itens perdidos, o que transforma `dropar` em `hardcore` disfarçado.

Três decisões que não são óbvias:

**A receita é do primeiro dia** — três tábuas sobre três troncos. A cama existe para encurtar a
caminhada de volta depois de morrer; uma cama cara só ficaria pronta depois de o jogador já ter
passado pela parte em que morrer dói, ou seja, chegaria tarde demais para servir para o que foi
feita. Um teste exige que **nenhum ingrediente peça ferramenta**.

**Folhas seriam o estofado óbvio, e são uma armadilha**: têm `drops: -1`, então o jogador nunca
conseguiria nenhuma e a receita seria impossível sem nada explicando. Virou teste: todo ingrediente
da cama precisa cair de algum bloco ou sair de alguma receita.

**Guarda-se o ponto, não a cama.** Se a cama for quebrada depois, o jogador ainda renasce ali.
Validar que o bloco continua sendo uma cama mandaria de volta ao outro lado do mundo quem tivesse a
casa desmanchada por um amigo — num momento em que ele já está morto e sem nada para reagir.

**Usar o bloco vem antes da recusa por estar com ferramenta na mão.** O estado normal de quem acabou
de minerar é ter a picareta selecionada; com a ordem invertida, clicar na cama não faria nada, e
nada explicaria por quê.

E a cama entrou na corrente de objetivos, logo depois do abrigo — não perto do fim: ela serve para
as descidas, e as descidas começam três passos adiante.

### O mundo encerrado aparece encerrado (1329)

Um mundo hardcore que acabou continua na lista **de propósito**: foi uma partida, e apagá-la sozinho
seria decidir pelo jogador que aquilo não vale nada. Mas precisa *parecer* encerrado — riscado, com
a data, botão desabilitado. Sem isso a única forma de descobrir era clicar em Carregar e ser
devolvido ao menu por um toast, o que se lê como defeito, não como regra.

- [~] 1333 `P1` **Bloco `B.BED`**, `decor` (não veda o abrigo nem bloqueia passagem) e `interactive`
- [~] 1334 `P1` **`onUseBlock`** na interação — o primeiro bloco do jogo que se **usa** em vez de só empilhar
- [~] 1335 `P1` **Ponto de renascimento por jogador**, não por mundo: a cama do anfitrião puxaria os convidados para dentro dela
- [~] 1336 `P1` **9 travas de fiação**, incluindo "a morte usa o ponto, não `findSpawn()`" — o erro provável era a cama salvar, aparecer no save e não fazer nada
- [~] 1337 `P2` **Objetivo "Fabrique uma cama"** entre o abrigo e o carvão
- [~] 1338 `P2` **Mundo encerrado riscado na lista**, com a data e o botão desabilitado

### Lacunas anotadas nesta rodada

- [~] 1339 `P1` **Dormir até o amanhecer** — `src/game/dormir.ts`, com as quatro recusas explicadas; ver a seção 62
- [~] 1340 `P1` **O ponto é conferido na hora de usar** — corpo inteiro, não só os pés; se ficou soterrado, volta ao spawn do mundo com aviso
- [ ] 1341 `P2` **Não há como ver nem limpar o ponto de renascimento** — quem esqueceu onde dormiu não tem como descobrir, e não há como voltar ao spawn original sem morrer lá
- [ ] 1342 `P2` **A cama não é sincronizada no multijogador** — o bloco é replicado, mas o "usei esta cama" é local, o que está certo; falta o convidado ver que a cama do anfitrião foi usada

---

## 62 — Dormir até o amanhecer (itens 1339, 1340, e a auditoria do 009)

A cama definia onde renascer, e nada mais. Isso é metade do que uma cama significa no gênero, e era
a metade menos interessante: quem fez tudo certo — casa fechada, tocha acesa, cama no canto — ainda
tinha que **esperar a noite passar olhando para a parede**. Sete minutos e meio de relógio real, sem
nada para fazer, como recompensa por ter se preparado bem.

### As quatro recusas, e o que cada uma protege

Elas vivem num módulo puro porque cada uma é uma regra de jogo com uma razão — não uma guarda
defensiva. Enterradas num `if` composto dentro do laço principal, seriam indistinguíveis umas das
outras, e a primeira a ser "simplificada" levaria a razão junto.

**De dia, não.** Adiantaria o relógio um dia inteiro para pular… o dia. O jogador perderia as horas
de luz, que são justamente quando dá para explorar a superfície em segurança.

**A céu aberto, não.** Esta é a regra que faz dormir ser a **recompensa por ter se preparado**, e
não a maneira de não precisar se preparar. Sem ela a cama vira um botão de pular a noite, e a noite
é metade do jogo: o perigo, o motivo de construir, o motivo de fazer tochas.

**Convidado, não.** O relógio do mundo é do anfitrião. Um convidado adiantando o próprio veria um
amanhecer que não aconteceu para mais ninguém, e a correção seguinte o puxaria de volta — o sol
subiria e desceria na cara dele.

**Já dormindo, não.**

E cada recusa **devolve a frase pronta**, não um código. "Não é possível dormir" manda o jogador
adivinhar entre quatro motivos, e o mais provável é ele concluir que a cama está quebrada. Um teste
exige que as quatro frases sejam diferentes entre si: quatro recusas com a mesma frase são uma só.

### Três detalhes que falham calados

**Dormir acelera, não salta.** A luz do céu está assada na cor dos vértices, e o mundo é re-meshado
quando `sunScale` cruza o limiar. Um salto faria isso de uma vez, com o sol pulando no céu e um
engasgo visível. A 90× a noite passa em uns 4 segundos, pelos mesmos degraus de sempre.

**Acordar é decidido pela FASE**, não por um valor de `timeOfDay`. É a mesma noção que o resto do
jogo usa para dizer o que é noite; um número solto aqui poderia sair de sincronia com ela sem nada
apontar a discordância. E sem a parada, o relógio a 90× daria voltas no dia inteiro.

**Acordar avisa os convidados na hora.** O envio periódico é de 10 em 10 segundos, e nesse intervalo
eles ainda estariam de noite — com o céu de outro horário e criaturas que o anfitrião já não simula.

**Definir o ponto acontece sempre, antes de qualquer recusa.** É a metade da cama que não pode
falhar: quem tentar dormir de dia ainda assim quer ter marcado ali o lugar para onde volta.

### O ponto conferido na hora de usar (1340)

Entre gravar e morrer, o mundo muda. Quem tapar o próprio quarto com pedra — ou tiver a casa
preenchida por um amigo, por um fluido escoando ou por um script de mod — renasceria **dentro da
rocha**, preso, no momento em que acabou de morrer e ainda está entendendo o que houve. O spawn do
mundo é uma volta longa, mas é uma volta; ficar entalado não é.

A conferência é do **corpo inteiro**, não só dos pés: com o pé livre e a cabeça na pedra, o jogador
nasce com a câmera dentro do bloco e vê o mundo de dentro para fora.

### O item 009, auditado em vez de refeito

"Inimigos surgem só após o anoitecer" já acontecia, e por uma regra melhor que a literal:
`effectiveLight = max(sky * sunScale, block)`. Ao meio-dia a superfície dá 15 e nada nasce; de
madrugada dá ~1,8 e passa do limiar 6. Caverna gera de dia também, que é o comportamento certo — a
regra é a **luz**, não a hora, e é isso que faz a tocha ser ferramenta de território.

- [~] 1343 `P1` **`dormir.ts`** com as quatro recusas explicadas, 11 testes
- [~] 1344 `P1` **4 travas de fiação** — o módulo é puro e passaria nos 11 testes com a cama continuando a só definir spawn

### Lacunas anotadas nesta rodada

- [ ] 1345 `P2` **A primeira noite não é enquadrada como evento** — ela tem peso mecânico (hostis, abrigo, dormir), mas nada no jogo a marca como diferente das outras
- [~] 1346 `P2` **Véu de sono** que escurece por transição, não por corte — o gradual é a informação, um corte seco pareceria congelamento
- [~] 1347 `P2` **`descansar(segundos)`** — e a descoberta que veio junto: o corpo NÃO atravessava a noite que o mundo atravessava; ver a seção 63
- [ ] 1348 `P3` **O convidado não tem como pedir para dormir** — a recusa é honesta, mas num mundo compartilhado ninguém dorme nunca, a menos que o anfitrião resolva

---

## 63 — O corpo que não atravessava a noite (itens 1346, 1347)

Fui acrescentar "dormir restaura vida" e encontrei um buraco maior do lado.

**Dormir corre o relógio do MUNDO a 90×, mas `update(dt)` continua recebendo o `dt` real.** Uma
noite inteira passava para o mundo — uns seis minutos de jogo — e **quatro segundos** para o corpo.
Metade da barra de fome deixava de ser cobrada, e dormir virava a maneira mais eficiente de não
comer.

Não falharia em lugar nenhum. A fome simplesmente decairia mais devagar para quem dorme, e a
explicação estaria a três arquivos de distância do sintoma: quem notasse concluiria que a fome é
lenta demais e mexeria na constante errada.

`descansar(segundos)` cobra do corpo o período que o mundo pulou, com duas decisões:

**Descansar custa metade.** Um corpo parado gasta menos que um corpo cavando. É o que dá à cama uma
vantagem real além do tempo — sem isso, dormir seria neutro e continuaria valendo mais minerar a
noite toda. O teste compara as duas coisas de frente: dormir uma noite contra ficar acordado a mesma
noite, simulada em passos de meio segundo.

**A fome é conferida DEPOIS do gasto.** Na ordem inversa, uma noite que zera a barra ainda curaria —
e dormir seria uma forma de trocar comida por vida sem ter comida.

O véu de sono (1346) usa `opacity` com transição, e não `display`: o escurecer gradual é a
informação, porque é ele que comunica a passagem do tempo. Um corte seco pareceria congelamento. E
há trava exigindo que ele acenda **e apague** — acender e esquecer deixaria a tela preta para
sempre depois da primeira noite, sem nada indicando por quê.

- [~] 1349 `P1` **`descansar`** com 6 testes, incluindo "dormir de barriga vazia não cura"
- [~] 1350 `P1` **2 travas de fiação** — o método é puro e passaria em todos os testes com o jogo nunca o chamando

### Lacunas anotadas nesta rodada

- [x] 1351 `P1` ~~O mesmo descompasso vale para qualquer salto de relógio~~ — **RETIRADO depois de olhar melhor.** Não existe comando `/time`, e o único outro salto é a correção `world_time` do convidado. Cobrar o corpo ali seria **errado**: o convidado não pulou tempo, ele estava *enganado* sobre a hora — o corpo dele viveu em tempo real o tempo todo, e cobrá-lo puniria uma correção de rede. Dormir é o único salto de verdade
- [ ] 1352 `P3` **Criaturas e fluidos também não atravessam a noite** — o mundo pula seis minutos e nenhuma poça escoou. Rebaixado a `P3`: no caso dos hostis o comportamento é o **desejado** (dormir existe para pular a noite deles), e no dos fluidos o efeito é imperceptível

---

## 64 — A ressalva do GLSL, encurtada (item 1206)

Venho repetindo o mesmo aviso há várias rodadas: três sistemas injetam GLSL por `onBeforeCompile`,
**nada compila esses shaders num teste**, e o sintoma de uma injeção malformada não é um erro na
tela — é o terreno inteiro desaparecer.

Compilar de verdade exige WebGL, e jsdom não tem. Um contexto headless traria dependência nativa que
quebra a cada versão de Node: o remédio custaria mais que a doença. Mas há uma metade verificável, e
ela cobre a classe de falha **silenciosa**.

A injeção funciona por substituição de texto, e `String.replace` que não encontra o alvo **não faz
nada e não avisa**. Se o three.js renomear um chunk numa versão nova — e ele faz isso —, a injeção
para de acontecer sem um único erro: a curvatura sumiria, a onda pararia, e o jogo continuaria
rodando bonito e errado.

`THREE.ShaderLib` é dado puro em JavaScript. O teste pega o shader **real** do material que o jogo
usa, roda a injeção de verdade em cima dele, e exige que o resultado tenha mudado — por injeção, e
não pelo shader inteiro: se três acertarem o alvo e uma errar, o shader muda e uma verificação
grosseira passaria enquanto a quarta funcionalidade some.

### Dois testes meus que estavam errados, e o que eles me ensinaram

Escrevi "nenhum marcador sobrou por substituir" e falhou. **Duas das quatro injeções preservam o
marcador de propósito**: `#include <color_vertex>` seguido do nosso código, porque o chunk original
precisa rodar antes — o tingimento multiplica `vColor`, que só existe depois que o include o
preencheu. Só `project_vertex` é substituído por inteiro, porque ali o nosso código refaz a projeção.

Isso virou um teste próprio, para o erro **simétrico**: trocar o corpo da substituição e esquecer de
repetir o `#include` na saída. O nosso código continuaria lá, o outro teste passaria, e o chunk do
three.js deixaria de rodar — `vColor` nunca receberia a cor do vértice, e o mundo inteiro ficaria de
uma cor só.

O segundo erro: testei a onda pelo nome do uniform, e `uOndaTempo` é declarado nos dois materiais
porque o prelúdio de uniforms é um só. A comparação certa é pelo **deslocamento** (`sin(cqWorld.x`),
senão o teste passa a impressão de que o terreno também ondula.

**O que este arquivo NÃO prova**, e está escrito nele: que o GLSL compila. Um `vec3` somado a um
`float`, um uniform com nome trocado ou um ponto e vírgula a menos passam por aqui. O item 1206
segue aberto — com escopo menor e a parte barata resolvida.

- [~] 1353 `P1` **`marcadoresDeShader.test.ts`** — 11 testes contra o `ShaderLib` real
- [~] 1354 `P2` **Trava do material** — trocar o Lambert por Standard sem atualizar o teste faria tudo continuar verde verificando o shader errado
- [~] 1355 `P2` **Chaves e parênteses balanceados** na saída — a forma mais comum de quebrar uma injeção por concatenação, e a de sintoma mais assustador

---

## 65 — Auditoria: o que falta, e o que estava marcado errado

Varredura dos 26 `P0` pendentes, conferindo cada um contra o código em vez de reler o checklist.

### Dois estavam marcados errado

**1075 (passe de LUT) não é tarefa pendente — é decisão tomada e escrita.** `src/render/grading.ts`
explica por que o `EffectComposer` foi recusado: alvo de render do tamanho da tela, uma cópia por
quadro e um passe sobre cada pixel, num projeto que nasceu do relato *"está muito muito travado"*. A
gradação em seis instruções dentro do fragmento que já ia rodar entrega o mesmo visual. A limitação
está assumida no arquivo: alcança terreno, água e vidro, não personagem, criaturas nem céu.

Ficar como `P0` pendente é pior que estar fechado ou aberto — é um bloqueador aparente que ninguém
ia atacar, inflando a fila e escondendo o que de fato falta. É o terceiro erro de auditoria deste
tipo, depois do 1077 (ACES) e do 053 (oclusão de ambiente).

**502 (validador de casa) tem o miolo pronto.** `estaAbrigado` já responde "este espaço é fechado?"
por busca em largura — a parte difícil. Faltam porta, luz mínima e mobília, e a porta nem existe
como bloco ainda.

### Os 25 que restam, em cinco blocos

Não são 25 tarefas independentes: são **cinco frentes**, e três delas se resolvem por uma decisão de
arquitetura cada.

**A. Sandbox de mods em Worker** — 358, 1239, 1251, 1252. Uma frente só. O custo real não é o Worker:
é tornar a API de mods **assíncrona**, porque `api.world.getBlock(x,y,z)` não atravessa a fronteira
de reino de execução sem virar `await`. Isso quebra todo mod já escrito. É a única coisa que fecha a
saída por `[].constructor.constructor('return this')()`, hoje documentada num teste que passa quando
a fuga funciona.

**B. Capacidades e rede de mod** — 761–768, 775. Nove itens, uma frente. Hoje o mod **não tem rede
nenhuma** (o sandbox bloqueia `fetch`), então nada está inseguro: o que falta é a maneira de dar rede
com controle. Depende de A para valer de verdade, porque um wrapper de `fetch` num reino onde o
script alcança o global é decorativo.

**C. Voz P2P** — 927–932. Seis itens, uma frente, independente das outras. A `RTCPeerConnection` já
existe; falta a trilha de áudio e a renegociação.

**D. Conteúdo gerado por mod** — 676, 677, 689, 690. Mods registrarem biomas e regras de
espalhamento. Não existe nada disso hoje.

**E. Mundo vertical** — 029, 495, 496. Dobrar a altura e dar identidade às camadas. O 029 segue
adiado com motivo: dobra a memória por chunk, muda o custo de iluminação e o formato de save, e o
modo de falha é **corrupção de save** — que eu não consigo verificar sem rodar o jogo.

### O que isto quer dizer para "o que fazer agora"

Nenhuma das cinco é pequena, e quatro delas são de infraestrutura, não de jogo. A frente com melhor
razão entre valor e risco é **C (voz)**: é a única isolada, não depende de A, não toca o formato de
save, e o que ela entrega — falar com quem está no mesmo mundo — é imediatamente perceptível.

**A frente A é a mais importante e a mais cara**, e vale dizer por quê: enquanto ela não existir,
todo o resto do sistema de mods está construído sobre uma fronteira que o próprio teste admite ser
furada.

- [x] 1356 `P1` **Auditoria dos 26 `P0`** — dois corrigidos, cinco frentes identificadas
