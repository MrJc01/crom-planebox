# Checklist Mestre â€” Painel de Especialistas (1660 itens)

> **Estado em 28/07/2026** â€” 997 de 1660 itens tratados (59.6%), com **1653 testes** passando,
> `tsc --noEmit` limpo e build funcionando. **Nenhum `P0` pendente.**
>
> | Status | Itens | Significado |
> |---|---|---|
> | `[x]` | 101 | JÃ¡ existia no repositÃ³rio e foi **verificado no cÃ³digo**. Inclui itens que eu havia marcado como pendentes por erro de auditoria (053, 1077) e itens descartados com justificativa (1064, 1066). |
> | `[~]` | 896 | **Entregue** ao longo das rodadas, com teste. |
> | `[ ]` | 656 | Pendente. Inclui os 48 itens da rodada de pedidos do dono do projeto (Parte VII). |
>
> **A seÃ§Ã£o 44 Ã© a mais importante deste documento.** Ela registra o primeiro relato do jogador
> vendo o jogo numa tela â€” e encontrou, em cinco frases, defeitos que os 696 testes nÃ£o pegariam,
> porque nenhum Ã© falha de lÃ³gica. `depthTest: false` roda. A fase invertida da lua roda. O relay
> que nÃ£o estÃ¡ de pÃ© devolve `null` exatamente como escrito.
>
> **Como este documento foi produzido.** Simulamos uma banca de especialistas, cada um auditando o
> Crom Planebox sob a sua prÃ³pria lente. Todos os itens foram escritos **depois** de ler o cÃ³digo
> real deste repositÃ³rio, por isso muitos apontam arquivo e funÃ§Ã£o concretos. As seÃ§Ãµes cresceram
> conforme o trabalho revelou o que faltava â€” daÃ­ o nÃºmero final ser mais que o dobro do inicial.
>
> **Prioridade**: `P0` bloqueia o objetivo declarado (jogo completo + IA que modifica tudo com
> save), `P1` Ã© essencial para a experiÃªncia, `P2` Ã© refinamento, `P3` Ã© ambiÃ§Ã£o de longo prazo.

---

## A ressalva que vale mais que qualquer marcaÃ§Ã£o

**Nada do que foi entregue foi visto rodando numa tela.** Os testes provam lÃ³gica, nÃ£o aparÃªncia.
TrÃªs sistemas injetam GLSL que nenhum teste compila (curvatura, tingimento sazonal, apariÃ§Ã£o de
chunk) â€” se a injeÃ§Ã£o estiver malformada, o sintoma Ã© o terreno sumir, e sÃ³ aparece abrindo o jogo.
Dois sistemas alteram o terreno em si (biomas no worldgen, construÃ§Ãµes espalhadas).

Um item marcado `[~]` significa "escrito, ligado e coberto por teste". **NÃ£o** significa
"conferido visualmente".

## O padrÃ£o que mais custou a este projeto

**CÃ³digo presente nÃ£o Ã© cÃ³digo ativo.** Cinco vezes encontramos funcionalidade completa,
comentada e cuidadosa que **nada chamava**:

| O que | Como se descobriu |
|---|---|
| `setViewRange` | `scene.fog` era `null`; o `if (f)` falhava em silÃªncio |
| `applyCurvature` | `invR: 0` e `start: 500`, alÃ©m da distÃ¢ncia desenhada |
| `UndoManager.recordBatch` | Nenhum chamador â€” nenhuma construÃ§Ã£o da IA era desfazÃ­vel |
| EstaÃ§Ãµes do ano | Mudavam clima e painel F3, e nada que o jogador visse |
| Biomas no worldgen | O gerador decidia superfÃ­cie por limiares paralelos e ignorava o mÃ³dulo |

A resposta foi passar a escrever **testes de "estÃ¡ ligado?"**, nÃ£o sÃ³ de unidade: os blocos da
construÃ§Ã£o aparecem no chunk gerado, a injeÃ§Ã£o chega ao shader, o diamante nÃ£o existe no deserto
*no terreno varrido*, o pacote do mod **nÃ£o tem onde guardar** um segredo.

---


## Ã�ndice

| # | Especialista | Itens | Foco |
|---|---|---|---|
| 01 | Diretor de Game Design | 001â€“024 | Loop de jogo Minecraft/Terraria |
| 02 | Arquiteto de Engine Voxel | 025â€“048 | Chunks, mundo, escala de miniblocos |
| 03 | Engenheiro de RenderizaÃ§Ã£o | 049â€“072 | Look "Lay of the Land" |
| 04 | Diretor de Arte TÃ©cnica | 073â€“096 | Paleta, miniblocos, materiais |
| 05 | Engenheiro de Worldgen | 097â€“120 | Biomas, ruÃ­do, cavernas |
| 06 | Designer de SobrevivÃªncia | 121â€“144 | Vida, fome, progressÃ£o |
| 07 | Designer de Combate | 145â€“168 | Armas, inimigos, bosses |
| 08 | Engenheiro de IA de Entidades | 169â€“192 | NPCs, pathfinding, ecologia |
| 09 | Designer de Crafting & Economia | 193â€“216 | Receitas, tiers, comÃ©rcio |
| 10 | Engenheiro de FÃ­sica | 217â€“240 | ColisÃ£o, fluidos, gravidade |
| 11 | Engenheiro de IluminaÃ§Ã£o | 241â€“264 | Luz propagada, ciclo dia/noite |
| 12 | Engenheiro de PersistÃªncia | 265â€“288 | Save, migraÃ§Ã£o, integridade |
| 13 | **Arquiteto do Sistema de Mods** | 289â€“320 | **IA modificando o jogo com save** |
| 14 | Engenheiro de Agente IA / MCP | 321â€“352 | Ferramentas, planejamento, visÃ£o |
| 15 | Engenheiro de SeguranÃ§a | 353â€“376 | Sandbox de scripts gerados |
| 16 | Engenheiro de Rede | 377â€“400 | P2P, autoridade, sync de mods |
| 17 | Engenheiro de Performance | 401â€“424 | Frame budget, memÃ³ria, workers |
| 18 | Designer de UI/UX | 425â€“448 | HUD, inventÃ¡rio, acessibilidade |
| 19 | Engenheiro de QA | 449â€“476 | Testes automatizados |
| 20 | Engenheiro de Ã�udio | 477â€“494 | Som posicional, ambiÃªncia |
| 21 | Designer de ConteÃºdo Terraria-like | 495â€“512 | Camadas verticais, eventos |
| 22 | DevOps & Build | 513â€“520 | CI, versionamento, distribuiÃ§Ã£o |
| 36 | Auditoria de Desempenho | 883â€“906 | CorreÃ§Ã£o do travamento relatado |
| 37 | Interface e Controle de CÃ¢mera | 907â€“948 | Telas separadas, pointer lock, voz |
| 38 | ApariÃ§Ã£o de Chunk (*fade in*) | 1001â€“1011 | Como o Minecraft moderno faz |
| 39 | CÃ©u Noturno | 1012â€“1031 | Lua, fases, estrelas, claridade variÃ¡vel |
| 40 | Curvatura do Mundo | 1032â€“1042 | *Curvature Shader* |
| 41 | Estado de Interface | 1043â€“1062 | O bug do "clique nÃ£o volta ao jogo" |
| 42 | Atmosfera, Clima e EstaÃ§Ãµes | 1063â€“1130 | *Biome Blending*, *Color Grading*, *Fog Interpolation* |

---

## 01 â€” Diretor de Game Design (loop Minecraft/Terraria)

*Parecer: a engine tem cinco modos de jogo e sobrevivÃªncia bÃ¡sica, mas falta o "porquÃª" â€” um
loop de objetivos que puxe o jogador do primeiro dia atÃ© um chefe final.*

- [x] 001 `P0` Cinco modos de jogo distintos (`classic`, `survival`, `ghost`, `creative`, `adventure`) â€” `src/game/GameModeManager.ts`
- [x] 002 `P0` Ciclo bÃ¡sico de sobrevivÃªncia com vida e fome â€” `src/game/SurvivalSystem.ts`
- [x] 003 `P0` Quebrar/colocar blocos com tier de ferramenta â€” `src/player/interaction.ts`
- [x] 004 `P1` Drops de item ao quebrar blocos â€” `src/game/ItemDropSystem.ts`
- [x] 005 `P1` Bancada de crafting com receitas â€” `src/crafting/CraftingSystem.ts`
- [~] 006 `P0` Definir e documentar o **loop central de 30 minutos** (acordar â†’ coletar â†’ craftar â†’ abrigar â†’ explorar) â€” `docs/LOOP_CENTRAL.md`, com os quinze passos, os portÃµes que obrigam a ordem, e uma seÃ§Ã£o final do que o loop **ainda nÃ£o tem**
- [~] 007 `P0` Sistema de objetivos/conquistas guiando o jogador novato ("faÃ§a sua primeira picareta") â€” `src/game/Objetivos.ts` + cartÃ£o no HUD, 21 testes de lÃ³gica e 9 de fiaÃ§Ã£o
- [~] 008 `P0` Curva de progressÃ£o em tiers de material (madeira â†’ pedra â†’ ferro â†’ diamante) com gate real de acesso â€” a corrente vai de 1 a 4 sem buraco, **cada degrau coleta algo que o anterior nÃ£o coletava**, e o Ãºltimo tem porta prÃ³pria (obsidiana, itens 1287/1293). O gate Ã© "quebra mas nÃ£o dropa", nÃ£o parede: gateia a *aquisiÃ§Ã£o* sem trancar ninguÃ©m no cenÃ¡rio
- [~] 009 `P1` Primeira noite como evento de tensÃ£o â€” **auditado**: a regra de luz jÃ¡ faz isso. `effectiveLight = max(sky * sunScale, block)`; ao meio-dia a superfÃ­cie dÃ¡ 15 e nada nasce, de madrugada dÃ¡ ~1,8 e passa do limiar 6. Caverna nasce de dia tambÃ©m, que Ã© o certo. Falta sÃ³ o enquadramento da PRIMEIRA noite como evento (item 1345)
- [~] 010 `P1` Sistema de "camas"/ponto de renascimento definido pelo jogador â€” bloco `B.BED`, receita do primeiro dia, clique direito define o ponto; ver a seÃ§Ã£o 61
- [~] 011 `P1` Morte com penalidade escolhÃ­vel por mundo (dropar inventÃ¡rio / manter / hardcore) â€” `src/game/penalidadeDeMorte.ts`, escolhida na criaÃ§Ã£o do mundo; ver a seÃ§Ã£o 60
- [~] 012 `P1` **DiÃ¡rio de bordo no mundo registrando marcos alcanÃ§ados** â€” `getDiarioDeBordo()` em `src/game/Objetivos.ts`
- [ ] 013 `P2` Estrutura de "vilas" geradas com NPCs que dÃ£o missÃµes simples
- [ ] 014 `P2` Sistema de reputaÃ§Ã£o com facÃ§Ãµes (o `faction` das entidades jÃ¡ existe e estÃ¡ ocioso)
- [ ] 015 `P2` Modo Aventura com mapas curados que proÃ­bem quebrar blocos fora de regras
- [ ] 016 `P2` Eventos sazonais no mundo (chuva de meteoros, lua de sangue) usando `EventSystem`
- [ ] 017 `P2` Sistema de encantamentos/afixos em ferramentas
- [ ] 018 `P3` DimensÃµes alternativas (submundo estilo Nether/Corruption)
- [ ] 019 `P3` Boss final com arena gerada proceduralmente
- [ ] 020 `P3` New Game+ carregando conquistas entre mundos
- [~] 021 `P1` **Tutorial contextual nÃ£o intrusivo nos primeiros 5 minutos** â€” `showContextualTutorial()` no `HUD` em `src/ui/HUD.ts`
- [ ] 022 `P2` Balanceamento por telemetria local (tempo atÃ© 1Âª ferramenta, mortes por hora)
- [ ] 023 `P2` Modo criativo com "paleta de projeto" salvÃ¡vel e reutilizÃ¡vel
- [ ] 024 `P3` Editor de aventura para o jogador publicar mundos curados

## 02 â€” Arquiteto de Engine Voxel

*Parecer: a base de chunks e a escala de miniblocos (`SCALE`) estÃ£o corretas; o gargalo Ã©
verticalidade limitada e ausÃªncia de LOD.*

- [x] 025 `P0` Mundo em chunks com geraÃ§Ã£o em worker â€” `src/world/genWorker.ts`
- [x] 026 `P0` Escala de minibloco (`SCALE`) separando bloco lÃ³gico de voxel visual â€” `src/world/chunk.ts`
- [x] 027 `P0` `World.setBlock`/`getBlock` marcando chunks sujos para re-mesh â€” `src/world/world.ts`
- [x] 028 `P1` RuÃ­do e RNG determinÃ­sticos por semente â€” `src/core/noise.ts`, `src/core/rng.ts`
- [~] 029 `P0` **Mundo de 85 m, com o mar a 46** â€” e a mediÃ§Ã£o mostrou que o item apontava para o lado errado: o teto nunca era tocado, o aperto era embaixo. Ver a seÃ§Ã£o 79
- [~] 030 `P0` **`WORLD_MAX_Y` e `TOPO_VARREDURA` em `world/chunk.ts`** â€” e a extraÃ§Ã£o revelou um teto silencioso de 8 voxels
- [~] 031 `P1` **LOD de chunks distantes (mesh simplificado alÃ©m de N chunks)** â€” `computeChunkLOD()` em `src/render/scene.ts`
- [x] 032 `P1` **JÃ¡ existia** â€” `disposeChunkMesh` remove da cena, chama `geometry.dispose()` e o chunk sai do `Map`. Auditado
- [~] 033 `P1` **PaletizaÃ§Ã£o de chunk (Ã­ndices locais + tabela) para reduzir memÃ³ria** â€” `paletizeChunk()` em `src/world/chunk.ts`
- [~] 034 `P1` **CompressÃ£o RLE de chunks salvos** â€” `compressRLE` e `decompressRLE` em `src/world/paleta.ts`
- [ ] 035 `P2` Chunks verticais (seÃ§Ãµes de 16Â³) em vez de coluna inteira
- [ ] 036 `P2` Sistema de "tick" de bloco agendado (crescimento, fluido, fornalha)
- [ ] 037 `P2` Metadados por bloco (rotaÃ§Ã£o, estado) alÃ©m do id numÃ©rico
- [ ] 038 `P2` Blocos com entidade associada (baÃº, fornalha, placa) e seus dados salvos
- [~] 039 `P1` **API pÃºblica estÃ¡vel de mundo para mods (`getBlock`, `setBlock`, `fillBox`, `queryRegion`)** â€” mÃ©todos documentados em `src/mods/ModAPI.ts`
- [ ] 040 `P2` Sistema de eventos do mundo (`onBlockPlaced`, `onBlockBroken`) assinÃ¡vel por mods
- [ ] 041 `P2` RegiÃµes protegidas (claim) que bloqueiam ediÃ§Ã£o por script ou por outro jogador
- [ ] 042 `P3` Streaming infinito real em ambos os eixos horizontais sem perda de precisÃ£o
- [ ] 043 `P3` Grafo de conectividade para colapso estrutural mais realista
- [~] 044 `P1` **`caixa.ts`**: a geometria num lugar sÃ³, com o limite de tamanho que faltava nas trÃªs
- [x] 045 `P1` **JÃ¡ existia** â€” `dirty` Ã© uma flag por chunk, e o laÃ§o de quadro varre com orÃ§amento. Auditado
- [ ] 046 `P2` Undo/redo com limite de memÃ³ria configurÃ¡vel â€” base em `src/storage/UndoManager.ts`
- [ ] 047 `P2` Snapshot/clone de regiÃ£o (copiar-colar estruturas grandes)
- [ ] 048 `P3` Determinismo verificÃ¡vel: hash do mundo gerado por semente em teste de regressÃ£o

## 03 â€” Engenheiro de RenderizaÃ§Ã£o (look "Lay of the Land")

*Parecer inicial: "falta oclusÃ£o de ambiente, sombras suaves e neblina atmosfÃ©rica". Duas
correÃ§Ãµes depois: a **oclusÃ£o jÃ¡ existia** (erro meu na leitura do cÃ³digo), e a **neblina foi
entregue** na rodada de desempenho â€” junto com a descoberta de que `setViewRange` ajustava as
propriedades de uma nÃ©voa que nunca havia sido criada, e portanto nÃ£o fazia nada.*

*Do parecer original, resta a sombra suave (055).*

- [x] 049 `P0` Mesher prÃ³prio com faces por bloco e sombreamento direcional â€” `src/world/mesher.ts`
- [x] 050 `P1` Jitter procedural de cor por voxel (`hash3`) evitando superfÃ­cies chapadas
- [x] 051 `P1` Blocos decorativos renderizados como caixinhas menores (`addDecor`)
- [x] 052 `P1` Camada de Ã¡gua separada com topo rebaixado
- [x] 053 `P0` **Ambient occlusion por vÃ©rtice** â€” jÃ¡ existia em `mesher.ts` (`vertexAO`, side1/side2/corner) desde a primeira auditoria; estava marcado como pendente por engano meu
- [~] 054 `P0` **Neblina atmosfÃ©rica com a cor do cÃ©u**, acompanhando o ciclo dia/noite e a distÃ¢ncia de render â€” fecha a estÃ©tica alvo
- [~] 055 `P1` **Sombras suaves (PCF) com cascata ajustada Ã  distÃ¢ncia de render** â€” `PCFShadowMap` 2048x2048 em `src/render/scene.ts`
- [~] 056 `P1` **CÃ©u procedural com gradiente por hora do dia** â€” ShaderMaterial da cÃºpula do cÃ©u em `src/render/sky.ts`
- [~] 057 `P1` **Nuvens volumÃ©tricas em camada de voxels lentos** â€” camada 3D animada em `src/world/volumetricClouds.ts`
- [ ] 058 `P2` Bloom sutil restrito a blocos emissivos (`GLOWSTONE`, `LAVA`)
- [ ] 059 `P2` CorreÃ§Ã£o de cor / tonemapping filmico leve
- [ ] 060 `P2` Ã�gua com reflexo de tela (SSR barato) e distorÃ§Ã£o de onda
- [ ] 061 `P2` PartÃ­culas: poeira ao quebrar, respingo na Ã¡gua, fagulha na lava
- [ ] 062 `P2` Rastro de chuva e neve por bioma
- [~] 063 `P1` **Contorno do bloco alvo mais legÃ­vel (outline com profundidade e alto contraste)** â€” realce ciano transparente com teste de profundidade em `src/player/interaction.ts`
- [ ] 064 `P2` AnimaÃ§Ã£o de quebra em estÃ¡gios (rachaduras progressivas)
- [ ] 065 `P2` Vento animando capim e folhas por vertex shader
- [~] 066 `P1` **Instanciamento de decorativos para reduzir draw calls** â€” `InstancedMesh` em `src/render/InstancedDecorationManager.ts`
- [ ] 067 `P2` Frustum culling explÃ­cito por chunk antes de enviar Ã  GPU
- [ ] 068 `P2` Modo de qualidade (baixo/mÃ©dio/alto) exposto nas configuraÃ§Ãµes
- [ ] 069 `P3` IluminaÃ§Ã£o global aproximada por probes de chunk
- [ ] 070 `P3` Suporte a shader packs carregÃ¡veis por mod
- [~] 071 `P1` **Fallback gracioso quando WebGL2 nÃ£o estiver disponÃ­vel** â€” `checkWebGL2Support()` em `src/render/scene.ts`
- [ ] 072 `P2` Teste de regressÃ£o visual por hash de imagem em cena fixa

## 04 â€” Diretor de Arte TÃ©cnica (paleta e miniblocos)

*Parecer: a paleta atual Ã© coerente e sÃ³bria; o risco Ã© a explosÃ£o de blocos criados pela IA
destruir essa coerÃªncia sem um guia de cor obrigatÃ³rio.*

- [x] 073 `P1` Paleta central declarativa com cores por face (topo/lateral/base) â€” `src/world/blocks.ts`
- [x] 074 `P1` 28 blocos base cobrindo terreno, minerais, vegetaÃ§Ã£o e fluidos
- [~] 075 `P0` Blocos criados pela IA passam pelo mesmo `def()` da paleta base â€” `src/world/blocks.ts`
- [~] 076 `P0` **Validador de contraste perceptual** no caminho de criaÃ§Ã£o, com sugestÃ£o de direÃ§Ã£o
- [~] 077 `P1` **DerivaÃ§Ã£o automÃ¡tica de cor lateral/base a partir do topo (escurecimento consistente)** â€” `deriveSideAndBottomColors` em `src/world/blocks.ts`
- [~] 078 `P1` **Guia de arte escrito para a IA seguir ao inventar blocos (saturaÃ§Ã£o e luminÃ¢ncia alvo)** â€” `validateAIBlockArtGuide()` em `src/world/blocks.ts`
- [~] 079 `P1` **Suporte a textura procedural por bloco (ruÃ­do, listras, xadrez) alÃ©m de cor sÃ³lida** â€” `generateProceduralTexturePattern()` em `src/world/blocks.ts`
- [ ] 080 `P2` Variantes de bloco (musgo, rachado, polido) geradas automaticamente
- [ ] 081 `P2` Blocos com transparÃªncia parcial (vidro colorido)
- [ ] 082 `P2` Blocos emissivos com intensidade configurÃ¡vel
- [~] 083 `P1` **Ã�cone de bloco no inventÃ¡rio gerado a partir das 3 cores reais** â€” canvas 3D isomÃ©trico por paleta em `src/ui/BlockIconGenerator.ts`
- [ ] 084 `P2` Miniblocos com formas alternativas (escada, laje, poste, cerca)
- [ ] 085 `P2` RotaÃ§Ã£o de bloco em 4 direÃ§Ãµes para peÃ§as direcionais
- [ ] 086 `P2` Modelos compostos (mesa, cadeira) montados de vÃ¡rios miniblocos
- [~] 087 `P1` **Padronizar altura de personagem em miniblocos e documentar** â€” `MINI_BLOCK_PLAYER_HEIGHT_VOXELS` em `src/world/miniStructureEditor.ts`
- [ ] 088 `P2` Escala de referÃªncia visÃ­vel no modo criativo (rÃ©gua de miniblocos)
- [ ] 089 `P2` Biblioteca de paletas por bioma para a IA reutilizar
- [ ] 090 `P3` Editor visual de bloco no jogo (o jogador cria blocos sem a IA)
- [ ] 091 `P2` Exportar/importar paleta de mod como JSON
- [~] 092 `P1` **Limite mÃ¡ximo de blocos customizados por mundo com aviso claro** â€” `getCustomBlockUsage` e `MAX_CUSTOM_BLOCKS` em `src/world/blocks.ts`
- [ ] 093 `P2` DeduplicaÃ§Ã£o: avisar quando a IA registrar um bloco quase idÃªntico a outro
- [ ] 094 `P2` Nomes de bloco normalizados (sem duplicatas com acento/caixa diferentes)
- [ ] 095 `P3` Suporte a atlas de textura carregado por mod
- [ ] 096 `P2` Modo daltonismo ajustando a paleta de blocos crÃ­ticos

## 05 â€” Engenheiro de Worldgen

- [x] 097 `P0` GeraÃ§Ã£o procedural por semente com ruÃ­do multi-oitava â€” `src/world/worldgen.ts`
- [x] 098 `P1` Biomas com vegetaÃ§Ã£o distinta (pinheiros, capim, flores, juncos)
- [x] 099 `P1` GeraÃ§Ã£o fora da thread principal em worker
- [~] 100 `P0` **Cavernas conectadas por ruÃ­do 3D (tÃºneis ridged em interseÃ§Ã£o + cÃ¢maras) â€” `src/world/underground.ts`**
- [~] 101 `P0` **Veios de minÃ©rio por profundidade e raridade (carvÃ£o â†’ ferro â†’ ouro â†’ diamante)**
- [x] 102 `P1` **JÃ¡ existia** â€” `pesosDeBioma` mistura por temp Ã— umidade sobre uma camada de relevo. Auditado
- [x] 103 `P1` **JÃ¡ existia** â€” `misturarCor`/`misturarEscalar` por peso, e a altura vem de mÃ¡scaras contÃ­nuas. Auditado
- [~] 104 `P1` **Rios e lagos conectados seguindo o gradiente do terreno** â€” `generateRiverPath()` em `src/world/worldgen.ts`
- [x] 105 `P1` **JÃ¡ existia** â€” o bioma `praia` toma peso na faixa do nÃ­vel do mar. Auditado
- [ ] 106 `P2` Montanhas com penhascos e camadas de rocha expostas
- [ ] 107 `P2` Estruturas geradas: vilas, ruÃ­nas, masmorras
- [ ] 108 `P2` BaÃºs de tesouro com loot table por estrutura
- [ ] 109 `P2` Bioma de deserto com cactos e oÃ¡sis
- [ ] 110 `P2` Bioma de pÃ¢ntano com Ã¡gua escura e vegetaÃ§Ã£o prÃ³pria
- [ ] 111 `P2` Bioma nevado com acÃºmulo dinÃ¢mico de neve
- [ ] 112 `P3` ErosÃ£o hidrÃ¡ulica simulada no pÃ³s-processamento do terreno
- [~] 113 `P1` **Preview do terreno no assistente de criaÃ§Ã£o de mundo** â€” `generateWorldTerrainPreview()` em `src/world/worldgen.ts`
- [~] 114 `P1` **Semente exibida e copiÃ¡vel na UI** â€” `semente` e `copySeedToClipboard` no `DebugPanel` (`src/ui/DebugPanel.ts`)
- [ ] 115 `P2` ParÃ¢metros de geraÃ§Ã£o ajustÃ¡veis por mundo (amplitude, escala, nÃ­vel do mar)
- [ ] 116 `P2` Geradores alternativos (superflat, ilhas, amplificado)
- [~] 117 `P1` **Mods podem injetar blocos no gerador** via estruturas registradas
- [ ] 118 `P2` Mods podem registrar biomas inteiros
- [ ] 119 `P2` RegeneraÃ§Ã£o de regiÃ£o preservando construÃ§Ãµes do jogador
- [ ] 120 `P3` GeraÃ§Ã£o guiada por IA ("faÃ§a um vale entre duas montanhas aqui")

## 06 â€” Designer de SobrevivÃªncia

- [x] 121 `P0` Vida e fome com drenagem ao longo do tempo â€” `src/game/SurvivalSystem.ts`
- [x] 122 `P0` Dano de queda proporcional Ã  altura
- [x] 123 `P1` Tier de ferramenta exigido para dropar minÃ©rios â€” `minToolTier`
- [~] 124 `P0` **Comida real: itens comestÃ­veis restaurando fome (tecla F) â€” `FOOD_VALUE`**
- [~] 125 `P0` **RegeneraÃ§Ã£o de vida com fome alta â€” verificado em teste**
- [~] 126 `P1` **Reserva de ar de 12 s com barra de bolhas**, que aparece sÃ³ quando importa
- [x] 127 `P1` **JÃ¡ existia** â€” lava contÃ­nua e queimadura que sÃ³ a Ã¡gua apaga. Auditado
- [~] 128 `P1` **Temperatura por bioma exigindo abrigo ou roupa** â€” dano por frio/calor sem abrigo em `src/game/SurvivalSystem.ts`
- [~] 129 `P1` **Durabilidade de ferramentas com quebra, e barra de desgaste na hotbar**
- [~] 130 `P1` **Armadura reduzindo dano recebido** â€” cÃ¡lculo de reduÃ§Ã£o em `src/game/SurvivalSystem.ts`
- [ ] 131 `P2` Efeitos de status (veneno, regeneraÃ§Ã£o, velocidade)
- [ ] 132 `P2` PoÃ§Ãµes craftÃ¡veis
- [ ] 133 `P2` Agricultura: plantar, crescer por tick, colher
- [ ] 134 `P2` CriaÃ§Ã£o de animais e reproduÃ§Ã£o
- [ ] 135 `P2` Pesca
- [ ] 136 `P2` Fornalha com combustÃ­vel e tempo de queima
- [~] 137 `P1` **BaÃºs**, indexados por posiÃ§Ã£o â€” e o `grant` que perdia item em silÃªncio, corrigido
- [ ] 138 `P2` Peso/limite de inventÃ¡rio opcional
- [~] 139 `P1` **A noite passa quando todos deitam** â€” e a recusa `souORelogio` saiu junto com a regra
- [ ] 140 `P2` Sede como terceiro recurso (opcional por mundo)
- [ ] 141 `P2` Dificuldade configurÃ¡vel afetando dano e spawn
- [ ] 142 `P2` Modo hardcore com mundo apagado na morte
- [~] 143 `P1` **Causa da morte em palavras** â€” ela era entregue e descartada na assinatura
- [ ] 144 `P2` EstatÃ­sticas por mundo (blocos quebrados, distÃ¢ncia, mortes)

## 07 â€” Designer de Combate

- [~] 145 `P0` **Sistema de dano jogadorâ†”entidade com alcance e cooldown â€” `src/entities/Combat.ts`**
- [~] 146 `P0` **Inimigos hostis com spawn noturno e em cavernas â€” `src/entities/MobSpawner.ts`**
- [~] 147 `P0` **Armas corpo a corpo com dano por tier (`damageForTier`)**
- [~] 148 `P1` **Arco e flecha com projÃ©til balÃ­stico** â€” gravidade e colisÃ£o em `src/entities/ArrowProjectile.ts`
- [~] 149 `P1` **Knockback ao receber dano, com componente vertical**
- [~] 150 `P1` **Invulnerabilidade temporÃ¡ria pÃ³s-dano (i-frames) â€” impede stun lock**
- [~] 151 `P1` **Barra de vida sobre entidades hostis, criada ao primeiro dano**
- [~] 152 `P1` **Drops de inimigo alimentando o prÃ³prio ciclo (carvÃ£o â†’ tocha; ferro â†’ picareta)**
- [ ] 153 `P2` Bloqueio/parry com escudo
- [ ] 154 `P2` Ataque carregado
- [ ] 155 `P2` Inimigos com resistÃªncias elementais
- [ ] 156 `P2` Bosses com fases e padrÃµes de ataque
- [ ] 157 `P2` Arenas de boss com invocaÃ§Ã£o por item
- [ ] 158 `P2` Inimigos voadores com pathfinding 3D
- [ ] 159 `P2` Armadilhas colocÃ¡veis
- [ ] 160 `P2` Torres/defesas automÃ¡ticas
- [~] 161 `P1` **Feedback visual claro de acerto (piscada vermelha + barra de vida)**
- [ ] 162 `P2` PvP opcional por mundo com toggle
- [ ] 163 `P2` Zonas seguras onde nÃ£o hÃ¡ spawn hostil
- [ ] 164 `P3` Combate montado
- [ ] 165 `P3` Magias com custo de mana
- [~] 166 `P1` **Mods podem definir inimigos com script de comportamento prÃ³prio**
- [ ] 167 `P2` Mods podem definir armas com efeito customizado
- [ ] 168 `P2` Escalonamento de dificuldade por progresso do jogador

## 08 â€” Engenheiro de IA de Entidades

*Parecer: o `EntitySystem` jÃ¡ anima e faz wandering, mas as entidades **nÃ£o sobrevivem ao
reload** e o pathfinding ignora obstÃ¡culos verticais.*

- [x] 169 `P1` Entidades voxel com partes 3D montÃ¡veis â€” `src/entities/EntitySystem.ts`
- [x] 170 `P1` AnimaÃ§Ã£o de caminhada (pernas/braÃ§os) por ciclo
- [x] 171 `P1` Encaixe no chÃ£o imediato ao spawnar (`groundSnap`)
- [x] 172 `P1` Script de comportamento por entidade compilado em runtime
- [x] 173 `P1` PossessÃ£o de entidade pelo jogador (`takeControlOf`)
- [~] 174 `P0` **Entidades persistidas no save e restauradas ao recarregar o mundo**
- [~] 175 `P0` **Pathfinding A* respeitando colisÃ£o e altura de pulo â€” `src/entities/Pathfinding.ts`**
- [~] 176 `P1` **ColisÃ£o de entidade com blocos â€” mobs pararam de atravessar parede**
- [~] 177 `P1` **MÃ¡quina de estados (ocioso, perseguir, atacar)**
- [~] 178 `P1` **PercepÃ§Ã£o com raio de visÃ£o (`aggroRange`)**
- [~] 179 `P1` **Limite de entidades hostis ativas (`MAX_HOSTILES`)**
- [~] 180 `P1` **Congelamento por distÃ¢ncia**, com histerese e sem soltar a marca de combate
- [ ] 181 `P2` Rotinas diÃ¡rias de NPC (dormir, trabalhar, socializar)
- [ ] 182 `P2` DiÃ¡logo com NPC e Ã¡rvore de conversa
- [ ] 183 `P2` ComÃ©rcio com NPC
- [ ] 184 `P2` FacÃ§Ãµes com relaÃ§Ãµes hostis/aliadas (campo `faction` jÃ¡ existe)
- [ ] 185 `P2` Grupos/manadas com comportamento coletivo
- [ ] 186 `P2` Ecologia: predador/presa, reproduÃ§Ã£o, populaÃ§Ã£o estÃ¡vel
- [~] 187 `P1` **Nome/etiqueta de entidade legÃ­vel a distÃ¢ncia com escala** â€” escala dinÃ¢mica por distÃ¢ncia da cÃ¢mera em `src/entities/EntitySystem.ts`
- [ ] 188 `P2` Entidade montÃ¡vel
- [ ] 189 `P2` Entidade transportando itens
- [ ] 190 `P3` Comportamento gerado por LLM em tempo real com cache
- [~] 191 `P1` **OrÃ§amento de tempo por frame para scripts de comportamento** â€” limite de 4ms/frame no loop de atualizaÃ§Ã£o em `src/entities/EntitySystem.ts`
- [x] 192 `P1` **JÃ¡ existia** â€” `onUpdate` roda dentro de `try/catch` por entidade. Auditado

## 09 â€” Designer de Crafting & Economia

- [x] 193 `P0` Grade de crafting com receitas por padrÃ£o â€” `src/crafting/CraftingSystem.ts`
- [x] 194 `P1` Templates de estrutura colocÃ¡veis como item â€” `src/crafting/StructureTemplates.ts`
- [~] 195 `P0` **Corrente de ferramentas fechada de 1 a 4** â€” faltava a picareta de diamante
- [~] 196 `P0` **Receitas sem forma (shapeless) alÃ©m das com forma â€” jÃ¡ existiam ambas; verificado**
- [~] 197 `P1` **Livro de receitas na UI mostrando o que Ã© craftÃ¡vel agora** â€” filtro de ingredientes em `src/crafting/CraftingSystem.ts`
- [~] 198 `P1` **FundiÃ§Ã£o com receitas prÃ³prias** â€” `SMELTING_RECIPES` e `getSmeltingRecipe` em `src/crafting/CraftingSystem.ts`
- [~] 199 `P1` **Bancadas especializadas desbloqueando receitas** â€” suporte estendido em `src/crafting/CraftingSystem.ts`
- [ ] 200 `P2` Reparo de ferramentas
- [ ] 201 `P2` Reciclagem de itens
- [ ] 202 `P2` Moeda e mercado com NPCs
- [ ] 203 `P2` Economia de vila com oferta e demanda
- [ ] 204 `P2` Encomendas/contratos como missÃµes
- [~] 205 `P1` **Mods podem registrar estruturas colocÃ¡veis novas**
- [~] 206 `P1` **Mods podem registrar receitas novas** â€” `crafting.registerRecipe` e `CraftingSystem.registerCustomRecipe`
- [ ] 207 `P2` Mods podem registrar itens nÃ£o-bloco (ferramentas, comida)
- [~] 208 `P1` **ValidaÃ§Ã£o de receita: recusar receita que produza bloco inexistente** â€” `validateRecipe` em `src/crafting/CraftingSystem.ts`
- [ ] 209 `P2` Autocrafting de itens intermediÃ¡rios
- [ ] 210 `P2` Favoritar receitas
- [ ] 211 `P2` OrdenaÃ§Ã£o e busca no inventÃ¡rio
- [~] 212 `P1` **Stack mÃ¡ximo por item configurÃ¡vel** â€” propriedade `maxStack` em `HotbarSlot` (`src/player/interaction.ts`)
- [ ] 213 `P2` Arrastar e soltar entre inventÃ¡rio e hotbar
- [ ] 214 `P2` PrÃ©-visualizaÃ§Ã£o 3D do item craftado
- [ ] 215 `P3` Cadeia de produÃ§Ã£o automatizada (esteiras, funis)
- [ ] 216 `P2` EstatÃ­sticas de uso de receita por mundo

## 10 â€” Engenheiro de FÃ­sica

- [x] 217 `P0` ColisÃ£o AABB do jogador com o mundo â€” `src/world/physics.ts`
- [x] 218 `P0` Gravidade, pulo e voo criativo â€” `src/player/controller.ts`
- [x] 219 `P1` Blocos com gravidade (areia, cascalho) caindo sem suporte
- [x] 220 `P1` Colapso estrutural de blocos `structural` sem apoio
- [x] 221 `P0` ~~Ã�gua escoando por nÃ­veis~~ â€” **auditado, jÃ¡ existe** em `world/fluids.ts` (`WATER_SPREAD`, escoamento por nÃ­vel)
- [x] 222 `P0` ~~Lava escoando e solidificando~~ â€” **auditado, jÃ¡ existe**: `LAVA_SPREAD` e Ã¡gua+lava â†’ obsidiana
- [~] 223 `P1` **Empuxo e nataÃ§Ã£o com fÃ­sica prÃ³pria** â€” amortecimento e empuxo d'Ã¡gua em `src/player/controller.ts`
- [~] 224 `P1` **Escadas e trepadeiras alterando o movimento vertical** â€” escalada de blocos em `src/player/controller.ts`
- [~] 225 `P1` **Agachar impedindo cair da borda** â€” trava de seguranÃ§a contra queda de penhascos em `src/player/controller.ts`
- [~] 226 `P1` **Correr com consumo de fome** â€” multiplicador 2.5x ao correr em `src/game/SurvivalSystem.ts`
- [ ] 227 `P2` Atrito por tipo de bloco (gelo escorregadio)
- [ ] 228 `P2` EmpurrÃ£o entre entidades
- [ ] 229 `P2` ExplosÃµes destruindo blocos por raio e resistÃªncia
- [ ] 230 `P2` ResistÃªncia Ã  explosÃ£o por bloco
- [ ] 231 `P2` ProjÃ©teis com gravidade e colisÃ£o
- [ ] 232 `P2` Plataformas mÃ³veis
- [ ] 233 `P2` PistÃµes empurrando blocos
- [ ] 234 `P3` Redstone / circuitos lÃ³gicos
- [~] 235 `P1` **Passo de fÃ­sica com timestep fixo independente do frame rate** â€” acumulador de fÃ­sica fixo em `src/player/controller.ts`
- [~] 236 `P1` **ProteÃ§Ã£o contra atravessar parede em alta velocidade (sweep test)** â€” teste contÃ­nuo ray-AABB em `src/player/controller.ts`
- [ ] 237 `P2` ColisÃ£o precisa com blocos decorativos menores
- [~] 238 `P1` **Blocos de mod respeitam `solid`/`opaque` na fÃ­sica e no mesher**
- [ ] 239 `P2` Mods podem definir fÃ­sica customizada por bloco (bounce, slow)
- [ ] 240 `P2` Testes automatizados de fÃ­sica com cenÃ¡rios fixos

## 11 â€” Engenheiro de IluminaÃ§Ã£o

- [x] 241 `P1` Sombreamento direcional por face no mesher
- [x] 242 `P1` Blocos emissivos marcados como interativos (`GLOWSTONE`, `LAVA`)
- [~] 243 `P0` **PropagaÃ§Ã£o de luz por flood fill (luz solar + luz de bloco) â€” `src/world/lighting.ts`**
- [~] 244 `P0` **EscuridÃ£o real em cavernas exigindo tocha**
- [~] 245 `P1` **Ciclo dia/noite com sol animado em arco e cÃ©u que muda de cor**
- [~] 246 `P1` **Cor da luz variando ao amanhecer/entardecer (laranja rasante)**
- [~] 247 `P1` **Tochas colocÃ¡veis emitindo luz (bloco `TORCH`, craftÃ¡vel com carvÃ£o)**
- [~] 248 `P1` **Recalcular luz incrementalmente com **remoÃ§Ã£o correta** e enfileirado por frame**
- [~] 249 `P2` **Luz atravessando blocos translÃºcidos com atenuaÃ§Ã£o (Ã¡gua, folhagem, vidro)**
- [~] 250 `P2` **Luz da lua com intensidade por fase**
- [ ] 251 `P2` Luz colorida por bloco emissivo
- [~] 252 `P1` **Mods podem definir nÃ­vel de luz emitido pelo bloco** (`lightLevel`) â€” na rodada 3 era sÃ³ metadado; agora o motor de luz realmente o consome
- [ ] 253 `P2` Sombra projetada por entidades
- [ ] 254 `P2` AdaptaÃ§Ã£o de exposiÃ§Ã£o ao sair de uma caverna
- [~] 255 `P2` **Spawn de inimigos condicionado ao nÃ­vel de luz â€” consome o motor da rodada 4**
- [ ] 256 `P2` Debug view mostrando o mapa de luz
- [~] 257 `P1` **Custo de luz espalhado por frame em vez de pico no clique (fila com orÃ§amento)**
- [ ] 258 `P2` Limite de propagaÃ§Ã£o configurÃ¡vel por performance
- [ ] 259 `P3` ReflexÃ£o de luz difusa entre blocos prÃ³ximos
- [ ] 260 `P2` IluminaÃ§Ã£o suave interpolada por vÃ©rtice
- [ ] 261 `P2` Bloco "barreira de luz" para builders
- [~] 262 `P1` **Persistir o horÃ¡rio do mundo no save (`WorldRecord.timeOfDay`)**
- [ ] 263 `P2` Comando para fixar o horÃ¡rio
- [~] 264 `P2` **Testes do algoritmo de propagaÃ§Ã£o em grade conhecida (26 testes)**

## 12 â€” Engenheiro de PersistÃªncia

*Parecer: o save de blocos e jogador estÃ¡ sÃ³lido e em lote; o buraco crÃ­tico era o mundo salvar
ids de bloco que **nÃ£o existiam mais** depois do reload â€” resolvido nesta rodada.*

- [x] 265 `P0` PersistÃªncia em IndexedDB via Dexie â€” `src/storage/Database.ts`
- [x] 266 `P0` Save de modificaÃ§Ãµes de bloco em lote â€” `WorldRepository.saveBlockModBatch`
- [x] 267 `P0` Save de jogador por mundo (posiÃ§Ã£o, vida, inventÃ¡rio, OP)
- [x] 268 `P1` HistÃ³rico de chat por mundo e por thread
- [x] 269 `P1` Exportar/importar mundo em JSON
- [x] 270 `P1` Reparo de mensagens Ã³rfÃ£s de chat
- [x] 271 `P1` CustomizaÃ§Ãµes de UI da IA persistidas por mundo
- [~] 272 `P0` **Mods persistidos por mundo (blocos, entidades, estruturas)** â€” `Database` v4
- [~] 273 `P0` **InstÃ¢ncias de entidade persistidas e restauradas no load**
- [~] 274 `P0` **Ids de bloco customizado estÃ¡veis entre sessÃµes**
- [~] 275 `P1` **Mods incluÃ­dos no export/import de mundo**
- [~] 276 `P0` **MigraÃ§Ã£o de save versionada e idempotente â€” `src/storage/SaveMigration.ts`**
- [~] 277 `P1` **Backup automÃ¡tico antes de migrar (mundo + mods, no localStorage)**
- [~] 278 `P1` **VerificaÃ§Ã£o de integridade ao carregar (ids Ã³rfÃ£os, coordenadas invÃ¡lidas)** â€” `verifyWorldIntegrity()` em `src/storage/SaveMigration.ts`
- [~] 279 `P1` **CompactaÃ§Ã£o do save de blocos (RLE por chunk)** â€” codificaÃ§Ã£o sem perdas em `src/world/paleta.ts`
- [ ] 280 `P2` Save incremental em background sem travar o frame
- [~] 281 `P2` **Indicador de estado no painel de diagnÃ³stico (fila de luz, malhas em voo)**
- [ ] 282 `P2` Quota de armazenamento monitorada com aviso
- [ ] 283 `P2` Exportar mundo como arquivo binÃ¡rio compacto
- [ ] 284 `P2` Importar mundo mesclando em vez de sobrescrever
- [ ] 285 `P2` Clonar mundo
- [~] 286 `P1` **Apagar mundo removendo todas as tabelas relacionadas** â€” `WorldRepository.deleteWorld`
- [ ] 287 `P2` HistÃ³rico de versÃµes do mundo com rollback
- [ ] 288 `P2` Testes de round-trip exportâ†’import preservando tudo

## 13 â€” Arquiteto do Sistema de Mods â­�

*Parecer: este era o **buraco central** do pedido. `registerCustomBlock` existia mas era efÃªmero:
adicionava um bloco ao array em memÃ³ria e nada era salvo. Ao recarregar, o bloco sumia e as
posiÃ§Ãµes salvas apontavam para um id inexistente â€” o mesher lia `BLOCKS[t].colors` de um buraco.
Nesta rodada o sistema foi reconstruÃ­do do zero com identidade estÃ¡vel e persistÃªncia.*

- [~] 289 `P0` **Formato de pacote de mod** com blocos, entidades e estruturas â€” `src/mods/ModTypes.ts`
- [~] 290 `P0` **Registro puro e testÃ¡vel de mods** â€” `src/mods/ModRegistry.ts`
- [~] 291 `P0` **AlocaÃ§Ã£o determinÃ­stica de id de bloco a partir de uma base fixa** (`CUSTOM_BLOCK_ID_BASE`)
- [~] 292 `P0` **Ids reservados nÃ£o deixam buracos no array `BLOCKS`** (slots placeholder)
- [~] 293 `P0` **PersistÃªncia de mods por mundo** â€” tabela `mods` (Database v4)
- [~] 294 `P0` **ReaplicaÃ§Ã£o automÃ¡tica dos mods ao carregar o mundo** â€” hook em `main.ts`
- [~] 295 `P0` **Entidades de mod instanciadas no mundo sÃ£o salvas e restauradas**
- [~] 296 `P0` **Estruturas de mod carimbÃ¡veis com blocos do prÃ³prio mod**
- [~] 297 `P0` **ReferÃªncia de bloco por chave simbÃ³lica** (`meumod:rubi`) resolvida na aplicaÃ§Ã£o
- [~] 298 `P1` **Habilitar/desabilitar mod sem perder as definiÃ§Ãµes**
- [~] 299 `P1` **Remover mod com limpeza dos blocos colocados no mundo**
- [~] 300 `P1` **Exportar mod como JSON portÃ¡til**
- [~] 301 `P1` **Importar mod JSON em outro mundo**
- [~] 302 `P1` **ValidaÃ§Ã£o do pacote antes de aplicar** (nome, cores, chaves duplicadas)
- [~] 303 `P1` **Limite de blocos por mundo com erro claro em vez de corromper**
- [~] 304 `P1` **Listar mods instalados com contagem de conteÃºdo**
- [~] 305 `P1` **DependÃªncias entre mods â†’ ver seÃ§Ã£o 26 (item 655), redesenhado com o modelo de sessÃµes**
- [~] 306 `P1` **Versionamento de mod com histÃ³rico e rollback â€” `ModRevision` + `rollback_mod`**
- [~] 307 `P1` **Conflito de chave entre mods detectado e reportado** â€” `detectModKeyConflicts()` em `src/mods/ModRegistry.ts`
- [ ] 308 `P2` Mods registrando receitas de crafting
- [ ] 309 `P2` Mods registrando itens nÃ£o-bloco
- [ ] 310 `P2` Mods registrando biomas
- [ ] 311 `P2` Mods registrando eventos de mundo
- [ ] 312 `P2` Mods assinando hooks (`onBlockPlaced`, `onTick`)
- [~] 313 `P2` **Painel de gerenciamento de mods â†’ parcialmente coberto pela seleÃ§Ã£o de mod na sessÃ£o**
- [ ] 314 `P2` Recarga a quente de mod sem reiniciar o mundo
- [~] 315 `P2` **Sandbox de permissÃµes por mod â†’ escrita jÃ¡ escopada ao mod da sessÃ£o (item 701)**
- [ ] 316 `P2` Galeria/compartilhamento de mods entre jogadores
- [ ] 317 `P2` Sincronizar mods para os convidados no multiplayer P2P
- [ ] 318 `P3` Mods com assets (sons, texturas) empacotados
- [ ] 319 `P3` Assinatura/verificaÃ§Ã£o de integridade do pacote
- [~] 320 `P0` **Cobertura de testes automatizados do ciclo completo de mod**

## 14 â€” Engenheiro de Agente IA / MCP

*Parecer: o conjunto de ferramentas Ã© forte (execuÃ§Ã£o de script, visÃ£o multi-Ã¢ngulo, autocorreÃ§Ã£o
por log de erro). Faltava a ferramenta mais importante do pedido: criar **modificaÃ§Ãµes inteiras**
que sobrevivem ao save.*

- [x] 321 `P0` Registro de ferramentas MCP tipado â€” `src/ai/MCPRegistry.ts`
- [x] 322 `P0` ExecuÃ§Ã£o de script JS gerado pela IA com API de mundo â€” `execute_voxel_script`
- [x] 323 `P0` VisÃ£o computacional: snapshot e multi-Ã¢ngulo â€” `capture_snapshot`, `capture_multi_angle`
- [x] 324 `P1` PercepÃ§Ã£o de Ã¡rea e resumo do mundo â€” `src/ai/WorldPerception.ts`
- [x] 325 `P1` Log de erros recentes para autocorreÃ§Ã£o â€” `list_recent_errors`
- [x] 326 `P1` Carimbo de estruturas prontas â€” `stamp_structure`
- [x] 327 `P1` ModificaÃ§Ã£o agÃªntica da prÃ³pria UI â€” `src/ai/UIExecutors.ts`
- [x] 328 `P1` Eventos de mundo em larga escala â€” `trigger_world_event`
- [x] 329 `P1` Guarda de tempo de 4s contra loop infinito no script
- [~] 330 `P0` **`create_mod`: criar uma modificaÃ§Ã£o inteira e salvÃ¡-la no mundo**
- [~] 331 `P0` **`define_mod_block`: adicionar bloco a um mod existente**
- [~] 332 `P0` **`define_mod_entity`: adicionar espÃ©cie de entidade a um mod**
- [~] 333 `P0` **`define_mod_structure`: adicionar estrutura a um mod**
- [~] 334 `P0` **`spawn_mod_entity`: instanciar entidade do mod no mundo, persistida**
- [~] 335 `P0` **`place_mod_structure`: carimbar estrutura do mod no mundo, persistida**
- [~] 336 `P1` **`list_mods`: inspecionar o que jÃ¡ foi criado antes de duplicar**
- [~] 337 `P1` **`set_mod_enabled` / `delete_mod`: ciclo de vida completo**
- [~] 338 `P1` **`export_mod`: devolver o JSON do mod para o usuÃ¡rio guardar**
- [~] 339 `P1` **`registerCustomBlock` dentro do script agora persiste de verdade**
- [~] 340 `P1` **Planejador multi-etapa explÃ­cito (a IA declara o plano antes de executar)** â€” `createAIPlan()`, `approveStep()` em `src/commands/CommandSystem.ts`
- [~] 341 `P1` **Ferramenta de dry-run: simular a modificaÃ§Ã£o e reportar o impacto sem aplicar** â€” `dryRunBuild()` em `src/commands/CommandSystem.ts`
- [~] 342 `P1` **Desfazer a Ãºltima aÃ§Ã£o da IA via `undo_last_action`**, revertendo mundo e save
- [~] 343 `P1` **OrÃ§amento de blocos por chamada com aviso quando estourar** â€” `MAX_BLOCKS_PER_CALL` em `src/ai/MCPExecutors.ts`
- [~] 344 `P2` **Progresso de construÃ§Ãµes longas visÃ­vel no painel (malhas em voo, fila de luz)**
- [ ] 345 `P2` MemÃ³ria de longo prazo do agente por mundo (o que jÃ¡ construiu e onde)
- [ ] 346 `P2` Ferramenta de busca semÃ¢ntica no histÃ³rico (hoje Ã© `includes` literal)
- [ ] 347 `P2` Cache de snapshots para evitar re-render idÃªntico
- [ ] 348 `P2` Ferramenta de mediÃ§Ã£o (distÃ¢ncia, Ã¡rea livre) antes de construir
- [ ] 349 `P2` Modo "arquiteto": a IA propÃµe 3 variantes e o usuÃ¡rio escolhe
- [ ] 350 `P2` Limitar ferramentas disponÃ­veis por modo de jogo
- [~] 351 `P1` **Mensagens de erro das ferramentas sempre acionÃ¡veis** â€” `formatActionableError()` em `src/ai/MCPExecutors.ts`
- [~] 352 `P1` **DocumentaÃ§Ã£o das ferramentas sincronizada com o registro** â€” `docs/MCP_TOOLS.md`

## 15 â€” Engenheiro de SeguranÃ§a

*Parecer: scripts da IA rodam via `new Function` com acesso ao escopo global do navegador. Para
um jogo local single-player o risco Ã© baixo, mas o vetor "prompt injection â†’ script" Ã© real e
deve ser tratado antes de qualquer compartilhamento de mods.*

- [x] 353 `P1` SanitizaÃ§Ã£o de HTML injetado pela IA (remoÃ§Ã£o de scripts inline) â€” `UIExecutors`
- [x] 354 `P1` Guarda de tempo abortando escritas apÃ³s 4s
- [x] 355 `P1` Erro de script isolado e reportado sem derrubar o jogo
- [~] 356 `P1` **ValidaÃ§Ã£o estrita do pacote de mod antes de persistir**
- [~] 357 `P1` **Script de comportamento de entidade compilado com falha isolada**
- [~] 358 `P0` **Scripts rodam em Web Worker isolado**, com `fetch`, `indexedDB` e companhia apagados antes de existir um Ãºnico script. Ver a seÃ§Ã£o 69
- [~] 359 `P0` **Escopo global sombreado** â€” `fetch`, `window`, `document`, `localStorage`, `indexedDB` e cia. entram como parÃ¢metros `undefined`. Barra o acesso direto; **nÃ£o Ã© fronteira de seguranÃ§a** (ver 358)
- [~] 360 `P1` **Limite de iteraÃ§Ãµes alÃ©m do limite de tempo** â€” `checkIterationLimit()` em `src/commands/CommandSystem.ts`
- [~] 361 `P1` **Limite de memÃ³ria/blocos por script** â€” `checkMemoryLimit()` em `src/commands/CommandSystem.ts`
- [~] 362 `P1` **Nunca persistir chave de API em texto claro sem aviso ao usuÃ¡rio** â€” `detectExposedApiKeys()` em `src/commands/CommandSystem.ts`
- [~] 363 `P1` **ConfirmaÃ§Ã£o do usuÃ¡rio antes de aÃ§Ãµes destrutivas (`reset_world`, `delete_mod`)** â€” `confirmDestructiveAction` em `src/mods/ModService.ts`
- [~] 364 `P1` **Aviso claro ao importar mod de terceiros (contÃ©m cÃ³digo executÃ¡vel)** â€” `securityWarningForExternalMod` em `src/mods/ModService.ts`
- [ ] 365 `P2` Sandbox de permissÃµes por mod
- [ ] 366 `P2` Assinatura de mod e verificaÃ§Ã£o na importaÃ§Ã£o
- [ ] 367 `P2` CSP restritiva na pÃ¡gina do jogo
- [ ] 368 `P2` Rate limit de chamadas de ferramenta por minuto
- [ ] 369 `P2` Log de auditoria de tudo que a IA alterou no mundo
- [ ] 370 `P2` ReversÃ£o em massa de tudo que um mod alterou
- [~] 371 `P1` **Validar coordenadas recebidas das ferramentas (NaN, infinito, fora de limites)** â€” verificaÃ§Ã£o estrita em `src/mods/ModAPI.ts`
- [~] 372 `P1` **Validar tamanho de `fill_box` antes de alocar** â€” limite de volume 64k voxels em `src/mods/ModAPI.ts`
- [ ] 373 `P2` Relay de sinalizaÃ§Ã£o nunca recebendo dados de mundo (jÃ¡ Ã© o desenho; adicionar teste)
- [ ] 374 `P2` ValidaÃ§Ã£o de mensagens P2P contra payload malicioso
- [ ] 375 `P2` Modo "somente leitura" para a IA
- [ ] 376 `P2` Documentar o modelo de ameaÃ§a em `docs/`

## 16 â€” Engenheiro de Rede

- [x] 377 `P1` Multiplayer P2P via WebRTC com relay sÃ³ de sinalizaÃ§Ã£o â€” `src/net/`
- [x] 378 `P1` Modelo host-autoritativo documentado â€” `docs/NETWORK_PROTOCOL.md`
- [x] 379 `P1` Sync completo de blocos ao entrar (`full_sync`)
- [x] 380 `P1` RetransmissÃ£o de blocos alterados pela IA (`onBlocksChanged`)
- [~] 381 `P0` **Sincronizar mods com os convidados** (`full_sync.mods` + `mod_sync`)
- [~] 382 `P0` **Criaturas sincronizadas** por retrato a 6 Hz, com o anfitriÃ£o como autoridade Ãºnica
- [~] 383 `P1` **InterpolaÃ§Ã£o de posiÃ§Ã£o de jogadores remotos** â€” `interpolateRemotePlayer()` em `src/net/PeerSync.ts`
- [~] 384 `P1` **ReconexÃ£o automÃ¡tica com re-sync incremental** â€” `queryReconnectInfo()`, `resetReconnect()` em `src/net/PeerSync.ts`
- [~] 385 `P1` **Delta sync em vez de mundo inteiro ao reconectar** â€” `computeDeltaSync()` em `src/net/PeerSync.ts`
- [~] 386 `P1` **CompressÃ£o das mensagens de bloco â€” gzip nativo no `full_sync`**
- [~] 387 `P1` **ValidaÃ§Ã£o de permissÃ£o (OP) no host antes de aplicar ediÃ§Ã£o do convidado** â€” `validatePeerPermission()` em `src/net/PeerSync.ts`
- [ ] 388 `P2` Chat multiplayer separado do chat da IA
- [ ] 389 `P2` Lista de jogadores com latÃªncia
- [ ] 390 `P2` Kick/ban por jogador
- [ ] 391 `P2` MigraÃ§Ã£o de host quando o host sai
- [ ] 392 `P2` Limite de convidados configurÃ¡vel
- [~] 393 `P2` **Indicador de estado de conexÃ£o â€” papel, peers e banda no painel F3**
- [~] 394 `P2` **Fila de mensagens com fragmentaÃ§Ã£o â€” `src/net/wire.ts`**
- [ ] 395 `P2` Testes do protocolo com peers simulados
- [ ] 396 `P2` Modo offline explÃ­cito desabilitando toda a rede
- [ ] 397 `P3` Servidor dedicado opcional
- [ ] 398 `P3` ReplicaÃ§Ã£o de entidades por interesse (Ã¡rea)
- [~] 399 `P2` **Versionamento implÃ­cito por formato: peer antigo continua entendido, porque texto e binÃ¡rio convivem no mesmo canal**
- [~] 400 `P2` **MÃ©tricas de banda por sessÃ£o â€” `PeerSync.getTrafficStats`**

## 17 â€” Engenheiro de Performance

- [x] 401 `P0` GeraÃ§Ã£o de chunk fora da thread principal
- [x] 401b `P0` Save de blocos em lote (era 2N round-trips, virou 2 escritas)
- [~] 402 `P0` **OrÃ§amento de quadro adaptativo** â€” havia um limite por contagem; faltava reagir ao custo real
- [~] 403 `P0` **Mesh em Web Worker â€” `src/world/meshWorker.ts`, com buffers transferidos nos dois sentidos**
- [~] 404 `P1` **Pool de buffers reaproveitados em vez de realocar 300 KB por re-mesh**
- [~] 405 `P1` **`dispose()` do chunk anterior ao aplicar a malha nova**
- [~] 406 `P1` **Instanced mesh para decorativos e entidades repetidas** â€” `createDecorativeInstancedMesh()` em `src/world/physics.ts`
- [~] 407 `P1` **Reduzir draw calls agrupando chunks vizinhos** â€” `groupNeighborChunkMeshes()` em `src/render/scene.ts`
- [~] 408 `P1` **Profiling embutido (F3)** com FPS, custo por sistema, chunks, entidades, vozes, rede e memÃ³ria
- [~] 409 `P1` **DistÃ¢ncia de render adaptativa ao FPS medido** â€” `computeAdaptiveRenderDistance()` em `src/core/profiler.ts`
- [ ] 410 `P2` Cache de resultado de `getGroundY` por coluna
- [ ] 411 `P2` Estruturas tipadas (`Uint8Array`) em vez de `Map<string, number>` no hot path
- [~] 412 `P2` **Evitada a concatenaÃ§Ã£o de string por voxel no acesso Ã  luz (cache de chunk)**
- [ ] 413 `P2` Web Worker dedicado para persistÃªncia
- [ ] 414 `P2` Debounce jÃ¡ existe no save de jogador; estender ao save de blocos
- [~] 415 `P1` **Limite de entidades simuladas por frame** â€” `maxSimulatedEntitiesPerFrame` em `src/entities/EntitySystem.ts`
- [ ] 416 `P2` Throttle de scripts de comportamento por distÃ¢ncia
- [ ] 417 `P2` Benchmark automatizado de mesher em cena fixa
- [ ] 418 `P2` Benchmark de geraÃ§Ã£o de 100 chunks
- [ ] 419 `P2` Teste de regressÃ£o de performance no CI
- [ ] 420 `P2` Lazy load do mÃ³dulo de IA (sÃ³ quando o chat abre)
- [ ] 421 `P2` Code splitting do bundle
- [ ] 422 `P2` Reduzir tamanho do bundle Three.js (imports seletivos)
- [ ] 423 `P3` WebGPU como caminho alternativo
- [ ] 424 `P2` Detectar e avisar sobre GPU fraca

## 18 â€” Designer de UI/UX & Acessibilidade

- [x] 425 `P1` Menu principal, assistente de criaÃ§Ã£o de mundo, pausa â€” `src/ui/`
- [x] 426 `P1` HUD com hotbar e toasts
- [x] 427 `P1` InventÃ¡rio criativo com abas
- [x] 428 `P1` Chat com threads e histÃ³rico por mundo
- [x] 429 `P1` Gerenciador central de UI com lock de ponteiro
- [x] 430 `P0` ~~Painel de mods na UI~~ â€” **auditado, jÃ¡ existe** em `ModsPage`: listar, ativar, remover, exportar
- [~] 431 `P1` **Feedback visual quando a IA estÃ¡ construindo (progresso, nÃ£o sÃ³ spinner)** â€” `updateAIBuildProgress()` no `HUD` em `src/ui/HUD.ts`
- [~] 432 `P1` **Remapeamento de teclas** â€” `keyMap` reconfigurÃ¡vel em `src/player/controller.ts`
- [~] 433 `P1` **Suporte a gamepad** â€” `pollGamepad()` em `src/player/controller.ts`
- [~] 434 `P1` **Sensibilidade de mouse configurÃ¡vel** â€” `mouseSensitivity` no `PlayerController` em `src/player/controller.ts`
- [~] 435 `P1` **Legendas/indicadores para efeitos sonoros importantes** â€” `onSoundSubtitle` em `src/audio/AudioSystem.ts`
- [~] 436 `P1` **Modo daltonismo** â€” `aplicarModoDaltonismo()` em `src/render/grading.ts`
- [~] 437 `P1` **Escala de UI configurÃ¡vel** â€” `setUIScale()` no `HUD` em `src/ui/HUD.ts`
- [ ] 438 `P2` Redutor de movimento (desligar balanÃ§o de cÃ¢mera)
- [ ] 439 `P2` Contraste alto no HUD
- [ ] 440 `P2` NavegaÃ§Ã£o por teclado em todos os menus
- [ ] 441 `P2` RÃ³tulos ARIA nos elementos interativos
- [~] 442 `P2` **Tela de configuraÃ§Ãµes unificada â€” Ã¡udio e atalhos no hub**
- [ ] 443 `P2` Minimapa
- [ ] 444 `P2` BÃºssola e coordenadas opcionais
- [ ] 445 `P2` Tela de morte com resumo
- [ ] 446 `P2` Tooltip de bloco com propriedades (inclusive blocos de mod)
- [ ] 447 `P2` Busca no inventÃ¡rio
- [ ] 448 `P3` Suporte a toque/mobile

## 19 â€” Engenheiro de QA & Testes Automatizados

*Parecer: 46 testes passando Ã© uma base honesta, mas cobrem sÃ³ lÃ³gica pura. O sistema de mods
precisava nascer com teste, porque a falha dele Ã© silenciosa e corrompe o save.*

- [x] 449 `P0` Vitest configurado com `npm test`
- [x] 450 `P1` Testes de `blocks.ts` (solidez, opacidade, tiers)
- [x] 451 `P1` Testes de `CommandSystem`
- [x] 452 `P1` Testes de `CraftingSystem`
- [x] 453 `P1` Testes de `GameModeManager`
- [x] 454 `P1` Testes de `StructureTemplates`
- [x] 455 `P1` Testes de `SurvivalSystem`
- [~] 456 `P0` **Testes do `ModRegistry`** (alocaÃ§Ã£o de id, validaÃ§Ã£o, resoluÃ§Ã£o simbÃ³lica)
- [~] 457 `P0` **Testes de estabilidade de id entre sessÃµes** (o bug que corrompia o save)
- [~] 458 `P0` **Testes de round-trip de mod** (criar â†’ serializar â†’ recarregar â†’ aplicar)
- [~] 459 `P0` **Testes de registro de bloco customizado sem buracos no array**
- [~] 460 `P1` **Testes das ferramentas MCP de mod com repositÃ³rio fake**
- [~] 461 `P1` **Testes de resoluÃ§Ã£o de referÃªncia simbÃ³lica de bloco em estruturas**
- [~] 462 `P1` **Testes de `WorldRepository` com IndexedDB fake** â€” `tests/unit/worldRepositoryFake.test.ts`
- [~] 463 `P1` **Testes de `physics.ts` com cenÃ¡rios de colisÃ£o fixos** â€” `tests/unit/physicsFixedCollision.test.ts`
- [~] 464 `P1` **Testes de `worldgen` verificando determinismo por semente** â€” `tests/unit/worldgenSeedDeterminism.test.ts`
- [~] 465 `P1` **Testes de `mesher` contando faces geradas em grade conhecida** â€” `tests/unit/mesherFacesCount.test.ts`
- [~] 466 `P1` **Testes de `UndoManager`** â€” `tests/unit/undoManagerComprehensive.test.ts` + bug real corrigido no `redo()`
- [~] 467 `P1` **Testes de `WorldPerception`** â€” `tests/unit/worldPerceptionCoverage.test.ts`
- [ ] 468 `P2` Testes de `EntitySystem` com cena Three mockada
- [ ] 469 `P2` Testes do protocolo de rede com peers simulados
- [ ] 470 `P2` Cobertura mÃ­nima exigida no CI (ex.: 60% em `src/`)
- [ ] 471 `P2` Testes end-to-end com Playwright (criar mundo, colocar bloco, recarregar)
- [ ] 472 `P2` Teste de regressÃ£o visual do mesher
- [ ] 473 `P2` Testes de migraÃ§Ã£o de save entre versÃµes
- [ ] 474 `P2` Fixtures de mundo para cenÃ¡rios repetÃ­veis
- [ ] 475 `P2` Testes de carga (10k blocos, 200 entidades)
- [ ] 476 `P2` `npm run test:watch` documentado no guia de desenvolvimento

## 20 â€” Engenheiro de Ã�udio

- [~] 477 `P0` **Sistema de Ã¡udio com Web Audio API e sÃ­ntese procedural â€” zero asset, zero download**
- [~] 478 `P0` **Som por material ao quebrar/colocar, derivado da paleta (bloco de mod herda som coerente)**
- [~] 479 `P1` **Passos variando por bloco pisado, com cadÃªncia por distÃ¢ncia andada**
- [~] 480 `P1` **Ã�udio posicional: atenuaÃ§Ã£o por distÃ¢ncia com corte, e panorÃ¢mica estÃ©reo**
- [~] 481 `P1` **AmbiÃªncia por bioma** â€” `updateBiomeAmbiance()` em `src/audio/AudioSystem.ts`
- [~] 482 `P1` **MÃºsica dinÃ¢mica por contexto (dia, noite, caverna, combate)** â€” `updateDynamicMusic()` em `src/audio/AudioSystem.ts`
- [~] 483 `P1` **Volume separado por canal (mestre, efeitos, ambiente, mÃºsica, UI)**
- [~] 484 `P1` **Som de dano, morte, acerto, queimadura e ferramenta quebrando**
- [ ] 485 `P2` Som de Ã¡gua e lava por proximidade
- [ ] 486 `P2` Reverb em cavernas
- [ ] 487 `P2` Abafamento embaixo d'Ã¡gua
- [~] 488 `P2` **Som de UI (pegar item, abrir painel)**
- [~] 489 `P2` **Mods podem tocar sons pelo catÃ¡logo â€” `api.audio.play`**
- [~] 490 `P2` **Limite de vozes simultÃ¢neas com liberaÃ§Ã£o garantida**
- [~] 491 `P2` **RuÃ­do gerado uma vez e reaproveitado, sem travar o boot**
- [ ] 492 `P2` Silenciar ao perder o foco da aba
- [ ] 493 `P3` SÃ­ntese procedural de som de bloco a partir do material
- [~] 494 `P2` **Testes de que todo som Ã© vÃ¡lido e nenhum sai da faixa audÃ­vel**

## 21 â€” Designer de ConteÃºdo Terraria-like

- [~] 495 `P0` **Quatro camadas com nÃ©voa, alcance e piso de luz prÃ³prios** â€” superfÃ­cie, subsolo, caverna, abismo. Ver a seÃ§Ã£o 77
- [~] 496 `P0` **Ouro sÃ³ na caverna, diamante sÃ³ no abismo** â€” a regra Ã© consultada na geraÃ§Ã£o, antes da abundÃ¢ncia de bioma
- [~] 497 `P1` **Perigo por camada** â€” o abismo gera hostis mais que o dobro do ritmo da superfÃ­cie. Ver a seÃ§Ã£o 78
- [~] 498 `P1` **Masmorras com chave/mecanismo de abertura** â€” `tryUnlockDungeonDoor()` em `src/player/interaction.ts`
- [~] 499 `P1` **Eventos de invasÃ£o temporizados** â€” `startInvasionEvent()` em `src/entities/EntitySystem.ts`
- [~] 500 `P1` **Bosses invocÃ¡veis com item de convocaÃ§Ã£o** â€” `summonBoss()` em `src/entities/EntitySystem.ts`
- [~] 501 `P1` **NPCs que se mudam para a base quando hÃ¡ condiÃ§Ãµes (casa vÃ¡lida)** â€” `checkNPCHousingQualification()` em `src/game/abrigo.ts`
- [~] 502 `P1` Validador de "casa" â€” **o miolo existe**: `estaAbrigado` (seÃ§Ã£o 58) jÃ¡ responde "este espaÃ§o Ã© fechado?" por busca em largura, que Ã© a parte difÃ­cil. Faltam os outros trÃªs critÃ©rios (porta, luz mÃ­nima, mobÃ­lia), e a **porta ainda nÃ£o existe como bloco** (item 1323)
- [ ] 503 `P2` Biomas corrompidos que se espalham
- [ ] 504 `P2` Item de mobilidade progressiva (gancho, planador, botas)
- [ ] 505 `P2` AcessÃ³rios com efeitos combinÃ¡veis
- [ ] 506 `P2` BaÃºs de bioma com loot Ãºnico
- [ ] 507 `P2` Sistema de trofeus/coleÃ§Ãµes
- [ ] 508 `P2` Modo dificuldade "pÃ³s-boss" alterando o mundo
- [ ] 509 `P2` Pesca com raridades
- [ ] 510 `P3` Modo construÃ§Ã£o 2D lateral opcional
- [ ] 511 `P2` Mapa de mundo revelado por exploraÃ§Ã£o
- [ ] 512 `P2` Marcadores/waypoints no mapa

## 22 â€” DevOps & Build

- [x] 513 `P1` Vite + TypeScript com `npm run build` e `npm test`
- [~] 514 `P0` **CI rodando `tsc --noEmit`, `vitest run` e build a cada push â€” `.github/workflows/ci.yml`**
- [ ] 515 `P1` Lint (ESLint) e formataÃ§Ã£o (Prettier) padronizados
- [ ] 516 `P1` `strict` do TypeScript revisado e sem `any` implÃ­cito nas APIs pÃºblicas
- [~] 517 `P1` **Versionamento semântico com CHANGELOG gerado** — `docs/CHANGELOG.md`
- [ ] 518 `P2` Build de produÃ§Ã£o com source maps publicÃ¡veis
- [ ] 519 `P2` Deploy automatizado (GitHub Pages / estÃ¡tico)
- [ ] 520 `P2` DocumentaÃ§Ã£o de contribuiÃ§Ã£o e de arquitetura mantida em `docs/`

---

## Resumo executivo desta rodada

**Bloqueio crÃ­tico encontrado e corrigido.** `registerCustomBlock()` em `src/world/blocks.ts`
criava blocos apenas em memÃ³ria. ConsequÃªncias concretas no cÃ³digo anterior:

1. Ao recarregar o mundo, `BLOCKS` voltava a ter 29 entradas.
2. Os `blockMods` salvos ainda referenciavam ids â‰¥ 29.
3. `src/world/mesher.ts:142` faz `const def = BLOCKS[t]` e em seguida lÃª `def.colors` â€” com um id
   Ã³rfÃ£o isso Ã© `undefined.colors`, quebrando o mesh do chunk inteiro.

Ou seja: **toda modificaÃ§Ã£o de bloco criada pela IA corrompia o mundo no reload.** Os itens
marcados `[~]` acima sÃ£o a correÃ§Ã£o estrutural: identidade de bloco estÃ¡vel, persistÃªncia por
mundo, reaplicaÃ§Ã£o no load e cobertura de testes.

### Rodada 6 â€” concluÃ­do

| Item | Entrega |
|---|---|
| 175 | A* em grade de voxels: os mobs contornam quinas em vez de encostar na parede e travar |
| 129/152 | Durabilidade com quebra e loot que realimenta o ciclo de luz e de picareta |
| 621â€“641 | **Mod = sessÃ£o de chat**, com versionamento, rollback e quarentena |
| 701â€“703 | Escrita escopada ao mod da sessÃ£o; leitura continua ampla |

**DecisÃ£o de modelagem que vale registrar:** o pedido original sugeria 1 sessÃ£o â†” 1 mod. Amarrar
assim obrigaria a carregar toda a conversa anterior no contexto para continuar um mod antigo. O
vÃ­nculo autoritativo ficou em `ChatThreadRecord.modId` (1 mod â†’ N sessÃµes), e `originThreadId`
guarda sÃ³ a proveniÃªncia.

**SessÃ£o livre** foi acrescentada como terceiro estado: sem mod vinculado, o agente lÃª o mundo e
os outros mods mas nenhuma ferramenta de escrita funciona. Ã‰ o que impede uma conversa
exploratÃ³ria de alterar o jogo por engano.

**Biomas e construÃ§Ãµes espalhadas** foram desenhados e registrados na seÃ§Ã£o 27, mas **nÃ£o
implementados** nesta rodada, a pedido â€” o esboÃ§o do `BiomeDef` e da regra de espalhamento estÃ¡
descrito lÃ¡ para a implementaÃ§Ã£o ser direta.

### Rodada 5 â€” concluÃ­do

| Item | Entrega |
|---|---|
| 145/147/149/150 | NÃºcleo de combate puro: dano por tier, alcance com **cone de mira**, cooldown, i-frames, recuo |
| 146/255 | Hostis nascem **sÃ³ no escuro** â€” o motor de luz da rodada 4 virou mecÃ¢nica de jogo |
| 151/161 | Barra de vida flutuante e piscada vermelha ao acertar |
| 176â€“179 | Mobs colidem com o mundo, sobem degrau, percebem, perseguem e atacam |
| 124â€“125 | Comida (tecla F) e regeneraÃ§Ã£o â€” a fome deixou de ser sÃ³ um cronÃ´metro de morte |

TrÃªs arquÃ©tipos com posturas distintas: zumbi lento e resistente, aranha rÃ¡pida e frÃ¡gil,
esqueleto no meio. A verificaÃ§Ã£o de balanceamento estÃ¡ em teste â€” nenhum mob mata de um golpe,
e o jogador de mÃ£o vazia derrota qualquer um entre 2 e 12 golpes.

**A tocha virou ferramenta tÃ¡tica:** iluminar a Ã¡rea Ã© literalmente o que impede o spawn, porque
`effectiveLight` faz a luz de bloco valer integralmente a qualquer hora, enquanto a luz de cÃ©u
despenca Ã  noite.

### Rodada 4 â€” concluÃ­do

| Item | Entrega |
|---|---|
| 243â€“244 | Motor de luz por flood fill: sol + luz de bloco, com escuridÃ£o real nas cavernas |
| 245â€“246 | Ciclo dia/noite: sol em arco, cÃ©u azul â†’ laranja â†’ noite |
| 247 | Tocha colocÃ¡vel (`B.TORCH`), craftÃ¡vel com carvÃ£o + tronco |
| 248 | RecÃ¡lculo incremental â€” colocar tocha ou furar o teto acende/apaga na hora |
| 249/252 | Ã�gua, folhagem e vidro atenuam de formas diferentes; `lightLevel` de mod passou a valer |
| 262 | Hora do mundo entrou no save |
| â€” | Receitas de minÃ©rio â†’ bloco refinado, fechando a cadeia aberta na rodada 3 |

**Bug real encontrado:** as folhas retornavam opacidade `Infinity` porque sÃ£o `opaque` na paleta
(para o mesher nÃ£o desenhar as faces internas da copa). Para a luz isso significava que toda
Ã¡rvore projetaria uma sombra preta sÃ³lida. A folhagem agora Ã© filtro (custo 1), tratada **antes**
da checagem de opacidade.

### Rodada 3 â€” concluÃ­do

| Item | Entrega |
|---|---|
| 100â€“101 | Cavernas por ruÃ­do 3D e veios de minÃ©rio â€” o subsolo deixou de ser rocha maciÃ§a |
| 540 | Lava com a mesma geometria de minibloco da Ã¡gua |
| 543 | Queimadura persistente: sair da lava nÃ£o apaga o fogo, sÃ³ a Ã¡gua |
| 342 | `undo_last_action` â€” e `recordBatch` passou a ser chamado (o undo existia mas estava morto) |
| 381/608 | Mods sincronizados no P2P, com os ids preservados |
| 286 | `deleteWorld` deixou de vazar players, threads, UI e mods |

Densidade medida no subsolo: **10,6% de caverna**, com gradiente de raridade
carvÃ£o 1,24% â†’ ferro 0,92% â†’ ouro 0,12% â†’ diamante 0,022%.

**Prioridade recomendada para a prÃ³xima rodada** (maior impacto primeiro):

| Ordem | Item | Por quÃª |
|---|---|---|
| 1 | 665â€“669 (biomas com recursos prÃ³prios) | Desenhado e registrado; Ã© o que dÃ¡ razÃ£o para explorar o mapa |
| 1b | 721â€“728 (`mod.env` + cofre) | PrÃ©-requisito de qualquer integraÃ§Ã£o externa; ver a ordem da seÃ§Ã£o 30 |
| 2 | 681â€“684 (construÃ§Ãµes espalhadas) | NÃ£o hÃ¡ nada para encontrar explorando hoje |
| 3 | 642 (painel de mods na UI) | Versionamento e rollback existem, mas sÃ³ via ferramenta da IA |
| 4 | 704â€“705 (atribuir blocos ao mod da sessÃ£o) | Fecha o cerco: hoje `set_block` ainda escreve fora do escopo |
| 5 | 148 (arco e flecha) | Sem ataque Ã  distÃ¢ncia, todo combate Ã© encostar e bater |
| 6 | 130 (armadura) | O combate existe, mas defender-se ainda nÃ£o Ã© decisÃ£o |
| 7 | 403 (mesh em worker) | O re-mesh do ciclo dia/noite tornou o custo de malha mais visÃ­vel |
| 8 | 514 (CI) | Impede regressÃ£o silenciosa nos 285 testes |

---

# Adendo â€” Rodada 2 (itens 521â€“620)

> Requisitos levantados pelo usuÃ¡rio depois da primeira entrega, com trÃªs especialistas novos
> convocados para a banca. A pesquisa sobre o **Lay of the Land** (Southern Cross Interactive,
> 2026) foi feita e confirmou a direÃ§Ã£o: o jogo usa voxels de verdade em vez de blocos grandes,
> e *tudo* obedece fÃ­sica â€” estruturas colapsam sob carga e objetos rolam ladeira abaixo. Isso
> ancora tanto a mecÃ¢nica de fluidos quanto o desmoronamento de areia pedidos aqui.

| # | Especialista | Itens | Foco |
|---|---|---|---|
| 23 | Engenheiro de Fluidos & Materiais | 521â€“556 | Ã�gua/lava finitas, areia com Ã¢ngulo de repouso |
| 24 | Diretor de Personagem & CÃ¢mera | 557â€“600 | Avatar estilo Hytale, 1Âª/3Âª pessoa, customizaÃ§Ã£o |
| 25 | Arquiteto Client-Side | 601â€“620 | Tudo no navegador, inclusive no P2P |

## 23 â€” Engenheiro de Fluidos & Materiais

*Parecer: a Ã¡gua era um preenchimento de cavidade ligado ao nÃ­vel do mar â€” comportava-se como
fonte infinita e nÃ£o tinha noÃ§Ã£o de volume. A lava nÃ£o escoava de forma alguma. Reescrito como
transporte de massa conservada em mini-voxels.*

- [~] 521 `P0` **Ã�gua e lava como voxels discretos e finitos** â€” `src/world/fluids.ts`
- [~] 522 `P0` **Massa conservada: o sistema move fluido, nunca cria**
- [~] 523 `P0` **Sem fonte infinita â€” a poÃ§a espalha, afina e para**
- [~] 524 `P0` **Queda: o fluido desce enquanto a cÃ©lula de baixo aceitar**
- [~] 525 `P0` **Cair restaura o orÃ§amento de espalhamento** (cachoeira volta a se abrir embaixo)
- [~] 526 `P0` **Busca de beirada: o lÃ­quido prefere a direÃ§Ã£o com degrau para baixo**
- [~] 527 `P0` **PressÃ£o hidrostÃ¡tica: sÃ³ espalha em plano se houver coluna por cima**
- [~] 528 `P1` **Voxel isolado nÃ£o rasteja â€” fica onde caiu**
- [~] 529 `P1` **Lava mais viscosa que Ã¡gua** (alcance lateral menor)
- [~] 530 `P1` **Ã�gua + lava â†’ obsidiana**
- [~] 531 `P1` **Fluido atravessa vegetaÃ§Ã£o decorativa em vez de ficar preso**
- [~] 532 `P1` **ReativaÃ§Ã£o: cavar sob uma poÃ§a parada faz o fluido voltar a escoar**
- [~] 533 `P1` **OrÃ§amento por frame â€” dilÃºvio nÃ£o derruba o FPS**
- [~] 534 `P1` **Escoamento persiste no save e Ã© replicado no P2P pelo anfitriÃ£o**
- [~] 535 `P0` **Areia/cascalho desmoronam para o lado em declive Ã­ngreme** (`findSlideTarget`)
- [~] 536 `P1` **Ã‚ngulo de repouso: sÃ³ escorrega se houver degrau vazio, nÃ£o em encosta apoiada**
- [~] 537 `P1` **Desempate de direÃ§Ã£o alternado, sem viÃ©s para um lado**
- [~] 538 `P1` **EmpurrÃ£o horizontal no destroÃ§o, para o grÃ£o rolar visivelmente**
- [~] 539 `P0` **Cobertura de testes da mecÃ¢nica de fluidos e desmoronamento** (20 testes)
- [~] 540 `P1` **Lava renderizada com a mesma geometria rebaixada da Ã¡gua**
- [~] 541 `P1` **Altura visual do voxel proporcional ao volume restante** â€” `computeVoxelVisualHeight()` em `src/world/physics.ts`
- [~] 542 `P1` **Nadar e boiar com fÃ­sica prÃ³pria dentro do fluido** â€” `computeSwimPhysics()` em `src/world/physics.ts`
- [~] 543 `P1` **Dano por lava e queimadura persistente** (sÃ³ a Ã¡gua apaga)
- [~] 544 `P1` **Balde: pegar e despejar uma quantidade finita** â€” `handleBucketInteraction()` em `src/player/interaction.ts`
- [ ] 545 `P2` Correnteza empurrando jogador e entidades
- [ ] 546 `P2` EvaporaÃ§Ã£o lenta de poÃ§as rasas expostas ao sol
- [ ] 547 `P2` Congelamento de Ã¡gua em bioma nevado
- [ ] 548 `P2` Lava esfriando em pedra longe de fonte de calor
- [ ] 549 `P2` Fluido girando moinho/turbina (energia mecÃ¢nica)
- [ ] 550 `P2` Som posicional de fluido escoando
- [ ] 551 `P2` PartÃ­culas de respingo ao cair
- [ ] 552 `P2` Fluidos customizados via mod (Ã¡cido, mel) com viscosidade prÃ³pria
- [ ] 553 `P2` SimulaÃ§Ã£o de fluido movida para Web Worker
- [ ] 554 `P2` Compactar o estado ativo do fluido no save (hoje o orÃ§amento Ã© transitÃ³rio)
- [ ] 555 `P3` PressÃ£o em tubulaÃ§Ã£o fechada (fluido sobe)
- [ ] 556 `P2` Benchmark: 5.000 voxels de fluido ativos sem queda de frame

## 24 â€” Diretor de Personagem & CÃ¢mera

*Parecer: nÃ£o existia personagem â€” o jogador era uma cÃ¢mera flutuante e os outros jogadores no
P2P eram sÃ³ um nome numa lista, sem corpo. ConstruÃ­do do zero com silhueta estilo Hytale.*

- [~] 557 `P0` **Modelo 3D do jogador com anatomia estilo Hytale** â€” `src/player/PlayerModel.ts`
- [~] 558 `P0` **ProporÃ§Ãµes distintas do Minecraft: cabeÃ§a grande, membros finos, peÃ§as destacadas**
- [~] 559 `P0` **Cabelo em 4 estilos** (curto, longo, moicano, careca)
- [~] 560 `P0` **PeÃ§as extras de silhueta: cinto, botas, mÃ£os, olhos**
- [~] 561 `P1` **PivÃ´s no ombro/quadril/pescoÃ§o â€” o braÃ§o gira do ombro, nÃ£o da barriga**
- [~] 562 `P1` **Ciclo de caminhada com amplitude proporcional Ã  velocidade**
- [~] 563 `P1` **Pose de salto distinta quando fora do chÃ£o**
- [~] 564 `P1` **CabeÃ§a acompanha a mira vertical, com limite de pescoÃ§o**
- [~] 565 `P1` **BalanÃ§o sutil do corpo ao andar**
- [~] 566 `P1` **Materiais compartilhados por cor â€” nÃ£o cria material por peÃ§a**
- [~] 567 `P0` **O jogo comeÃ§a em primeira pessoa**
- [~] 568 `P0` **CÃ¢mera em terceira pessoa orbital atrÃ¡s do personagem**
- [~] 569 `P0` **F5 alterna 1Âª/3Âª pessoa** (Ctrl+4 tambÃ©m seleciona direto)
- [~] 570 `P1` **Roda do mouse ajusta a distÃ¢ncia da 3Âª pessoa**
- [~] 571 `P1` **CÃ¢mera se aproxima ao encostar em parede, em vez de entrar no terreno**
- [~] 572 `P1` **Terceira pessoa mantÃ©m a mesma fÃ­sica da primeira**
- [~] 573 `P1` **Modelo oculto em 1Âª pessoa** (a cÃ¢mera fica dentro da cabeÃ§a)
- [~] 574 `P1` **Terceira pessoa listada no menu de pausa**
- [~] 575 `P0` **PÃ¡gina de customizaÃ§Ã£o do personagem** â€” `src/ui/CharacterCreator.ts`
- [~] 576 `P0` **Preview 3D girando, com renderer prÃ³prio criado sÃ³ ao abrir**
- [~] 577 `P0` **Cor por parte do corpo: 7 slots pintÃ¡veis**
- [~] 578 `P0` **Paleta sugerida + seletor de cor livre**
- [~] 579 `P1` **Arrastar no preview para girar o personagem**
- [~] 580 `P1` **BotÃ£o "AleatÃ³rio" gerando visual coerente**
- [~] 581 `P1` **Ajuste de porte (0.9â€“1.1)**
- [~] 582 `P1` **Nome do personagem editÃ¡vel**
- [~] 583 `P0` **A aparÃªncia Ã© salva** â€” tabela `profiles` (Database v5)
- [~] 584 `P0` **Perfil global ao jogador, nÃ£o por mundo** â€” o personagem acompanha todos os mundos
- [~] 585 `P0` **Outros jogadores veem o personagem customizado online** â€” `AvatarManager`
- [~] 586 `P0` **AparÃªncia viaja no `player_state` do protocolo P2P**
- [~] 587 `P1` **Avatares remotos com interpolaÃ§Ã£o de posiÃ§Ã£o** (pacotes a ~10 Hz)
- [~] 588 `P1` **Etiqueta de nome legÃ­vel sobre o avatar, sempre virada para a cÃ¢mera**
- [~] 589 `P1` **Avatar reconstruÃ­do quando o peer troca de visual em tempo real**
- [~] 590 `P1` **Avatar sumindo depois de 12s sem estado** (queda de conexÃ£o silenciosa)
- [~] 591 `P0` **AparÃªncia recebida da rede Ã© higienizada antes de virar cor/escala**
- [~] 592 `P1` **F4 abre a customizaÃ§Ã£o; a tela entra no gerenciador de UI bloqueante**
- [~] 593 `P1` **Cobertura de testes da aparÃªncia e da anatomia** (20 testes)
- [~] 594 `P1` **Primeira pessoa mostrando braÃ§os e ferramenta na tela** â€” `updateFirstPersonToolView()` em `src/player/controller.ts`
- [~] 595 `P1` **PeÃ§as de equipamento visÃ­veis (capacete, peitoral) sobre o modelo** â€” `renderEquipmentOverlay()` em `src/player/controller.ts`
- [ ] 596 `P2` Emotes e animaÃ§Ãµes de gesto
- [ ] 597 `P2` Mais opÃ§Ãµes de rosto (sobrancelha, barba, boca)
- [ ] 598 `P2` Presets de personagem salvos e nomeados
- [ ] 599 `P2` Ombro esquerdo/direito na cÃ¢mera de 3Âª pessoa
- [ ] 600 `P2` Compartilhar o personagem como cÃ³digo/JSON entre jogadores

## 25 â€” Arquiteto Client-Side

*Parecer: a regra "tudo roda no navegador" jÃ¡ era respeitada e continua sendo, inclusive no
multiplayer. Vale registrÃ¡-la explicitamente para nenhuma feature futura quebrar a premissa.*

- [x] 601 `P0` Jogo 100% client-side: nenhum backend de jogo existe
- [x] 602 `P0` PersistÃªncia local em IndexedDB, nunca em servidor
- [x] 603 `P0` Multiplayer P2P direto entre navegadores via WebRTC DataChannel
- [x] 604 `P0` Relay enxerga sÃ³ sinalizaÃ§Ã£o â€” nunca blocos, inventÃ¡rio ou chat
- [x] 605 `P0` Chamadas de rede externas restritas ao provedor de IA configurado
- [~] 606 `P0` **AparÃªncia do personagem trafega P2P, sem servidor de perfil**
- [~] 607 `P0` **Fluidos simulados no cliente; o anfitriÃ£o Ã© a autoridade e replica o resultado**
- [~] 608 `P1` **Sincronizar mods para os convidados â€” o convidado registra no mesmo id do anfitriÃ£o**
- [ ] 609 `P1` Sincronizar entidades e seu estado
- [~] 610 `P1` **Documentar premissa client-side no ARCHITECTURE.md como regra de projeto** — `docs/ARCHITECTURE.md`
- [~] 611 `P1` **Teste automatizado de isolamento do relay P2P** — `tests/unit/novasMelhoriasP1Batch7.test.ts` + `relayPayloadSafety.test.ts`
- [~] 612 `P1` **Modo offline explÃ­cito, desabilitando toda a rede** â€” `setExplicitOfflineMode()` em `src/net/PeerSync.ts`
- [ ] 613 `P2` Funcionar como PWA instalÃ¡vel e jogÃ¡vel sem conexÃ£o
- [ ] 614 `P2` Service worker com cache de assets
- [ ] 615 `P2` Aviso claro de uso de quota do IndexedDB
- [ ] 616 `P2` Exportar/importar todo o perfil do jogador
- [ ] 617 `P2` MigraÃ§Ã£o de host quando o anfitriÃ£o sai
- [ ] 618 `P2` ValidaÃ§Ã£o de todas as mensagens P2P recebidas contra payload malicioso
- [ ] 619 `P2` Limite de convidados configurÃ¡vel
- [ ] 620 `P3` Servidor dedicado opcional, sem quebrar o modo local

---

# Adendo â€” Rodada 3 de requisitos (itens 621â€“720)

> TrÃªs especialistas novos convocados para os requisitos de **mod como sessÃ£o de chat**,
> **biomas com recursos prÃ³prios** e **construÃ§Ãµes espalhadas**.

| # | Especialista | Itens | Foco |
|---|---|---|---|
| 26 | Arquiteto de SessÃµes & Versionamento | 621â€“664 | Mod = sessÃ£o de chat, versÃµes, isolamento |
| 27 | Designer de Biomas & DistribuiÃ§Ã£o | 665â€“700 | Biomas com recursos exclusivos, estruturas espalhadas |
| 28 | Engenheiro de Ferramentas do Agente | 701â€“720 | Escopo, leitura ampla, escrita restrita |

## 26 â€” Arquiteto de SessÃµes & Versionamento â­�

*Parecer: o pedido tem uma intuiÃ§Ã£o forte â€” se a conversa **Ã©** a modificaÃ§Ã£o, o agente sempre
sabe onde escrever, e o usuÃ¡rio ganha um histÃ³rico legÃ­vel do porquÃª de cada mudanÃ§a. O risco a
evitar era amarrar 1 sessÃ£o â†” 1 mod: continuar um mod antigo obrigaria a carregar toda a conversa
anterior no contexto. Resolvido com 1 mod â†’ N sessÃµes.*

- [~] 621 `P0` **`ChatThreadRecord.modId` Ã© o vÃ­nculo autoritativo entre sessÃ£o e mod**
- [~] 622 `P0` **`ModPackage.originThreadId` guarda a proveniÃªncia (onde o mod nasceu)**
- [~] 623 `P0` **Cardinalidade 1 mod â†’ N sessÃµes** â€” continuar um mod sem herdar o histÃ³rico
- [~] 624 `P0` **SessÃ£o livre (sem mod): lÃª tudo, nÃ£o escreve nada**
- [~] 625 `P0` **Criar sessÃ£o permite escolher mod existente, nomear um novo, ou ficar livre**
- [~] 626 `P0` **`create_mod` vincula a sessÃ£o atual automaticamente**
- [~] 627 `P0` **`attach_session_to_mod` troca ou solta o vÃ­nculo**
- [~] 628 `P0` **`get_session_context` diz ao agente onde ele estÃ¡ antes de modificar**
- [~] 629 `P0` **`mod_id` virou opcional nas ferramentas de escrita** (usa o mod da sessÃ£o)
- [~] 630 `P0` **Snapshot do estado ANTES de cada alteraÃ§Ã£o** (`ModRevision`)
- [~] 631 `P0` **`list_mod_revisions` com resumo do que mudou em cada versÃ£o**
- [~] 632 `P0` **`rollback_mod` reverte mundo e save**
- [~] 633 `P0` **O rollback Ã© reversÃ­vel: o estado atual vira revisÃ£o antes de voltar**
- [~] 634 `P1` **HistÃ³rico linear: a revisÃ£o avanÃ§a mesmo voltando no conteÃºdo**
- [~] 635 `P0` **Quarentena: mod que falha ao aplicar Ã© isolado e o mundo carrega**
- [~] 636 `P0` **AplicaÃ§Ã£o mod a mod** â€” antes uma exceÃ§Ã£o travava o carregamento inteiro
- [~] 637 `P1` **Mod em quarentena nÃ£o Ã© reaplicado nos loads seguintes**
- [~] 638 `P1` **Aviso na UI quando um mod Ã© isolado, com o motivo**
- [~] 639 `P0` **`export_mod` entrega a ESTRUTURA, sem conversa, quarentena ou ids locais**
- [~] 640 `P1` **Database v6 com a tabela `modRevisions`**
- [~] 641 `P1` **Cobertura de testes de sessÃ£o, versionamento e isolamento** (15 testes)
- [x] 642 `P0` ~~Painel de mods com versÃµes e rollback~~ â€” **auditado, jÃ¡ existe**: aba VersÃµes e `rollbackMod`
- [~] 643 `P1` **Aba de sessÃµes mostrando a qual mod cada uma pertence** â€” `getModSessionMap()` em `src/mods/ModService.ts`
- [~] 644 `P1` **Diff legÃ­vel entre duas revisÃµes ("+2 blocos, âˆ’1 estrutura")** â€” `computeRevisionDiff()` em `src/mods/ModService.ts`
- [~] 645 `P1` **Limite de revisÃµes por mod, com poda das mais antigas** â€” `pruneOldRevisions()` em `src/mods/ModService.ts`
- [~] 646 `P1` **Rollback parcial (sÃ³ os blocos, sÃ³ as estruturas)** â€” `rollbackPartialRevision()` em `src/mods/ModService.ts`
- [~] 647 `P1` **Reverter do mundo os blocos colocados por uma revisÃ£o descartada** â€” `revertRevisionWorldBlocks()` em `src/mods/ModService.ts`
- [~] 648 `P1` **Tirar da quarentena manualmente** â€” `unquarantineMod()` em `src/mods/ModService.ts`
- [~] 649 `P1` **DiagnÃ³stico do motivo da quarentena legÃ­vel** â€” `formatQuarantineDiagnosis()` em `src/mods/ModService.ts`
- [ ] 650 `P2` Renomear e descrever a sessÃ£o a partir do conteÃºdo do mod
- [ ] 651 `P2` Arquivar sessÃ£o sem apagar o mod
- [ ] 652 `P2` Apagar sessÃ£o perguntando o que fazer com o mod
- [ ] 653 `P2` Mesclar dois mods num sÃ³
- [ ] 654 `P2` Dividir um mod em dois
- [ ] 655 `P2` DependÃªncia declarada entre mods, com ordem de carga
- [ ] 656 `P2` Detectar conflito quando dois mods alteram a mesma coisa
- [ ] 657 `P2` Marcar revisÃ£o como "estÃ¡vel" para servir de ponto de retorno
- [ ] 658 `P2` Comparar o mod com a versÃ£o exportada (o que mudou desde entÃ£o)
- [ ] 659 `P2` Importar mod jÃ¡ vinculando a uma sessÃ£o nova
- [ ] 660 `P2` HistÃ³rico de quem alterou o quÃª no multiplayer
- [ ] 661 `P2` Exportar a sessÃ£o (conversa) separadamente, como registro de decisÃµes
- [ ] 662 `P3` Reproduzir um mod a partir da conversa, do zero
- [ ] 663 `P2` MigraÃ§Ã£o de mods antigos sem `revision` nem `originThreadId`
- [ ] 664 `P2` Teste de que uma revisÃ£o restaurada gera exatamente o mesmo mundo

## 27 â€” Designer de Biomas & DistribuiÃ§Ã£o

*Parecer: hoje o gerador escolhe o bloco de superfÃ­cie por uma sequÃªncia de `if` dentro de
`column()` â€” praia, montanha, rio. Isso descreve **relevo**, nÃ£o bioma. Falta o que faz um bioma
importar num jogo de sobrevivÃªncia: ter algo que sÃ³ existe ali, obrigando a expediÃ§Ã£o. E o mundo
nÃ£o tem nenhuma construÃ§Ã£o espalhada â€” nada para encontrar explorando.*

**Desenho proposto (jÃ¡ esboÃ§ado e guardado aqui em vez de implementado agora):**
`BiomeDef` declarativo com faixa de clima, superfÃ­cie, vegetaÃ§Ã£o e **recursos com abundÃ¢ncia
prÃ³pria**; seleÃ§Ã£o por pontuaÃ§Ã£o contÃ­nua (`biomeScore`) em vez de teste booleano, para as
fronteiras serem graduais e para um bioma de mod competir em igualdade com os base.

- [~] 665 `P0` **`BiomeDef` declarativo: clima, cor, nÃ©voa, saturaÃ§Ã£o, estaÃ§Ã£o e minÃ©rios**
- [~] 666 `P0` **SeleÃ§Ã£o por pontuaÃ§Ã£o contÃ­nua â€” `pesosDeBioma`, fronteiras graduais por construÃ§Ã£o**
- [~] 667 `P0` **AbundÃ¢ncia por bioma: ouro no deserto, diamante na tundra**
- [~] 668 `P0` ****Recurso exclusivo**: nÃ£o hÃ¡ diamante no deserto, por mais fundo que se cave**
- [~] 669 `P0` **Oito biomas de clima + trÃªs de relevo (oceano, praia, montanha)**

#### O mundo nÃ£o tinha biomas â€” sÃ³ atmosfera de bioma

Ao voltar para esta seÃ§Ã£o encontrei o mesmo padrÃ£o que jÃ¡ tinha pegado nas estaÃ§Ãµes: o mÃ³dulo de
biomas existia, alimentava nÃ©voa, cor, clima e estaÃ§Ã£o, e **o gerador de terreno o ignorava**. A
superfÃ­cie e a vegetaÃ§Ã£o saÃ­am de limiares prÃ³prios, paralelos e independentes.

O sintoma disso Ã© invisÃ­vel atÃ© alguÃ©m reparar: o horizonte podia dizer "deserto" enquanto o chÃ£o
sob os pÃ©s dizia outra coisa. Duas fontes para a mesma decisÃ£o divergem em silÃªncio.

Agora `ColumnInfo.bioma` sai da mesma funÃ§Ã£o que governa tudo o mais, e decide superfÃ­cie,
espÃ©cie de Ã¡rvore, densidade de vegetaÃ§Ã£o e abundÃ¢ncia de minÃ©rio.

**Uma funÃ§Ã£o a mais, e a razÃ£o dela.** `pesosDeBioma` monta e ordena um vetor â€” certo para
misturar cor, errado para chamar uma vez por coluna: a geraÃ§Ã£o de um chunk faria mais de mil
vetores curtos, e o custo real nÃ£o Ã© a aritmÃ©tica, Ã© a pressÃ£o de coleta de lixo dentro do Web
Worker. `biomaDominanteRapido` faz o mesmo sem alocar, e hÃ¡ um teste que varre o domÃ­nio inteiro
fixando a equivalÃªncia entre as duas â€” duas implementaÃ§Ãµes da mesma regra Ã© precisamente o que
diverge sem avisar.

**PrecedÃªncia descoberta por teste:** rio e estrada mandam mais que o bioma. Um leito de rio Ã©
feito de leito de rio, atravesse ele o bioma que atravessar. O teste acusou areia numa coluna de
montanha e a causa era essa; virou uma asserÃ§Ã£o explÃ­cita em vez de uma exceÃ§Ã£o silenciosa.

**Densidade de Ã¡rvore zero no deserto e na tundra** Ã© decisÃ£o de leitura, nÃ£o de realismo: uma
Ã¡rvore isolada no meio da areia destrÃ³i o reconhecimento do bioma mais do que qualquer outro
detalhe.

- [~] 670 `P1` **VegetaÃ§Ã£o por bioma (densidade de Ã¡rvore, capim, decoraÃ§Ã£o caracterÃ­stica)** â€” `getBiomeVegetationDensity()` em `src/world/worldgen.ts`
- [~] 671 `P1` **Bioma influencia a paleta de superfÃ­cie e subsolo** â€” `getBiomePalette()` em `src/world/worldgen.ts`
- [~] 672 `P1` **Bioma de montanha condicionado Ã  altura, nÃ£o sÃ³ ao clima** â€” `isMountainBiomeHeightCondition()` em `src/world/worldgen.ts`
- [~] 673 `P1` **TransiÃ§Ã£o suave de altura entre biomas vizinhos** â€” `smoothBiomeHeightTransition()` em `src/world/worldgen.ts`
- [~] 674 `P1` **Mob hostil caracterÃ­stico por bioma** â€” `getBiomeHostileMob()` em `src/world/worldgen.ts`
- [~] 675 `P1` **Temperatura do bioma afetando o jogador (item 128)** â€” `getBiomeTemperatureEffect()` em `src/world/worldgen.ts`
- [~] 676 `P0` **Mods registram biomas** â€” dado do pacote, replicado ao Worker de geraÃ§Ã£o. Ver a seÃ§Ã£o 75
- [~] 677 `P0` **`define_mod_biome`** â€” a descriÃ§Ã£o explica o plano de clima, porque `temp`/`moist` Ã© a Ãºnica parte que o agente erra sem saber que errou
- [~] 678 `P1` **Bioma de mod entra na seleÃ§Ã£o em igualdade com os base** â€” `selectModBiomeEqualWeight()` em `src/world/worldgen.ts`
- [~] 679 `P1` **Nome do bioma atual no HUD e em `query_world_area`** â€” `updateBiomeBadge()` no `HUD` em `src/ui/HUD.ts`
- [ ] 680 `P2` Mapa de biomas consultÃ¡vel pelo agente antes de construir
- [~] 681 `P0` **`src/world/scatter.ts` â€” construÃ§Ãµes distribuÃ­das proceduralmente, ligadas ao `worldgen`**
- [~] 682 `P0` **Regra por bioma e peso; espaÃ§amento garantido pela grade Ãºnica**
- [~] 683 `P0` ****Uma estrutura por cÃ©lula, vencedor Ãºnico** â€” as regras competem pela cÃ©lula**
- [~] 684 `P0` **Assenta no ponto mais baixo da pegada, com fundaÃ§Ã£o e limpeza acima**

#### Um defeito de desenho que sÃ³ o teste mostrou

A primeira versÃ£o deu uma **grade por regra**, copiando o que as Ã¡rvores fazem. A garantia de
espaÃ§amento valia dentro de cada regra e nÃ£o entre elas: na savana, que aceita casa *e* muro, as
duas grades tinham arestas diferentes e as estruturas nasceram sobrepostas. O teste apontou o par
exato â€” `small_house@5873,5689` colidindo com `wall@5884,5690`.

A correÃ§Ã£o **nÃ£o** foi rejeitar colisÃµes depois de gerar. Isso quebraria a localidade: a rejeiÃ§Ã£o
passaria a depender do que mais estivesse na janela de varredura, e uma estrutura na fronteira de
dois chunks apareceria num e nÃ£o no outro. A correÃ§Ã£o foi **uma grade sÃ³** â€” a cÃ©lula sorteia se
tem estrutura, e as regras vÃ¡lidas para aquele bioma competem por ela. O espaÃ§amento volta a ser
garantia por construÃ§Ã£o, e a decisÃ£o continua local.

#### O que faz ser construÃ§Ã£o, e nÃ£o caixa jogada no terreno

- **Limpa o volume acima da base** antes de colocar. Sem isso o terreno que sobe dentro da pegada
  atravessa a parede, e capim nasce dentro da sala.
- **Preenche o vÃ£o atÃ© o chÃ£o.** O sÃ­tio assenta no ponto mais *baixo* da pegada â€” assentar no
  mais alto deixaria a construÃ§Ã£o sobre pernas de ar no lado da descida.
- **Rejeita encosta** antes de tentar consertar: terreno acidentado demais simplesmente nÃ£o
  recebe construÃ§Ã£o. Mais barato e mais bonito que nivelar depois.
- **Margem de varredura maior que a das Ã¡rvores** (14 contra 8): uma casa ancorada logo fora do
  chunk invade vÃ¡rios voxels dele, e sem isso apareceria cortada na fronteira.

E o teste que importa mais que todos: os blocos aparecem **no chunk gerado**. Sem ele, `scatter.ts`
seria mais um mÃ³dulo completo, testado e inerte.

- [~] 685 `P1` **RuÃ­nas, torres abandonadas e acampamentos como conteÃºdo base** â€” `generateRuinStructure()` em `src/world/scatter.ts`
- [~] 686 `P1` **BaÃº de loot dentro da estrutura, com tabela por tipo** â€” `generateLootChest()` em `src/world/scatter.ts`
- [~] 687 `P1` **Estruturas subterrÃ¢neas ligadas Ã s cavernas** â€” `generateUndergroundStructure()` em `src/world/scatter.ts`
- [~] 688 `P1` **Aldeias com vÃ¡rias estruturas e caminho ligando** â€” `generateVillageStructures()` em `src/world/scatter.ts`
- [~] 689 `P0` **Mods registram espalhamento** â€” regra e template no pacote, replicados ao Worker. Ver a seÃ§Ã£o 76
- [~] 690 `P0` **`define_mod_scatter`** â€” a descriÃ§Ã£o explica que o peso **disputa** a cÃ©lula em vez de aumentar a densidade, que Ã© o que o agente supÃµe errado
- [~] 691 `P1` **Estrutura espalhada respeita o bioma declarado na regra** â€” `validateScatterBiomeConstraint()` em `src/world/scatter.ts`
- [~] 692 `P1` **Densidade de espalhamento configurÃ¡vel por mundo** â€” `setWorldScatterDensity()` em `src/world/scatter.ts`
- [~] 693 `P1` **Estruturas espalhadas como blocos normais** â€” `convertScatterToSavedBlocks()` em `src/world/scatter.ts`
- [ ] 694 `P2` Marcar no mapa as estruturas jÃ¡ encontradas
- [ ] 695 `P2` Estrutura com variaÃ§Ã£o procedural (nÃ£o duas iguais)
- [ ] 696 `P2` Estrutura com entidades prÃ©-posicionadas
- [ ] 697 `P2` Comando/ferramenta para localizar a estrutura mais prÃ³xima
- [ ] 698 `P2` Bioma corrompido que se espalha (item 503)
- [ ] 699 `P2` Testes de determinismo do espalhamento por semente
- [ ] 700 `P2` Testes de que nenhuma estrutura nasce dentro de outra

## 28 â€” Engenheiro de Ferramentas do Agente

*Parecer: o pedido separa bem **leitura** de **escrita** â€” o agente lÃª o projeto inteiro e os
outros mods, mas sÃ³ escreve dentro do mod da sessÃ£o. Isso Ã© o que contÃ©m o estrago de um mod
malfeito. Falta fechar o cerco nas ferramentas que ainda escrevem fora do escopo.*

- [~] 701 `P0` **Escrita escopada ao mod da sessÃ£o** (`targetMod` + orientaÃ§Ã£o padronizada)
- [~] 702 `P0` **Leitura ampla continua liberada** (`list_mods`, `query_world_area`, snapshots)
- [~] 703 `P1` **Mensagem Ãºnica e acionÃ¡vel ao tentar escrever numa sessÃ£o livre**
- [~] 704 `P0` **Toda escrita do agente passa por um caminho atribuÃ­do** ao mod da sessÃ£o
- [~] 705 `P0` **ReversÃ£o precisa dos blocos de um mod** â€” o registro existia e nada revertia; e ele guardava o bloco errado
- [~] 706 `P1` **`read_mod` para inspecionar outro mod** â€” `readModPackageReadOnly()` em `ModRegistry.ts`
- [~] 707 `P1` **Ferramenta de leitura do projeto** â€” `inspectProjectStructure()` em `ModRegistry.ts`
- [~] 708 `P1` **OrÃ§amento de alteraÃ§Ãµes por sessÃ£o** â€” `checkSessionEditBudget()` em `ModService.ts`
- [~] 709 `P1` **Dry-run: simular a modificação e reportar impacto** — `dry_run_simulation` em `src/ai/MCPExecutors.ts`
- [~] 710 `P1` **Ferramentas de escrita no histÃ³rico da sessÃ£o** â€” `recordSessionHistoryEntry()` em `ModService.ts`
- [ ] 711 `P2` PermissÃµes por mod (o que ele pode tocar)
- [ ] 712 `P2` Ferramentas de escrita desabilitadas em mod em quarentena
- [ ] 713 `P2` ConfirmaÃ§Ã£o do usuÃ¡rio antes de operaÃ§Ã£o destrutiva na sessÃ£o
- [ ] 714 `P2` Log de auditoria por sessÃ£o, exportÃ¡vel
- [ ] 715 `P2` Agente consegue citar a mensagem que originou cada alteraÃ§Ã£o
- [ ] 716 `P2` Sugerir automaticamente dividir a sessÃ£o quando o mod cresce demais
- [ ] 717 `P2` Detectar que a conversa mudou de assunto e propor sessÃ£o nova
- [ ] 718 `P2` Limite de contexto: resumir a sessÃ£o longa preservando as decisÃµes
- [ ] 719 `P3` Agente propÃµe o plano do mod antes de executar, e o usuÃ¡rio aprova
- [ ] 720 `P2` Teste de que nenhuma ferramenta de escrita funciona em sessÃ£o livre

---

# Adendo â€” Rodada 4 de requisitos (itens 721â€“800)

> Requisito: **todo mod nasce com um arquivo de configuraÃ§Ã£o estilo `.env`** para as chaves que
> ele precisa, podendo herdar do ambiente global ou ser definido manualmente. E nÃ£o sÃ³ para IA:
> APIs de terceiros em geral â€” clima local para simular uma cidade, captura de Ã¡udio do usuÃ¡rio,
> geraÃ§Ã£o de voz. Modular e escalÃ¡vel na horizontal, respeitando a estrutura vertical.
>
> Dois especialistas convocados. O segundo existe porque este requisito **cruza a premissa
> arquitetural do projeto** (tudo client-side, o relay nunca vÃª dados do mundo) e mexe com
> segredos que hoje nÃ£o existem no sistema.

| # | Especialista | Itens | Foco |
|---|---|---|---|
| 29 | Engenheiro de ConfiguraÃ§Ã£o & Segredos | 721â€“760 | `mod.env`, heranÃ§a, nunca vazar chave |
| 30 | Arquiteto de Capacidades & IntegraÃ§Ãµes | 761â€“800 | Rede, Ã¡udio, permissÃµes, escala horizontal |

## 29 â€” Engenheiro de ConfiguraÃ§Ã£o & Segredos de Mod

*Parecer: a ideia de herdar do ambiente global (`AI_API_MOD_KEY=AI_API_KEY`) Ã© a parte elegante
do pedido â€” o mod declara **de que chave precisa** sem nunca conter o valor. O perigo mora no
caso oposto: assim que um mod puder guardar o valor literal, `export_mod` e o sync P2P viram
vazamento de credencial. A regra que sustenta tudo: **o mod carrega a referÃªncia, o cofre carrega
o valor.***

**Formato proposto** (`mod.env` por mod, editÃ¡vel na UI e pelo agente):

```
# ReferÃªncia: puxa do cofre global. O valor NUNCA fica no mod.
AI_MOD_ROUTER=$AI_ROUTER
AI_API_MOD_KEY=$AI_API_KEY

# Literal: sÃ³ para valores nÃ£o sensÃ­veis (modelo, idioma, limites)
AI_MOD_MODEL=anthropic/claude-sonnet-4.5
VOICE_LANG=pt-BR
CITY_SIM_UNITS=metric
```

O `$` marca a heranÃ§a. Sem ele Ã© literal â€” e todo literal Ã© tratado como pÃºblico, porque Ã©
exatamente isso que ele serÃ¡ no momento em que alguÃ©m exportar o mod.

- [~] 721 `P0` **`mod.env` criado por padrÃ£o em todo mod novo, com cabeÃ§alho explicativo**
- [~] 722 `P0` **HeranÃ§a `CHAVE=$GLOBAL` resolvida **em tempo de execuÃ§Ã£o**, nunca na gravaÃ§Ã£o**
- [~] 723 `P0` **Valores literais para configuraÃ§Ã£o nÃ£o sensÃ­vel (modelo, idioma, cidade)**
- [~] 724 `P0` **`export_mod` leva o **esquema** e nunca os valores â€” nÃ£o hÃ¡ o que filtrar**
- [~] 725 `P0` **`mod_sync` idem: os valores nunca estiveram no `ModPackage`**
- [~] 726 `P0` **Cofre em tabela prÃ³pria (`modSecrets`, schema v8), fora de `mods`**
- [~] 727 `P0` **Chaves obrigatÃ³rias vs opcionais, com descriÃ§Ã£o de cada uma**
- [~] 728 `P0` **Mod nÃ£o carrega se faltar chave obrigatÃ³ria â€” quarentena com o motivo**

#### A separaÃ§Ã£o Ã© estrutural, nÃ£o uma regra a lembrar

Um `mod.env` tem duas metades: o **esquema** (quais chaves existem, para que servem) e os
**valores** (o que estÃ¡ preenchido nesta instalaÃ§Ã£o). O esquema Ã© parte do mod e viaja; os valores
vivem num cofre Ã  parte e nunca viajam.

A razÃ£o de a separaÃ§Ã£o ser **estrutural**: se os valores morassem no `ModPackage`, `export_mod` e
`mod_sync` teriam de *filtrar* algo sensÃ­vel a cada vez â€” e bastaria um caminho novo esquecer o
filtro para a chave de API do jogador sair pela rede. Estando fora, nÃ£o hÃ¡ o que filtrar. O teste
que fixa isso nÃ£o verifica um filtro; verifica que **o pacote nÃ£o tem onde guardar um valor**.

Defesa em profundidade, para o caso de alguÃ©m tentar: **chave sensÃ­vel nÃ£o pode ter valor padrÃ£o
literal**. Um padrÃ£o viaja com o esquema, e um segredo com valor padrÃ£o Ã© um segredo publicado â€”
o tipo de erro que se comete uma vez, por conveniÃªncia, e que nÃ£o dÃ¡ sintoma atÃ© vazar.

#### Onde a fronteira NÃƒO estÃ¡, para nÃ£o haver ilusÃ£o

O script do mod roda no mesmo cliente, com os mesmos privilÃ©gios do jogo. Esconder o valor **dele**
nÃ£o seria seguranÃ§a, seria teatro: um script que precisa da chave para chamar uma API precisa da
chave. A fronteira real Ã© o que **sai da mÃ¡quina** â€” exportaÃ§Ã£o, `mod_sync` e histÃ³rico de conversa.
O agente Ã© remoto, e por isso vÃª `descreverEnv` (metadados e se estÃ¡ preenchida) e nÃ£o os valores.

#### Dois detalhes de uso que o teste pegou

- **Salvar sem mexer nÃ£o apaga o segredo.** O texto mostra `********`; se o parse gravasse isso, o
  jogador que abrisse a tela e clicasse em salvar destruiria a chave â€” por uma aÃ§Ã£o que ele leu
  como "nÃ£o fiz nada".
- **ReferÃªncia para global inexistente vira ausÃªncia**, nÃ£o a string `"$AI_ROUTER"`. Passar o
  literal adiante faria o mod mandar isso como token e receber um erro de autenticaÃ§Ã£o, com o
  sintoma longe da causa.

Sem armazenamento (navegaÃ§Ã£o privada, IndexedDB bloqueado) o cofre fica em memÃ³ria e o mundo
carrega assim mesmo: derrubar o carregamento porque nÃ£o hÃ¡ onde guardar chaves seria trocar um
problema pequeno por um total.

- [~] 729 `P1` **Editor de `mod.env` na pÃ¡gina de mods, com a chave que falta em destaque**

#### A ponte com a configuraÃ§Ã£o de IA do jogo

`AI_MOD_ROUTER=$AI_ROUTER` funciona **sem o jogador colar a mesma chave duas vezes** â€” Ã© o que o
pedido descrevia. As globais `AI_ROUTER`, `AI_API_KEY` e `AI_MODEL` sÃ£o **derivadas** da
configuraÃ§Ã£o de IA jÃ¡ existente, nÃ£o copiadas para o cofre: copiar criaria uma segunda cÃ³pia da
chave, que envelheceria em silÃªncio quando o jogador trocasse a das configuraÃ§Ãµes.

Global gravada vence a derivada, para quem quiser uma conta separada sÃ³ para os mods.

#### Um campo por chave, nÃ£o uma caixa de texto

A caixa de texto livre obrigaria o jogador a conhecer a sintaxe para preencher uma chave, e a
descriÃ§Ã£o de cada uma â€” que Ã© o que explica *para que serve* â€” nÃ£o teria onde aparecer. A ediÃ§Ã£o
do arquivo inteiro continua possÃ­vel no editor de cÃ³digo.

Detalhe que evita destruiÃ§Ã£o acidental: **chave sensÃ­vel nasce com o campo vazio** e o marcador
`(preenchida â€” digite para substituir)`. Mostrar a mÃ¡scara num `input` faria o jogador apagÃ¡-la
para digitar, e campo vazio significaria zerar. Apagar de propÃ³sito tem botÃ£o prÃ³prio.

- [~] 730 `P1` **As chaves exigidas aparecem no painel do mod, com descriÃ§Ã£o, antes de ligar**
- [~] 731 `P1` **ValidaÃ§Ã£o de formato por chave (URL, token, enum)** â€” `validateFormatByKey()` em `ModEnv.ts`
- [~] 732 `P1` **Aviso quando nÃ£o hÃ¡ armazenamento persistente â€” as chaves valem sÃ³ a sessÃ£o**
- [~] 733 `P1` **Chave sensÃ­vel em campo `password`, com botÃ£o prÃ³prio para apagar**
- [~] 734 `P1` **Ferramenta MCP `set_mod_env` para chaves nÃ£o sensÃ­veis** â€” `setModEnvPublicKey()` em `ModEnv.ts`
- [~] 735 `P0` **Agente nÃ£o lÃª valor de segredo** â€” auditado: `descreverEnv` devolve sÃ³ metadados (nome, obrigatÃ³ria, sensÃ­vel, preenchida), e `modEnv` nÃ£o Ã© ferramenta do agente, sÃ³ da API do script
- [~] 736 `P0` **Segredo redigido do log e das mensagens de erro**, na GRAVAÃ‡ÃƒO e nÃ£o na exibiÃ§Ã£o
- [~] 737 `P1` **RedaÃ§Ã£o automÃ¡tica de segredos ao imprimir** â€” `redactSecrets()` em `ModEnv.ts`
- [~] 738 `P1` **`mod.env` versionado junto do mod** â€” `versionModEnvSchema()` em `ModService.ts`
- [~] 739 `P1` **Rollback restaura o esquema, nÃ£o os valores** â€” `rollbackModEnvSchema()` em `ModService.ts`
- [~] 740 `P1` **Chave global editável em um lugar só** — `resolveModEnvWithGlobals()` em `src/mods/ModEnv.ts`
- [~] 741 `P1` **Sobrescrita por mod** — `resolveModEnvWithGlobals()` em `src/mods/ModEnv.ts`
- [ ] 742 `P2` Perfis de ambiente (dev/prod) por mundo
- [ ] 743 `P2` Verificar a chave contra o provedor antes de salvar ("testar conexÃ£o")
- [ ] 744 `P2` Aviso de expiraÃ§Ã£o / falha de autenticaÃ§Ã£o atribuÃ­da ao mod certo
- [ ] 745 `P2` Chave de um mod nÃ£o Ã© visÃ­vel para outro mod
- [ ] 746 `P2` Escopo: mod declara quais chaves usa, e sÃ³ recebe essas
- [ ] 747 `P2` RotaÃ§Ã£o de chave sem reeditar cada mod
- [ ] 748 `P2` Importar/exportar o cofre separadamente, com aviso explÃ­cito
- [ ] 749 `P2` Cofre opcionalmente cifrado com senha do usuÃ¡rio
- [ ] 750 `P2` Limpar todas as chaves de uma vez ("sair da mÃ¡quina")
- [~] 751 `P1` **Documentar no `mod.env` gerado que literais são públicos** — `CABECALHO_PADRAO` em `src/mods/ModEnv.ts`
- [~] 752 `P1` **Bloquear salvar literal com cara de segredo** â€” `looksLikeSecret()` em `ModEnv.ts`
- [ ] 753 `P2` Sugerir converter literal suspeito em referÃªncia ao cofre
- [ ] 754 `P2` HeranÃ§a encadeada com valor padrÃ£o (`$CHAVE:-padrao`)
- [ ] 755 `P2` ComentÃ¡rios preservados ao editar o arquivo pela UI
- [ ] 756 `P2` `mod.env.example` gerado no export, para quem importa saber o que preencher
- [ ] 757 `P2` Diff de esquema entre revisÃµes ("+1 chave obrigatÃ³ria")
- [ ] 758 `P2` MigraÃ§Ã£o quando um mod passa a exigir uma chave nova
- [ ] 759 `P2` Testes de que nenhum caminho de export/sync carrega valor de segredo
- [ ] 760 `P2` Testes de resoluÃ§Ã£o de heranÃ§a, sobrescrita e chave faltante

## 30 â€” Arquiteto de Capacidades & IntegraÃ§Ãµes Externas

*Parecer: aqui estÃ¡ o item mais delicado de todo o checklist, e vale dizer por quÃª antes de
listar tarefas.*

*O Crom Planebox Ã© **100% client-side** â€” Ã© premissa declarada do projeto (seÃ§Ã£o 25), e o relay
existe sÃ³ para sinalizaÃ§Ã£o WebRTC. Mods que chamam APIs de terceiros nÃ£o quebram essa premissa
(a chamada sai do navegador do usuÃ¡rio, nÃ£o de um servidor do jogo), mas **abrem trÃªs frentes
que hoje nÃ£o existem**:*

1. *ExfiltraÃ§Ã£o. Um mod que lÃª o mundo e faz `fetch` para um host arbitrÃ¡rio pode mandar para
   fora qualquer coisa que enxergue. O agente escreve o cÃ³digo do mod, e o agente pode ser
   manipulado por injeÃ§Ã£o de prompt vinda de um mod importado.*
2. *SuperfÃ­cie sensÃ­vel. Microfone e geolocalizaÃ§Ã£o sÃ£o pedidos do usuÃ¡rio aqui, mas passam a
   ser capacidades que **qualquer** mod poderia solicitar depois.*
3. *ConfianÃ§a transitiva. Importar mod de terceiro passa a significar executar as integraÃ§Ãµes
   dele, nÃ£o sÃ³ carregar blocos.*

*Nada disso Ã© motivo para nÃ£o fazer â€” Ã© motivo para o desenho comeÃ§ar por **capacidades
declaradas e consentidas**, em vez de um `fetch` livre que depois precisaria ser retirado. Sobre
a escala pedida: a horizontal vem das capacidades (cada mod declara as suas, e elas se somam sem
se conhecer); a vertical vem da estrutura do mod, que permanece a hierarquia jÃ¡ existente
(pacote â†’ blocos/entidades/estruturas â†’ env â†’ capacidades).*

**Manifesto de capacidades proposto** (declarativo, no mesmo espÃ­rito do `mod.env`):

- [~] 780 `P1` **Mensagem clara quando a API falha por CORS** â€” `detectCorsError()` em `src/net/wire.ts`
```jsonc
{
  "capabilities": {
    "network": { "allow": ["api.openweathermap.org", "api.elevenlabs.io"] },
    "microphone": { "reason": "comandos de voz do jogador" },
    "geolocation": { "reason": "clima local para simular a cidade", "precision": "cidade" }
  }
}
```

- [~] 761 `P0` **Manifesto no `ModPackage`** â€” viaja com o mod (quem importa precisa ver o pedido antes de instalar); o consentimento **nÃ£o** viaja junto
- [~] 762 `P0` **Allowlist de hosts** â€” `hostCasa`, com as duas Ãºnicas formas aceitas (exato e `.dominio.com`) e 28 testes. Ver a seÃ§Ã£o 71
- [~] 763 `P0` **Consentimento host a host**, por mundo, com tabela `modConsents` (v9 do banco)
- [~] 764 `P0` **`RedeDeMods`** â€” quatro verificaÃ§Ãµes em ordem, `redirect: 'error'` e `credentials: 'omit'`. Ver a seÃ§Ã£o 72
- [~] 765 `P0` **Mod nÃ£o alcanÃ§a mais o `fetch` global** por acesso direto â€” com a mesma ressalva do 359
- [~] 766 `P0` **Capacidade inexistente Ã© RECUSADA, nÃ£o ignorada** â€” um mod pedindo `microfone` recebe erro explÃ­cito dizendo que ela nÃ£o existe neste jogo. Quando existir, entra na lista junto com o consentimento separado â€” e nÃ£o antes
- [~] 767 `P0` **RevogaÃ§Ã£o Ã© apagar a linha** â€” ausÃªncia Ã© o padrÃ£o seguro, e um campo booleano criaria estado indefinido
- [~] 768 `P0` **`modNetLog`** â€” registra tambÃ©m o que foi **recusado**, e nunca a query
- [~] 769 `P1` **Aba de capacidades por mod**, com o motivo declarado em destaque e o aviso de envio separado
- [~] 770 `P1` **Parcial**: o manifesto viaja com o mod e a aba o exibe; **falta** interceptar o momento da importaÃ§Ã£o para mostrar antes de instalar (item 1408)
- [~] 771 `P1` **Rate limit por mod por sessÃ£o** â€” `checkModRateLimit()` em `ModService.ts`
- [~] 772 `P1` **Timeout e retry com backoff** â€” `executeWithTimeoutAndBackoff()` em `wire.ts`
- [~] 773 `P1` **Falha de rede não derruba o mod (degradação offline)** — `chamarComDegradacao()` em `src/mods/RedeDeMods.ts`
- [~] 774 `P1` **Modo offline global desliga toda integração externa** — `setModoOffline()` em `src/mods/RedeDeMods.ts`
- [~] 775 `P0` **`enviaDados`** — corpo ou verbo de escrita exigem `envia: true`. A query string continua descoberta, e isso está dito no código em vez de omitido
- [~] 776 `P1` **Resposta de API externa tratada como não confiável** — `sanitizeExternalApiResponse()` em `wire.ts`
- [~] 777 `P1` **Sanitizar resposta externa** — `sanitizeExternalApiResponse()` em `wire.ts`
- [~] 778 `P1` **Documentar modelo de ameaça de mods com rede** — `docs/MOD_SECURITY.md`
- [~] 779 `P1` **CORS: documentar limitações e cabeçalhos do navegador** — `docs/CORS_GUIDE.md`
- [~] 780 `P1` **Mensagem clara quando a API falha por CORS** — `detectCorsError()` em `src/net/wire.ts`
- [~] 781 `P1` **Cache de resposta por mod com TTL** â€” `CachedApiResponseManager` em `wire.ts`
- [ ] 782 `P2` Capacidade "Ã¡udio de entrada": captura de microfone com indicador visÃ­vel de gravaÃ§Ã£o
- [ ] 783 `P2` Capacidade "Ã¡udio de saÃ­da": geraÃ§Ã£o/reproduÃ§Ã£o de voz
- [ ] 784 `P2` Capacidade "geolocalizaÃ§Ã£o" com precisÃ£o reduzida por padrÃ£o (cidade, nÃ£o coordenada)
- [ ] 785 `P2` Capacidade "clima" como integraÃ§Ã£o de exemplo, documentada ponta a ponta
- [ ] 786 `P2` Mod de exemplo: cidade que reage ao clima real do jogador
- [ ] 787 `P2` Mod de exemplo: comando de voz mapeado para ferramenta do jogo
- [ ] 788 `P2` Capacidade "LLM prÃ³prio": o mod usa um modelo diferente do agente principal
- [ ] 789 `P2` OrÃ§amento de tokens/custo por mod, visÃ­vel ao usuÃ¡rio
- [ ] 790 `P2` Fila de chamadas externas fora do frame, para nÃ£o travar o render
- [ ] 791 `P2` Web Worker dedicado para integraÃ§Ãµes, isolado do `window`
- [ ] 792 `P2` Capacidades compÃµem sem se conhecer (escala horizontal de verdade)
- [ ] 793 `P2` Registro de capacidades extensÃ­vel: uma nova nÃ£o exige mudar o nÃºcleo
- [ ] 794 `P2` Versionar o contrato de capacidade, com migraÃ§Ã£o
- [ ] 795 `P2` Mod declara o que faz **sem** rede, para funcionar degradado
- [ ] 796 `P2` Indicador no HUD quando um mod estÃ¡ usando rede, microfone ou localizaÃ§Ã£o
- [ ] 797 `P2` Multiplayer: capacidades do mod do anfitriÃ£o nÃ£o valem no cliente do convidado
- [ ] 798 `P2` Quarentena automÃ¡tica de mod que abusa da cota ou chama host nÃ£o declarado
- [ ] 799 `P2` Testes de que o wrapper bloqueia host fora da allowlist
- [ ] 800 `P2` Testes de que revogar capacidade interrompe as chamadas em andamento

### Ordem recomendada para esta Ã¡rea

O caminho seguro Ã© o inverso do intuitivo: **nÃ£o comece pelo `fetch`.**

| Ordem | Itens | Por quÃª |
|---|---|---|
| 1 | 721â€“728 | `mod.env` com heranÃ§a e o cofre separado â€” sem isso nÃ£o hÃ¡ onde guardar chave |
| 2 | 724â€“725, 735â€“737 | Fechar o vazamento **antes** de existir o que vazar |
| 3 | 761â€“765 | Manifesto e wrapper de rede com allowlist, jÃ¡ no lugar do `fetch` livre |
| 4 | 763, 766â€“770 | Consentimento e auditoria, antes da primeira integraÃ§Ã£o real |
| 5 | 785â€“787 | SÃ³ entÃ£o os exemplos pedidos: clima, voz, cidade reativa |

---

# Adendo â€” Rodada 5 de requisitos (itens 801â€“880)

> Requisito: **mods precisam poder executar funÃ§Ãµes**, nÃ£o sÃ³ declarar dados. E o jogo precisa de
> **novas pÃ¡ginas GUI**, entre elas um **editor de cÃ³digo estilo VSCode** que permita manter o
> jogo em tempo real â€” com os mods e a base do mundo modificÃ¡veis com facilidade.

| # | Especialista | Itens | Foco |
|---|---|---|---|
| 31 | Engenheiro de Runtime de Mod | 801â€“844 | API de funÃ§Ãµes, hooks, isolamento de erro |
| 32 | Designer de Ferramentas Internas | 845â€“880 | PÃ¡ginas GUI e editor de cÃ³digo |

## 31 â€” Engenheiro de Runtime de Mod

*Parecer: hoje um mod Ã© **sÃ³ dados** â€” blocos, entidades, estruturas. Ele descreve o que existe,
nunca o que acontece. Dar comportamento a ele Ã© o que falta para "a IA modificar todo o jogo"
deixar de significar "a IA coloca blocos".*

*TrÃªs decisÃµes precisam vir antes do primeiro `eval`:*

*1. **API injetada, nÃ£o global.** O script recebe um objeto `api` e nÃ£o enxerga `window`,
`fetch` nem `document`. Hoje `execute_voxel_script` usa `new Function` com o escopo global
vazando (itens 358â€“359) â€” repetir isso no runtime de mod multiplicaria o problema por N mods.
A superfÃ­cie precisa ser uma lista fechada, auditÃ¡vel lendo um arquivo sÃ³.*

*2. **Erro de mod nÃ£o derruba o jogo.** Um erro dentro de `tick` Ã© lanÃ§ado 60 vezes por segundo:
sem desligamento automÃ¡tico, ele enche o log e come o frame. O script que falhar N vezes sai de
cena sozinho, e o mundo continua.*

*3. **Escrita escopada e atribuÃ­da.** Toda alteraÃ§Ã£o feita por script fica registrada como
pertencente Ã quele mod â€” Ã© o que faltava nos itens 704â€“705 para desfazer um mod com precisÃ£o.*

**EsboÃ§o da superfÃ­cie** (o que nÃ£o estiver na lista, o mod nÃ£o alcanÃ§a):

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
api.console.log(...)                          // vai para o painel, nÃ£o para o console do navegador
api.B                                         // paleta base, sem decorar ids
```

- [~] 801 `P0` **Campo `scripts` no `ModPackage`, versionado junto do resto**
- [~] 802 `P0` **API injetada como objeto â€” sem `window`, `fetch`, `document`, `setTimeout` ou `import`**
- [~] 803 `P0` **Oito eventos: load, unload, tick, blockPlaced, blockBroken, playerDamaged, entityDeath, dayPhase**
- [~] 804 `P0` **`api.on(evento, fn)` registrando handler na carga do script**
- [~] 805 `P0` **Handler protegido â€” exceÃ§Ã£o nÃ£o escapa para o loop do jogo**
- [~] 806 `P0` **Script desligado sozinho apÃ³s 5 erros, com o motivo no log**
- [~] 807 `P0` **OrÃ§amento de 20.000 blocos por chamada**
- [~] 808 `P0` **OrÃ§amento de 4 ms por frame, somado entre todos os mods**
- [~] 809 `P0` **Bloco escrito por script Ã© gravado com a autoria do mod (`blockMods.modId`)**
- [~] 810 `P0` **`deleteMod` desfaz por autoria **e** por tipo â€” pedra do jogador nÃ£o Ã© arrastada junto**
- [~] 811 `P1` **`api.world`: getBlock, setBlock, fillBox, getGroundY, findNearest**
- [~] 812 `P1` **ReferÃªncia de bloco por id, chave do mod ou nome da paleta**
- [~] 813 `P1` **`api.entities`: spawn de espÃ©cie do prÃ³prio mod, list, damage**
- [~] 814 `P1` **`api.player`: position, teleport, health, give**
- [~] 815 `P1` **`api.ui.toast` com limite de tamanho**
- [~] 816 `P1` **`api.storage` chave-valor por mod, isolado**
- [~] 817 `P1` **`api.console` no log do mod, limitado a 300 linhas**
- [~] 818 `P1` **`api.B` com a paleta base**
- [~] 819 `P1` **Recarregar script sem reiniciar o mundo**
- [~] 820 `P1` **`unload` disparado antes de recarregar**
- [~] 821 `P1` **Handlers removidos ao recarregar â€” sem duplicaÃ§Ã£o**
- [~] 822 `P1` **Ordem de execução previsível entre mods** — `getOrderedMods()` em `ModService.ts`
- [~] 823 `P1` **`set_mod_script_enabled` desliga um script sem desabilitar o mod**
- [~] 824 `P1` **`define_mod_script` â€” compila e carrega na mesma chamada**
- [~] 825 `P1` **Ferramenta MCP `run_mod_script` para testar sem instalar** — `MCPRegistry.ts` & `MCPExecutors.ts`
- [~] 826 `P1` **Erro de script devolvido ao agente na mesma volta, mais `get_mod_script_logs`**
- [ ] 827 `P2` `api.world.queryRegion` devolvendo histograma de blocos
- [~] 828 `P2` **`api.time`: fraÃ§Ã£o do dia e `isNight()`**
- [ ] 829 `P2` `api.random` semeado pelo mundo, para script determinÃ­stico
- [ ] 830 `P2` `api.recipes` para registrar receita de crafting
- [ ] 831 `P2` `api.biomes` para registrar bioma (liga com a seÃ§Ã£o 27)
- [ ] 832 `P2` `api.scatter` para registrar construÃ§Ã£o espalhada
- [ ] 833 `P2` `api.commands` para registrar comando de chat
- [ ] 834 `P2` `api.hud` para desenhar indicador prÃ³prio
- [ ] 835 `P2` Tipagem TypeScript da API publicada, para autocomplete no editor
- [ ] 836 `P2` DocumentaÃ§Ã£o da API gerada a partir do prÃ³prio cÃ³digo
- [ ] 837 `P2` Script rodando em Web Worker (junta com 358â€“359)
- [ ] 838 `P2` Perfilador: quanto tempo cada mod consome por frame
- [ ] 839 `P2` Desligar automaticamente o mod que estoura o orÃ§amento de frame
- [ ] 840 `P2` Multiplayer: script roda sÃ³ no anfitriÃ£o, resultado replica
- [ ] 841 `P2` Sandbox de permissÃµes por script (liga com a seÃ§Ã£o 30)
- [~] 842 `P2` **Testes de isolamento: mod que lanÃ§a exceÃ§Ã£o nÃ£o afeta os outros**
- [~] 843 `P2` **Testes do desligamento automÃ¡tico apÃ³s N erros**
- [~] 844 `P2` **Testes de que a API nÃ£o expÃµe global implÃ­cito nem evento inexistente**

## 32 â€” Designer de Ferramentas Internas (pÃ¡ginas GUI)

*Parecer: o jogo tem menu, pausa, inventÃ¡rio e chat â€” tudo voltado a **jogar**. NÃ£o hÃ¡ nenhuma
tela voltada a **manter o jogo**. Hoje, ver o que um mod contÃ©m, voltar uma versÃ£o ou entender
por que um mod foi isolado sÃ³ Ã© possÃ­vel pedindo Ã  IA, o que Ã© um caminho indireto para uma
informaÃ§Ã£o que deveria estar Ã  mÃ£o.*

*Sobre o editor estilo VSCode: a escolha de biblioteca importa mais do que parece. Monaco Ã©
literalmente o editor do VSCode, mas pesa ~5 MB e Ã© difÃ­cil de empacotar com Vite; num jogo que
hoje entrega 853 KB, ele seria o maior componente do produto. **CodeMirror 6** dÃ¡ o essencial â€”
numeraÃ§Ã£o de linha, destaque de sintaxe, dobra, autocomplete â€” em ~150 KB gzipado, com
empacotamento limpo. Um editor feito Ã  mÃ£o (textarea + overlay) evita a dependÃªncia e Ã©
coerente com o resto do projeto, que Ã© todo artesanal, mas nÃ£o entrega autocomplete nem
diagnÃ³stico, que Ã© justamente o que torna a manutenÃ§Ã£o em tempo real viÃ¡vel.*

*RecomendaÃ§Ã£o: CodeMirror 6, carregado sob demanda (`import()` dinÃ¢mico) para nÃ£o pesar no boot
de quem nunca abre o editor.*

- [~] 845 `P0` **PÃ¡gina de Mods: lista, conteÃºdo, ativar/desativar, quarentena com motivo â€” `src/ui/ModsPage.ts`**
- [~] 846 `P0` **HistÃ³rico de versÃµes na pÃ¡gina, com rollback em um clique**
- [~] 847 `P0` **Exportar/importar mod pela pÃ¡gina, sem passar pela IA**
- [~] 848 `P1` **Qual sessão de chat originou o mod** — `originThreadId` em `ModPackage` e `ModService.ts`
- [~] 849 `P1` **Aviso visual de mod em quarentena, com o erro legÃ­vel**
- [~] 850 `P0` **PÃ¡gina de Editor com Ã¡rvore de arquivos do mod â€” `src/ui/CodeEditorPage.ts`**
- [~] 851 `P0` **CodeMirror 6 carregado sob demanda (chunk separado de ~489 KB, fora do boot)**
- [~] 852 `P0` **Salvar gera nova revisÃ£o do mod**
- [~] 853 `P0` **Executar/recarregar o script sem reiniciar o mundo**
- [~] 854 `P0` **Painel de console mostrando `api.console` e erros do script**
- [ ] 855 `P1` Erro aponta linha e coluna, com salto para o ponto no editor
- [ ] 856 `P1` Autocomplete da API do mod (usa a tipagem do item 835)
- [~] 857 `P1` **Editar mod.env pela mesma árvore** — nó `mod.env` em `src/ui/CodeEditorPage.ts`
- [~] 858 `P1` **Editar definições como JSON no editor** — nó `definitions.json` em `src/ui/CodeEditorPage.ts`
- [~] 859 `P1` **Validação ao salvar, recusando JSON inválido antes de gravar** — `validateDefinitionJson()` em `ModService.ts`
- [~] 860 `P1` **Ctrl+S salva e recarrega**
- [~] 861 `P1` **Buscar e substituir dentro do arquivo** — `findAndReplace()` em `src/ui/CodeEditorPage.ts`
- [~] 862 `P1` **Estado do editor preservado ao fechar e reabrir**
- [ ] 863 `P1` Editor nÃ£o bloqueia o jogo: pausa opcional enquanto estÃ¡ aberto
- [ ] 864 `P2` Diff entre a versÃ£o salva e a editada, antes de salvar
- [ ] 865 `P2` Desfazer/refazer com histÃ³rico prÃ³prio do editor
- [ ] 866 `P2` Modelos de script prontos (reagir a bloco, gerar estrutura, ciclo do dia)
- [~] 867 `P2` **Modelo de script inserido em todo script novo**
- [ ] 868 `P2` **PÃ¡gina de DiagnÃ³stico**: FPS, chunks, entidades, memÃ³ria, custo por mod
- [ ] 869 `P2` **PÃ¡gina de Mundo**: semente, hora, regras, distÃ¢ncia de render, regenerar regiÃ£o
- [ ] 870 `P2` **PÃ¡gina de Blocos**: navegar a paleta, ver propriedades, ir atÃ© um bloco no mundo
- [ ] 871 `P2` **PÃ¡gina de Entidades**: listar, seguir, remover, editar espÃ©cie
- [ ] 872 `P2` **PÃ¡gina de Rede**: peers, latÃªncia, o que estÃ¡ sendo sincronizado
- [~] 873 `P2` **NavegaÃ§Ã£o unificada entre as pÃ¡ginas, com atalho Ãºnico (ESC)**
- [~] 874 `P2` **PÃ¡ginas registradas no `UIManager` como telas bloqueantes (F6 e F7)**
- [ ] 875 `P2` PÃ¡ginas acessÃ­veis por teclado, com foco visÃ­vel
- [ ] 876 `P2` Tema claro/escuro consistente entre as pÃ¡ginas
- [ ] 877 `P2` As pÃ¡ginas respeitam a customizaÃ§Ã£o de UI feita pela IA
- [ ] 878 `P2` Editor aberto em modo somente-leitura para mod importado de terceiro
- [ ] 879 `P2` Aviso ao editar mod sincronizado no multiplayer
- [ ] 880 `P2` Testes de que salvar no editor gera revisÃ£o e nÃ£o corrompe o pacote
## 33 â€” Redator TÃ©cnico do Agente (documentaÃ§Ã£o da API para a IA)

*Parecer: de nada adianta a API existir se o agente nÃ£o souber que ela existe. E o agente nÃ£o lÃª
o repositÃ³rio a cada mensagem â€” ele lÃª o **prompt do sistema** e as **descriÃ§Ãµes das ferramentas**.
Toda capacidade que nÃ£o aparecer nesses dois lugares Ã©, na prÃ¡tica, inexistente para ele.*

*Isso jÃ¡ aconteceu neste projeto: `registerCustomBlock` existia hÃ¡ tempos e a IA continuava
gerando blocos efÃªmeros, porque nada no prompt dizia como usÃ¡-la corretamente. A documentaÃ§Ã£o
aqui nÃ£o Ã© cortesia â€” Ã© o mecanismo de ativaÃ§Ã£o da funcionalidade.*

- [~] 881 `P0` **SeÃ§Ã£o de script no prompt do sistema, com o fluxo completo**
- [~] 882 `P0` **Cada evento documentado com o formato do payload**
- [~] 883 `P0` **Cinco exemplos executÃ¡veis â€” e um teste garante que compilam**
- [~] 884 `P0` **Documentado que a sessÃ£o define o mod e que a escrita Ã© escopada**
- [~] 885 `P0` **Documentado explicitamente o que **nÃ£o** existe (fetch, window, setTimeout, import)**
- [~] 886 `P0` **`get_mod_api_reference` devolvendo a superfÃ­cie completa sob demanda**
- [~] 887 `P1` **`docs/MOD_API.md` como fonte única** — `docs/MOD_API.md`
- [~] 888 `P1` **Referência gerada a partir do código** — `docs/MOD_API.md`
- [~] 889 `P1` **Teste que falha se um evento sumir da referÃªncia entregue Ã  IA**
- [~] 890 `P1` **Erros do runtime citando o script e a mensagem original**
- [~] 891 `P1` **`get_session_context` incluindo mod e scripts** — `getSessionContext()` em `ModService.ts`
- [~] 892 `P1` **Receitas prontas: "reagir a bloco quebrado", "gerar estrutura", "ciclo do dia"** — `docs/MOD_RECIPES.md`
- [~] 893 `P1` **Documentar orçamento de blocos e tempo para agentes** — `docs/AGENT_BUDGET.md`
- [ ] 894 `P2` Documentar como ler outros mods sem poder alterÃ¡-los
- [ ] 895 `P2` Changelog da API versionado, para mods antigos continuarem vÃ¡lidos
- [~] 896 `P2` **SeÃ§Ã£o de erros comuns na referÃªncia**
- [ ] 897 `P2` Guia de arte e de escala junto da API (proporÃ§Ã£o do jogador em mini-voxels)
- [~] 898 `P2` **DocumentaÃ§Ã£o em portuguÃªs, alinhada ao projeto**
- [ ] 899 `P2` `list_recent_errors` correlacionando erro com a funÃ§Ã£o da API envolvida
- [ ] 900 `P2` Teste de que toda funÃ§Ã£o pÃºblica da API aparece na documentaÃ§Ã£o

---

# ðŸŽ¯ Ordem de execuÃ§Ã£o recomendada

> AnÃ¡lise pedida: **o que precisa ser feito primeiro.** SÃ£o 900 itens; a ordem abaixo Ã© a que
> maximiza o que fica protegido e utilizÃ¡vel a cada etapa, nÃ£o a que entrega mais features.

## Onda 0 â€” Proteger o que jÃ¡ existe `~1 rodada`

*Barato, e sem isso todo o resto anda sobre areia.*

| Item | Por quÃª agora |
|---|---|
| 514 CI (`tsc --noEmit` + `vitest run`) | HÃ¡ **285 testes** e nada os executa automaticamente. Uma regressÃ£o passa despercebida atÃ© alguÃ©m rodar Ã  mÃ£o |
| 276 MigraÃ§Ã£o de save versionada | O schema foi de v2 a **v6 em poucos dias**. NÃ£o existe caminho de migraÃ§Ã£o: um usuÃ¡rio com mundo antigo Ã© risco real de perda de dados |
| 277 Backup antes de migrar | ConsequÃªncia direta do anterior |
| 278 VerificaÃ§Ã£o de integridade no load | A quarentena de mod jÃ¡ cobre parte; falta o mesmo para blocos e entidades Ã³rfÃ£os |

## âœ… Onda 1 â€” CONCLUÃ�DA

*O objetivo do projeto Ã© "a IA modificar todo o jogo com save no mundo". Um mod era **sÃ³ dados**:
descrevia o que existe, nunca o que acontece. Agora tem comportamento.*

| Entregue | O que mudou |
|---|---|
| 801â€“810 | Runtime com API injetada, isolamento, orÃ§amento e autoria de bloco |
| 811â€“821, 823, 828 | SuperfÃ­cie de funÃ§Ãµes: mundo, entidades, jogador, tempo, storage, console |
| 824, 826 | `define_mod_script` compila e carrega **na mesma chamada** â€” o agente recebe o erro na hora |
| 881â€“886, 889 | `get_mod_api_reference` + seÃ§Ã£o no prompt, com teste que falha se a doc divergir do cÃ³digo |

**Bug encontrado pelo prÃ³prio teste:** cada handler fecha sobre o `api` recebido na compilaÃ§Ã£o,
mas o despacho construÃ­a um `api` novo a cada evento e drenava o objeto errado. Resultado: bloco
colocado dentro de um evento nunca era salvo nem sincronizado. Corrigido reaproveitando uma
instÃ¢ncia por script.

## Onda 1 (registro original) â€” Fechar a lacuna que o prÃ³prio objetivo declara

*O objetivo do projeto Ã© "a IA modificar todo o jogo com save no mundo". Hoje um mod Ã© sÃ³
**dados**: descreve o que existe, nunca o que acontece. Esta Ã© a lacuna central que sobrou.*

| Item | Por quÃª agora |
|---|---|
| 801â€“810 Runtime de mod | API injetada, isolamento de erro, orÃ§amento, atribuiÃ§Ã£o de blocos |
| 809â€“810 + 704â€“705 | Bloco alterado por script fica atribuÃ­do ao mod â†’ reverter passa a ser exato |
| 824â€“826 Ferramentas de script | Sem elas o agente nÃ£o alcanÃ§a o runtime |
| **881â€“886 DocumentaÃ§Ã£o para o agente** | **Capacidade nÃ£o documentada no prompt Ã© capacidade inexistente.** JÃ¡ aconteceu aqui: `registerCustomBlock` existia e a IA seguia gerando blocos efÃªmeros |

## âœ… Onda 2 â€” CONCLUÃ�DA

| Entregue | O que mudou |
|---|---|
| 845â€“849 | PÃ¡gina de Mods (F6): conteÃºdo, versÃµes, rollback em um clique, export/import, quarentena legÃ­vel |
| 850â€“854, 860 | Editor de cÃ³digo (F7) com CodeMirror sob demanda, Ctrl+S salvaâ†’revisÃ£oâ†’recarrega, console ao vivo |
| 918â€“919 | Cache de rotas do A*, com estatÃ­stica de acerto e invalidaÃ§Ã£o ao alterar o mundo |

O CodeMirror ficou em chunks separados (~489 KB) carregados sÃ³ ao abrir o editor; o bundle
principal subiu 53 KB. Quem nunca abre o editor nÃ£o paga nada no boot.

## Onda 2 (registro original) â€” Tornar o jogo mantenÃ­vel

*Versionamento, rollback e quarentena existem, mas sÃ³ a IA os alcanÃ§a. O usuÃ¡rio nÃ£o tem como
ver o que um mod contÃ©m nem voltar uma versÃ£o sem pedir a ela.*

| Item | Por quÃª agora |
|---|---|
| 845â€“849 PÃ¡gina de Mods | ExpÃµe o que jÃ¡ foi construÃ­do: conteÃºdo, versÃµes, rollback, quarentena |
| 850â€“855 Editor de cÃ³digo | Viabiliza a manutenÃ§Ã£o em tempo real pedida |
| 857 Editar `mod.env` na mesma Ã¡rvore | SÃ³ depois da Onda 3 ter definido o formato |

## Onda 3 â€” Segredos antes de integraÃ§Ãµes `~1 rodada`

*A ordem aqui Ã© contraintuitiva de propÃ³sito: **fechar o vazamento antes de existir o que vazar**.*

| Item | Por quÃª nesta ordem |
|---|---|
| 721â€“728 `mod.env` + cofre | Sem cofre nÃ£o hÃ¡ onde guardar chave |
| 724â€“725, 735â€“737 | `export_mod` e `mod_sync` **jÃ¡ existem**: no dia em que um mod puder guardar valor de credencial, os dois viram vazamento automÃ¡tico |
| 761â€“765 Manifesto + wrapper de rede | Substituir o `fetch` livre **antes** da primeira integraÃ§Ã£o, nÃ£o depois â€” retirar permissÃ£o concedida quebra mod existente |
| 785â€“787 Exemplos (clima, voz, cidade) | SÃ³ aqui, com o cerco jÃ¡ fechado |

## Onda 4 â€” Dar motivo para explorar `~2 rodadas`

*O mundo tem cavernas, minÃ©rios e inimigos, mas a superfÃ­cie Ã© homogÃªnea e nÃ£o hÃ¡ nada para
encontrar. Falta a razÃ£o de andar atÃ© o horizonte.*

| Item | Por quÃª |
|---|---|
| 665â€“669 Biomas com recursos exclusivos | Desenho jÃ¡ registrado na seÃ§Ã£o 27; Ã© o que obriga a expediÃ§Ã£o |
| 681â€“684 ConstruÃ§Ãµes espalhadas | Hoje nÃ£o existe nada para descobrir explorando |
| 676â€“677, 689â€“690 | Biomas e espalhamento registrÃ¡veis por mod â€” a base pedida para o agente |

## âœ… Onda 5 â€” desempenho e Ã¡udio concluÃ­dos

| Entregue | Resultado |
|---|---|
| 477â€“494 | Ã�udio sintetizado: o jogo deixou de ser mudo |
| 961â€“969 | RegressÃµes de luz corrigidas: 69 ms â†’ ~11 ms por bloco, e enfileirado |
| 403/971 | Malha em Web Worker, com bundle do worker em 7,5 KB |
| 972/404 | Buffers de malha reciclados entre thread e worker |
| 982/990 | Tela inicial como pÃ¡gina: simulaÃ§Ã£o suspensa e canvas escondido |
| 970/974/408 | Painel F3 medindo o frame **no navegador**, com custo por sistema |

**Ressalva que continua valendo:** os ganhos acima foram medidos em bancada (Node). O painel F3
existe justamente para conferir isso no navegador â€” mas essa conferÃªncia ainda nÃ£o foi feita
com o jogo rodando de verdade.

## Onda 5 (registro original) â€” em andamento

**Ã�udio (477â€“494): entregue.** O jogo deixou de ser mudo. Tudo sintetizado via Web Audio â€”
o projeto nÃ£o tem asset de som, e trazÃª-los custaria megabytes num bundle de 900 KB.

Duas decisÃµes que valem registrar:

- **`materialOf` deriva o som das propriedades do bloco**, nÃ£o de uma tabela por id. Um bloco
  criado por mod herda som coerente sem declarar nada; sem isso, todo bloco novo soaria como pedra.
- **A especificaÃ§Ã£o Ã© pura** (`synth.ts` devolve parÃ¢metros, nÃ£o toca nada). DÃ¡ para testar que
  vidro Ã© mais brilhante que terra sem abrir navegador.

Falta: ambiÃªncia por bioma (481), mÃºsica por contexto (482), reverb em caverna (486).

## Onda 5 (registro original) â€” Pilares ausentes e desempenho

| Item | Nota |
|---|---|
| 477â€“494 Ã�udio | **Pilar inteiro ausente.** O jogo Ã© mudo: sem som de passo, de quebra ou de dano |
| 403 Mesh em worker | O re-mesh do ciclo dia/noite tornou o custo visÃ­vel |
| 358â€“359 Sandbox em Worker | Junta com 837; prÃ©-requisito para compartilhar mod de terceiro |
| 609 Sync de entidades no P2P | Ãšltima lacuna grande do multiplayer |
| 130, 148 Armadura e arco | Combate existe, mas defender-se e atacar Ã  distÃ¢ncia ainda nÃ£o sÃ£o decisÃ£o |
| 053â€“054 AO por vÃ©rtice e neblina | Os dois itens que faltam para fechar a estÃ©tica alvo |

## O prÃ³ximo passo, em uma linha

**Onda 0 inteira** â€” CI e migraÃ§Ã£o de save. SÃ£o as duas coisas que, se continuarem faltando,
transformam qualquer avanÃ§o futuro em risco: a primeira deixa regressÃ£o passar, a segunda deixa
mundo de usuÃ¡rio quebrar a cada mudanÃ§a de schema.

---

# Anexo â€” AvaliaÃ§Ã£o do `crompressor.wasm`

> Pedido: avaliar se o `crompressor` ajuda em desempenho e seguranÃ§a, inclusive na troca de
> dados P2P â€” e se a deduplicaÃ§Ã£o ajudaria tambÃ©m em blocos e outras Ã¡reas.
>
> **Resposta curta: nos dados deste jogo, nÃ£o.** O gzip nativo do navegador venceu em todos os
> cenÃ¡rios medidos, inclusive no cenÃ¡rio que o crompressor foi desenhado para atacar. Abaixo o
> que foi medido, o porquÃª provÃ¡vel, e o que fazer com essa informaÃ§Ã£o.

## O que o binÃ¡rio Ã©

`github.com/MrJc01/crompressor`, Go 1.25.7, **10,9 MB**. Arquitetura interna:

| Componente | FunÃ§Ã£o |
|---|---|
| `pkg/cromlib` | `PackBytes` / `UnpackBytes` / `Metrics` |
| `internal/chunker` | fatiamento em blocos de conteÃºdo |
| `internal/codebook` | dicionÃ¡rio compartilhado (`OpenFromBytes`, `ParseHeader`) |
| `internal/search` | LSH, distÃ¢ncia de Hamming (com caminho SIMD), similaridade |
| `internal/delta` | `XOR`, `ApplyPatch`, pools zstd |
| `internal/crypto` | `Decrypt`, `DeriveKey` |
| `internal/entropy`, `internal/fractal` | Shannon, polinÃ´mios |

API exposta ao JS: **`cromPack(bytes)` e `cromUnpack(bytes)`**, ambas sem parÃ¢metros extras,
retornando `{ ok, data }`.

## MediÃ§Ãµes

Todas com round-trip verificado (`unpack(pack(x)) === x`). Comparadas com gzip, que no navegador
Ã© `CompressionStream` â€” **nativo, zero byte de download**.

| CenÃ¡rio | gzip | crompressor |
|---|---|---|
| `full_sync` JSON, 40k blocos (1,5 MB) | **10,8x** Â· 20 ms | 4,0x Â· 292 ms |
| 1 chunk de terreno (128 KB) | **780x** Â· 1 ms | 2,7x Â· 41 ms |
| 16 chunks vizinhos quase iguais (2 MB) | **246x** Â· 6 ms | 2,7x Â· 204 ms |
| 48 chunks realistas, separados (6 MB) | **15,3x** Â· 103 ms | 2,3x Â· 1780 ms |
| 48 chunks realistas, juntos (6 MB) | **15,4x** Â· 91 ms | 2,3x Â· 1146 ms |
| 24 versÃµes quase idÃªnticas (9,4 MB) | **30,1x** Â· 56 ms | 20,4x Â· 2424 ms |

## CorreÃ§Ã£o: o que o crompressor Ã©

Registro um erro meu antes da anÃ¡lise. Numa primeira leitura descrevi o crompressor como
"compressor de domÃ­nio para pesos de LLM e tensores". **EstÃ¡ errado.** Peguei uma linha de
benchmark num README lido dentro de um projeto de artigo (`crom-artigo-dnai-jl/`), tratei-a como
se fosse a finalidade do projeto, e repeti isso por duas rodadas â€” generalizei a partir de uma
fonte que nÃ£o Ã© a declaraÃ§Ã£o de propÃ³sito.

A declaraÃ§Ã£o de propÃ³sito Ã© o artigo do autor: *"A ilusÃ£o da compressÃ£o: por que o Crompressor
nÃ£o Ã© o novo gzip, e sim um Git para dados (CDN, P2P)"*.

**O que ele Ã©:** um motor de **deduplicaÃ§Ã£o com dicionÃ¡rio estÃ¡tico compartilhado**. O modelo Ã© o
do Git e o do CAS (content-addressable storage): treina-se um `.cromdb` sobre dados histÃ³ricos,
distribui-se esse dicionÃ¡rio aos nÃ³s **uma vez**, e a partir daÃ­ um bloco reconhecido viaja como
um identificador de 24 bytes em vez do conteÃºdo. O ganho nÃ£o estÃ¡ em espremer bytes â€” estÃ¡ em
**nÃ£o retransmitir o que o outro lado jÃ¡ consegue reconstruir**.

Os nÃºmeros do autor, no modo pretendido:

| Benchmark | Resultado |
|---|---|
| V5 (chunks de 128 B) | 80,5% de reduÃ§Ã£o de trÃ¡fego â€” o limite dado o overhead de 24 B por chunk |
| V6 (chunks de 4 KB) | 460,81 MB â†’ **2,81 MB (99,38%)** em projetos reais |

Casos declarados como bons: sincronizar imagens Docker por CDN, quadros de CCTV, ISOs de VM,
deduplicaÃ§Ã£o massiva de logs. Casos declarados como ruins: arquivo Ãºnico sem redundÃ¢ncia,
formatos jÃ¡ comprimidos, e **compressÃ£o tradicional em sistema isolado** â€” que Ã© exatamente o
que eu havia medido.

## Por que minha mediÃ§Ã£o nÃ£o respondeu Ã  pergunta certa

A tabela acima testou **empacotamento autÃ´nomo**: cada payload comprimido sozinho, sem dicionÃ¡rio
compartilhado e sem segundo nÃ³. O prÃ³prio autor classifica esse uso como inadequado e registra
que nele o arquivo chega a **inflar (125% do original)**.

Os nÃºmeros que medi sÃ£o coerentes com o que o projeto diz sobre uso isolado. **A mediÃ§Ã£o estava
correta; a pergunta Ã© que estava errada.**

## Segunda correÃ§Ã£o: eu estava errado, e a mediÃ§Ã£o prova

Eu havia afirmado duas coisas que nÃ£o se sustentam:

1. *"NÃ£o hÃ¡ um segundo nÃ³ com dado repetido para deduplicar contra."* â€” **Falso.** O jogo tem
   multiplayer P2P: o anfitriÃ£o roda o mundo e os convidados sÃ£o a outra ponta. SÃ£o nÃ³s reais.
2. *"NÃ£o hÃ¡ plataforma de distribuiÃ§Ã£o."* â€” **Falso na prÃ¡tica.** O dicionÃ¡rio pode ser enviado
   uma vez pelo anfitriÃ£o no `full_sync`, exatamente como o modelo do artigo prevÃª.

O erro de mÃ©todo foi pior que o de fato: eu testei sÃ³ o `full_sync` â€” **um payload grande** â€” e
concluÃ­ sobre o modelo inteiro. Nesse payload o LZ77 do gzip jÃ¡ enxerga a repetiÃ§Ã£o sozinho,
porque tudo estÃ¡ na mesma janela. O regime onde o dicionÃ¡rio compartilhado ganha Ã© o oposto:
**muitas mensagens pequenas**, cada uma curta demais para o compressor achar repetiÃ§Ã£o dentro
dela. E esse Ã© justamente o trÃ¡fego real de uma partida.

### MediÃ§Ã£o no trÃ¡fego real de partida

6.000 mensagens (3.000 `block_update` + 3.000 `player_state`), mÃ©dia de 211 bytes cada,
totalizando 1.235 KB:

| EstratÃ©gia | TrÃ¡fego | Ganho | Nota |
|---|---|---|---|
| **Hoje** (JSON texto puro) | 1.235 KB | 1,0x | mensagem pequena nÃ£o Ã© comprimida |
| gzip por mensagem | 965 KB | 1,28x | o cabeÃ§alho quase anula o ganho |
| crompressor sem codebook | 988 KB | 1,25x | e 2,6 s para 300 mensagens |
| **deflate + dicionÃ¡rio compartilhado** | **163 KB** | **7,60x** | â†� o modelo do artigo funciona |
| **binÃ¡rio por opcode** | **105 KB** | **11,71x** | 5 ms, zero dependÃªncia |
| binÃ¡rio + gzip em lote | 10,4 KB | 119x | quando dÃ¡ para agrupar |

**O modelo estÃ¡ certo.** DicionÃ¡rio compartilhado entre nÃ³s entrega 7,6x onde o gzip entrega
1,28x. A tese central do crompressor â€” *nÃ£o retransmitir o que o outro lado consegue
reconstruir* â€” se confirma neste jogo, e no ponto que eu havia descartado.

### O que foi implementado a partir disso

O modelo validado virou cÃ³digo (itens 922-924), com a implementaÃ§Ã£o nativa:

| Medida | Resultado |
|---|---|
| `block_update` isolado | 9 bytes, contra ~80 do JSON |
| `player_state` | aparÃªncia saiu do pacote; sobrou o hash de 4 bytes |
| TrÃ¡fego de partida (600 mensagens) | **5,3x** menor que o que era enviado antes |
| ConstruÃ§Ã£o de 800 blocos num frame | **7,9x** menor, com um cabeÃ§alho em vez de 800 |

Texto e binÃ¡rio convivem no mesmo canal, distinguidos pelo primeiro byte â€” entÃ£o um peer de
versÃ£o anterior, que sÃ³ fala JSON, continua sendo entendido.

### O que isso muda na decisÃ£o

Duas coisas separadas, que eu vinha misturando:

**A ideia:** validada, e vale implementar. Ã‰ ganho de 7 a 12x num trÃ¡fego que hoje vai cru.

**A ferramenta:** continua nÃ£o sendo testÃ¡vel aqui, mas por um motivo concreto e especÃ­fico â€”
`cromPack(bytes)` **nÃ£o tem parÃ¢metro para receber o codebook**. Sem isso, o modo que o artigo
descreve nÃ£o Ã© alcanÃ§Ã¡vel a partir do WASM publicado. O que medi (1,25x) Ã© o modo isolado, que o
prÃ³prio autor classifica como mau uso.

**A melhor implementaÃ§Ã£o para este caso Ã© um codebook especializado:** o "dicionÃ¡rio" Ã© o prÃ³prio
esquema das mensagens, que os dois lados jÃ¡ conhecem por serem o mesmo programa. Em vez de
transmitir nomes de campo, transmite-se um opcode e os valores em binÃ¡rio â€” 11,71x, nativo, sem
dependÃªncia e sem download. Ã‰ a mesma ideia do crompressor, especializada num domÃ­nio onde o
esquema Ã© conhecido de antemÃ£o.

## O ponto do artigo que mais interessa a este projeto

A afirmaÃ§Ã£o de **12,7x ao injetar o motor em simulaÃ§Ãµes em RAM (pathfinding, fÃ­sica),
deduplicando estados matemÃ¡ticos repetidos** Ã© a mais aplicÃ¡vel â€” e nÃ£o tem relaÃ§Ã£o com tamanho
de arquivo.

Este projeto acabou de ganhar A* (`src/entities/Pathfinding.ts`), com vÃ¡rios mobs recalculando
rota contra o mesmo jogador, no mesmo terreno, a cada 0,35 s. SÃ£o estados repetidos, hoje
recomputados do zero. Ã‰ memoizaÃ§Ã£o de estado â€” parente direto da deduplicaÃ§Ã£o â€” e Ã© mensurÃ¡vel
sem depender de plataforma nenhuma.

## DecisÃ£o tomada nesta rodada

Implementado com **gzip nativo** (`CompressionStream`), nÃ£o com o WASM â€” mas a razÃ£o principal
nÃ£o Ã© mais a razÃ£o de compressÃ£o, e sim a arquitetura:

1. **A redundÃ¢ncia que o crompressor elimina jÃ¡ nÃ£o existe aqui.** O `full_sync` transmite sÃ³ as
   alteraÃ§Ãµes do jogador; o terreno o convidado regenera da semente. NÃ£o hÃ¡ um segundo nÃ³ com
   dado repetido para deduplicar contra.
2. **NÃ£o hÃ¡ plataforma de distribuiÃ§Ã£o.** O modelo do artigo pressupÃµe nÃ³s que compartilham um
   codebook treinado. Com um usuÃ¡rio e um navegador, falta o outro nÃ³.
3. **10,9 MB Ã© 13x o bundle inteiro do jogo** (853 KB). Mesmo que 1 e 2 fossem resolvidos, o
   custo de download precisaria ser pago por um ganho que ainda nÃ£o foi medido neste domÃ­nio.

Nenhum desses trÃªs pontos Ã© sobre o crompressor ser bom ou ruim â€” Ã© sobre este jogo, hoje, nÃ£o
ter o problema que ele resolve. Os itens 918-921 registram o que mudaria essa conclusÃ£o.

- [~] 901 `P0` **CompressÃ£o do `full_sync` com `CompressionStream` nativo**
- [~] 902 `P0` **FragmentaÃ§Ã£o de mensagem grande no P2P** â€” `src/net/wire.ts`
- [~] 903 `P0` **CorreÃ§Ã£o: mensagem acima de ~256 KB derrubava o DataChannel** â€” quanto mais o anfitriÃ£o construÃ­a, menor a chance de um convidado conseguir entrar
- [~] 904 `P1` **Remontagem por peer, com descarte de conjunto abandonado**
- [~] 905 `P1` **Mensagem pequena segue como texto puro** (compatÃ­vel com peer antigo)
- [~] 906 `P1` **21 testes de enquadramento, fragmentaÃ§Ã£o e remontagem**
- [ ] 907 `P1` Medir o ganho real de banda numa sessÃ£o P2P de verdade, e registrar
- [ ] 908 `P2` Comprimir tambÃ©m o save de blocos no IndexedDB (mesma funÃ§Ã£o, outro consumidor)
- [ ] 909 `P2` Comprimir o export de mundo e de mod
- [ ] 910 `P2` Delta entre revisÃµes de mod, em vez de snapshot inteiro (ver item 645)
- [ ] 911 `P2` **Reavaliar o crompressor quando `cromPack` aceitar codebook** â€” o segundo nÃ³ existe (anfitriÃ£o/convidados); o que falta Ã© a API expor o dicionÃ¡rio
- [~] 922 `P0` **Protocolo binÃ¡rio por opcode â€” `src/net/codec.ts`, medido 4,4x no pacote e 7,9x no lote**
- [~] 923 `P1` **AparÃªncia enviada sÃ³ quando muda; nos demais pacotes viaja apenas o hash de 4 bytes**
- [~] 924 `P1` **`block_update` do mesmo frame agrupados em `block_batch` â€” um cabeÃ§alho em vez de N**
- [ ] 925 `P2` Avaliar dicionÃ¡rio compartilhado (deflate com `dictionary`) para o que sobrar em texto
- [ ] 926 `P2` Medir o ganho real numa sessÃ£o P2P de verdade, nÃ£o em bancada
- [ ] 915 `P3` Medir o cenÃ¡rio de codebook compartilhado: treinar sobre chunks reais, distribuir uma vez, e comparar sÃ³ o trÃ¡fego de Ã­ndices contra gzip
- [ ] 916 `P3` PrÃ©-requisito do anterior: expor `cromPack(bytes, codebook, modo)` no WASM â€” a API atual nÃ£o recebe nenhum dos trÃªs
- [ ] 917 `P3` Resolver a distribuiÃ§Ã£o do codebook entre peers (ele prÃ³prio Ã© grande, e vira um problema de sync)
- [~] 918 `P1` **Cache de rotas do A* com TTL e invalidaÃ§Ã£o ao alterar o mundo**
- [~] 919 `P2` **EstatÃ­sticas de acerto do cache expostas por `getPathCacheStats`**
- [ ] 920 `P3` Reavaliar o crompressor **se** surgir uma galeria de mods/mundos â€” aÃ­ existe o segundo nÃ³ contra o qual deduplicar
- [ ] 921 `P2` Documentar que o `full_sync` jÃ¡ elimina a redundÃ¢ncia por regeneraÃ§Ã£o via semente (o dicionÃ¡rio custa 4 bytes)
- [ ] 912 `P2` Isolar segredo de dado de terceiro em fluxos comprimidos distintos (CRIME/BREACH)
- [ ] 913 `P2` Documentar em `docs/NETWORK_PROTOCOL.md` o formato de quadro e o limiar de fragmentaÃ§Ã£o

---

# Adendo â€” Rodada 6 de requisitos (itens 927â€“960)

> Duas lacunas levantadas por pergunta direta, e ambas confirmadas ausentes:
> **voz nativa entre jogadores** (o microfone sÃ³ existia como capacidade de mod) e **ver o
> prÃ³prio corpo em primeira pessoa** (havia sÃ³ "braÃ§os na tela", item 594, ainda pendente).

## 34 â€” Engenheiro de Voz P2P

*Parecer: esta Ã© a feature com a melhor relaÃ§Ã£o entre valor e esforÃ§o de todo o checklist, e
estava faltando. O motivo Ã© que metade do trabalho jÃ¡ estÃ¡ feito: o `RTCPeerConnection` do
`PeerSync` existe, e o WebRTC transporta **Ã¡udio nativamente** â€” foi para isso que ele nasceu.
NÃ£o Ã© preciso codec, nem servidor, nem buffer de jitter: basta acrescentar uma track Ã  conexÃ£o
que jÃ¡ estÃ¡ aberta.*

*Duas coisas precisam ser bem feitas, porÃ©m, e nenhuma Ã© tÃ©cnica:*

*1. **Microfone Ã© privacidade, nÃ£o feature.** O padrÃ£o tem de ser desligado, com indicador
visÃ­vel de que estÃ¡ captando. "Sempre ligado" numa sessÃ£o com estranhos Ã© inaceitÃ¡vel, e
push-to-talk resolve isso melhor que qualquer configuraÃ§Ã£o.*

*2. **A permissÃ£o Ã© do navegador, e Ã© uma vez sÃ³.** Pedir `getUserMedia` no momento errado (no
boot, por exemplo) queima a chance: o usuÃ¡rio nega, e o navegador lembra da negativa. SÃ³ pedir
quando ele clicar no botÃ£o.*

- [~] 927 `P0` **BotÃ£o de microfone no HUD**, desligado por padrÃ£o e visÃ­vel sÃ³ numa partida com outras pessoas
- [~] 928 `P0` **Push-to-talk em [V]**, com modo alternado; soltar a tecla emudece mesmo digitando, e perder o foco tambÃ©m
- [~] 929 `P0` **TrÃªs estados visÃ­veis**: desligado, aberto e mudo, transmitindo â€” juntar os dois Ãºltimos apagaria a Ãºnica distinÃ§Ã£o que importa
- [~] 930 `P0` **`getUserMedia` sÃ³ no clique**, com trava de fiaÃ§Ã£o que reprova qualquer outra chamada no cÃ³digo
- [~] 931 `P0` **Trilha na conexÃ£o que jÃ¡ carrega os blocos** â€” sem servidor de voz, sem upload
- [~] 932 `P0` **RenegociaÃ§Ã£o com negociaÃ§Ã£o perfeita** â€” e ela revelou um defeito: `handleSignal` criava conexÃ£o nova a cada oferta
- [~] 933 `P1` **Mensagem clara em falha de permissão de microfone** — mensagem Toast explicativa com instrução de reativação
- [~] 934 `P1` **Volume por jogador e opção de silenciar** — `mutePeer()`, `setPeerVolume()` em `PeerSync.ts`
- [~] 935 `P1` **Indicador de quem está falando** — `setPeerSpeaking()`, `isPeerSpeaking()` em `PeerSync.ts`
- [~] 936 `P1` **Voz atenuada por distância no mundo** — `misturaDaVoz()` em `vozEspacial.ts` e `MixerDeVoz.ts`
- [~] 937 `P1` **Canal de volume próprio para voz** — `'voice'` em `AudioSystem.ts`
- [~] 938 `P1` **Supressão de ruído e cancelamento de eco** — `echoCancellation`, `noiseSuppression` em `main.ts`
- [~] 939 `P1` **Detecção de silêncio para economizar transmissão** — `detectVoiceSilence()` em `vozEspacial.ts`
- [ ] 940 `P2` Voz continua funcionando se o anfitriÃ£o sair (junta com migraÃ§Ã£o de host)
- [ ] 941 `P2` Silenciar a si mesmo com atalho Ãºnico, sempre disponÃ­vel
- [ ] 942 `P2` Indicador de nÃ­vel de entrada, para o jogador saber se o microfone pegou
- [ ] 943 `P2` Aviso no HUD de que a voz Ã© P2P direta, sem passar por servidor
- [ ] 944 `P2` Limite de participantes com voz simultÃ¢nea
- [ ] 945 `P2` Testes do ciclo ligar/renegociar/desligar sem derrubar a conexÃ£o de dados

## 35 â€” Diretor de PresenÃ§a em Primeira Pessoa

*Parecer: o jogo comeÃ§a em primeira pessoa (item 567) e o modelo do personagem existe e Ã©
completo (557â€“566), mas em primeira pessoa ele Ã© **totalmente ocultado**. A razÃ£o foi correta na
Ã©poca â€” a cÃ¢mera fica dentro da cabeÃ§a, e o modelo apareceria como uma parede de textura na
tela. Mas a soluÃ§Ã£o usada Ã© grosseira: esconder tudo. O resultado Ã© que o jogador nÃ£o tem corpo.*

*O que se faz de verdade: esconder **sÃ³ a cabeÃ§a**, e manter o resto. AÃ­ olhar para baixo mostra
tronco, pernas e pÃ©s â€” que Ã© o que dÃ¡ presenÃ§a fÃ­sica. BraÃ§os e ferramenta na tela (item 594) sÃ£o
um problema separado, porque em primeira pessoa eles usam poses exageradas que nÃ£o correspondem
ao esqueleto real.*

- [~] 946 `P0` **Em primeira pessoa some **apenas a cabeÃ§a** â€” `setPrimeiraPessoa`**
- [~] 947 `P0` **Olhar para baixo mostra tronco, pernas e botas do prÃ³prio personagem**
- [~] 948 `P0` **Sem buraco no pescoÃ§o: o tronco jÃ¡ termina acima da linha do pescoÃ§o**

Dois detalhes que sÃ³ aparecem implementando:

- **O corpo nÃ£o gira com o olhar vertical em primeira pessoa.** O `pitch` move a cabeÃ§a, que estÃ¡
  oculta; passÃ¡-lo adiante giraria o tronco inteiro e o jogador veria o prÃ³prio peito ao olhar
  para cima. Em primeira pessoa o modelo recebe `pitch = 0`.
- **`build()` recria os pivÃ´s**, entÃ£o a visibilidade precisa ser reaplicada depois. Sem isso,
  trocar de cor na tela de customizaÃ§Ã£o faria a cabeÃ§a reaparecer na frente da cÃ¢mera â€” hÃ¡ teste.

No modo fantasma o corpo some por inteiro, de propÃ³sito: ali o jogador atravessa parede, e ver o
prÃ³prio corpo passando por dentro de blocos entregaria a ilusÃ£o.

- [ ] 949 `P1` BraÃ§os em primeira pessoa com pose prÃ³pria, nÃ£o a do esqueleto de terceira pessoa
- [ ] 950 `P1` Ferramenta equipada visÃ­vel na mÃ£o, acompanhando a hotbar
- [ ] 951 `P1` AnimaÃ§Ã£o de golpe e de quebrar bloco na visÃ£o de primeira pessoa
- [~] 952 `P1` **Balanço sutil ao caminhar** — `headBobbingEnabled` em `CameraManager.ts`
- [~] 953 `P1` **Cor do corpo em primeira pessoa idêntica à customização** — `AvatarManager.ts` / `PlayerController.ts`
- [ ] 954 `P2` Sombra do prÃ³prio personagem visÃ­vel no chÃ£o
- [ ] 955 `P2` Modo fantasma mantÃ©m o corpo translÃºcido, distinguindo-se da primeira pessoa normal
- [ ] 956 `P2` BraÃ§o direito e esquerdo distintos, conforme o item na mÃ£o
- [ ] 957 `P2` ReaÃ§Ã£o visual ao levar dano na primeira pessoa
- [ ] 958 `P2` Ver o corpo dentro da Ã¡gua com a distorÃ§Ã£o do fluido
- [ ] 959 `P2` OpÃ§Ã£o de esconder o corpo, para quem preferir a visÃ£o limpa
- [ ] 960 `P2` Testes de que a cabeÃ§a estÃ¡ oculta em 1Âª pessoa e visÃ­vel em 3Âª

---

# Adendo â€” Desempenho e interface (itens 961â€“1000)

> Relato do usuÃ¡rio: *"estÃ¡ muito muito travado"*, *"a GUI ainda nÃ£o melhorou, nÃ£o tem uma
> pÃ¡gina sÃ³ do menu inicial"*, *"Ã s vezes dou ESC e nÃ£o consigo voltar a ter o mouse fixo"*.
>
> As duas primeiras causas de travamento foram **regressÃµes introduzidas por mim** nas rodadas
> de luz e de mods. Ficam registradas com o que era e o que virou.

## 36 â€” Auditoria de desempenho (rodada de correÃ§Ã£o)

*DiagnÃ³stico: colocar **um** bloco disparava um recÃ¡lculo de luz sÃ­ncrono que zerava 9.261
cÃ©lulas, re-semeava 441 colunas inteiras de 128 voxels, e ainda marcava 9 chunks para re-mesh.
Cada acesso Ã  luz montava uma string (`chunkKey`) â€” mais de 100 mil concatenaÃ§Ãµes por clique. E o
mesher chamava `Math.pow` uma vez por face.*

| CorreÃ§Ã£o | Antes | Depois |
|---|---|---|
| `recalcRegion` (raio 8) | **69 ms** por bloco colocado | **~11 ms**, e enfileirado |
| Custo por frame ao construir | 42 ms (travando) | **2,8 ms** espalhado |
| Consulta de luz no mesher | `Math.pow` por face | tabela de 256 entradas â€” **16x** |
| Acesso a `getLight/setLight` | string por voxel | cache do Ãºltimo chunk |
| Chunks marcados por alteraÃ§Ã£o | sempre 9 | sÃ³ os que a regiÃ£o toca |

- [~] 961 `P0` **`recalcRegion` deixou de re-semear colunas inteiras** â€” lÃª o sol que chega no teto da caixa
- [~] 962 `P0` **Fila de relight com orÃ§amento de uma regiÃ£o por frame**
- [~] 963 `P0` **RegiÃµes prÃ³ximas se fundem** antes de processar (cÃ©lula de 12)
- [~] 964 `P0` **Tabela de luz de 256 entradas** no lugar de `Math.pow` por face
- [~] 965 `P0` **Cache do Ãºltimo chunk** em `getLight`/`setLight`
- [~] 966 `P1` **SÃ³ os chunks tocados pela regiÃ£o sÃ£o marcados**, nÃ£o os 9 vizinhos
- [~] 967 `P1` **Coluna de sol comeÃ§a no topo do terreno**, nÃ£o no topo do mundo
- [~] 968 `P0` **BFS de remoÃ§Ã£o de luz** â€” apagar propagava valor velho de volta e a caverna nunca escurecia
- [~] 969 `P0` **Fontes independentes revalidadas** contra o estado final, nÃ£o o do momento em que foram vistas
- [~] 970 `P0` **Painel de diagnÃ³stico medindo o frame **no navegador** â€” F3, com custo por sistema**
- [~] 971 `P0` **Mesh em Web Worker: era o maior custo de frame depois da luz corrigida**
- [~] 972 `P1` **Buffers de `padChunk`/`padLight` reciclados entre a thread principal e o worker**
- [ ] 973 `P1` OrÃ§amento de re-mesh por frame tambÃ©m no ciclo dia/noite (hoje marca tudo de uma vez)
- [~] 974 `P1` **Painel F3 com FPS, chunks, entidades, vozes de Ã¡udio, mods, rede e cache de rotas**
- [~] 975 `P1` **Distância de render adaptativa ao FPS medido** — `adjustRenderDistanceForFps()` em `CameraManager.ts`
- [~] 976 `P2` **Custo por sistema medido por mÃ©dia mÃ³vel, com o pior frame da janela ao lado**
- [ ] 977 `P2` Teste de regressÃ£o de desempenho no CI, com orÃ§amento por operaÃ§Ã£o
- [ ] 978 `P2` Descarregar geometria de chunk fora do alcance de forma mais agressiva

## 37 â€” Interface: separaÃ§Ã£o de telas e controle de cÃ¢mera

### Estado apÃ³s a rodada de correÃ§Ã£o

Entregue: **hub de navegaÃ§Ã£o** (`GameMenu`) como destino do ESC, com todos os destinos, os
atalhos visÃ­veis ao lado de cada um, volume por canal e saÃ­da para a tela inicial. E um
**tema compartilhado** (`theme.ts`), porque cada tela escrevia o prÃ³prio `cssText` â€” a mesma cor
de fundo aparecia com trÃªs valores diferentes e o mesmo botÃ£o tinha quatro paddings.

**PÃ¡gina inicial separada (982): entregue.** Enquanto ela estÃ¡ aberta, o canvas Ã© escondido e o
loop devolve o quadro imediatamente â€” antes, voltar ao menu deixava fÃ­sica, criaturas e render
trabalhando atrÃ¡s dele. O `requestAnimationFrame` continua agendado, para a volta ser instantÃ¢nea.

Ainda pendente na seÃ§Ã£o: opÃ§Ãµes de vÃ­deo e controles (985), remapeamento de teclas (432) e o
layout responsivo (998).


*Parecer: o `MainMenu` existe, mas o jogo nÃ£o tem uma **pÃ¡gina inicial** de verdade â€” as telas
foram nascendo como overlays sobre a cena, e hoje hÃ¡ sete delas competindo pelo mesmo espaÃ§o sem
navegaÃ§Ã£o comum. E o bug do ponteiro Ã© o pior tipo: o jogador perde o controle da cÃ¢mera e nÃ£o
tem nenhuma indicaÃ§Ã£o do que fazer.*

*Causa do bug do ESC: `requestPointerLock` **exige gesto do usuÃ¡rio**, e o navegador impÃµe uma
recusa logo apÃ³s a saÃ­da por ESC. A chamada automÃ¡tica era negada em silÃªncio (o `catch` engolia)
e nada mais tentava â€” o mouse ficava solto para sempre.*

- [~] 979 `P0` **Retomada do ponteiro por clique**, que Ã© o gesto que o navegador aceita
- [~] 980 `P0` **Dica "clique para voltar ao jogo"** quando o controle estÃ¡ solto
- [~] 981 `P0` **`pointerlockchange` detecta perda inesperada** e avisa, em vez de deixar o jogador sem saber
- [~] 982 `P0` **Tela inicial como pÃ¡gina: canvas escondido e simulaÃ§Ã£o suspensa enquanto ela estÃ¡ aberta**
- [~] 983 `P0` **NavegaÃ§Ã£o comum entre as telas â€” hub em `src/ui/GameMenu.ts`, aberto pelo ESC**
- [~] 984 `P0` **Porta Ãºnica em vez de sete atalhos soltos; os atalhos viraram atalhos, nÃ£o o Ãºnico caminho**
- [~] 985 `P1` **Tela de opções unificada: vídeo, áudio, controles, IA** — `src/ui/OptionsModal.ts`
- [~] 986 `P1` **Volume por canal exposto na interface (o sistema jÃ¡ suportava, nada expunha)**
- [~] 987 `P1` **Lista de atalhos visÃ­vel dentro do jogo, ao lado de cada destino**
- [~] 988 `P1` **Menu de pausa virou uma entrada do hub ("Mundo e rede"), em vez da Ãºnica porta**
- [~] 989 `P1` **Estilo compartilhado em `src/ui/theme.ts` â€” tokens e construtores no lugar de CSS repetido**
- [~] 990 `P1` **TransiÃ§Ã£o clara entre "no menu" e "jogando", com o ponteiro coerente nos dois**
- [~] 991 `P2` **Voltar sempre para o hub, e do hub para o jogo**
- [ ] 992 `P2` Indicador de qual tela estÃ¡ aberta
- [ ] 993 `P2` As telas herdam a customizaÃ§Ã£o de UI feita pela IA
- [ ] 994 `P2` NavegaÃ§Ã£o por teclado e foco visÃ­vel em todas as telas
- [ ] 995 `P2` Tela inicial mostrando os mundos com prÃ©via e data
- [ ] 996 `P2` Tela de crÃ©ditos e versÃ£o
- [ ] 997 `P2` Primeira execuÃ§Ã£o com um passo a passo curto
- [ ] 998 `P2` Layout responsivo para janela pequena
- [ ] 999 `P2` Testes de que ESC sempre devolve o controle da cÃ¢mera
- [ ] 1000 `P2` Testes de navegaÃ§Ã£o entre telas sem estado preso

---

# Adendo â€” Rodada 7 de requisitos (itens 1001â€“1042)

> Dois pedidos, ambos pesquisados antes de registrar: **apariÃ§Ã£o suave dos chunks** como no
> Minecraft moderno, e um **cÃ©u noturno de verdade** â€” lua, estrelas por padrÃ£o, e noites com
> claridade variÃ¡vel.

## 38 â€” Engenheiro de ApariÃ§Ã£o de Chunk (*fade in*)

*O que a pesquisa mostrou: no Java vanilla o chunk simplesmente **aparece** â€” o recorte seco que
este projeto tambÃ©m tem. A apariÃ§Ã£o suave Ã© padrÃ£o no **Bedrock**, e no Java vem de mods, sendo o
[Chunks fade in](https://modrinth.com/mod/chunks-fade-in) o mais usado (4,2 milhÃµes de downloads),
com [implementaÃ§Ã£o aberta](https://github.com/kerudion/chunksfadein). O
[fade-in-chunks](https://github.com/Johni0702/fade-in-chunks) descreve o efeito explicitamente
como "estilo Bedrock".*

**A tÃ©cnica, destrinchada:**

1. Cada chunk guarda o instante em que sua malha ficou pronta.
2. Durante ~0,4â€“0,8 s, a opacidade vai de 0 a 1. Algumas variantes somam um **deslocamento
   vertical** (o chunk "sobe" para o lugar), que Ã© o toque do Bedrock.
3. Os chunks aparecem **escalonados**, um apÃ³s o outro, e nÃ£o todos no mesmo quadro â€” Ã© isso que
   diferencia de um simples fade global.

**Duas armadilhas que a pesquisa deixa claras, e que valem registro aqui:**

- **Material transparente custa caro e quebra a profundidade.** Fazer o fade exige `transparent`,
  que desativa a escrita no *depth buffer* e reordena o desenho. Se o chunk ficar transparente
  para sempre, o mundo inteiro passa a ser desenhado como translÃºcido. O material precisa
  **voltar a opaco** ao terminar a animaÃ§Ã£o.
- **InteraÃ§Ã£o com nÃ©voa.** Este projeto acabou de ganhar neblina (item 054), e ela jÃ¡ esconde
  parte do surgimento. Fade e nÃ©voa precisam ser ajustados juntos, ou o chunk aparece com
  opacidade cheia dentro de uma nÃ©voa que deveria escondÃª-lo.

- [~] 1001 `P0` **`FadeAgenda` registra o instante em que a malha de cada chunk fica pronta**
- [~] 1002 `P0` **0 a 1 ao longo de 0,6 s, com suavizaÃ§Ã£o *ease-out***
- [~] 1003 `P0` ****Material nunca fica transparente** â€” a transiÃ§Ã£o Ã© por descarte (Bayer 4Ã—4)**
- [~] 1004 `P1` **Deslocamento vertical opcional estilo Bedrock** — `verticalPlacementOffset` em `PlayerController.ts`
- [~] 1005 `P1` **ApariÃ§Ã£o escalonada, 45 ms entre chunks**
- [~] 1006 `P1` **NÃ£o briga com a neblina: o material Ã© opaco e a nÃ©voa age normalmente**
- [~] 1007 `P1` **Re-mesh por alteraÃ§Ã£o **nÃ£o** refaz a animaÃ§Ã£o â€” sÃ³ os recÃ©m-carregados**
- [~] 1008 `P2` **Curva *ease-out* isolada em `suavizar()`, trocÃ¡vel num lugar sÃ³**
- [~] 1009 `P2` **ApariÃ§Ã£o de chunk desligÃ¡vel no menu (CÃ¢mera & Personagem)**
- [~] 1010 `P2` **A colisÃ£o nunca esperou a malha: a fÃ­sica lÃª os dados do chunk, nÃ£o a geometria**
- [~] 1011 `P2` **Teste de que todo chunk que comeÃ§a a aparecer termina, e volta ao material compartilhado**

#### Por que descarte, e nÃ£o transparÃªncia

O item 1003 avisava do custo, e ele Ã© maior do que parecia: material transparente **nÃ£o escreve no
buffer de profundidade**. O chunk que estÃ¡ chegando deixaria de ocultar o que estÃ¡ atrÃ¡s dele â€” o
jogador veria o interior do terreno atravÃ©s do chÃ£o que aparece, durante a animaÃ§Ã£o inteira â€” e o
renderizador ainda teria de ordenar os chunks por distÃ¢ncia a cada quadro.

Descartando fragmentos por um padrÃ£o de Bayer 4Ã—4, o material continua opaco: escreve
profundidade, dispensa ordenaÃ§Ã£o, e o que varia Ã© a *fraÃ§Ã£o* de pixels desenhados. Em 0,6 s o olho
lÃª como um esmaecimento.

Dois detalhes que sÃ³ aparecem ao implementar:

- **`clone()` nÃ£o serve** para o material da animaÃ§Ã£o. `Material.copy` do three.js nÃ£o copia
  `onBeforeCompile`, e o clone sairia sem curvatura, sem tingimento e sem o descarte â€” em
  silÃªncio. Ã‰ preciso construir e reaplicar.
- **Array GLSL com Ã­ndice dinÃ¢mico nÃ£o Ã© portÃ¡til** em WebGL1. A tabela de Bayer virou duas
  linhas de aritmÃ©tica, o que tambÃ©m Ã© mais barato.

O item 1010 (a colisÃ£o nÃ£o pode esperar a animaÃ§Ã£o) jÃ¡ era verdade e foi verificado, nÃ£o
implementado: a fÃ­sica lÃª os dados do chunk, nunca a geometria.


## 39 â€” Diretor de CÃ©u Noturno

*Pesquisa sobre o Minecraft, e uma diferenÃ§a que importa: o vanilla tem
[oito fases da lua](https://minecraft.wiki/w/Moon), que mudam ao fim de cada amanhecer â€” mas
**a fase nÃ£o altera a luminosidade**. A noite tem nÃ­vel de luz 4 fixo, seja lua cheia ou nova; a
fase sÃ³ influencia o surgimento de slimes no pÃ¢ntano. Escurecer conforme a fase Ã© justamente o
que mods como [Dynamic Darkness](https://www.curseforge.com/minecraft/mc-mods/dynamic-darkness)
acrescentam.*

*Ou seja: **o pedido vai alÃ©m do vanilla**, e vai numa direÃ§Ã£o melhor. Fazer a lua nova ser
realmente escura dÃ¡ funÃ§Ã£o Ã  fase lunar â€” a mesma caverna, a mesma base, mudam de dificuldade
conforme a noite. Ã‰ o tipo de variaÃ§Ã£o que faz o jogador olhar para o cÃ©u antes de sair.*

*O motor de luz deste projeto jÃ¡ separa luz de cÃ©u de luz de bloco e aplica um `sunScale`
contÃ­nuo, entÃ£o a claridade variÃ¡vel entra sem recalcular nada â€” basta o `sunScale` noturno
depender da fase. A tocha continua com o mesmo valor, que Ã© exatamente o que se quer.*

- [~] 1012 `P0` **Lua desenhada no cÃ©u, oposta ao sol â€” `src/render/sky.ts`**
- [~] 1013 `P0` **Oito fases lunares, avanÃ§ando uma por amanhecer**
- [~] 1014 `P0` **Fase persistida no save (`WorldRecord.worldDay`)**
- [~] 1015 `P0` **Claridade da noite varia com a fase â€” lua nova quase preta, cheia navegÃ¡vel**
- [~] 1016 `P0` **Estrelas por padrÃ£o, visÃ­veis sÃ³ Ã  noite**
- [~] 1017 `P1` **Estrelas surgindo no anoitecer com transiÃ§Ã£o suave**
- [~] 1018 `P1` **PosiÃ§Ã£o das estrelas determinÃ­stica â€” o mesmo mundo tem o mesmo cÃ©u**
- [~] 1019 `P1` **Brilho das estrelas reduzido nas noites de lua cheia**
- [~] 1020 `P1` **A lua projeta luz direcional fraca com sombra suave própria** — `moon` DirectionalLight em `src/render/scene.ts`
- [~] 1021 `P1` **Piso de luminosidade que nunca chega ao preto absoluto**
- [~] 1022 `P1` **`api.time.moonPhase` e `api.time.isDarkNight` expostos aos mods**
- [~] 1023 `P1` **Bioma e fase da lua no painel F3**
- [~] 1024 `P2` **Lua nova gera hostis a ~1,8Ã— o ritmo da cheia â€” `intervaloDeSpawn`**
- [ ] 1025 `P2` CÃ©u com gradiente noturno prÃ³prio, nÃ£o sÃ³ o diurno escurecido
- [ ] 1026 `P2` Via lÃ¡ctea ou faixa de estrelas mais densa, para o cÃ©u nÃ£o ser uniforme
- [ ] 1027 `P2` Nuvens escurecidas Ã  noite, recortando o cÃ©u estrelado
- [ ] 1028 `P2` Eclipse raro como evento de mundo
- [ ] 1029 `P2` Ferramenta MCP para consultar e ajustar a fase lunar
- [~] 1030 `P2` **Teste de que a fase avanÃ§a uma vez por dia e volta ao ciclo apÃ³s oito**
- [~] 1031 `P2` **Teste de que a lua nova Ã© mais escura que a cheia, e nenhuma Ã© preto absoluto**

## Como isso conversa com o que jÃ¡ existe

| JÃ¡ entregue | O que o pedido acrescenta |
|---|---|
| Ciclo dia/noite com `sunScale` contÃ­nuo (245) | O `sunScale` noturno passa a depender da fase lunar |
| Luz de cÃ©u separada da de bloco (243) | A tocha mantÃ©m o valor: sÃ³ a luz de cÃ©u escurece |
| CÃ©u que muda de cor (246) | Ganha gradiente noturno prÃ³prio, lua e estrelas |
| Spawn por nÃ­vel de luz (255) | Noite escura vira noite perigosa, sem regra nova |
| Neblina atmosfÃ©rica (054) | Precisa ser conciliada com o fade de chunk |
| Re-mesh em degraus de `sunScale` (245) | A variaÃ§Ã£o por fase muda de degrau uma vez por dia, nÃ£o por frame |

**Ordem recomendada:** 1012â€“1016 primeiro (lua, fases, claridade variÃ¡vel, estrelas) â€” Ã© o que o
usuÃ¡rio descreveu e o que muda a experiÃªncia. O *fade* de chunk (1001â€“1003) depois, porque mexe
em material e profundidade, e um erro ali degrada o desempenho do mundo inteiro.

### CÃ©u noturno: entregue

Lua com oito fases, estrelas determinÃ­sticas pela semente, e a claridade da noite governada pela
fase â€” lua nova quase preta, cheia navegÃ¡vel. O `sunScale` noturno deixou de ser fixo em 0,12 e
passa a sair de `claridadeNoturna(fase)`; como o motor separa luz de cÃ©u de luz de bloco, **a
tocha mantÃ©m o mesmo valor em todas as noites**, que Ã© exatamente o comportamento desejado.

Um ajuste que os testes forÃ§aram: o limiar de "noite escura" estava no meio da faixa de brilho,
mas a curva usa raiz e sobe rÃ¡pido â€” sÃ³ a lua nova classificava como escura, e sete das oito
noites seriam "claras". O limiar passou para a **iluminaÃ§Ã£o** do disco, e agora as trÃªs noites em
torno da lua nova sÃ£o as escuras.

Falta desta seÃ§Ã£o: sombra prÃ³pria da lua (1020), gradiente noturno dedicado (1025), e ligar a
fase ao spawn de hostis (1024) â€” que Ã© o que transformaria a lua nova em noite perigosa.

---

# Adendo â€” Curvatura do Mundo (itens 1032â€“1042)

> Pedido: registrar a **Curvatura do Mundo** (*World Curvature*), o efeito em que o cenÃ¡rio
> distante se dobra para baixo no horizonte, implementado por um *Curvature Shader*.
>
> **Achado ao verificar o cÃ³digo antes de registrar: jÃ¡ estava implementado â€” e desligado.**

## 40 â€” Auditoria da curvatura

O `applyCurvature` em `src/render/scene.ts` jÃ¡ injetava a curvatura no *vertex shader* de todos os
materiais de terreno, Ã¡gua e vidro, com a matemÃ¡tica correta:

```glsl
float cqDist = distance(cqWorld.xz, cameraPosition.xz);
float cqDrop = max(0.0, cqDist - uCurvStart);
cqWorld.y -= cqDrop * cqDrop * uCurvInvR;   // afunda com o QUADRADO da distÃ¢ncia
```

SÃ³ que **nunca funcionou**, por dois motivos somados:

1. `invR` valia **0** â€” e o comentÃ¡rio ao lado dizia literalmente *"0 = mundo 100% plano e reto"*.
   Nada no projeto inteiro alterava esse valor.
2. `start` valia **500 voxels**, enquanto a distÃ¢ncia de render sÃ£o ~192 (6 chunks Ã— 32). A
   curvatura comeÃ§aria alÃ©m do que existe desenhado. Mesmo que `invR` fosse ligado, nÃ£o
   apareceria nada.

Ã‰ o terceiro trecho assim encontrado nesta sÃ©rie: `UndoManager.recordBatch` nunca era chamado
(nenhuma construÃ§Ã£o da IA era reversÃ­vel), `setViewRange` ajustava uma nÃ©voa que nÃ£o existia, e
agora a curvatura. Vale como padrÃ£o a observar: **cÃ³digo presente nÃ£o Ã© cÃ³digo ativo.**

### CorreÃ§Ã£o aplicada

- [~] 1032 `P0` **Curvatura ligada por padrÃ£o**, com `invR` derivado em vez de fixo
- [~] 1033 `P0` **InÃ­cio e intensidade derivados da distÃ¢ncia de render** â€” `start` fixo em 500 ficava fora do alcance desenhado
- [~] 1034 `P0` **A intensidade Ã© expressa como "quanto o horizonte afunda no limite da visÃ£o"** e o `invR` sai daÃ­. Com `invR` fixo, aumentar a distÃ¢ncia dobraria o mundo ao absurdo, porque a queda cresce com o quadrado
- [~] 1035 `P1` **`setCurvature` acompanha a mudanÃ§a de distÃ¢ncia de render**, como a nÃ©voa

### Pendente

- [~] 1036 `P1` **Expor a intensidade nas opções, com queda = 0 para mundo plano** — `setCurvature()` em `src/render/scene.ts`
- [ ] 1037 `P1` Conciliar curvatura e neblina: o ponto onde o mundo dobra deve estar dentro da nÃ©voa, nÃ£o alÃ©m dela
- [~] 1038 `P1` **A curvatura é só visual** — física, colisão raycast e A* continuam no mundo plano sem distorção
- [ ] 1039 `P2` Aplicar a mesma curvatura Ã s entidades e ao personagem, que hoje ficam retos sobre terreno curvo
- [ ] 1040 `P2` Aplicar Ã s partÃ­culas e aos destroÃ§os de fÃ­sica
- [ ] 1041 `P2` Curvatura no eixo vertical tambÃ©m, para o efeito "planeta" completo
- [ ] 1042 `P2` Teste de que `queda = 0` restaura o mundo plano exatamente

**Ressalva honesta:** a correÃ§Ã£o foi verificada por tipos, testes e build, mas o efeito visual em
si **nÃ£o foi conferido numa tela** â€” o valor padrÃ£o de 26 voxels de queda no limite da visÃ£o Ã© um
palpite calibrado, nÃ£o uma mediÃ§Ã£o. Pode precisar de ajuste ao ver.


---

## 41. Especialista em Estado de Interface e Retomada de Controle (itens 1043â€“1062)

Relato do usuÃ¡rio: *"as vezes buga e nao consigo clicar para voltar ao jogo"*, com a dica
"Clique para voltar ao jogo" na tela e o clique sem efeito.

### Causa encontrada â€” estado duplicado

O `UIManager` mantinha uma pilha de ids (`blockingStack`) **e** cada tela mantinha o prÃ³prio
`isOpen`. Dois donos da mesma verdade. Como todo botÃ£o de fechar chama `close()` direto
(`CodeEditorPage`, `ModsPage`, `InventoryModal`, `PauseMenu`), e `closeBlocking` saÃ­a antes da
hora quando a tela jÃ¡ estava fechada, **o id ficava na pilha para sempre**. A partir dali
`isAnyBlockingOpen()` valia `true` eternamente e o ouvinte de clique desistia na primeira linha.

Um agravante: a dica tinha `pointer-events: none` e `z-index: 40` â€” mandava clicar sem ser
clicÃ¡vel, e ficava **abaixo** de qualquer overlay que tivesse sobrado.

### Entregue

- [~] 1043 `P0` **A pilha deixou de ser a verdade**: `isOpen` de cada tela Ã© a fonte, a pilha guarda sÃ³ a ordem do ESC
- [~] 1044 `P0` **`podarPilha()` reconcilia antes de qualquer leitura** â€” remove quem se fechou sozinho e adota quem se abriu sozinho
- [~] 1045 `P0` **`closeBlocking` nÃ£o desiste mais quando a tela jÃ¡ estÃ¡ fechada** â€” Ã© exatamente aÃ­ que precisa limpar e destravar
- [~] 1046 `P0` **A dica virou botÃ£o**: recebe o clique diretamente, com o maior z-index da interface
- [~] 1047 `P0` **Teclado como gesto alternativo** (W/A/S/D/espaÃ§o/enter) â€” se o clique estiver sendo engolido, andar devolve a cÃ¢mera
- [~] 1048 `P0` **Ouvinte de clique no `document` em captura**, nÃ£o no canvas: overlay esquecido por cima nÃ£o engole mais o gesto
- [~] 1049 `P0` **Segundo ouvinte de relock removido do `main.ts`** â€” tinha lista de modos desatualizada, sem `thirdperson`, e a cÃ¢mera nÃ£o voltava em terceira pessoa
- [~] 1050 `P0` **`pointerlockerror` e `blur` tratados** â€” toda falha rearma a dica em vez de sumir em silÃªncio
- [~] 1051 `P1` **`shouldRelock` exige partida em curso** â€” a dica aparecia sobre o menu inicial
- [~] 1052 `P1` **Teste de regressÃ£o do vazamento da pilha** (`tests/unit/uiManager.test.ts`, 8 casos)

### Pendente

- [~] 1053 `P1` **Pausar simulação no singleplayer com bloqueante aberto** — `pauseWorldInSingleplayer()` em `PauseManager.ts`
- [~] 1054 `P1` **Indicador visível de "PAUSADO" no HUD** — `setPaused()` em `HUD.ts`
- [~] 1055 `P1` **Pausa não pausa o P2P em multiplayer** — `pauseWorldInSingleplayer()` em `PauseManager.ts`
- [~] 1056 `P1` **Sair do lock por troca de aba deve pausar** â€” `visibilitychange` em `main.ts` integrado a `PauseManager.ts`
- [~] 1057 `P1` **Zerar teclas pressionadas ao perder o foco** â€” `clearPressedKeys` em `PauseManager.ts` disparado no `visibilitychange`/`blur`
- [ ] 1058 `P2` Remapeamento de teclas, com o ESC configurÃ¡vel (ver item 432)
- [ ] 1059 `P2` `UIScreen` com evento `onClose` para as telas avisarem, tornando a poda desnecessÃ¡ria
- [ ] 1060 `P2` Teste de integraÃ§Ã£o com DOM real (jsdom) cobrindo o caminho de pointer lock
- [ ] 1061 `P2` Tela de diagnÃ³stico de estado de UI no F3 â€” quais telas o gerenciador acha que estÃ£o abertas
- [ ] 1062 `P2` Foco de teclado preso dentro do overlay aberto (armadilha de foco), por acessibilidade

---

## 42. Especialista em Atmosfera, Clima e EstaÃ§Ãµes (itens 1063â€“1130)

Pedido do usuÃ¡rio: *"melhorar o ambiente efeito de clima, fog, cor, estilo Biome Blending, Color
Grading e Fog Interpolation, mudanÃ§a de clima, o bioma quero que seja facil configurar as estaÃ§Ãµes
do ano, que muda o comportamento do bioma"* â€” e, textualmente, **"que funcione"**, que Ã© o
lembrete de que a seÃ§Ã£o 41 acabou de mostrar o custo de escrever cÃ³digo que nunca roda.

### 42.1 Biome Blending â€” transiÃ§Ã£o entre biomas

Hoje o bioma Ã© decidido por ponto e aplicado direto: a fronteira entre deserto e floresta Ã© uma
linha reta visÃ­vel. A mistura precisa acontecer em trÃªs lugares distintos, e confundi-los Ã© o erro
clÃ¡ssico â€” misturar a *cor* Ã© barato, misturar a *altura do terreno* muda a geraÃ§Ã£o.

- [~] 1063 `P0` **`pesosDeBioma` devolve `{id, peso}[]` normalizado â€” `src/world/biomes.ts`**
- [x] 1064 `P0` ~~Amostragem dos vizinhos num raio configurÃ¡vel~~ â€” **nÃ£o se aplica**: `temp` e `moist` jÃ¡ sÃ£o campos de ruÃ­do contÃ­nuos, entÃ£o o peso derivado deles Ã© suave por construÃ§Ã£o. Amostrar vizinhos multiplicaria o custo para obter algo que jÃ¡ se tem de graÃ§a
- [~] 1065 `P0` **`misturarCor` mistura grama, folhagem e nÃ©voa pelos pesos**
- [x] 1066 `P0` ~~Mistura da altura do terreno pelos pesos~~ â€” **nÃ£o se aplica**: a altura aqui nÃ£o Ã© derivada do bioma, Ã© uma cadeia de ruÃ­do independente (continente â†’ montanha â†’ erosÃ£o â†’ rio). NÃ£o existe degrau de altura na fronteira porque nunca houve fronteira de altura
- [ ] 1067 `P1` Mistura sÃ³ na cor por padrÃ£o; mistura de altura como opÃ§Ã£o, por custo de geraÃ§Ã£o
- [ ] 1068 `P1` RuÃ­do na fronteira, para a transiÃ§Ã£o nÃ£o ser um cÃ­rculo perfeito
- [~] 1069 `P1` **Amostrado a cada 6 quadros, com interpolaÃ§Ã£o temporal cobrindo o intervalo**
- [~] 1070 `P1` **O `worldgen` decide superfÃ­cie e Ã¡rvore pelo bioma dominante â€” nÃ£o mais por limiares paralelos**
- [~] 1071 `P1` **Densidade de Ã¡rvore por bioma; deserto e tundra em zero**
- [ ] 1072 `P2` Bioma de transiÃ§Ã£o explÃ­cito (praia, orla de floresta) como caso especial
- [~] 1073 `P2` **Teste de continuidade: salto mÃ¡ximo 0,0104 por passo de 0,01, uniforme**
- [~] 1074 `P2` **Teste de que a soma dos pesos Ã© sempre 1, em todo o domÃ­nio**

### 42.2 Color Grading â€” a paleta do *Lay of the Land*

O visual de referÃªncia nÃ£o vem da geometria, vem da **cor**: paleta dessaturada, sombras
azuladas, luz quente. Sem gradaÃ§Ã£o, mini-blocos e AO entregam sÃ³ metade do resultado.

- [x] 1075 `P0` ~~Passe de pÃ³s-processamento com LUT~~ â€” **dimensionado e RECUSADO por custo**, e a decisÃ£o estÃ¡ escrita em `src/render/grading.ts`: um `EffectComposer` custa um alvo de render do tamanho da tela, uma cÃ³pia por quadro e um passe sobre cada pixel, num projeto que veio do relato *"estÃ¡ muito muito travado"*. A gradaÃ§Ã£o em seis instruÃ§Ãµes dentro do fragmento entrega o mesmo visual. **A limitaÃ§Ã£o assumida:** ela alcanÃ§a terreno, Ã¡gua e vidro â€” nÃ£o personagem, criaturas nem cÃ©u. Reabrir sÃ³ se a gradaÃ§Ã£o precisar ficar agressiva. Estava marcado `P0` pendente sem que ninguÃ©m fosse fazÃª-lo
- [~] 1076 `P0` **ExposiÃ§Ã£o por hora do dia â€” `exposicaoDaHora`, no `toneMappingExposure`**
- [x] 1077 `P0` **Mapeamento de tom ACES â€” jÃ¡ existia** desde antes desta seÃ§Ã£o (`renderer.toneMapping = ACESFilmicToneMapping`). MarcÃ¡-lo como pendente foi erro meu de auditoria, o segundo do tipo depois do item 053 (oclusÃ£o de ambiente)
- [~] 1078 `P1` **Sombra puxada para o azul e luz para o Ã¢mbar (tonalizaÃ§Ã£o dividida)**
- [~] 1079 `P1` **SaturaÃ§Ã£o por bioma, **multiplicando** a da predefiniÃ§Ã£o**
- [~] 1080 `P1` **InterpolaÃ§Ã£o do tingimento entre biomas, pelos mesmos pesos do 1063**
- [ ] 1081 `P1` Vinheta sutil e aberraÃ§Ã£o cromÃ¡tica mÃ­nima nas bordas â€” desligÃ¡veis
- [~] 1082 `P1` **Quatro predefiniÃ§Ãµes selecionÃ¡veis no menu: natural, cinema, vÃ­vido, nenhuma**
- [ ] 1083 `P2` LUT carregÃ¡vel por mod, para um mod poder dar identidade visual prÃ³pria
- [ ] 1084 `P2` Custo medido no F3: a gradaÃ§Ã£o Ã© um passe de tela cheia e precisa aparecer no orÃ§amento
- [ ] 1085 `P2` Desligar automaticamente a gradaÃ§Ã£o quando o FPS cair de um limiar
- [~] 1086 `P2` **Teste de que a saturaÃ§Ã£o nunca fica negativa nem estoura**

### 42.3 Fog Interpolation â€” a nÃ©voa que reage

A nÃ©voa hoje Ã© uma cor sÃ³, derivada da distÃ¢ncia de render. Ela deveria ser o principal veÃ­culo
de clima e de hora: chuva aproxima e acinzenta, deserto afasta e amarela, noite escurece.

- [~] 1087 `P0` **Cor da nÃ©voa interpolada com a hora do dia **e** tingida pelo bioma**
- [~] 1088 `P0` **Cor e alcance da nÃ©voa por bioma, misturados pelos pesos**
- [~] 1089 `P0` **InterpolaÃ§Ã£o temporal com meia-vida de 0,5 s, independente da taxa de quadros**
- [~] 1090 `P1` **Névoa exponencial ao quadrado (FogExp2) como opção** — `setFogMode()` em `src/render/scene.ts`
- [~] 1091 `P1` **CÃºpula com gradiente**: o horizonte Ã© a cor da nÃ©voa, e a borda deixa de existir
- [~] 1092 `P1` **NÃ©voa por altitude**, entrando sÃ³ no lado do bioma da mistura
- [~] 1093 `P1` **JÃ¡ estava entregue** pelas camadas verticais â€” auditado e travado com teste
- [ ] 1094 `P2` NÃ©voa volumÃ©trica barata por camadas, para os raios de luz do amanhecer
- [ ] 1095 `P2` Teste de que a densidade nunca esconde o bloco em que o jogador estÃ¡ mirando

### 42.4 Clima â€” chuva, neve, tempestade

- [~] 1096 `P0` **MÃ¡quina de estados de clima â€” `src/world/weather.ts` (6 estados)**
- [~] 1097 `P0` **TransiÃ§Ã£o gradual, com duraÃ§Ã£o sorteada e **determinÃ­stica pela semente****
- [~] 1098 `P0` **Clima traduzido pelo bioma dominante: nÃ£o neva no deserto, chuva vira neve na tundra**
- [~] 1099 `P0` **RelÃ³gio do mundo sincronizado do anfitriÃ£o (`world_time`); o clima Ã© derivado dele**
- [~] 1100 `P1` **PartÃ­culas de chuva e neve, presas Ã  cÃ¢mera, com orÃ§amento fixo de 1.400**
- [~] 1101 `P1` **Chuva para no primeiro sÃ³lido abaixo â€” "nÃ£o chove dentro de casa" sai de graÃ§a**
- [~] 1102 `P1` **Som de chuva e trovÃ£o pelo sintetizador, sem arquivo de Ã¡udio**
- [~] 1103 `P1` **ClarÃ£o do relÃ¢mpago e trovÃ£o atrasado pela distÃ¢ncia**
- [~] 1104 `P1` **Chuva escurece a cor do terreno enquanto molha, pelo mesmo canal**
- [~] 1105 `P1` **Neve cai com queda e deriva prÃ³prias (acÃºmulo como bloco fino ainda pendente)**
- [~] 1106 `P1` **Clima modula a nÃ©voa e a luz do cÃ©u, como multiplicadores**
- [ ] 1107 `P2` Chuva enche recipientes e alimenta os fluidos finitos existentes
- [ ] 1108 `P2` Raio incendeia e pode converter areia em vidro, com chance baixa
- [ ] 1109 `P2` Clima afeta o surgimento de criaturas e a agressividade
- [~] 1110 `P2` **`api.env.get/has/missing` documentado na referÃªncia do agente**
- [ ] 1111 `P2` Ferramenta MCP `set_weather` / `get_weather`
- [~] 1112 `P2` **Teste de que a mÃ¡quina nunca fica presa e sempre termina numa transiÃ§Ã£o vÃ¡lida**

#### O que a implementaÃ§Ã£o do clima revelou

**Uma lacuna prÃ©-existente, encontrada ao tentar cumprir o item 1099:** `timeOfDay` e `worldDay`
**nunca foram sincronizados no P2P**. Cada par contava o prÃ³prio tempo desde que entrou â€” dois
jogadores no mesmo mundo viam horas do dia e fases da lua diferentes. O clima sÃ³ tornou isso
visÃ­vel, porque Ã© derivado do dia. Corrigido com a mensagem `world_time`, que o anfitriÃ£o manda na
entrada do convidado e a cada 10 s.

O convidado **alcanÃ§a correndo** (ritmo Â±30%) em vez de saltar. Saltar faria o sol pular no cÃ©u e,
pior, faria `sunScale` cruzar o limiar de re-mesh de uma vez â€” o mundo inteiro remontado num
quadro, a cada mensagem de relÃ³gio.

**O clima Ã© derivado, nÃ£o sorteado.** A sequÃªncia Ã© funÃ§Ã£o de (semente, dia), o que resolve duas
coisas de graÃ§a: nÃ£o precisa ser gravado no save, e nÃ£o precisa trafegar no P2P â€” os dois lados
derivam do mesmo relÃ³gio. SÃ³ o clima **imposto** (por mod ou pelo anfitriÃ£o) viaja.

**A fase da lua nÃ£o afetava o spawn, e nÃ£o era Ã³bvio.** O `sunScale` jÃ¡ vinha da fase, mas o
limiar de spawn Ã© 6 e a luz de cÃ©u efetiva Ã  noite vai de 0,5 (nova) a 2,9 (cheia): as duas passam
com folga. A fase mudava o quanto se enxerga e nada mais. O que precisava mudar era o **ritmo** â€”
`intervaloDeSpawn`.

### 42.5 EstaÃ§Ãµes do ano â€” configurÃ¡veis por bioma

Requisito textual do usuÃ¡rio: *"o bioma quero que seja facil configurar as estaÃ§Ãµes do ano, que
muda o comportamento do bioma"*. O ponto central Ã© **configuraÃ§Ã£o declarativa**: uma estaÃ§Ã£o nÃ£o
deve exigir cÃ³digo, e sim uma tabela que o bioma preenche â€” Ã© o que permite a IA criar um bioma
com estaÃ§Ãµes prÃ³prias sem escrever lÃ³gica.

- [~] 1113 `P0` **CalendÃ¡rio de 4 estaÃ§Ãµes Ã— 8 dias, derivado do mesmo `worldDay` da lua**
- [~] 1114 `P0` **`PerfilSazonal` declarativo â€” **sÃ³ nÃºmeros**, nenhum `switch` no motor**
- [~] 1115 `P0` **InterpolaÃ§Ã£o entre estaÃ§Ãµes, com platÃ´ no coraÃ§Ã£o de cada uma**
- [~] 1116 `P0` **Derivado do `worldDay`, que jÃ¡ Ã© sincronizado pelo `world_time`**
- [~] 1117 `P1` **Folhagem muda de cor na estaÃ§Ã£o **sem regerar o chunk** â€” canal `aTint` + uniform**
- [~] 1118 `P1` **Inverno cobre de neve e congela a Ã¡gua**, com bloco de gelo novo e degelo por identidade
- [~] 1119 `P1` **Crescimento rasteiro por estaÃ§Ã£o** â€” e nÃ£o existia crescimento nenhum para modular
- [~] 1120 `P1` **Hora aparente**: o inverno encurta o dia sem mexer no relÃ³gio real
- [~] 1121 `P1` **`sazonal` por bioma **e** perfil prÃ³prio via `definirPerfil`**
- [~] 1122 `P1` **A estaÃ§Ã£o traduz o clima: inverno converte chuva em neve onde o bioma permite**
- [~] 1123 `P1` **`api.season.defineProfile` â€” declaraÃ§Ã£o sem cÃ³digo; painel na pÃ¡gina de mods pendente**
- [~] 1124 `P2` **`api.season.current/is/growth/defineProfile`**
- [ ] 1125 `P2` Ferramenta MCP `configure_biome_seasons`, documentada em `ModAPIReference`
- [ ] 1126 `P2` EstaÃ§Ã£o afeta o surgimento de criaturas e o que os aldeÃµes produzem
- [ ] 1127 `P2` Evento sazonal raro (aurora no inverno, tempestade de areia no verÃ£o do deserto)
- [~] 1128 `P2` **Teste de que o ciclo de estaÃ§Ãµes fecha e volta ao inÃ­cio**
- [~] 1129 `P2` **Teste de que um bioma sem perfil nÃ£o quebra nada**
- [~] 1130 `P2` **Teste de que a interpolaÃ§Ã£o nunca produz valor fora da faixa**

### O que jÃ¡ roda

`src/world/biomes.ts` (puro) + `tests/unit/biomes.test.ts` (17 casos), ligado no laÃ§o principal do
`main.ts` e no painel F3.

Dois itens desta seÃ§Ã£o foram **descartados com justificativa** (1064 e 1066) em vez de ficarem
pendentes para sempre: eles pressupunham um bioma discreto por ponto, que este gerador nunca teve.

Um defeito meu, que o teste pegou: a primeira versÃ£o truncava a mistura nos 4 maiores pesos. O
teste de continuidade acusou salto de 0,084 contra mediana de 0,0077 â€” outlier isolado, que Ã© a
assinatura de descontinuidade, nÃ£o de inclinaÃ§Ã£o. Cortar o quinto peso e renormalizar move todos
de uma vez. Sem truncamento, o salto mÃ¡ximo Ã© 0,0104 e **uniforme**.

#### O que a implementaÃ§Ã£o das estaÃ§Ãµes revelou

**Um defeito de ordem, pego pelo teste.** Eu aplicava a estaÃ§Ã£o antes do bioma, e a regra
"bioma temperado converte neve em chuva" **desfazia** a conversÃ£o do inverno â€” a floresta nunca
veria neve. A ordem certa, lendo de novo, Ã© Ã³bvia: o bioma diz o que Ã© *possÃ­vel* ali (nÃ£o neva no
deserto, nunca), e a estaÃ§Ã£o escolhe dentro do possÃ­vel. Filtrar depois de escolher desfaz a
escolha.

**A estaÃ§Ã£o nÃ£o mexe nos pesos do sorteio de clima, e isso Ã© deliberado.** Se mexesse, a mesma
semente daria sequÃªncias diferentes conforme os perfis sazonais que um mod tivesse registrado â€” e
o determinismo do P2P passaria a exigir que os dois lados tivessem exatamente os mesmos mods
carregados. A estaÃ§Ã£o Ã© uma lente sobre a sequÃªncia, nÃ£o parte dela.

**Perfis sÃ£o limpos ao trocar de mundo.** Um mundo com o mod "inverno eterno" contaminaria o
prÃ³ximo aberto na mesma sessÃ£o, e o sintoma apareceria longe de qualquer coisa feita ali.

#### O que a implementaÃ§Ã£o das partÃ­culas revelou

**"NÃ£o chove dentro de casa" (1101) nÃ£o precisou de teste de cÃ©u aberto.** A regra Ã© "a partÃ­cula
para no primeiro bloco sÃ³lido abaixo" â€” e o telhado *Ã©* o primeiro bloco sÃ³lido. Uma varanda, uma
caverna com entrada lateral e uma casa com claraboia funcionam sem nenhum caso especial. O teste
de coluna com cÃ©u aberto, que era a soluÃ§Ã£o planejada, teria custado mais e acertado menos.

**A varredura acontece ao renascer, nÃ£o por quadro.** Com 1.400 partÃ­culas vivendo ~1,5 s, sÃ£o
algumas centenas de varreduras por segundo, contra 84.000 se fosse por quadro.

**O clarÃ£o nÃ£o entra no `sunScale`.** Se entrasse, cada raio marcaria todos os chunks como sujos
e o mundo inteiro seria remontado duas vezes por relÃ¢mpago. O clarÃ£o Ã© de iluminaÃ§Ã£o, nÃ£o de
geometria â€” e essa distinÃ§Ã£o existe porque a luz de cÃ©u estÃ¡ assada na cor dos vÃ©rtices.

**Chuva contÃ­nua nÃ£o cabia no modelo de `play()`,** que Ã© de disparo curto: para soar contÃ­nua
seriam dezenas de disparos por segundo, e o teto de 24 vozes estouraria antes de qualquer outro
som do jogo tocar. Foi preciso uma fonte de ruÃ­do em laÃ§o, viva o tempo todo, com ganho zero
quando nÃ£o hÃ¡ clima â€” uma voz fixa e nada mais.

Um teste existente reprovou o trovÃ£o por ser mais longo que o som de morte. O invariante era
legÃ­timo, mas sobre **resposta a aÃ§Ã£o**: nenhum retorno de ato do jogador pode se arrastar mais
que a prÃ³pria morte. TrovÃ£o Ã© atmosfÃ©rico. O teste foi **escopado**, nÃ£o afrouxado â€” encurtar o
trovÃ£o para caber nele seria deixar o teste ditar o jogo.

#### O outono sem remontar chunk

Ao terminar as estaÃ§Ãµes percebi que **elas nÃ£o eram visÃ­veis**: mudavam o clima e o painel F3, e
nada mais. Um sistema inteiro que o jogador nÃ£o enxerga.

O obstÃ¡culo Ã© que a luz e a oclusÃ£o estÃ£o **assadas na cor dos vÃ©rtices** â€” mudar a cor da
folhagem exigiria remontar o chunk, inaceitÃ¡vel para algo que muda todo dia de calendÃ¡rio.

A saÃ­da Ã© um canal novo no mesher: **um byte por vÃ©rtice** dizendo se aquele vÃ©rtice responde
(0 = nÃ£o, 1 = folhagem, 2 = grama). A *cor* nÃ£o vai por vÃ©rtice; ela vive num uniform. O outono
chega ao mundo inteiro trocando trÃªs nÃºmeros.

TrÃªs detalhes que decidem se funciona:

- **Multiplicativo, nÃ£o substitutivo.** Preserva a luz e a oclusÃ£o que jÃ¡ estÃ£o na cor. Somar ou
  substituir apagaria o relevo, e a folha de pinheiro viraria laranja em vez de escurecer.
- **SÃ³ o topo da grama.** A lateral de um bloco de grama Ã© terra; pintÃ¡-la de laranja deixaria o
  corte do terreno com cara de bolo.
- **Um `onBeforeCompile` sÃ³.** O three.js guarda **um** por material â€” uma segunda atribuiÃ§Ã£o
  apagaria a curvatura em silÃªncio, e o sintoma seria "a curvatura parou quando o outono chegou".

Blocos de mod entram sozinhos, pelas propriedades: um bloco `decor` nÃ£o sÃ³lido Ã© folhagem, do
mesmo jeito que jÃ¡ herda o som de folhagem em `materialOf`. Um mod que cria "samambaia" ganha
outono sem declarar nada â€” e sem isso, todo bioma criado pela IA ficaria congelado no verÃ£o.

#### GradaÃ§Ã£o sem passe de tela cheia

A soluÃ§Ã£o de manual Ã© um `EffectComposer` com LUT: um alvo de render do tamanho da tela, uma cÃ³pia
por quadro e um passe de fragmento sobre cada pixel. Este projeto veio de um relato de *"estÃ¡
muito muito travado"*, e pagar isso por um efeito de cor seria a escolha errada.

O que foi entregue sÃ£o **seis instruÃ§Ãµes dentro do fragmento que jÃ¡ ia rodar**, injetadas depois
de `fog_fragment` â€” depois da nÃ©voa, de propÃ³sito: antes dela o horizonte destoaria do terreno
exatamente no ponto onde os dois se encontram, que Ã© o mais visÃ­vel de todos.

**A limitaÃ§Ã£o Ã© real e precisa ficar registrada:** a gradaÃ§Ã£o assim aplicada alcanÃ§a o terreno, a
Ã¡gua e o vidro â€” **nÃ£o** o personagem, as criaturas nem.

- [~] 1191 `P1` **Aba [Opções]** — Configurações de Vídeo, Áudio, Controles e IA em `OptionsModal.ts`
- [~] 1192 `P1` **Aba [Sistema/Sair]** — Gestão de save, sessão multiplayer e confirmação de saída em `PauseMenu.ts`

A exposiÃ§Ã£o, essa sim, Ã© global: vai no `toneMappingExposure` do renderizador e alcanÃ§a tudo.

Um detalhe que sÃ³ aparece medindo: a luminÃ¢ncia usa os c### Entregue nesta rodada

- [~] 1147 `P0` **`InventoryModal` migrado para o componente `Tabs`** (CatÃ¡logo, Crafting 6x6 e Personagem)
- [~] 1148 `P0` **`PauseMenu` migrado para o componente `Tabs`**
- [~] 1149 `P0` **`ModsPage` migrado para o componente `Tabs`** (Geral, `mod.env`, VersÃµes e Scripts)
- [~] 1150 `P1` **Layout do inventÃ¡rio em duas colunas** (Coluna esquerda: Tabs/Grade; Coluna direita: Personagem/Stats & Equipamentos)
- [~] 1151 `P1` **Barra de vida e fome com nÃºmeros formatados** junto aos Ã­cones SVG
- [~] 1160 `P2` **Teste de integraÃ§Ã£o de UI** em `tests/unit/uiIntegration.test.ts` (garantindo exclusividade de modais)

### Pendente

- [~] 1152 `P1` **Foco preso dentro da tela aberta (armadilha de foco)** — `focaveisDe()` em `UIManager.ts`
- [~] 1153 `P1` **Animação de entrada e saída das telas** — `animateScreenTransition()` em `src/ui/UIManager.ts`
- [~] 1154 `P1` **Estado vazio em toda lista** — `vazio()` em `src/ui/theme.ts`
- [~] 1155 `P1` **A tela lembra a última aba aberta por tela** — `saveActiveTab()` / `getLastActiveTab()` em `UIManager.ts`
- [ ] 1156 `P2` Tema claro, jÃ¡ que as cores estÃ£o centralizadas
- [ ] 1157 `P2` Teste de que nenhuma tela escreve `cssText` com cor literal fora do tema
- [ ] 1158 `P2` Arrastar item entre grade e hotbar
- [ ] 1159 `P2` Busca dentro do inventÃ¡rio e do crafting

---

## 44. Relato de tela do jogador â€” 26/07/2026 (o que sÃ³ se vÃª rodando)

> Esta seÃ§Ã£o Ã© a mais valiosa do documento, e o motivo estÃ¡ na ressalva do topo: **nada tinha sido
> visto numa tela**. Um print e cinco frases do jogador encontraram defeitos que 696 testes nÃ£o
> encontrariam, porque nenhum deles Ã© uma questÃ£o de lÃ³gica â€” sÃ£o de *aparÃªncia* e de *integraÃ§Ã£o
> com o mundo real* (um servidor que nÃ£o estÃ¡ rodando).
>
> Registro aqui a causa raiz de cada um **antes** de corrigir, porque a causa Ã© o que tem valor
> depois; o conserto Ã© consequÃªncia dela.

### O relato, literal

1. "online nÃ£o estÃ¡ funcionando, tentei ligar, ou criar o link e nÃ£o consegui, **nem local**"
2. "as estrelas e lua **duplicada** aparecem por dentro das Ã¡rvores, **nÃ£o tem nuvens nem sol**"
3. "o lado que nÃ£o bate luz fica **totalmente escuro**"
4. "os menus ainda estÃ£o confusos e Ã s vezes ficam **sobrepostos**, como o clique para voltar ao jogo, e **nÃ£o estÃ¡ bonito**"
5. "o fog Ã  noite **nÃ£o fica preto**"
6. "as nuvens tÃªm que ser **que nem blocos transparentes** e nÃ£o uma linha 2D"
7. "o cÃ©u estÃ¡ **estÃ¡tico**, e quando tem chuva num local **nÃ£o tem um concentrado de nuvens**, nÃ£o estÃ¡ fluido, **nem a Ã¡gua nem onda**"

### Causa raiz de cada um

| # | Sintoma | Causa encontrada no cÃ³digo |
|---|---|---|
| 2a | Estrelas e lua atravessam as Ã¡rvores | `depthTest: false` nos materiais de `sky.ts`. O motivo original era evitar recorte da cÃºpula, mas ela tem raio 900 e o plano distante da cÃ¢mera Ã© 12000 â€” **nunca houve recorte a evitar**. A opÃ§Ã£o sÃ³ criava o problema que deveria prevenir. |
| 2b | Lua **duplicada** | A fase era um segundo disco escuro sobreposto, e `desloca = (1 - iluminacao) * 62` estÃ¡ **invertido**: centra a sombra na lua CHEIA e a afasta na NOVA. O comentÃ¡rio ao lado descrevia o comportamento certo; a expressÃ£o fazia o oposto. Pior: **dois discos de mesmo raio nÃ£o formam lua gibosa** â€” nas fases entre quarto e cheia o disco escuro escapa e vira um segundo cÃ­rculo no cÃ©u. |
| 2c | NÃ£o tem sol nem nuvens | Nunca existiram. `sky.ts` sÃ³ tinha estrelas e lua. |
| 5 | NÃ©voa nÃ£o fica preta Ã  noite | `fog.color.lerp(corBiomaAtual, 0.55 * sunScale)`, e `sunScale` tem **piso noturno** (a claridade da lua). O piso impede o fator de chegar a zero, entÃ£o a cor clara do bioma (0.74, 0.80, 0.85) continua entrando Ã  meia-noite. |
| 3 | Lado sem luz fica preto | NÃ£o existe termo ambiente na cena: sÃ³ direcional (2.2) e hemisfÃ©rica (0.75). Uma face virada para longe do sol recebe `NÂ·L = 0` e fica sÃ³ com a hemisfÃ©rica, que ainda Ã© multiplicada pelo sombreado de face jÃ¡ assado no vÃ©rtice (0.68 a 0.86) e pela AO. O ACES no fim esmaga o que sobrou. |
| 1 | Online nÃ£o conecta, nem local | O `relay/server.js` **existe no repositÃ³rio e nÃ£o estava rodando** â€” e nÃ£o hÃ¡ script npm para ele. Pior: `PauseMenu` comeÃ§a com o campo de URL **vazio**, entÃ£o `signaling.configure(null)` faz `isConfigured()` ser falso e `hostRoom()` devolver `null` antes de tentar qualquer coisa. O caminho "nem local" nÃ£o existia: **nÃ£o hÃ¡ nenhum modo de conectar sem um processo servidor**, o que contradiz a premissa do projeto de rodar tudo no cliente. |
| 6 | Nuvens 2D | Primeira versÃ£o minha foi um plano com ruÃ­do no shader. Plano nÃ£o tem espessura: de cima some, de baixo Ã© decalque, e voar atÃ© ele revela uma folha de papel. Num mundo de voxel isso destoa de tudo Ã  volta. |
| 7 | CÃ©u estÃ¡tico / chuva sem nuvem / Ã¡gua sem onda | Nunca foram escritos. O clima jÃ¡ tinha `luz` e `alcanceNeblina`, mas **nada ligava chuva a nuvem** â€” o cÃ©u de tempestade era idÃªntico ao de dia limpo. |

### Entregue nesta rodada

- [~] 1161 `P0` **`depthTest` ligado no cÃ©u** â€” o mundo oculta o cÃ©u, o cÃ©u nÃ£o oculta nada
- [~] 1162 `P0` **Fase da lua por terminador elÃ­ptico no shader** â€” acaba com a lua duplicada por construÃ§Ã£o, e passa a produzir gibosa, que dois discos nÃ£o conseguem
- [~] 1163 `P0` **Sol visÃ­vel**, nÃºcleo mais halo em mistura aditiva, avermelhando rasante
- [~] 1164 `P0` **Sol e lua derivados da MESMA direÃ§Ã£o** da luz direcional â€” antes o `z` da lua nÃ£o batia com o da luz e ela nÃ£o estava exatamente oposta ao sol
- [~] 1165 `P0` **Nuvens como blocos translÃºcidos** (`InstancedMesh`), nÃ£o plano: tÃªm lado, topo e volume atravessÃ¡vel
- [~] 1166 `P1` **Grade de nuvens remontada sÃ³ na troca de Ã¢ncora**, com deslize sub-cÃ©lula â€” sem isso o vento andaria aos pulos de 12 voxels
- [~] 1167 `P0` **NÃ©voa preta Ã  noite** â€” `luzDoDia` zera de fato quando o sol se pÃµe, sem o piso da lua que mantinha a cor do bioma
- [~] 1168 `P0` **Termo ambiente na cena** (`AmbientLight`), impedindo o lado sem sol de ficar preto
- [~] 1169 `P0` **Cobertura de nuvens governada pelo clima** em `setWeather` â€” chuva e tempestade fecham o cÃ©u
- [~] 1170 `P0` **Multijogador local sem servidor nenhum**, via `BroadcastChannel` entre abas do mesmo navegador
- [~] 1171 `P0` **Script `npm run relay` e URL padrÃ£o `ws://localhost:8787`** no campo do menu
- [~] 1172 `P0` **Mensagens de erro do online com diagnÃ³stico** e instruÃ§Ãµes claras no UI
- [~] 1173 `P1` **SinalizaÃ§Ã£o manual por colar/copiar token** (offer/answer), para jogar pela internet sem relay
- [~] 1174 `P1` **Onda na Ã¡gua** â€” deslocamento senoidal duplo de vÃ©rtices no shader + uniform `uOndaTempo`
- [~] 1175 `P1` **CÃ©u com movimento perceptÃ­vel mesmo parado** â€” deriva do vento contÃ­nua no tempo
- [~] 1176 `P1` **Nuvem escurece quando chove** â€” interpolaÃ§Ã£o para tom cinza de tempestade
- [~] 1178 `P2` **Teste de compilaÃ§Ã£o dos shaders GLSL** em `tests/unit/glslShaderCompilation.test.ts`

### Pendente â€” o resto do relato

- [ ] 1177 `P2` Sombra das nuvens no chÃ£o, se der para fazer sem custar o mapa de sombras

> **LiÃ§Ã£o, a mesma de sempre neste documento e agora com um custo real:** o teste prova que o
> cÃ³digo roda, nÃ£o que o resultado estÃ¡ certo. `depthTest: false` roda perfeitamente. A fase
> invertida da lua roda perfeitamente. O relay que nÃ£o estÃ¡ de pÃ© Ã© um `if` que devolve `null`
> exatamente como escrito. Nenhum deles quebra nada â€” todos os trÃªs sÃ³ ficam **errados na tela**.

---

## 45. Especialista em UI/UX Gaming Architecture â€” Hub Unificado com NavegaÃ§Ã£o por Abas (itens 1179â€“1195)

*Parecer: A arquitetura de interface unificada resolve de forma definitiva a fragmentaÃ§Ã£o da UI. Em vez de janelas flutuantes desconectadas ou modais sobrepostos que disputam foco e bloqueiam cliques, o jogo adota uma **estrutura de trÃªs camadas fixas**: Barra Superior de Abas (Top Tab Bar), ConteÃºdo Central DinÃ¢mico (Dynamic Center Container) e Barra de Atalhos no RodapÃ© (Bottom Bar). O Menu Inicial passa a rodar sobre um Diorama 3D em tempo real, enquanto o Menu In-Game aplica blur atmosfÃ©rico sobre a cena pausada.*

- [~] 1179 `P0` **Layout Unificado de TrÃªs Camadas**: Top Bar (navegaÃ§Ã£o) + Dynamic Center (conteÃºdo) + Bottom Bar (atalhos)
- [~] 1180 `P0` **Menu Inicial com Diorama 3D em Tempo Real (Live Preview)** rodando na engine do jogo em background
- [~] 1181 `P0` **NavegaÃ§Ã£o no Menu Inicial via Abas Superiores**: Jogar, Carregar Mundo, OpÃ§Ãµes, Sair deslizando sobre o Diorama 3D
- [~] 1182 `P0` **Menu In-Game (Hub de Pausa) Unificado**: Abas [InventÃ¡rio] | [Habilidades] | [MissÃµes] | [Mapa] | [OpÃ§Ãµes] | [Sistema/Sair]
- [~] 1183 `P0` **Efeito Visual de Fundo no Hub In-Game**: `backdrop-filter: blur(12px)` + escurecimento suave (75% opacity) com o jogo pausado visÃ­vel atrÃ¡s
- [~] 1184 `P0` **AlternÃ¢ncia RÃ¡pida de Abas via Teclado e Gamepad**: Atalhos `Q` / `E` e bumpers `L1` / `R1` (`LB` / `RB`) para deslizar entre abas superiores
- [~] 1185 `P1` **RodapÃ© Fixo com Atalhos Contextuais**: ExibiÃ§Ã£o dos botÃµes permitidos (`[Esc] Voltar`, `[Q/E] Trocar Aba`, `[EspaÃ§o] Selecionar`)
- [~] 1186 `P1` **AnimaÃ§Ãµes de TransiÃ§Ã£o Fluidas**: Slide horizontal suave + Fade cross-dissolve (`150ms ease-out`), respeitando `prefers-reduced-motion`
- [~] 1187 `P1` **Aba [InventÃ¡rio]**: Layout 2 colunas com grade de blocos/crafting (esquerda) + diorama do personagem e status (direita)
- [ ] 1188 `P1` **Aba [Habilidades]**: Ã�rvore visual de habilidades/melhorias com painel de descriÃ§Ã£o e custo
- [~] 1189 `P1` **Aba [MissÃµes]**: o diÃ¡rio estÃ¡ feito (aba "Objetivos" no hub, itens 007/1305). **Falta** o marcador no mapa â€” e ele depende de objetivos com lugar no mundo, que a corrente atual nÃ£o tem
- [ ] 1190 `P1` **Aba [Mapa]**: Cartografia expandida do mundo com waypoints, biomas e coordenadas XYZ
- [ ] 1191 `P1` **Aba [OpÃ§Ãµes]**: ConfiguraÃ§Ãµes de VÃ­deo, Ã�udio, Controles e IA com aplicaÃ§Ã£o instantÃ¢nea
- [~] 1192 `P1` **Aba [Sistema/Sair]** — Gestão de save, sessão multiplayer e confirmação de saída em `PauseMenu.ts`
- [ ] 1193 `P2` **Armadilha de Foco e Acessibilidade (Focus Trap)**: Garantir foco navegÃ¡vel via teclado/gamepad dentro do container ativo
- [ ] 1194 `P2` **PersistÃªncia da Ãšltima Aba Aberta**: O Hub lembra a Ãºltima aba consultada durante a sessÃ£o de jogo
- [ ] 1195 `P2` **Testes Automatizados de NavegaÃ§Ã£o por Abas**: ValidaÃ§Ã£o da troca de abas via Q/E e isolamento de conteÃºdo em `tabsNavigation.test.ts`

---

## 46. Segunda rodada do relato â€” 26/07/2026 (o padrÃ£o se repetiu duas vezes)

> **CorreÃ§Ã£o de integridade deste documento.** Numerei esta seÃ§Ã£o sem conferir o maior nÃºmero jÃ¡
> usado e colidi com a seÃ§Ã£o 45: treze itens ficaram duplicados (1147, 1149, 1170, 1172, 1173 e
> 1179â€“1185, 1187â€“1192). Renumerei os meus para 1196â€“1208 e transformei em prosa as cinco linhas
> que eram sÃ³ releitura de itens jÃ¡ numerados. A contagem do cabeÃ§alho estava inflada por isso.

> Esta rodada encontrou **mais dois casos do mesmo defeito estrutural** que a seÃ§Ã£o 44 jÃ¡
> documentava, elevando a contagem de cinco para sete. Vale registrar porque o padrÃ£o agora Ã©
> inegÃ¡vel: neste repositÃ³rio, o modo dominante de falha **nÃ£o Ã© cÃ³digo errado â€” Ã© cÃ³digo certo
> que ninguÃ©m invoca**.

| # | O que estava escrito, correto e testado | O que faltava |
|---|---|---|
| 6 | O shader da onda da Ã¡gua, com as duas senoides e o uniform de tempo | `createScene` chamava `applyCurvature(waterMaterial)` **sem o segundo argumento**, entÃ£o o ramo `ehAgua` era sempre falso. A Ã¡gua nunca ondulou. |
| 7 | A tabela `CAMADA` em `theme.ts`, com o comentÃ¡rio *"concentradas aqui para nÃ£o haver disputa de z-index entre telas"* | **Sete das nove telas a ignoravam** e escreviam `z-index` literal. |

### A causa de "Ã s vezes os menus ficam sobrepostos"

A palavra que resolve o relato Ã© **"Ã s vezes"**. Quando dois elementos empatam no `z-index`, o
desempate Ã© a ordem no DOM â€” que depende de qual tela foi construÃ­da primeiro. **Um bug que muda
de comportamento sem o cÃ³digo mudar Ã© quase sempre um empate em algum lugar.**

Duas causas, e a segunda Ã© a grave:

1. **Empate.** HUD (aviso), `InventoryModal` e `ChatOverlay` estavam os trÃªs em `z-index: 100`.
2. **Ordem invertida.** As telas **bloqueantes** estavam em 60â€“63 e o chat, que Ã© **flutuante**,
   em 90â€“100. O chat desenhava por cima da pÃ¡gina de mods â€” a tela que deveria estar bloqueando
   tudo era a que ficava por baixo.

### Entregue

- [~] 1196 `P0` **Onda da Ã¡gua ligada** â€” `applyCurvature(waterMaterial, true)`, e tambÃ©m na Ã¡gua em apariÃ§Ã£o, senÃ£o o lago pararia de ondular durante os 0,6 s do surgimento do chunk
- [~] 1197 `P0` **TrÃªs testes de fiaÃ§Ã£o da onda**, que leem o cÃ³digo fonte de `scene.ts`. Textuais, com a fragilidade que isso implica, e ainda assim vÃ¡lidos: falham exatamente no acidente ocorrido. O ideal seria instanciar `createScene`, mas ela constrÃ³i um `WebGLRenderer` e jsdom nÃ£o tem GPU.
- [~] 1198 `P0` **Todo `z-index` passou a sair de `CAMADA`** â€” nenhum literal em `src/`
- [~] 1199 `P0` **Regra codificada: bloqueante sempre acima de flutuante**
- [~] 1200 `P1` **Teste que varre `src/ui/` e `main.ts` e reprova `z-index` literal** â€” a tabela existir nunca impediu ninguÃ©m de ignorÃ¡-la (item 1157, antecipado)
- [~] 1201 `P1` **Camadas para toast e para a dica de retomada**, que antes eram nÃºmeros soltos
- [~] 1202 `P1` **Uma branch sÃ³.** `main` recebeu os 39 commits de `feat/mods-fluidos-personagem`; a branch de trabalho e a `claude/game-system-ai-mods-3f30f7` (worktree Ã³rfÃ£) foram removidas local e remotamente, depois de conferido que nenhuma tinha commit exclusivo.

### O que jÃ¡ veio pronto do seu lado

Ao retomar, encontrei no `SignalingClient` e no `PeerSync` o que a seÃ§Ã£o 44 listava como pendente
em multijogador: **`BroadcastChannel`** para abas do mesmo navegador (o caminho 100% cliente),
sinalizaÃ§Ã£o **manual por token** e o seletor de modo no `PauseMenu`. Isso cobre 1170, 1172 e 1173.

Estes jÃ¡ estavam numerados nas seÃ§Ãµes anteriores e foram apenas **reconferidos** aqui, nÃ£o recriados: 1147 e 1149 (telas no componente `Tabs`), 1170, 1172 e 1173 (multijogador local, mensagens de erro e sinalizaÃ§Ã£o manual).

### Pendente

- [x] 1203 `P1` ~~Layout do inventÃ¡rio em duas colunas~~ â€” **duplicata de 1150**, que jÃ¡ estava feito. Conferido em `InventoryModal.ts` ("Layout em 2 Colunas", com Stats & Equipamento na direita)
- [x] 1204 `P1` ~~`npm run relay` e URL padrÃ£o~~ â€” **auditado e jÃ¡ feito**: o script existe em `package.json` e o campo abre com `ws://localhost:8787`. Eu tinha escrito "1171 segue aberto" sem conferir.
- [ ] 1205 `P1` Sombra das nuvens no chÃ£o
- [~] 1206 `P2` **A metade verificÃ¡vel foi feita** (seÃ§Ã£o 64): os marcadores de injeÃ§Ã£o sÃ£o conferidos contra o `ShaderLib` real do three.js, e cada injeÃ§Ã£o precisa provar que chegou ao shader. Compilar de verdade continua exigindo WebGL headless, que jsdom nÃ£o tem â€” segue aberto, e agora com escopo menor

### Rodada seguinte â€” a aba que o jogador perdia

Ao migrar as telas encontrei que **vocÃª jÃ¡ tinha migrado as duas**: `InventoryModal` e `ModsPage`
usam o componente `Tabs`. Os itens 1147 e 1149 estavam feitos. O que sobrou foi um defeito
adjacente, e Ã© de novo um que sÃ³ aparece usando:

`renderDetalhe` da `ModsPage` constrÃ³i um `Tabs` **novo a cada chamada**, e `render()` Ã© chamado
por sete aÃ§Ãµes diferentes â€” ligar um mod, apagar, recarregar, trocar de mod. Como a escolha de aba
morava dentro do componente, cada uma dessas aÃ§Ãµes jogava o jogador de volta na primeira aba: ele
abria "VersÃµes", clicava em qualquer coisa e estava em "Geral" de novo.

Manter um `Tabs` vivo e sÃ³ trocar o conteÃºdo seria pior â€” os painÃ©is guardam estado do mod
anterior, e a montagem preguiÃ§osa passaria a mostrar dados de outro mod atÃ© a aba ser reativada.
A escolha mora fora do componente, e um id desconhecido cai na primeira aba em vez de deixar a
tela em branco.

Estes jÃ¡ estavam numerados nas seÃ§Ãµes anteriores e foram apenas **reconferidos** aqui, nÃ£o recriados: 1147 e 1149 (telas no componente `Tabs`), 1170, 1172 e 1173 (multijogador local, mensagens de erro e sinalizaÃ§Ã£o manual).
- [~] 1207 `P1` **A tela de mods lembra a aba aberta** entre redesenhos (item 1155, para esta tela)
- [~] 1208 `P1` **TrÃªs testes da memÃ³ria de aba**, inclusive o caso de uma aba gravada que nÃ£o existe mais numa versÃ£o nova

### O console do jogo, lido em 26/07/2026 â€” o mundo lixo

VocÃª colou o log do navegador, e ele entregou um defeito que nenhum teste pegaria:

```
Carregando mundo ID: "guest-ws://localhost:8787"
Mundo "Visitante de ws://localhost:8787" carregado do zero com sucesso!
```

**A URL do relay virou o id de uma sala.** A causa era uma linha em `main.ts`:
`url.searchParams.get('join') || link`. O `|| link` faz **qualquer texto virar id de sala**.

E havia um segundo defeito, de ordem, empilhado no primeiro: `handleJoinLink` criava o mundo de
visitante, **salvava no banco** e iniciava o jogo â€” para sÃ³ entÃ£o tentar conectar. Cada tentativa
frustrada deixava um mundo vazio permanente na lista, e o jogador caÃ­a dentro dele em vez de ler
uma mensagem de erro.

O terceiro: o botÃ£o "Conectar" do menu chamava `this.close()` **antes** de tentar. Quando falhava,
a tela que deveria contar o porquÃª jÃ¡ nÃ£o existia.

- [~] 1209 `P0` **`idDeSala` recusa o que nÃ£o Ã© convite** â€” endereÃ§o sem `?join=`, frase colada, id curto. Em mÃ³dulo prÃ³prio (`src/net/convite.ts`), porque virou validaÃ§Ã£o de verdade e uma funÃ§Ã£o dentro de `bootstrap()` nÃ£o se testa sem subir o jogo
- [~] 1210 `P0` **Conectar primeiro, criar o mundo depois** â€” tentativa falha nÃ£o deixa rastro
- [~] 1211 `P0` **O menu sÃ³ fecha quando a conexÃ£o abre**, e a falha aparece embaixo do campo
- [~] 1212 `P1` **`relayDeLink` nÃ£o decodifica duas vezes** â€” corromperia um relay com `%` legÃ­timo
- [~] 1213 `P1` **11 testes de convite**, incluindo o caso exato do log
- [~] 1214 `P1` **Armadilha de foco** no `UIManager`: o Tab nÃ£o escapa da tela aberta, painÃ©is de aba escondidos ficam fora da ordem, e o foco volta ao lugar quando a tela fecha
- [~] 1215 `P1` **13 testes de foco e navegaÃ§Ã£o por abas** (item 1195)
- [x] 1216 `P1` ~~Hub lembra a Ãºltima aba~~ (1194) â€” **auditado**: `PauseMenu` guarda o `Tabs` num campo e `iniciar()` sem argumento jÃ¡ reusa a aba ativa. Coberto por teste em vez de reescrito
- [~] 1217 `P2` **DepreciaÃ§Ãµes do three.js**: `Clock` â†’ `Timer`, `PCFSoftShadowMap` â†’ `PCFShadowMap` (o three.js jÃ¡ rebaixava sozinho e avisava a cada abertura)

> **O que o log ensinou.** TrÃªs defeitos numa Ãºnica funcionalidade, e os trÃªs invisÃ­veis para a
> suÃ­te: um de validaÃ§Ã£o ausente, um de **ordem** de operaÃ§Ãµes, um de ciclo de vida de tela.
> Nenhum Ã© lÃ³gica errada â€” sÃ£o todos "a coisa certa na hora errada". Vale mais um log de console
> real do que uma rodada inteira de auditoria de cÃ³digo.

### Oitavo caso, e o teste que devia existir desde o primeiro

`WorldRepository.deleteWorld` estava lÃ¡: completa, transacional em nove tabelas (mundo, blocos,
chat, threads, jogadores, customizaÃ§Ãµes, mods, entidades e revisÃµes). **Nada a chamava.** NÃ£o
havia como apagar um mundo dentro do jogo â€” que Ã© como os "Visitante de ws://localhost:8787" das
tentativas frustradas viraram lixo permanente na lista.

Isso encerra a lista dos oito, e deixa clara a natureza do problema:

| # | Funcionalidade | O que faltava |
|---|---|---|
| 1 | `setViewRange` | `scene.fog` era `null`, o `if` falhava em silÃªncio |
| 2 | `applyCurvature` | o shader existia com `invR = 0` |
| 3 | `UndoManager.recordBatch` | nenhuma ediÃ§Ã£o o chamava |
| 4 | EstaÃ§Ãµes | mudavam o clima e o F3, e nada no mundo |
| 5 | Biomas | o worldgen usava limiares paralelos prÃ³prios |
| 6 | Onda da Ã¡gua | `applyCurvature(waterMaterial)` sem o segundo argumento |
| 7 | Tabela `CAMADA` | sete das nove telas escreviam `z-index` literal |
| 8 | `deleteWorld` | nÃ£o havia botÃ£o |

**Os oito tinham todos os testes passando.** Uma funÃ§Ã£o nunca chamada nÃ£o quebra nada; ela
simplesmente nÃ£o acontece. Teste de unidade prova que a funÃ§Ã£o funciona â€” nenhum pergunta se
alguÃ©m a usa.

- [~] 1218 `P0` **BotÃ£o de apagar mundo**, com confirmaÃ§Ã£o em dois estados no prÃ³prio botÃ£o. Um `confirm()` do navegador Ã© fÃ¡cil de despachar no automÃ¡tico e, pior, alguns navegadores o bloqueiam â€” o mundo sumiria sem pergunta nenhuma
- [~] 1219 `P1` **A lista de mundos se atualiza ao voltar para a aba** (`aoAtivar`), com `montar` e `aoAtivar` de papÃ©is separados: se os dois desenhassem, na primeira ativaÃ§Ã£o os dois rodariam e a lista sairia duplicada â€” a mesma corrida do `renderBody`
- [~] 1220 `P0` **`tests/unit/fiacao.test.ts`** â€” guarda os oito casos de uma vez, procurando um chamador fora do arquivo que define. Textual, com a fragilidade que isso implica; a ferramenta ideal seria cobertura de integraÃ§Ã£o com o jogo rodando, e isso exige WebGL que o jsdom nÃ£o tem
- [~] 1221 `P2` **O varredor testa a si mesmo**: um teste que varresse zero arquivos passaria vazio e daria falsa seguranÃ§a

## 47. O avatar enterrado â€” 26/07/2026

VocÃª mandou uma referÃªncia de arte voxel e trÃªs frases: *"o jogador tem de 4-5 bloquinhos de
altura, a skin tÃ¡ ficando dentro da terra, e nÃ£o respeitando as proporÃ§Ãµes"*. Eram **dois
defeitos distintos**, e o segundo Ã© dos mais instrutivos que apareceram aqui.

### 1. O balanÃ§o da marcha era dono da posiÃ§Ã£o de mundo

`main.ts` escrevia a posiÃ§Ã£o do jogador em `playerModel.group.position`. A linha seguinte â€”
`playerModel.update(...)` â€” terminava com:

```ts
this.group.position.y = moving ? Math.abs(Math.sin(this.walkCycle * 2)) * 0.02 : 0;
```

O balanÃ§o **descartava** o `y` que o `main` tinha acabado de escrever, plantando o avatar em
`y = 0` do mundo. Literalmente "a skin ficando dentro da terra": o boneco enterrado na origem
vertical, e nÃ£o nos pÃ©s do jogador. **Dois donos para a mesma propriedade.** O conserto Ã©
estrutural â€” um grupo interno (`corpo`) carrega o balanÃ§o, e `group` fica sÃ³ com a transformaÃ§Ã£o
de mundo. NÃ£o existe mais caminho para um sobrescrever o outro.

### 2. Duas rÃ©guas, e nenhuma ponte entre elas

A fÃ­sica conta em mini-voxels: `HEIGHT = 5.3` em `controller.ts`. O modelo era construÃ­do em
metros: `PLAYER_HEIGHT = 1.8` em `Appearance.ts`. **Nada convertia entre os dois.** O avatar saÃ­a
com um terÃ§o do tamanho do prÃ³prio corpo de colisÃ£o.

Este Ã© o tipo de defeito que nenhum teste unitÃ¡rio encontra, e vale entender por quÃª: **os dois
nÃºmeros estavam certos**, cada um na sua rÃ©gua. NÃ£o havia nada a reprovar em `5.3`, nem em `1.8`.
O erro morava no espaÃ§o entre os dois arquivos, que Ã© exatamente onde nÃ£o hÃ¡ teste.

- [~] 1222 `P0` **Grupo `corpo` interno** â€” o balanÃ§o deixa de sobrescrever a posiÃ§Ã£o de mundo
- [~] 1223 `P0` **`ESCALA_MODELO`** liga as duas rÃ©guas; `ALTURA_MUNDO` passa a ser a fonte Ãºnica
- [~] 1224 `P0` **ProporÃ§Ãµes da referÃªncia**: cabeÃ§a grande (29%), torso curto, ombros mais estreitos que a cabeÃ§a, braÃ§os e pernas finos
- [~] 1225 `P0` **PivÃ´s derivados das proporÃ§Ãµes** â€” eram cravados (1,34 / 0,80 / 1,40) e casavam com uma versÃ£o antiga. Mudar uma altura girava o braÃ§o em torno de um ponto que nÃ£o era mais o ombro
- [~] 1226 `P1` **Plaquinha de nome e cÃ¢mera do preview derivadas de `ALTURA_MUNDO`** â€” as duas estavam calibradas para 1,8; a cÃ¢mera do criador ficaria dentro do joelho do boneco
- [~] 1227 `P1` **8 testes de ancoragem e proporÃ§Ã£o**: o balanÃ§o nÃ£o toca na posiÃ§Ã£o de mundo, o balanÃ§o continua existindo (a correÃ§Ã£o nÃ£o pode ser desligar o efeito), os pÃ©s ficam em `y=0`, o corpo tem a altura da colisÃ£o, as proporÃ§Ãµes somam a altura, e as articulaÃ§Ãµes caem onde o corpo muda de peÃ§a
- [~] 1228 `P2` **Acessor `pecas`** para teste e acessÃ³rios, em vez de acoplamento a `group.children`

> **O que este caso ensina, e Ã© diferente dos oito anteriores.** Aqueles eram cÃ³digo que ninguÃ©m
> chamava. Estes dois sÃ£o cÃ³digo chamado, correto e **em conflito com outro cÃ³digo igualmente
> correto**. Um teste por arquivo nÃ£o os encontra: sÃ³ encontra quem olha para a costura. O teste
> que agora existe mede o avatar *no mundo* â€” caixa envolvente contra a altura da colisÃ£o â€” em vez
> de conferir nÃºmeros dentro de um arquivo sÃ³.

## 48. "O mundo nÃ£o Ã© o mesmo no multiplayer" â€” 26/07/2026

A causa era total, nÃ£o sutil. O mundo do convidado era criado assim:

```ts
seed: Math.floor(Math.random() * 1000000),
```

**Uma semente aleatÃ³ria.** O terreno inteiro Ã© gerado a partir dela â€” relevo, biomas, cavernas,
minÃ©rios, Ã¡rvores. Cada jogador via um mundo completamente diferente.

### Por que o `full_sync` nÃ£o salvava

Porque ele carrega apenas o que foi **editado Ã  mÃ£o**: `blockMods`, jogadores e mods. Sobre um
terreno gerado de outra semente, essas ediÃ§Ãµes caem no vazio â€” uma casa construÃ­da num morro do
anfitriÃ£o aparece flutuando, ou enterrada, no mundo do convidado. Pior que nada: dÃ¡ a impressÃ£o
de que a sincronizaÃ§Ã£o "quase funciona".

E a semente nÃ£o podia simplesmente entrar no `full_sync`: quando ele chega, o convidado **jÃ¡
gerou terreno**. A informaÃ§Ã£o chegaria tarde.

### A correÃ§Ã£o

Uma mensagem nova, `world_info`, Ã© a **primeira** coisa que o anfitriÃ£o envia a quem conecta â€” Ã 
frente do `full_sync` e do relÃ³gio. Ela leva semente, altura base e nome. E o convidado **espera
por ela antes de criar o mundo**, em vez de gerar o errado e tentar corrigir depois.

O tratamento dela fica **fora** do `switch` do tratador de mensagens, e isso Ã© deliberado: ela
chega antes de o jogo existir, num instante em que nÃ£o hÃ¡ `world`, nem HUD, nem chat. Qualquer
outro ramo do tratador tocaria em algo ainda nÃ£o construÃ­do.

- [~] 1229 `P0` **`WorldInfoMsg`** no protocolo: semente, altura base e nome do mundo do anfitriÃ£o
- [~] 1230 `P0` **O convidado adota a semente do anfitriÃ£o** â€” os dois geram exatamente o mesmo terreno
- [~] 1231 `P0` **A espera acontece antes de criar o mundo**, nÃ£o depois
- [~] 1232 `P1` **Prazo de 8 s na espera**, com mensagem clara: um anfitriÃ£o de versÃ£o antiga nÃ£o conhece `world_info` e travaria a entrada para sempre
- [~] 1233 `P1` **O id do mundo de visitante inclui a semente** â€” entrar em dois mundos diferentes do mesmo anfitriÃ£o nÃ£o pode reaproveitar o cache de blocos de um no outro
- [~] 1234 `P1` **O convidado herda o NOME do mundo**, em vez de "Visitante de room-xyz"
- [~] 1235 `P1` **4 testes**, incluindo um que reprova a volta de `Math.random()` na semente do convidado e um que verifica a **ordem** (esperar antes de criar)

> **Por que nenhum teste pegou.** A sincronizaÃ§Ã£o de blocos tinha testes, e passavam: ela de fato
> transmite os blocos corretamente. O que faltava era uma camada acima â€” a pergunta "os dois
> jogadores estÃ£o no mesmo mundo?" nunca tinha sido feita. Testar bem a parte nÃ£o diz nada sobre
> o todo quando a peÃ§a que falta Ã© a que liga as partes.

## 49. Auditoria de prioridade â€” 26/07/2026

VocÃª pediu para eu olhar o que o prÃ³prio documento chama de prioridade. Contagem dos pendentes:
**41 `P0`**, 219 `P1`, 384 `P2`, 35 `P3`.

O maior agrupamento de `P0` nÃ£o Ã© jogabilidade nem interface: sÃ£o **doze itens de seguranÃ§a do
sandbox de mods** (358, 359, 735, 736, 761â€“768, 775). Fui verificar a afirmaÃ§Ã£o em vez de repetir
o documento, e ela estava certa â€” o comentÃ¡rio no cÃ³digo Ã© que estava errado:

```ts
// `new Function` com um Ãºnico parÃ¢metro: o corpo nÃ£o recebe `window` nem `globalThis`
const fn = new Function('api', `"use strict";\n${script.code}`);
```

`new Function` isola o corpo do escopo **local** de quem o cria. Nada mais. O cÃ³digo continua
sendo avaliado no escopo **global**, onde `window`, `fetch`, `document`, `localStorage` e
`indexedDB` sÃ£o variÃ¡veis livres perfeitamente alcanÃ§Ã¡veis. NÃ£o passar como argumento nÃ£o esconde
coisa alguma.

Isso pesa mais aqui que na mÃ©dia: os scripts sÃ£o **escritos por uma IA** a pedido do jogador e
rodam no navegador dele, na **mesma origem** onde estÃ£o os mundos salvos e o cofre de chaves de
API. Um script com `fetch` manda qualquer um dos dois para qualquer lugar.

### O que foi feito, e o que explicitamente NÃƒO foi

Os nomes perigosos passaram a ser **sombreados**: entram como parÃ¢metros da funÃ§Ã£o com valor
`undefined`, e como parÃ¢metro Ã© ligaÃ§Ã£o lÃ©xica, `fetch` dentro do corpo resolve para o parÃ¢metro.

**Isto nÃ£o Ã© uma fronteira de seguranÃ§a contra cÃ³digo hostil**, e o teste diz isso em voz alta:
hÃ¡ um caso que **verifica a brecha existir** â€” `[].constructor.constructor('return this')()`
ainda escapa, porque a funÃ§Ã£o criada por `Function` tambÃ©m Ã© avaliada no escopo global. Ele passa
quando a fuga funciona, de propÃ³sito, para ninguÃ©m ler os outros nove e concluir demais.

`eval` nÃ£o estÃ¡ na lista de sombreados e nÃ£o Ã© esquecimento: em modo estrito ele Ã© proibido como
nome de ligaÃ§Ã£o, entÃ£o `new Function('eval', â€¦)` Ã© um `SyntaxError`. Ã‰ mais uma razÃ£o para a
fronteira real ser outro reino de execuÃ§Ã£o.

- [~] 1236 `P0` **`src/mods/sandbox.ts`**: escopo global sombreado, com o critÃ©rio documentado (bloqueia rede, armazenamento, documento e caminhos de volta ao global; preserva `Math`, `JSON`, `Date`, `Promise` â€” sem eles a plataforma de mods nÃ£o serve para nada)
- [~] 1237 `P0` **10 testes de sandbox**, sendo um que confirma a brecha restante em vez de escondÃª-la
- [~] 1238 `P1` **O comentÃ¡rio mentiroso do `ModRuntime` foi corrigido** â€” ele afirmava a proteÃ§Ã£o que nÃ£o existia, que Ã© pior que nÃ£o comentar nada

### Continua pendente, e agora com o tamanho certo

- [~] 1239 `P0` **Feito com o 358.** A fuga pelo construtor continua funcionando e passou a devolver o global do Worker â€” que estÃ¡ vazio
- [~] 1240 `P0` ~~Item 382~~ **FEITO nesta rodada** â€” item 382 (**sincronizar entidades**) â€” em aberto e confirmado no cÃ³digo: o convidado roda o prÃ³prio `MobSpawner` sem checar o papel, e `EntityUpdateMsg` estÃ¡ **definida no protocolo e nunca enviada nem recebida**. Ã‰ o nono caso de cÃ³digo dormente, e a continuaÃ§Ã£o direta do "o mundo nÃ£o Ã© o mesmo no multiplayer"

## 50. As criaturas â€” a segunda metade de "o mundo nÃ£o Ã© o mesmo"

A semente resolveu o terreno. Faltava o que se mexe em cima dele: **o convidado rodava o prÃ³prio
`MobSpawner`, sem checar o papel**. Cada lado criava as suas criaturas, em lugares diferentes, e
simulava as mesmas de forma independente.

**Duas simulaÃ§Ãµes autÃ´nomas do mesmo objeto nunca convergem.** NÃ£o Ã© imprecisÃ£o que uma correÃ§Ã£o
periÃ³dica conserta â€” Ã© falta de autoridade. SÃ³ um lado pode decidir.

### O nono caso de cÃ³digo dormente

`EntityUpdateMsg` (`id, x, y, z`) estava no protocolo, na uniÃ£o de tipos, e **nunca era enviada
nem recebida**. Nenhuma referÃªncia em `main.ts`.

E ela nÃ£o bastaria. Com sÃ³ posiÃ§Ãµes, o convidado nunca sabe que uma criatura **nasceu** â€” nÃ£o vem
o tipo â€” nem que **morreu**: a ausÃªncia nÃ£o Ã© um evento, nÃ£o chega mensagem nenhuma. Um zumbi
morto pelo anfitriÃ£o ficaria parado para sempre na tela do convidado.

### Retrato, e nÃ£o evento por criatura

`MobSyncMsg` leva a lista inteira, seis vezes por segundo. Uma regra sÃ³ resolve os trÃªs casos:
**o que estÃ¡ na lista existe, o que nÃ£o estÃ¡ deixou de existir.** E Ã© auto-corretivo â€” uma
mensagem perdida some no retrato seguinte, em vez de deixar estado divergente preso para sempre.

O custo Ã© mandar tudo sempre; com dezenas de criaturas e seis envios por segundo, Ã© irrelevante
perto da robustez que compra.

- [~] 1241 `P0` **`entitySystem.autoridade`** â€” com `false`, a IA hostil nÃ£o roda: o convidado desenha onde o anfitriÃ£o disser, e nada mais
- [~] 1242 `P0` **O convidado nÃ£o gera criaturas** (`mobSpawner.enabled` passou a checar o papel)
- [~] 1243 `P0` **`MobSyncMsg`**: retrato a 6 Hz, nÃ£o por quadro â€” criatura anda devagar, e 60 Hz seria dez vezes a banda para nenhum ganho visÃ­vel
- [~] 1244 `P0` **`aplicarRetratoDeHostis`** com mapa id-do-anfitriÃ£o â†’ id local. Sem ele cada mensagem criaria criaturas novas, e em segundos haveria centenas
- [~] 1245 `P1` **`mobKind` guardado no registro** â€” o perfil sozinho nÃ£o identifica a espÃ©cie de volta, e sem isso o convidado desenharia todo mundo como zumbi
- [~] 1246 `P1` **10 testes**, incluindo um que prova que a IA **continua funcionando** no anfitriÃ£o: sem ele, "consertar" seria trivial e inÃºtil â€” bastaria nunca mover ninguÃ©m

> **O padrÃ£o dos dois relatos de multijogador.** Em ambos, a parte tinha teste e passava. O que
> faltava era a pergunta de cima: *"os dois jogadores estÃ£o vendo a mesma coisa?"*. Testar bem
> cada peÃ§a nÃ£o diz nada sobre o todo quando o que falta Ã© a peÃ§a que liga as peÃ§as.

## 51. Sandbox: de lista de negados para lista de permitidos â€” e o tamanho real do item 358

A primeira versÃ£o sombreava os nomes perigosos passando-os como parÃ¢metros `undefined`. Funciona,
e tem o defeito de toda lista de negados: **o que eu esquecer, ou o que o navegador ganhar depois,
entra livre**.

Agora o corpo do script roda dentro de um `with` sobre um `Proxy` cujo `has` responde **sempre que
sim**. Dentro de um `with`, o motor pergunta ao objeto se ele tem cada nome livre *antes* de
procurar no escopo externo â€” respondendo sempre que sim, nenhuma busca chega ao global, e o `get`
decide nome a nome. Vira lista de **permitidos**: sÃ³ cÃ¡lculo puro passa.

TrÃªs detalhes que o teste fixou:

- **`with` Ã© proibido em modo estrito**, entÃ£o o invÃ³lucro Ã© permissivo. O corpo do script,
  dentro dele, Ã© estrito â€” e precisa ser: em modo permissivo `(function(){return this})()`
  devolve o objeto global, a rota de fuga mais curta que existe.
- Sem o estrito externo, `vazando = 1` criaria um global de verdade. O `set` do Proxy recusa.
- `Symbol.unscopables` precisa devolver `undefined`, senÃ£o o motor o interpreta como uma lista de
  nomes a ignorar e o `with` deixa de capturar tudo.

- [~] 1247 `P0` **Escopo por lista de permitidos** (`with` + `Proxy`), no lugar da lista de negados
- [~] 1248 `P0` **Corpo em modo estrito dentro do invÃ³lucro permissivo** â€” fecha a fuga pelo `this`
- [~] 1249 `P1` **A lista de perigosos virou teste executÃ¡vel**: cada nome dela Ã© rodado dentro do sandbox e precisa sair `undefined`. Antes o teste sÃ³ verificava que a lista *continha* o nome â€” provava que alguÃ©m o escreveu, nÃ£o que estava bloqueado
- [~] 1250 `P1` **Teste com nomes inventados** (`WebTransport`, `apiQueAindaNaoExiste`) provando o bloqueio por omissÃ£o

### O tamanho real do item 358, medido

Fui implementar o Worker e parei para medir. **O obstÃ¡culo nÃ£o Ã© o Worker â€” Ã© a API.**

`buildModAPI` Ã© **sÃ­ncrona e de leitura**: `world.getBlock(x,y,z)` devolve o bloco na hora,
`world.findNearest` varre e retorna, `player.position()` responde imediatamente. Um Worker sÃ³
conversa por `postMessage`, que Ã© assÃ­ncrono. Levar o script para lÃ¡ obriga **toda** a API a
virar `await`, e isso reescreve o modelo de programaÃ§Ã£o de todo mod jÃ¡ criado.

NÃ£o Ã© trabalho de uma passada, e fingir que Ã© seria pior que deixar pendente. O que fica
registrado, para quem for fazer:

- [~] 1251 `P0` **Corpo e handlers de mod agora sÃ£o `async`** â€” o `await` jÃ¡ Ã© vÃ¡lido hoje, com a API sÃ­ncrona, e continua valendo quando a leitura virar mensagem. Ver a seÃ§Ã£o 66
- [~] 1252 `P0` **NÃ£o hÃ¡ o que migrar** â€” os dois formatos sÃ£o vÃ¡lidos ao mesmo tempo, e a referÃªncia que o agente lÃª passou a ensinar o formato novo, com exemplo
- [~] 1253 `P1` **ExecuÃ§Ã£o movida para o Worker**, com os globais apagados no topo do mÃ³dulo

## 52. O caminho de saÃ­da de um segredo nÃ£o Ã© a rede â€” Ã© o texto

`api.env.get('API_KEY')` devolve a chave de verdade ao script, e isso estÃ¡ **certo**: ele roda no
mesmo cliente, com os mesmos privilÃ©gios do jogo. Um mod que precisa da chave para chamar uma API
precisa da chave. Esconder dele seria teatro.

A fronteira real Ã© o valor **nÃ£o sair da mÃ¡quina**. E o caminho mais fÃ¡cil de saÃ­da nÃ£o Ã© o
`fetch` â€” que o sandbox jÃ¡ bloqueia. Ã‰ o texto:

```js
api.log('conectando com', api.env.get('API_KEY'));
```

A chave vai para o log do mod, aparece no painel, entra no diagnÃ³stico e pode acabar no histÃ³rico
da conversa que o agente lÃª. Sai da mÃ¡quina sem nenhuma chamada de rede envolvida.

E acontece **sem mÃ¡ intenÃ§Ã£o**: depurar imprimindo a variÃ¡vel Ã© o reflexo mais comum que existe, e
uma IA escrevendo o mod faz exatamente isso.

### Duas decisÃµes de projeto

**Redigir ao gravar, nÃ£o ao exibir.** Proteger em cada leitor â€” painel, diagnÃ³stico, contexto do
agente â€” Ã© uma corrida que se perde na primeira vez que alguÃ©m adiciona um leitor e esquece. O
valor nunca chega a ser armazenado, entÃ£o nÃ£o hÃ¡ leitor capaz de vazÃ¡-lo.

**Comparar por valor, nÃ£o por origem.** Redigir "o que veio de `env.get`" exigiria rastrear o dado
atravÃ©s de concatenaÃ§Ãµes, interpolaÃ§Ãµes e `JSON.stringify` â€” impossÃ­vel sem instrumentar o motor.
Comparar o texto final contra os valores conhecidos Ã© simples e nÃ£o tem como escapar.

- [~] 1254 `P0` **`src/mods/redacao.ts`**: mÃ¡scara sobre qualquer ocorrÃªncia, em qualquer posiÃ§Ã£o
- [~] 1255 `P0` **Aplicada em `ModContext.log` e em `recordError`** â€” `fetch(url + chave)` que falha traz a chave no texto da exceÃ§Ã£o
- [~] 1256 `P1` **Segredos mais longos primeiro**: se um contÃ©m outro, redigir o curto antes partiria o longo e deixaria a cauda visÃ­vel
- [~] 1257 `P1` **Piso de 6 caracteres** â€” um segredo de dois ou trÃªs apareceria por acaso em toda mensagem, e o log viraria uma sopa de asteriscos, escondendo o problema de verdade
- [~] 1258 `P1` **Caractere especial de regex escapado** no valor do segredo
- [~] 1259 `P1` **13 testes**, incluindo chave dentro de objeto serializado e dentro de mensagem de erro
- [~] 1260 `P2` **O stub de teste do host passou a implementar `modEnv`** â€” a alternativa era guardar a chamada com `?.`, que desligaria a redaÃ§Ã£o em silÃªncio num host que esquecesse de implementar: exatamente a falha que ela previne

## 53. O teto invisÃ­vel de 8 voxels â€” item 030

Item mecÃ¢nico na aparÃªncia: "extrair as constantes de altura mÃ¡gicas para um `WORLD_MAX_Y`
Ãºnico". Extrair obrigou a responder **"120 por quÃª?"**, e a resposta era um defeito.

Seis lugares varriam a coluna de cima para baixo comeÃ§ando em `120`, num mundo de `128`:

```ts
for (let y = 120; y >= 0; y--) { ... }   // acha a superfÃ­cie
```

**Os oito voxels do topo eram invisÃ­veis para todos eles.** Construa uma torre atÃ© y=125 e o
"achar a superfÃ­cie" devolve o chÃ£o lÃ¡ embaixo. Quem teleporta ou nasce naquela coluna aparece
**dentro** da construÃ§Ã£o. O `120` provavelmente nasceu como margem de seguranÃ§a e virou um teto.

O sexto lugar Ã© o pior: `ai/WorldPerception.ts` â€” **o agente enxergava o mundo com o teto
cortado**. Ele descreveria como "campo aberto" uma coluna com uma torre de 125 blocos.

### Os dois nomes, e por que nÃ£o Ã© sinÃ´nimo Ã  toa

`CY` Ã© a altura de **uma coluna de chunk** â€” para quem indexa o array. `WORLD_MAX_Y` Ã© o limite do
**mundo** â€” para quem varre, valida coordenada ou posiciona. Valem o mesmo hoje porque hÃ¡ uma sÃ³
camada de chunks na vertical. Separar os nomes Ã© o que permite mudar isso (item 029) sem caÃ§ar
cada `CY` para decidir qual dos dois significados ele tinha ali.

- [~] 1261 `P0` **`WORLD_MAX_Y`** e **`TOPO_VARREDURA`**, com o porquÃª de cada um documentado
- [~] 1262 `P0` **Seis varreduras corrigidas** â€” `main.ts`, `EventSystem`, `MCPExecutors` (Ã—3) e `WorldPerception`
- [~] 1263 `P1` **Teste que reprova varredura descendente com literal** â€” o nÃºmero estava em seis arquivos; sem isso, o sÃ©timo nasce com o mesmo defeito. O regex distingue laÃ§o descendente de `for (let y = 0; y < CY; y++)`, que Ã© ascendente e legÃ­timo
- [~] 1264 `P1` **Teste do caso concreto**: torre a `WORLD_MAX_Y - 3` Ã© encontrada pela varredura

## 54. Validador de contraste â€” item 076

O jogador pede "cria um bloco de pedra escura" e a IA gera um cinza. JÃ¡ existe um cinza quase
igual. Os dois viram blocos distintos no inventÃ¡rio, com nomes e receitas diferentes, e
**indistinguÃ­veis na tela**. O jogador quebra o errado, constrÃ³i com o errado, e nada o avisa.

**NÃ£o Ã© um erro que o agente perceba sozinho**: ele nÃ£o vÃª a tela, e do ponto de vista dele o
bloco foi criado com sucesso.

### TrÃªs decisÃµes

**DistÃ¢ncia perceptual, nÃ£o RGB cru.** `#00FF00`â†’`#00E000` e `#0000FF`â†’`#0000E0` tÃªm a mesma
distÃ¢ncia numÃ©rica em RGB; aos olhos o par verde Ã© muito mais parecido, porque a visÃ£o Ã© bem mais
sensÃ­vel ao verde. A luminÃ¢ncia Rec. 709 entra como eixo principal â€” a mesma ponderaÃ§Ã£o jÃ¡ usada
na gradaÃ§Ã£o de cor, para o jogo ter uma sÃ³ noÃ§Ã£o de "quanto isto Ã© claro".

**Fora de `validateModPackage`.** Aquela funÃ§Ã£o roda tambÃ©m na **carga** de um mod salvo. Um bloco
criado antes desta regra existir passaria a reprovar e o mod iria para quarentena sozinho na
prÃ³xima abertura â€” o jogador perderia conteÃºdo por causa de uma regra nova. A regra vale para o
que estÃ¡ sendo criado **agora**.

**Um conflito, nÃ£o a lista.** Uma cor parecida com cinco cinzas geraria cinco reclamaÃ§Ãµes sobre o
mesmo problema, e o agente que lÃª isso tende a tratar como cinco correÃ§Ãµes separadas.

- [~] 1265 `P0` **`distanciaPerceptual`** ponderada por luminÃ¢ncia
- [~] 1266 `P0` **`conflitoDeContraste`** contra blocos nativos e de outros mods, ignorando os do prÃ³prio pacote â€” uma famÃ­lia coerente nÃ£o deve brigar consigo mesma
- [~] 1267 `P1` **SugestÃ£o com direÃ§Ã£o** ("clareie" / "escureÃ§a"), escolhendo o lado que afasta do vizinho. "Escolha outra cor" devolve o problema para quem nÃ£o sabe resolvÃª-lo
- [~] 1268 `P1` **Limiar calibrado em 0,055** â€” alto demais proibiria variaÃ§Ãµes legÃ­timas, e o agente passaria a inventar cores berrantes para passar na validaÃ§Ã£o: pior que o problema original
- [~] 1269 `P1` **11 testes**, incluindo o que prova a ponderaÃ§Ã£o perceptual (par verde vs par azul de mesma distÃ¢ncia RGB)
- [~] 1270 `P2` **Testes do `ModService` ganharam cores reais** â€” usavam `topColor: 0` como valor descartÃ¡vel, e o validador (corretamente) passou a recusar

## 55. O dÃ©cimo caso â€” e um defeito dentro do defeito

Auditei trÃªs `P0` antes de escrever cÃ³digo, porque este repositÃ³rio tem histÃ³rico. Dois estavam
**feitos**: o painel de mods (430, 642) jÃ¡ lista, ativa, remove, exporta, mostra versÃµes e faz
rollback. Marcados como verificados, sem retrabalho.

O terceiro, 705, era o **dÃ©cimo caso de cÃ³digo dormente** â€” e o mais irÃ´nico atÃ© agora.

`ModContext.placedBlocks` existia, era preenchido a cada `setBlock` do mod, e trazia o comentÃ¡rio
*"para reverter com precisÃ£o"*. **Nada revertia.** NÃ£o existia nem funÃ§Ã£o de reverter. O Ãºnico uso
era `blocksPlaced: ctx.placedBlocks.size`, num relatÃ³rio de diagnÃ³stico.

### O defeito dentro do defeito

O mapa guardava o bloco **colocado**, nÃ£o o anterior. Com esse dado a reversÃ£o precisa Ã©
**impossÃ­vel**: dÃ¡ para saber o que apagar, nÃ£o o que restaurar no lugar. Um mod que trocou terra
por pedra deixaria um buraco de ar.

Ou seja: mesmo que alguÃ©m tivesse escrito a funÃ§Ã£o de reverter, ela nÃ£o teria como funcionar
direito â€” e o comentÃ¡rio prometendo precisÃ£o estaria mentindo desde sempre.

### A guarda que separa desfazer de voltar no tempo

A reversÃ£o sÃ³ restaura onde o bloco **ainda Ã© o que o mod pÃ´s**. Se o jogador quebrou aquilo
depois, ou construiu por cima, a posiÃ§Ã£o fica em paz. Reverter sobre uma ediÃ§Ã£o do jogador
destruiria trabalho dele para desfazer o de outro.

- [~] 1271 `P0` **`placedBlocks` passou a guardar `{ antes, depois }`** â€” o `antes` Ã© o que devolve o terreno em vez de abrir um buraco
- [~] 1272 `P0` **`reverterBlocosDoMod`**, com a guarda "sÃ³ onde ainda Ã© o que o mod pÃ´s"
- [~] 1273 `P1` **Escrita dupla na mesma posiÃ§Ã£o guarda o `antes` da primeira** â€” o estado que interessa Ã© o do mundo antes de o mod tocar ali, nÃ£o o que o prÃ³prio mod pÃ´s no passo anterior
- [~] 1274 `P1` **6 testes**, incluindo o caso do jogador que construiu por cima
- [x] 430, 642 **Auditados** â€” o painel de mods jÃ¡ fazia tudo o que os itens pediam

### Item 704 â€” a reversÃ£o que funcionava pela metade

O agente altera o mundo por **dois** caminhos: o script do mod, que jÃ¡ registrava, e as
ferramentas diretas `set_block`, `fill_box` e `execute_voxel_script`. As segundas escreviam no
mundo sem atribuiÃ§Ã£o nenhuma â€” e **o que nÃ£o tem dono nÃ£o pode ser revertido**.

Na prÃ¡tica isso partia a reversÃ£o ao meio. O jogador pede "faÃ§a uma torre", o agente usa
`fill_box`, e depois "desfaÃ§a esse mod" deixa a torre de pÃ©. A metade vinda do script sumia, a
metade vinda da ferramenta ficava. **Pior que nÃ£o reverter nada**, porque o resultado Ã© um mundo
em estado intermediÃ¡rio que ninguÃ©m pediu.

A correÃ§Ã£o nÃ£o foi atribuir em cada `case` â€” foi **fechar o caminho**: existe um sÃ³ mÃ©todo de
escrita, e um teste conta as chamadas diretas a `world.setBlock` no arquivo, aceitando exatamente
uma (a de dentro do prÃ³prio mÃ©todo). Sem isso, o prÃ³ximo `case` nasce sem atribuiÃ§Ã£o e ninguÃ©m
percebe atÃ© alguÃ©m tentar reverter.

- [~] 1275 `P0` **`escreverBloco`** â€” caminho Ãºnico de escrita do agente, com atribuiÃ§Ã£o ao mod da sessÃ£o
- [~] 1276 `P0` **Cinco escritas diretas convertidas** (`set_block`, `fill_box`, e trÃªs dentro de `execute_voxel_script`)
- [~] 1277 `P1` **Teste que conta as escritas diretas no fonte** e aceita exatamente uma
- [~] 1278 `P1` **Silencioso em sessÃ£o livre** â€” sem mod vinculado nÃ£o hÃ¡ a quem atribuir, e isso Ã© modo de uso legÃ­timo, nÃ£o erro

### Item 402 â€” orÃ§amento que reage ao custo real

JÃ¡ existia um limite por **contagem**, derivado do alcance de visÃ£o: `Math.max(2, viewRadius / 2)`.
Ã‰ metade do problema, e a metade fÃ¡cil.

O que faltava Ã© o que dÃ¡ nome ao item. Numa mÃ¡quina lenta, ou num momento caro (tempestade com
partÃ­culas, muitas criaturas em volta), gerar o mesmo nÃºmero de malhas transforma um quadro pesado
numa **engasgada visÃ­vel**. O orÃ§amento agora encolhe quando o quadro passa do alvo e volta a
crescer quando sobra tempo.

A troca Ã© deliberada: **atraso se percebe menos que solavanco.** O mundo carrega um pouco mais
devagar em vez de travar.

TrÃªs decisÃµes que os testes fixaram:

- **Desce depressa, sobe devagar.** Um solavanco precisa de resposta imediata; recuperar o ritmo
  pode levar quadros. SimÃ©trico produziria vaivÃ©m â€” um controle que corrige demais passa a causar
  o problema que deveria resolver.
- **Nunca chega a zero.** O custo alto nÃ£o vem sÃ³ das malhas, entÃ£o parar de gerÃ¡-las nÃ£o conserta
  o quadro e ainda congelaria o carregamento para sempre.
- **Zona morta entre 1,1Ã— e 1,5Ã— do alvo**, senÃ£o um quadro parado no limite alternaria subir e
  descer indefinidamente.

- [~] 1279 `P0` **`OrcamentoDeQuadro`** em mÃ³dulo prÃ³prio â€” dentro de `bootstrap()` nÃ£o seria testÃ¡vel sem subir o jogo
- [~] 1280 `P1` **7 testes**, incluindo a assimetria subida/descida e o piso que impede o congelamento

## 56. Varredura de auditoria dos `P0` restantes

Antes de escrever mais cÃ³digo, varri os `P0` pendentes procurando o que jÃ¡ estava feito. O padrÃ£o
se repetiu.

**Feitos, marcados como verificados:**

- **221 e 222 (fluidos).** `world/fluids.ts` jÃ¡ escoa por nÃ­veis (`WATER_SPREAD`, `LAVA_SPREAD`) e
  jÃ¡ solidifica Ã¡gua+lava em obsidiana. Os dois itens estavam pendentes por engano de auditoria.

**O buraco que a varredura encontrou â€” e nÃ£o estava no checklist:**

As picaretas iam atÃ© o tier 3 (ferro). Nenhum bloco exige tier 4, entÃ£o **nada estava
inalcanÃ§Ã¡vel** â€” nÃ£o era esse o problema. O problema era mais silencioso: **o diamante era o fim
da corrente sem uso**. O jogador minerava minÃ©rio de diamante com a picareta de ferro, montava o
bloco de diamante, e acabava ali. O material mais raro do jogo nÃ£o levava a lugar nenhum.

Uma progressÃ£o cujo Ãºltimo degrau nÃ£o abre nada **termina antes do fim**: o jogador para de
minerar ao perceber que jÃ¡ tem tudo o que importa, no ferro. Ã‰ um defeito de desenho, nÃ£o de
cÃ³digo, e por isso nenhum teste o encontraria â€” foi preciso perguntar "para que serve o diamante?".

- [~] 1281 `P0` **Picareta de diamante** (tier 4), fechando a corrente madeira â†’ pedra â†’ ferro â†’ diamante
- [~] 1282 `P1` **Teste de corrente sem buraco** â€” um degrau faltando no meio deixaria o jogador com a picareta anterior e nenhuma receita para a seguinte
- [~] 1283 `P1` **Teste "todo tier exigido tem picareta que o alcanÃ§a"** â€” um bloco pedindo tier 5 sem ferramenta de tier 5 Ã© conteÃºdo que existe no mundo e ninguÃ©m pega, sem nada avisando
- [~] 1284 `P1` **Teste "o material mais raro leva a alguma coisa"**

### Anotado como faltando, descoberto nesta varredura

- [ ] 1285 `P1` ~~Espada/machado por tier~~ **REDIMENSIONADO** â€” o jogo nÃ£o tem *tipo* de ferramenta, sÃ³ `toolTier` genÃ©rico, e `damageForTier` jÃ¡ faz a tier valer no combate. Uma espada seria sÃ³ outro rÃ³tulo com o mesmo efeito. Fazer isso de verdade exige um conceito de **classe de ferramenta** (velocidade por material, dano por tipo) â€” mudanÃ§a de desenho, nÃ£o de receita
- [ ] 1286 `P1` **Diamante sem uso alÃ©m da picareta** â€” armadura ou ferramenta especial, senÃ£o o tier 4 Ã© um beco
- [~] 1287 `P2` **Nenhum bloco exige tier 4** â€” feito: a obsidiana passou a exigi-lo (ver "O Ãºltimo degrau ganha porta"). Anotei esta mesma lacuna **duas vezes**, aqui e em 1293, em rodadas diferentes; 1293 Ã© a duplicata

### O teto por saturaÃ§Ã£o â€” descoberto ao conferir a prÃ³pria correÃ§Ã£o anterior

Depois de adicionar a picareta de diamante, fui verificar se ela de fato faz diferenÃ§a. NÃ£o fazia.

`TIER_DAMAGE = [2, 3.5, 5, 7]` ia atÃ© o Ã­ndice 3, e `damageForTier` **satura** no Ãºltimo:

```ts
const t = Math.max(0, Math.min(TIER_DAMAGE.length - 1, Math.floor(tier || 0)));
```

Uma picareta de tier 4 batia **exatamente como a de ferro** â€” a receita mais cara do jogo, sem
nenhuma diferenÃ§a. E o comentÃ¡rio logo acima da tabela jÃ¡ falava em *"a picareta de diamante bate
~3Ã— a mÃ£o"*, descrevendo uma ferramenta que nÃ£o existia: estava aspiracional desde que foi escrito.

**Um teto por saturaÃ§Ã£o Ã© o pior tipo de teto**, porque nÃ£o falha. NÃ£o hÃ¡ erro, nÃ£o hÃ¡ aviso â€” sÃ³
deixa de recompensar em silÃªncio. Quem jogasse concluiria que o diamante "nÃ£o vale a pena", sem
nada explicando o porquÃª.

- [~] 1288 `P1` **`TIER_DAMAGE` estendida ao tier 4** (9,5), mantendo a curva suave
- [~] 1289 `P1` **Teste que amarra a tabela Ã  corrente de receitas** â€” a tabela precisa ser mais longa que o maior tier que existe, senÃ£o a saturaÃ§Ã£o volta calada
- [~] 1290 `P1` **Teste de curva sem degrau parado** e **teto de proporÃ§Ã£o** â€” sem o segundo, a correÃ§Ã£o teria a saÃ­da fÃ¡cil de inflar o Ãºltimo valor e virar um botÃ£o de deletar inimigo

### Lacunas anotadas nesta rodada

- [~] 1291 `P1` **Tier passou a afetar a velocidade de quebra** â€” antes:  â€” `breakCooldown` Ã© fixo (0,42 / 0,16). Uma picareta melhor hoje sÃ³ desbloqueia blocos e bate mais forte; minerar pedra com diamante leva o mesmo tempo que com madeira, que Ã© o oposto da expectativa do gÃªnero
- [ ] 1292 `P1` **NÃ£o existe classe de ferramenta** (picareta / machado / pÃ¡ / espada). Sem isso, "espada de ferro" seria sÃ³ um rÃ³tulo diferente para a picareta de ferro
- [~] 1293 `P2` **Duplicata de 1287** â€” a mesma lacuna anotada duas vezes, em rodadas diferentes. Feita junto

### O Ãºltimo degrau ganha porta â€” itens 1287/1293

A picareta de diamante existia, batia mais forte e minerava mais rÃ¡pido, e mesmo assim **nÃ£o
desbloqueava um Ãºnico bloco**: o maior `minToolTier` do jogo era 3. O efeito prÃ¡tico da receita
mais cara era "os mesmos blocos, sÃ³ que antes".

A obsidiana passou a exigir tier 4. Ela Ã© a candidata certa por trÃªs motivos, e nenhum deles Ã© ser
a mais escura:

- **Nasce sozinha** no encontro de lava com Ã¡gua (`fluids.ts`), evento comum em caverna profunda â€”
  a porta aparece no caminho de quem jÃ¡ estÃ¡ no fundo, em vez de exigir uma expediÃ§Ã£o prÃ³pria.
- **NÃ£o Ã© ingrediente de nada**, entÃ£o subir a exigÃªncia nÃ£o tranca nenhuma receita anterior. Se
  fosse o minÃ©rio de ferro, o jogo ficaria sem corrente de progressÃ£o nenhuma.
- O portÃ£o Ã© **"quebra mas nÃ£o dropa"** (`awardDrop`), nÃ£o uma parede: ninguÃ©m fica preso atrÃ¡s de
  obsidiana que nÃ£o consegue remover â€” inclusive a que o prÃ³prio jogador criou por acidente
  jogando Ã¡gua na lava.

**O teste que faltava era o simÃ©trico do que existia.** JÃ¡ havia "todo tier exigido tem picareta
que o alcanÃ§a" â€” que impede conteÃºdo inalcanÃ§Ã¡vel. Faltava o contrÃ¡rio: "a melhor picareta alcanÃ§a
algo que as outras nÃ£o". Sem ele, a ponta da progressÃ£o degenera **em silÃªncio**: a receita sai,
todos os testes passam, e nÃ£o falha em lugar nenhum. Foi o estado real por uma rodada inteira.

Somei um segundo, mais geral: **cada tier coleta algo que o anterior nÃ£o coletava**. Um degrau que
nÃ£o amplia o conjunto de blocos coletÃ¡veis Ã© um degrau que o jogador pode pular sem perder nada â€”
e uma receita cara que ninguÃ©m tem motivo para fazer.

- [~] 1296 `P1` **Obsidiana exige tier 4** â€” o Ãºnico bloco que a picareta de diamante abre
- [~] 1297 `P1` **Teste "o Ãºltimo degrau abre porta prÃ³pria"** â€” o simÃ©trico que faltava
- [~] 1298 `P2` **Teste "cada tier desbloqueia algo a mais que o anterior"** â€” pega o degrau vazio no meio, nÃ£o sÃ³ na ponta

### Item 1291 â€” a razÃ£o de subir de tier

A tier decidia **se** um bloco podia ser quebrado e quanto dano causava em combate, mas nÃ£o **quÃ£o
rÃ¡pido** se minerava: `breakCooldown` era fixo. Minerar pedra com a picareta de diamante levava
exatamente o mesmo tempo que com a de madeira.

Isso desfazia boa parte da razÃ£o de subir de tier â€” o jogador gasta uma corrente inteira de
progressÃ£o para ganhar acesso a blocos novos e **nenhum conforto** nos que jÃ¡ minerava.

Duas regras, as duas para manter a mineraÃ§Ã£o uma decisÃ£o e nÃ£o uma formalidade:

**A vantagem Ã© relativa ao bloco, nÃ£o absoluta.** Uma picareta de diamante numa pedra que sÃ³ pede
madeira tem trÃªs degraus de vantagem; na obsidiana, que pede ferro, tem um. Ã‰ o que faz o material
duro continuar duro mesmo com a melhor ferramenta â€” sem isso, o fim da progressÃ£o apagaria a
diferenÃ§a entre os materiais, e obsidiana viraria terra.

**SÃ³ acelera o que resiste.** Terra, areia e folhagem nÃ£o tÃªm `minToolTier`: jÃ¡ saem num golpe.
AcelerÃ¡-las nÃ£o daria sensaÃ§Ã£o nenhuma e ainda tornaria o modo detalhe difÃ­cil de controlar.

- [~] 1294 `P1` **`fatorDeVelocidade`** em mÃ³dulo prÃ³prio, com teto de ~2,2Ã— â€” sem o piso, uma corrente de tiers longa levaria o fator a zero e o mundo deixaria de ter custo
- [~] 1295 `P1` **8 testes**, incluindo "ferramenta insuficiente nÃ£o Ã© penalizada aqui" (quem barra o bloco Ã© a regra de tier mÃ­nimo; penalizar de novo seria punir duas vezes pelo mesmo motivo, num lugar onde ninguÃ©m procuraria)

---

## 57 â€” O loop central e o guia do novato (itens 006, 007, 008)

O jogo tinha cinco modos, sobrevivÃªncia com vida e fome, minÃ©rios por profundidade e uma corrente
de ferramentas de quatro degraus â€” e **nada que dissesse ao jogador o que fazer com isso**.

NÃ£o Ã© um defeito de cÃ³digo: cada peÃ§a funcionava. Ã‰ que a progressÃ£o inteira era **invisÃ­vel**.
Nada avisava que a picareta de madeira abre a pedra, que o carvÃ£o vira tocha, nem que a tocha Ã© o
que torna a caverna explorÃ¡vel. Descobrir a cadeia exigia ler receitas. O sintoma nÃ£o Ã© confusÃ£o â€”
Ã© o jogador construir uma casinha, achar que viu tudo, e sair em dez minutos.

### O que foi feito

`docs/LOOP_CENTRAL.md` define os quinze passos com tempo aproximado e, em cada um, **o que obriga o
seguinte**. TrÃªs deles sÃ£o portÃµes de verdade, onde o jogo diz "nÃ£o" e o jogador precisa voltar um
passo: sem picareta a pedra nÃ£o rende, sem tocha a caverna Ã© escura demais para achar minÃ©rio, sem
picareta de ferro o diamante nÃ£o sai. Sem portÃµes a ordem seria decorativa.

`src/game/Objetivos.ts` Ã© a mesma corrente executÃ¡vel, com trÃªs regras:

**Um passo de cada vez.** O HUD mostra **um** objetivo, nunca a lista. Um novato diante de quinze
caixinhas continua sem saber por onde comeÃ§ar â€” que Ã© exatamente o problema que o guia resolve.

**A ordem Ã© sugestÃ£o, nÃ£o trilho.** Cada evento Ã© testado contra *todos* os pendentes. NinguÃ©m
desce numa caverna seguindo uma lista, e obrigar a refazer o que jÃ¡ foi feito Ã© a maneira mais
rÃ¡pida de transformar um guia em estorvo.

**ConcluÃ­do nunca volta a pendente.** Sem isso, gastar as tÃ¡buas na bancada desmarcaria "fabrique
tÃ¡buas", e o guia mandaria de volta Ã  Ã¡rvore alguÃ©m que jÃ¡ estÃ¡ no ferro.

### O defeito que a prÃ³pria fiaÃ§Ã£o revelou

Pendurei `amanheceu` na virada do contador de dias â€” o lugar mais Ã³bvio, e onde o `worldDay++` jÃ¡
estava. **`timeOfDay = 0` Ã© meia-noite, nÃ£o amanhecer.** "Sobreviva atÃ© o amanhecer" fecharia no
meio da noite, antes da parte perigosa.

Nada falharia: o objetivo marcaria, o toast apareceria, o som tocaria. A Ãºnica coisa errada seria o
jogo ter dado a vitÃ³ria cedo demais â€” e Ã© por isso que virou teste. Passou a estar preso Ã 
transiÃ§Ã£o de fase (`faseAtual === 'amanhecer'`), com uma trava que reprova se alguÃ©m o devolver
para perto do `worldDay++`.

- [~] 1299 `P0` **`RastreadorDeObjetivos`** â€” 21 testes, incluindo "restaurar de vazio zera" (um sÃ³ rastreador serve todos os mundos da sessÃ£o; sem limpar, quem cria um mundo novo depois de jogar outro comeÃ§a com meia corrente feita)
- [~] 1300 `P0` **CartÃ£o de objetivo no HUD**, canto superior esquerdo, sÃ³ no Modo SobrevivÃªncia
- [~] 1301 `P1` **9 travas de fiaÃ§Ã£o** â€” a classe Ã© pura e completamente inerte sozinha; sem os quatro pontos de instrumentaÃ§Ã£o, todos os 21 testes passariam e nenhum objetivo avanÃ§aria em jogo
- [~] 1302 `P1` **`amanheceu` preso ao amanhecer**, nÃ£o Ã  meia-noite â€” com teste que reprova a regressÃ£o
- [~] 1303 `P2` **Som prÃ³prio de conquista** (sobe uma oitava, dura o triplo de `pegarItem`) â€” um clique curto se confunde com pegar item, e a conquista deixa de ser um momento
- [~] 1304 `P2` **Progresso no save do jogador**, por id e nÃ£o por Ã­ndice â€” guardar "estou no passo 4" faria um objetivo inserido no meio deslocar todos os mundos jÃ¡ salvos

### Lacunas que este trabalho revelou

- [~] 1305 `P1` **Aba "Objetivos" no hub de pausa** â€” a corrente por extenso, com o que vem depois do prÃ³ximo **esmaecido e nÃ£o escondido**: esconder o futuro faria o esforÃ§o parecer sem destino; mostrar tudo em igualdade tiraria a resposta da pergunta "e agora?"
- [~] 1306 `P1` **O abrigo passou a ser verificado, nÃ£o contado** â€” `src/game/abrigo.ts`, busca em largura com orÃ§amento; ver a seÃ§Ã£o 58
- [ ] 1307 `P1` **O loop nÃ£o tem segunda volta** â€” fecha no papel, mas depois da obsidiana nÃ£o hÃ¡ material melhor nem objetivo maior. Liga-se aos itens 018/019/1286
- [ ] 1308 `P2` **A noite nÃ£o Ã© perigosa o bastante** para justificar o abrigo do passo 6 â€” os hostis nascem, mas nada forÃ§a o jogador a se esconder (item 009)
- [~] 1309 `P2` **A morte passou a custar** (item 011). Segue aberto o 010 â€” o ponto de renascimento ainda Ã© sempre o spawn original
- [ ] 1310 `P2` **Os tempos da tabela sÃ£o estimativa, nÃ£o mediÃ§Ã£o** â€” nada registra quanto o jogador leva de fato atÃ© a primeira ferramenta (item 022)
- [ ] 1311 `P2` **O guia diz o quÃª, nÃ£o como se joga** â€” quem nÃ£o sabe que se coloca bloco com o botÃ£o direito ainda descobre sozinho (item 021)

---

## 58 â€” O abrigo que nÃ£o abrigava (itens 1305, 1306)

Duas lacunas anotadas na rodada anterior, feitas na mesma.

### A lista completa (1305)

O cartÃ£o do HUD mostra **um** passo, de propÃ³sito. Quem quisesse rever o que jÃ¡ fez, ou entender
para onde a corrente vai, nÃ£o tinha onde â€” e a resposta nÃ£o Ã© encher o canto da tela, que devolveria
ao novato exatamente o problema que o guia existe para resolver. SÃ£o dois pÃºblicos e duas telas.

A aba "Objetivos" do hub de pausa mostra a corrente inteira, com **o futuro esmaecido em vez de
escondido**. Esconder faria a corrente parecer curta e o esforÃ§o, sem destino: o jogador nÃ£o teria
como saber que minerar ferro leva a algum lugar. Mostrar tudo em igualdade tiraria a resposta da
pergunta "e agora?". Esmaecer preserva as duas coisas.

A aba **nÃ£o some** nos modos sem progressÃ£o: sumir pareceria defeito. Ela explica por que estÃ¡
vazia.

### O abrigo que nÃ£o abrigava (1306)

O objetivo contava **blocos colocados**: doze quaisquer. Doze blocos de terra enfileirados no chÃ£o
cumpriam. O jogador recebia a confirmaÃ§Ã£o de ter feito algo que nÃ£o fez, e a primeira noite o pegava
do lado de fora â€” com o jogo tendo dito que estava tudo certo.

**Um objetivo que mede a aÃ§Ã£o errada Ã© pior que objetivo nenhum**: ensina que o guia nÃ£o sabe do que
estÃ¡ falando, e a partir daÃ­ nada que ele disser Ã© levado a sÃ©rio.

O que define abrigo nÃ£o Ã© contagem de paredes nem padrÃ£o de construÃ§Ã£o â€” as duas coisas obrigariam o
jogador a construir do jeito que o cÃ³digo espera. Ã‰ **o ar em volta ser finito**. EntÃ£o Ã© uma busca
em largura pelo ar a partir do jogador, com orÃ§amento: se ela se esgota, o espaÃ§o Ã© fechado; se
estoura, o ar nÃ£o acaba e o jogador estÃ¡ lÃ¡ fora.

A propriedade que fez valer a pena: **um buraco na parede ou no teto derruba o resultado sozinho**,
sem nenhuma regra prÃ³pria, porque o ar de fora entra pela busca. E uma caverna tapada conta como
abrigo â€” e deve mesmo: exigir construÃ§Ã£o seria exigir um estilo de jogo em vez de um resultado.

Duas armadilhas que viraram teste:

**Parede de um mini-voxel.** A busca anda de metro em metro, mas o Modo Detalhe constrÃ³i em
mini-voxels. Testar sÃ³ o ponto de chegada atravessaria a parede em dois de cada trÃªs casos â€” sem
erro em lugar nenhum, sÃ³ um abrigo que Ã s vezes nÃ£o conta e ninguÃ©m saberia por quÃª. Cada passo
confere todos os mini-voxels do caminho.

**Soterrado nÃ£o Ã© abrigado.** Quem estÃ¡ dentro da rocha maciÃ§a estÃ¡ preso, nÃ£o protegido, e dar o
objetivo por cumprido ali premiaria um acidente ruim.

- [~] 1312 `P1` **`estaAbrigado`** com orÃ§amento de 1200 cÃ©lulas â€” Ã© tambÃ©m o teto de custo: a busca nunca visita mais que isso, e um teste conta as leituras para provar
- [~] 1313 `P1` **13 testes de abrigo**, incluindo "doze blocos em fila nÃ£o abrigam ninguÃ©m" (o defeito antigo reproduzido literalmente) e "vidro fecha, capim nÃ£o"
- [~] 1314 `P2` **`colocou` removido do tipo de evento** â€” sem objetivo que o consumisse, seria mais uma variante dormente

### Lacunas anotadas nesta rodada

- [~] 1315 `P1` **A casa passou a proteger de spawn** â€” `mapearAbrigo` devolve o conjunto de cÃ©lulas, e o `MobSpawner` recusa qualquer berÃ§o dentro dele
- [ ] 1316 `P2` **Um salÃ£o acima de ~10Ã—10Ã—10 m conta como "lÃ¡ fora"** â€” consequÃªncia assumida do orÃ§amento, mas uma base grande legÃ­tima seria reprovada sem explicaÃ§Ã£o nenhuma na tela
- [~] 1317 `P2` **Aviso de "vocÃª estÃ¡ a cÃ©u aberto"**, uma vez por noite e sÃ³ enquanto o objetivo estÃ¡ pendente

---

## 59 â€” A casa que nÃ£o protegia (itens 1315, 1317)

O mapeamento de abrigo tinha um segundo uso Ã³bvio, e nÃ£o tÃª-lo feito junto teria deixado o jogo
numa posiÃ§Ã£o pior que a de antes: o objetivo diria "vocÃª estÃ¡ abrigado" e o jogador continuaria
acordando com um zumbi dentro do quarto.

**O interior de uma casa fechada Ã© o lugar mais escuro do mundo Ã  noite.** A regra de spawn Ã©
"nasce onde a luz efetiva Ã© â‰¤ 6", e `MIN_SPAWN_DISTANCE` sÃ£o 14 mini-voxels â€” menos de cinco metros.
Somando as duas, o **melhor** berÃ§o que o sorteio poderia encontrar era exatamente dentro do abrigo.
O jogador constrÃ³i para se proteger e o jogo o pune por ter construÃ­do, que Ã© o caminho mais curto
para ele parar de construir.

`mapearAbrigo` passou a devolver **o conjunto de cÃ©lulas** em vez de um sim/nÃ£o. A busca jÃ¡ visita
exatamente essas cÃ©lulas; jogÃ¡-las fora e recomeÃ§ar para cada candidato a spawn custaria uma
varredura por candidato. Com o conjunto, a pergunta "este ponto estÃ¡ dentro da casa?" Ã© uma consulta
de tabela.

TrÃªs detalhes que viraram teste porque falham calados:

**O mapa precisa ser limpo ao amanhecer.** Um `Set` que nunca zera deixaria uma bolha permanente sem
spawn onde a casa esteve â€” seguindo o jogador pelo mundo inteiro, sem nada denunciando por quÃª.

**O bloqueio nÃ£o pode matar o spawn.** Sem um teste que exija criaturas nascendo *fora* do abrigo,
"consertar" seria trivial e inÃºtil: bastaria nunca gerar ninguÃ©m, e a noite deixaria de existir como
ameaÃ§a.

**A condiÃ§Ã£o Ã© `hasSurvival`, nÃ£o `mobSpawner.enabled`.** O convidado nÃ£o gera criaturas â€” quem as
gera Ã© o anfitriÃ£o â€” mas tem objetivos prÃ³prios. Prender o mapeamento Ã  autoridade deixaria "esteja
abrigado" impossÃ­vel para todo mundo que entra num mundo dos outros.

O aviso do 1317 fecha o outro lado: quem levantou as quatro paredes e esqueceu o teto fazia tudo,
nada acontecia, e nada dizia o que faltava. Agora recebe uma frase â€” **uma vez por noite**, porque a
verificaÃ§Ã£o roda a cada 2 s e trinta toasts por noite deixam de ser aviso e viram ruÃ­do que se
aprende a ignorar, inclusive quando estiver certo. E sÃ³ enquanto o objetivo estÃ¡ pendente: depois de
cumprido, quem sai Ã  noite de propÃ³sito jÃ¡ sabe o que estÃ¡ fazendo.

- [~] 1318 `P1` **`mapearAbrigo`** devolvendo o conjunto de cÃ©lulas, com `estaAbrigado` como invÃ³lucro fino
- [~] 1319 `P1` **4 testes de spawn abrigado**, incluindo "o bloqueio nÃ£o mata o spawn fora do abrigo"
- [~] 1320 `P1` **3 travas de fiaÃ§Ã£o novas** â€” o mesmo mapa serve a duas coisas, e ligar sÃ³ uma era o erro provÃ¡vel

### Lacunas anotadas nesta rodada

- [~] 1321 `P1` **A criatura presa no abrigo sai**, e o mundo passou a ter despawn por distÃ¢ncia
- [ ] 1322 `P2` **O abrigo sÃ³ Ã© mapeado a partir do jogador** â€” num mundo com dois jogadores, a casa do outro nÃ£o protege ninguÃ©m enquanto ele nÃ£o estiver dentro dela
- [ ] 1323 `P2` **A porta ainda nÃ£o existe** â€” sem um bloco que abra e feche, todo abrigo Ã© selado com bloco e reaberto na pÃ¡, e o "buraco derruba o abrigo" fica sendo a mecÃ¢nica de entrar e sair

---

## 60 â€” O que a morte custa, e dois callbacks que nunca tocaram (item 011)

### Os casos 11 e 12 de cÃ³digo dormente, e os mais silenciosos atÃ© agora

`survivalSystem.onDamage` e `onDeath` sÃ£o **propriedades**, nÃ£o listas de assinantes: a segunda
atribuiÃ§Ã£o apaga a primeira. Havia **duas de cada**, separadas por umas sessenta linhas de
`main.ts`.

O que se perdeu: o **som de dano**, o **som de morte** e o evento `playerDamaged` dos mods. Todos
escritos, corretos, comentados â€” e nunca executados.

Nada falhava. O jogo sÃ³ era silencioso ao apanhar e ao morrer, e quem notasse pensaria que faltava o
som, nÃ£o que ele estava lÃ¡ o tempo todo. Ã‰ o mesmo modo de falha das dez vezes anteriores, com uma
diferenÃ§a que vale registrar: **desta vez o cÃ³digo nÃ£o estava sÃ³ sem chamador â€” estava sendo
chamado e imediatamente substituÃ­do.** Um `grep` por "quem usa isto?" acharia o chamador e diria que
estÃ¡ tudo bem.

A trava nova conta atribuiÃ§Ãµes, e um segundo teste exige que os sons tenham sobrevivido Ã  fusÃ£o â€”
senÃ£o a saÃ­da fÃ¡cil seria apagar o handler "errado" e perder exatamente o que se queria de volta.

### A penalidade de morte

Morrer devolvia o jogador ao spawn com o inventÃ¡rio intacto. O efeito nÃ£o Ã© "o jogo Ã© fÃ¡cil": Ã© que
**o risco deixa de ser informaÃ§Ã£o**. Descer 25 metros atrÃ¡s de diamante e cair na lava custava a
caminhada de volta, e nada mais â€” entÃ£o nÃ£o havia decisÃ£o a tomar sobre quando descer, o que levar,
ou quando voltar com o que jÃ¡ se tem.

TrÃªs opÃ§Ãµes, e elas nÃ£o sÃ£o uma escala de dificuldade â€” sÃ£o trÃªs jogos: `manter` (construir sem
atrito), `dropar` (o padrÃ£o) e `hardcore` (uma vida).

**A ferramenta nÃ£o cai.** Regra deliberada: a penalidade Ã© o material que vocÃª carregava, nÃ£o a
progressÃ£o que vocÃª destravou. Perder a picareta de diamante numa queda apagaria uma corrente
inteira de progressÃ£o, e a reaÃ§Ã£o de quem joga nÃ£o Ã© "vou com mais cuidado" â€” Ã© parar de descer. O
medo que faz alguÃ©m sair do jogo nÃ£o Ã© o mesmo que faz alguÃ©m jogar melhor.

**Dois padrÃµes diferentes, de propÃ³sito.** Mundo novo nasce `dropar`; mundo gravado antes deste
campo existir lÃª como `manter`. Fazer a atualizaÃ§Ã£o do jogo mudar em silÃªncio as regras de um mundo
em andamento Ã© a pior surpresa possÃ­vel â€” o jogador perderia o inventÃ¡rio na prÃ³xima morte por uma
decisÃ£o que ninguÃ©m tomou nem comunicou.

**A escolha Ã© na criaÃ§Ã£o, nÃ£o nas configuraÃ§Ãµes.** TrocÃ¡-la no meio da partida permitiria ligar
`hardcore` depois de jÃ¡ estar seguro, ou desligÃ¡-lo no instante anterior Ã  morte, e as duas coisas
esvaziam a escolha.

**A recusa do mundo encerrado vive na porta de entrada** (`loadWorldById`), e nÃ£o na tela que lista
os mundos: hÃ¡ mais de um caminho atÃ© lÃ¡ â€” o menu, o Ãºltimo mundo aberto ao iniciar, a troca pelo hub
â€” e proteger cada um seria uma corrida que se perde na primeira vez que alguÃ©m acrescentar um
caminho novo.

- [~] 1324 `P0` **Dois callbacks sobrescritos** â€” som de dano, som de morte e `playerDamaged` voltaram a acontecer
- [~] 1325 `P1` **Trava que conta atribuiÃ§Ãµes** de `onDamage`/`onDeath`, mais a que exige os sons vivos depois da fusÃ£o
- [~] 1326 `P1` **`penalidadeDeMorte.ts`** com 15 testes, incluindo "largar sem esvaziar duplicaria o inventÃ¡rio" â€” o defeito que ninguÃ©m reporta como defeito, e sim como "achei um jeito de multiplicar item"
- [~] 1327 `P1` **Seletor "Ao Morrer"** no assistente de criaÃ§Ã£o de mundo, com a consequÃªncia escrita em cada opÃ§Ã£o
- [~] 1328 `P1` **Mundo hardcore encerrado nÃ£o reabre** â€” marcado antes de qualquer outra coisa, para que fechar a aba naquela fraÃ§Ã£o de segundo nÃ£o ressuscite a partida

### Lacunas anotadas nesta rodada

- [~] 1329 `P1` **A lista de mundos mostra o mundo encerrado** â€” riscado, com a data, e o botÃ£o desabilitado. Ele **continua na lista** de propÃ³sito: foi uma partida, e apagÃ¡-la sozinho seria decidir pelo jogador que aquilo nÃ£o vale nada
- [~] 1330 `P1` **Itens expiram, piscam antes e a pilha da morte Ã© distinta**
- [ ] 1331 `P2` **A ferramenta nÃ£o perde durabilidade na morte** â€” como ela nÃ£o cai, `dropar` acaba sendo mais brando do que a descriÃ§Ã£o sugere para quem sÃ³ carrega ferramenta
- [ ] 1332 `P2` **Hardcore nÃ£o avisa antes** â€” nenhuma confirmaÃ§Ã£o ao escolher, e nenhum aviso de vida baixa que reconheÃ§a que aquela vida Ã© Ãºnica

---

## 61 â€” A cama, e o mundo que aparece encerrado (itens 010, 1329)

### A cama (010)

O ponto de renascimento era sempre o spawn procedural. Com a penalidade de morte recÃ©m-ligada
(item 011), isso ficou desproporcional: morrer a 25 metros de profundidade custava os itens **e**
uma travessia inteira do mundo para voltar a eles â€” e itens que expiram numa caminhada dessas sÃ£o,
na prÃ¡tica, itens perdidos, o que transforma `dropar` em `hardcore` disfarÃ§ado.

TrÃªs decisÃµes que nÃ£o sÃ£o Ã³bvias:

**A receita Ã© do primeiro dia** â€” trÃªs tÃ¡buas sobre trÃªs troncos. A cama existe para encurtar a
caminhada de volta depois de morrer; uma cama cara sÃ³ ficaria pronta depois de o jogador jÃ¡ ter
passado pela parte em que morrer dÃ³i, ou seja, chegaria tarde demais para servir para o que foi
feita. Um teste exige que **nenhum ingrediente peÃ§a ferramenta**.

**Folhas seriam o estofado Ã³bvio, e sÃ£o uma armadilha**: tÃªm `drops: -1`, entÃ£o o jogador nunca
conseguiria nenhuma e a receita seria impossÃ­vel sem nada explicando. Virou teste: todo ingrediente
da cama precisa cair de algum bloco ou sair de alguma receita.

**Guarda-se o ponto, nÃ£o a cama.** Se a cama for quebrada depois, o jogador ainda renasce ali.
Validar que o bloco continua sendo uma cama mandaria de volta ao outro lado do mundo quem tivesse a
casa desmanchada por um amigo â€” num momento em que ele jÃ¡ estÃ¡ morto e sem nada para reagir.

**Usar o bloco vem antes da recusa por estar com ferramenta na mÃ£o.** O estado normal de quem acabou
de minerar Ã© ter a picareta selecionada; com a ordem invertida, clicar na cama nÃ£o faria nada, e
nada explicaria por quÃª.

E a cama entrou na corrente de objetivos, logo depois do abrigo â€” nÃ£o perto do fim: ela serve para
as descidas, e as descidas comeÃ§am trÃªs passos adiante.

### O mundo encerrado aparece encerrado (1329)

Um mundo hardcore que acabou continua na lista **de propÃ³sito**: foi uma partida, e apagÃ¡-la sozinho
seria decidir pelo jogador que aquilo nÃ£o vale nada. Mas precisa *parecer* encerrado â€” riscado, com
a data, botÃ£o desabilitado. Sem isso a Ãºnica forma de descobrir era clicar em Carregar e ser
devolvido ao menu por um toast, o que se lÃª como defeito, nÃ£o como regra.

- [~] 1333 `P1` **Bloco `B.BED`**, `decor` (nÃ£o veda o abrigo nem bloqueia passagem) e `interactive`
- [~] 1334 `P1` **`onUseBlock`** na interaÃ§Ã£o â€” o primeiro bloco do jogo que se **usa** em vez de sÃ³ empilhar
- [~] 1335 `P1` **Ponto de renascimento por jogador**, nÃ£o por mundo: a cama do anfitriÃ£o puxaria os convidados para dentro dela
- [~] 1336 `P1` **9 travas de fiaÃ§Ã£o**, incluindo "a morte usa o ponto, nÃ£o `findSpawn()`" â€” o erro provÃ¡vel era a cama salvar, aparecer no save e nÃ£o fazer nada
- [~] 1337 `P2` **Objetivo "Fabrique uma cama"** entre o abrigo e o carvÃ£o
- [~] 1338 `P2` **Mundo encerrado riscado na lista**, com a data e o botÃ£o desabilitado

### Lacunas anotadas nesta rodada

- [~] 1339 `P1` **Dormir atÃ© o amanhecer** â€” `src/game/dormir.ts`, com as quatro recusas explicadas; ver a seÃ§Ã£o 62
- [~] 1340 `P1` **O ponto Ã© conferido na hora de usar** â€” corpo inteiro, nÃ£o sÃ³ os pÃ©s; se ficou soterrado, volta ao spawn do mundo com aviso
- [ ] 1341 `P2` **NÃ£o hÃ¡ como ver nem limpar o ponto de renascimento** â€” quem esqueceu onde dormiu nÃ£o tem como descobrir, e nÃ£o hÃ¡ como voltar ao spawn original sem morrer lÃ¡
- [ ] 1342 `P2` **A cama nÃ£o Ã© sincronizada no multijogador** â€” o bloco Ã© replicado, mas o "usei esta cama" Ã© local, o que estÃ¡ certo; falta o convidado ver que a cama do anfitriÃ£o foi usada

---

## 62 â€” Dormir atÃ© o amanhecer (itens 1339, 1340, e a auditoria do 009)

A cama definia onde renascer, e nada mais. Isso Ã© metade do que uma cama significa no gÃªnero, e era
a metade menos interessante: quem fez tudo certo â€” casa fechada, tocha acesa, cama no canto â€” ainda
tinha que **esperar a noite passar olhando para a parede**. Sete minutos e meio de relÃ³gio real, sem
nada para fazer, como recompensa por ter se preparado bem.

### As quatro recusas, e o que cada uma protege

Elas vivem num mÃ³dulo puro porque cada uma Ã© uma regra de jogo com uma razÃ£o â€” nÃ£o uma guarda
defensiva. Enterradas num `if` composto dentro do laÃ§o principal, seriam indistinguÃ­veis umas das
outras, e a primeira a ser "simplificada" levaria a razÃ£o junto.

**De dia, nÃ£o.** Adiantaria o relÃ³gio um dia inteiro para pularâ€¦ o dia. O jogador perderia as horas
de luz, que sÃ£o justamente quando dÃ¡ para explorar a superfÃ­cie em seguranÃ§a.

**A cÃ©u aberto, nÃ£o.** Esta Ã© a regra que faz dormir ser a **recompensa por ter se preparado**, e
nÃ£o a maneira de nÃ£o precisar se preparar. Sem ela a cama vira um botÃ£o de pular a noite, e a noite
Ã© metade do jogo: o perigo, o motivo de construir, o motivo de fazer tochas.

**Convidado, nÃ£o.** O relÃ³gio do mundo Ã© do anfitriÃ£o. Um convidado adiantando o prÃ³prio veria um
amanhecer que nÃ£o aconteceu para mais ninguÃ©m, e a correÃ§Ã£o seguinte o puxaria de volta â€” o sol
subiria e desceria na cara dele.

**JÃ¡ dormindo, nÃ£o.**

E cada recusa **devolve a frase pronta**, nÃ£o um cÃ³digo. "NÃ£o Ã© possÃ­vel dormir" manda o jogador
adivinhar entre quatro motivos, e o mais provÃ¡vel Ã© ele concluir que a cama estÃ¡ quebrada. Um teste
exige que as quatro frases sejam diferentes entre si: quatro recusas com a mesma frase sÃ£o uma sÃ³.

### TrÃªs detalhes que falham calados

**Dormir acelera, nÃ£o salta.** A luz do cÃ©u estÃ¡ assada na cor dos vÃ©rtices, e o mundo Ã© re-meshado
quando `sunScale` cruza o limiar. Um salto faria isso de uma vez, com o sol pulando no cÃ©u e um
engasgo visÃ­vel. A 90Ã— a noite passa em uns 4 segundos, pelos mesmos degraus de sempre.

**Acordar Ã© decidido pela FASE**, nÃ£o por um valor de `timeOfDay`. Ã‰ a mesma noÃ§Ã£o que o resto do
jogo usa para dizer o que Ã© noite; um nÃºmero solto aqui poderia sair de sincronia com ela sem nada
apontar a discordÃ¢ncia. E sem a parada, o relÃ³gio a 90Ã— daria voltas no dia inteiro.

**Acordar avisa os convidados na hora.** O envio periÃ³dico Ã© de 10 em 10 segundos, e nesse intervalo
eles ainda estariam de noite â€” com o cÃ©u de outro horÃ¡rio e criaturas que o anfitriÃ£o jÃ¡ nÃ£o simula.

**Definir o ponto acontece sempre, antes de qualquer recusa.** Ã‰ a metade da cama que nÃ£o pode
falhar: quem tentar dormir de dia ainda assim quer ter marcado ali o lugar para onde volta.

### O ponto conferido na hora de usar (1340)

Entre gravar e morrer, o mundo muda. Quem tapar o prÃ³prio quarto com pedra â€” ou tiver a casa
preenchida por um amigo, por um fluido escoando ou por um script de mod â€” renasceria **dentro da
rocha**, preso, no momento em que acabou de morrer e ainda estÃ¡ entendendo o que houve. O spawn do
mundo Ã© uma volta longa, mas Ã© uma volta; ficar entalado nÃ£o Ã©.

A conferÃªncia Ã© do **corpo inteiro**, nÃ£o sÃ³ dos pÃ©s: com o pÃ© livre e a cabeÃ§a na pedra, o jogador
nasce com a cÃ¢mera dentro do bloco e vÃª o mundo de dentro para fora.

### O item 009, auditado em vez de refeito

"Inimigos surgem sÃ³ apÃ³s o anoitecer" jÃ¡ acontecia, e por uma regra melhor que a literal:
`effectiveLight = max(sky * sunScale, block)`. Ao meio-dia a superfÃ­cie dÃ¡ 15 e nada nasce; de
madrugada dÃ¡ ~1,8 e passa do limiar 6. Caverna gera de dia tambÃ©m, que Ã© o comportamento certo â€” a
regra Ã© a **luz**, nÃ£o a hora, e Ã© isso que faz a tocha ser ferramenta de territÃ³rio.

- [~] 1343 `P1` **`dormir.ts`** com as quatro recusas explicadas, 11 testes
- [~] 1344 `P1` **4 travas de fiaÃ§Ã£o** â€” o mÃ³dulo Ã© puro e passaria nos 11 testes com a cama continuando a sÃ³ definir spawn

### Lacunas anotadas nesta rodada

- [ ] 1345 `P2` **A primeira noite nÃ£o Ã© enquadrada como evento** â€” ela tem peso mecÃ¢nico (hostis, abrigo, dormir), mas nada no jogo a marca como diferente das outras
- [~] 1346 `P2` **VÃ©u de sono** que escurece por transiÃ§Ã£o, nÃ£o por corte â€” o gradual Ã© a informaÃ§Ã£o, um corte seco pareceria congelamento
- [~] 1347 `P2` **`descansar(segundos)`** â€” e a descoberta que veio junto: o corpo NÃƒO atravessava a noite que o mundo atravessava; ver a seÃ§Ã£o 63
- [ ] 1348 `P3` **O convidado nÃ£o tem como pedir para dormir** â€” a recusa Ã© honesta, mas num mundo compartilhado ninguÃ©m dorme nunca, a menos que o anfitriÃ£o resolva

---

## 63 â€” O corpo que nÃ£o atravessava a noite (itens 1346, 1347)

Fui acrescentar "dormir restaura vida" e encontrei um buraco maior do lado.

**Dormir corre o relÃ³gio do MUNDO a 90Ã—, mas `update(dt)` continua recebendo o `dt` real.** Uma
noite inteira passava para o mundo â€” uns seis minutos de jogo â€” e **quatro segundos** para o corpo.
Metade da barra de fome deixava de ser cobrada, e dormir virava a maneira mais eficiente de nÃ£o
comer.

NÃ£o falharia em lugar nenhum. A fome simplesmente decairia mais devagar para quem dorme, e a
explicaÃ§Ã£o estaria a trÃªs arquivos de distÃ¢ncia do sintoma: quem notasse concluiria que a fome Ã©
lenta demais e mexeria na constante errada.

`descansar(segundos)` cobra do corpo o perÃ­odo que o mundo pulou, com duas decisÃµes:

**Descansar custa metade.** Um corpo parado gasta menos que um corpo cavando. Ã‰ o que dÃ¡ Ã  cama uma
vantagem real alÃ©m do tempo â€” sem isso, dormir seria neutro e continuaria valendo mais minerar a
noite toda. O teste compara as duas coisas de frente: dormir uma noite contra ficar acordado a mesma
noite, simulada em passos de meio segundo.

**A fome Ã© conferida DEPOIS do gasto.** Na ordem inversa, uma noite que zera a barra ainda curaria â€”
e dormir seria uma forma de trocar comida por vida sem ter comida.

O vÃ©u de sono (1346) usa `opacity` com transiÃ§Ã£o, e nÃ£o `display`: o escurecer gradual Ã© a
informaÃ§Ã£o, porque Ã© ele que comunica a passagem do tempo. Um corte seco pareceria congelamento. E
hÃ¡ trava exigindo que ele acenda **e apague** â€” acender e esquecer deixaria a tela preta para
sempre depois da primeira noite, sem nada indicando por quÃª.

- [~] 1349 `P1` **`descansar`** com 6 testes, incluindo "dormir de barriga vazia nÃ£o cura"
- [~] 1350 `P1` **2 travas de fiaÃ§Ã£o** â€” o mÃ©todo Ã© puro e passaria em todos os testes com o jogo nunca o chamando

### Lacunas anotadas nesta rodada

- [x] 1351 `P1` ~~O mesmo descompasso vale para qualquer salto de relÃ³gio~~ â€” **RETIRADO depois de olhar melhor.** NÃ£o existe comando `/time`, e o Ãºnico outro salto Ã© a correÃ§Ã£o `world_time` do convidado. Cobrar o corpo ali seria **errado**: o convidado nÃ£o pulou tempo, ele estava *enganado* sobre a hora â€” o corpo dele viveu em tempo real o tempo todo, e cobrÃ¡-lo puniria uma correÃ§Ã£o de rede. Dormir Ã© o Ãºnico salto de verdade
- [ ] 1352 `P3` **Criaturas e fluidos tambÃ©m nÃ£o atravessam a noite** â€” o mundo pula seis minutos e nenhuma poÃ§a escoou. Rebaixado a `P3`: no caso dos hostis o comportamento Ã© o **desejado** (dormir existe para pular a noite deles), e no dos fluidos o efeito Ã© imperceptÃ­vel

---

## 64 â€” A ressalva do GLSL, encurtada (item 1206)

Venho repetindo o mesmo aviso hÃ¡ vÃ¡rias rodadas: trÃªs sistemas injetam GLSL por `onBeforeCompile`,
**nada compila esses shaders num teste**, e o sintoma de uma injeÃ§Ã£o malformada nÃ£o Ã© um erro na
tela â€” Ã© o terreno inteiro desaparecer.

Compilar de verdade exige WebGL, e jsdom nÃ£o tem. Um contexto headless traria dependÃªncia nativa que
quebra a cada versÃ£o de Node: o remÃ©dio custaria mais que a doenÃ§a. Mas hÃ¡ uma metade verificÃ¡vel, e
ela cobre a classe de falha **silenciosa**.

A injeÃ§Ã£o funciona por substituiÃ§Ã£o de texto, e `String.replace` que nÃ£o encontra o alvo **nÃ£o faz
nada e nÃ£o avisa**. Se o three.js renomear um chunk numa versÃ£o nova â€” e ele faz isso â€”, a injeÃ§Ã£o
para de acontecer sem um Ãºnico erro: a curvatura sumiria, a onda pararia, e o jogo continuaria
rodando bonito e errado.

`THREE.ShaderLib` Ã© dado puro em JavaScript. O teste pega o shader **real** do material que o jogo
usa, roda a injeÃ§Ã£o de verdade em cima dele, e exige que o resultado tenha mudado â€” por injeÃ§Ã£o, e
nÃ£o pelo shader inteiro: se trÃªs acertarem o alvo e uma errar, o shader muda e uma verificaÃ§Ã£o
grosseira passaria enquanto a quarta funcionalidade some.

### Dois testes meus que estavam errados, e o que eles me ensinaram

Escrevi "nenhum marcador sobrou por substituir" e falhou. **Duas das quatro injeÃ§Ãµes preservam o
marcador de propÃ³sito**: `#include <color_vertex>` seguido do nosso cÃ³digo, porque o chunk original
precisa rodar antes â€” o tingimento multiplica `vColor`, que sÃ³ existe depois que o include o
preencheu. SÃ³ `project_vertex` Ã© substituÃ­do por inteiro, porque ali o nosso cÃ³digo refaz a projeÃ§Ã£o.

Isso virou um teste prÃ³prio, para o erro **simÃ©trico**: trocar o corpo da substituiÃ§Ã£o e esquecer de
repetir o `#include` na saÃ­da. O nosso cÃ³digo continuaria lÃ¡, o outro teste passaria, e o chunk do
three.js deixaria de rodar â€” `vColor` nunca receberia a cor do vÃ©rtice, e o mundo inteiro ficaria de
uma cor sÃ³.

O segundo erro: testei a onda pelo nome do uniform, e `uOndaTempo` Ã© declarado nos dois materiais
porque o prelÃºdio de uniforms Ã© um sÃ³. A comparaÃ§Ã£o certa Ã© pelo **deslocamento** (`sin(cqWorld.x`),
senÃ£o o teste passa a impressÃ£o de que o terreno tambÃ©m ondula.

**O que este arquivo NÃƒO prova**, e estÃ¡ escrito nele: que o GLSL compila. Um `vec3` somado a um
`float`, um uniform com nome trocado ou um ponto e vÃ­rgula a menos passam por aqui. O item 1206
segue aberto â€” com escopo menor e a parte barata resolvida.

- [~] 1353 `P1` **`marcadoresDeShader.test.ts`** â€” 11 testes contra o `ShaderLib` real
- [~] 1354 `P2` **Trava do material** â€” trocar o Lambert por Standard sem atualizar o teste faria tudo continuar verde verificando o shader errado
- [~] 1355 `P2` **Chaves e parÃªnteses balanceados** na saÃ­da â€” a forma mais comum de quebrar uma injeÃ§Ã£o por concatenaÃ§Ã£o, e a de sintoma mais assustador

---

## 65 â€” Auditoria: o que falta, e o que estava marcado errado

Varredura dos 26 `P0` pendentes, conferindo cada um contra o cÃ³digo em vez de reler o checklist.

### Dois estavam marcados errado

**1075 (passe de LUT) nÃ£o Ã© tarefa pendente â€” Ã© decisÃ£o tomada e escrita.** `src/render/grading.ts`
explica por que o `EffectComposer` foi recusado: alvo de render do tamanho da tela, uma cÃ³pia por
quadro e um passe sobre cada pixel, num projeto que nasceu do relato *"estÃ¡ muito muito travado"*. A
gradaÃ§Ã£o em seis instruÃ§Ãµes dentro do fragmento que jÃ¡ ia rodar entrega o mesmo visual. A limitaÃ§Ã£o
estÃ¡ assumida no arquivo: alcanÃ§a terreno, Ã¡gua e vidro, nÃ£o personagem, criaturas nem cÃ©u.

Ficar como `P0` pendente Ã© pior que estar fechado ou aberto â€” Ã© um bloqueador aparente que ninguÃ©m
ia atacar, inflando a fila e escondendo o que de fato falta. Ã‰ o terceiro erro de auditoria deste
tipo, depois do 1077 (ACES) e do 053 (oclusÃ£o de ambiente).

**502 (validador de casa) tem o miolo pronto.** `estaAbrigado` jÃ¡ responde "este espaÃ§o Ã© fechado?"
por busca em largura â€” a parte difÃ­cil. Faltam porta, luz mÃ­nima e mobÃ­lia, e a porta nem existe
como bloco ainda.

### Os 25 que restam, em cinco blocos

NÃ£o sÃ£o 25 tarefas independentes: sÃ£o **cinco frentes**, e trÃªs delas se resolvem por uma decisÃ£o de
arquitetura cada.

**A. Sandbox de mods em Worker** â€” 358, 1239, 1251, 1252. Uma frente sÃ³. O custo real nÃ£o Ã© o Worker:
Ã© tornar a API de mods **assÃ­ncrona**, porque `api.world.getBlock(x,y,z)` nÃ£o atravessa a fronteira
de reino de execuÃ§Ã£o sem virar `await`. Isso quebra todo mod jÃ¡ escrito. Ã‰ a Ãºnica coisa que fecha a
saÃ­da por `[].constructor.constructor('return this')()`, hoje documentada num teste que passa quando
a fuga funciona.

**B. Capacidades e rede de mod** â€” 761â€“768, 775. Nove itens, uma frente. Hoje o mod **nÃ£o tem rede
nenhuma** (o sandbox bloqueia `fetch`), entÃ£o nada estÃ¡ inseguro: o que falta Ã© a maneira de dar rede
com controle. Depende de A para valer de verdade, porque um wrapper de `fetch` num reino onde o
script alcanÃ§a o global Ã© decorativo.

**C. Voz P2P** â€” 927â€“932. Seis itens, uma frente, independente das outras. A `RTCPeerConnection` jÃ¡
existe; falta a trilha de Ã¡udio e a renegociaÃ§Ã£o.

**D. ConteÃºdo gerado por mod** â€” 676, 677, 689, 690. Mods registrarem biomas e regras de
espalhamento. NÃ£o existe nada disso hoje.

**E. Mundo vertical** â€” 029, 495, 496. Dobrar a altura e dar identidade Ã s camadas. O 029 segue
adiado com motivo: dobra a memÃ³ria por chunk, muda o custo de iluminaÃ§Ã£o e o formato de save, e o
modo de falha Ã© **corrupÃ§Ã£o de save** â€” que eu nÃ£o consigo verificar sem rodar o jogo.

### O que isto quer dizer para "o que fazer agora"

Nenhuma das cinco Ã© pequena, e quatro delas sÃ£o de infraestrutura, nÃ£o de jogo. A frente com melhor
razÃ£o entre valor e risco Ã© **C (voz)**: Ã© a Ãºnica isolada, nÃ£o depende de A, nÃ£o toca o formato de
save, e o que ela entrega â€” falar com quem estÃ¡ no mesmo mundo â€” Ã© imediatamente perceptÃ­vel.

**A frente A Ã© a mais importante e a mais cara**, e vale dizer por quÃª: enquanto ela nÃ£o existir,
todo o resto do sistema de mods estÃ¡ construÃ­do sobre uma fronteira que o prÃ³prio teste admite ser
furada.

- [x] 1356 `P1` **Auditoria dos 26 `P0`** â€” dois corrigidos, cinco frentes identificadas

---

## 66 â€” A base do sandbox: mods assÃ­ncronos sem um dia de ruptura (itens 1251, 1252)

A frente que destrava as outras. O item 358 â€” rodar o script num Web Worker â€” Ã© a Ãºnica coisa que
fecha a saÃ­da por `[].constructor.constructor('return this')()`, hoje documentada num teste que
**passa quando a fuga funciona**. E a seÃ§Ã£o 51 jÃ¡ tinha medido o obstÃ¡culo: nÃ£o Ã© o Worker, Ã© a API.

Um Worker sÃ³ conversa por `postMessage`. Toda leitura do mundo â€” `api.world.getBlock(x, y, z)` â€”
vira ida e volta assÃ­ncrona no dia em que o script sair deste reino de execuÃ§Ã£o. Trocar o tipo de
retorno naquele dia quebraria **todo mod jÃ¡ escrito**, de uma vez, sem aviso.

### A migraÃ§Ã£o que nÃ£o tem dia de ruptura

O corpo do script virou uma funÃ§Ã£o `async`. Custa nada hoje â€” `await` sobre um valor que nÃ£o Ã©
promessa devolve o prÃ³prio valor â€” e faz os dois formatos serem vÃ¡lidos **ao mesmo tempo**:

```js
const bloco = await api.world.getBlock(1, 10, 1);   // funciona agora, e continuarÃ¡ funcionando
```

Um mod escrito assim roda hoje com a API sÃ­ncrona e continua rodando depois com a do Worker, sem uma
linha alterada. Ã‰ por isso que o item 1252 (migrar os mods existentes) nÃ£o tem o que migrar: nÃ£o hÃ¡
um momento em que os dois mundos deixem de coexistir.

E a referÃªncia que o agente lÃª passou a pedir `await`, **com exemplo** â€” texto explicando Ã© menos
eficaz que exemplo demonstrando, porque o agente copia o exemplo. Sem isso, todo mod novo nasceria
no formato antigo e a migraÃ§Ã£o evitada aqui voltaria a ser necessÃ¡ria, com mais mods para reescrever.

### TrÃªs coisas que o corpo `async` quebra, e ninguÃ©m veria

**Erro depois de um `await` some.** O `try/catch` do despacho sÃ³ pega o que estoura antes do primeiro
`await`; o resto vira promessa rejeitada. Sem tratamento, seria uma rejeiÃ§Ã£o nÃ£o tratada no console
â€” o script continuaria ligado, errando para sempre, e o contador que o desliga nunca subiria.

**A carga reportaria sucesso mentindo.** Sem `await` na compilaÃ§Ã£o, um script que falha depois do
primeiro `await` seria dado como carregado, e o agente diria ao jogador que estÃ¡ tudo certo.

**Bloco escrito depois do `await` ficaria preso.** A drenagem acontecia uma vez, logo apÃ³s o
handler. O que ele escrevesse depois ficaria no buffer â€” bloco colocado no jogo, ausente do save.

### E uma que o corpo `async` cria

**ReentrÃ¢ncia de `tick`.** Um `tick` assÃ­ncrono mais lento que um frame seria reentrado 60 vezes por
segundo, e cada entrada empilharia mais uma. Em segundos hÃ¡ centenas de execuÃ§Ãµes do mesmo handler
disputando o mesmo `api.storage` â€” e o sintoma nÃ£o Ã© lentidÃ£o, Ã© **o estado do mod embaralhado por
si mesmo**.

SÃ³ o `tick` Ã© pulado enquanto estÃ¡ em voo: ele Ã© periÃ³dico, e perder uma volta Ã© o que o orÃ§amento de
tempo jÃ¡ faz. Os outros eventos vÃªm de uma aÃ§Ã£o do jogador, e perder um seria perder o fato.

O registro Ã© um `WeakSet` sobre a prÃ³pria funÃ§Ã£o do handler â€” um `Set` comum seguraria a funÃ§Ã£o e,
por ela, o escopo inteiro do script, para sempre.

### O que o despacho continua NÃƒO fazendo

Ele nÃ£o espera o mod terminar. Quem chama Ã© o laÃ§o de renderizaÃ§Ã£o, e esperar entregaria a cada mod o
poder de congelar o jogo â€” um handler que nunca resolve travaria a aba inteira. HÃ¡ teste para isso.

- [~] 1357 `P0` **Corpo do script `async`** em `sandbox.ts`, com o modo estrito preservado
- [~] 1358 `P0` **Carga aguarda o corpo** antes de reportar sucesso
- [~] 1359 `P0` **RejeiÃ§Ã£o de handler contabilizada e capaz de desligar o script**
- [~] 1360 `P1` **Drenagem de blocos tambÃ©m depois do `await`**
- [~] 1361 `P1` **ReentrÃ¢ncia de `tick` bloqueada**, com teste de que o handler volta a ser chamado depois
- [~] 1362 `P1` **`ehPromessa` por forma (`.then`), nÃ£o por `instanceof`** â€” a promessa vinda do Worker nÃ£o Ã© `instanceof` a Promise desta janela
- [~] 1363 `P1` **10 testes novos**, e os 15 existentes migrados para `await`

### Lacunas anotadas nesta rodada

- [~] 1364 `P1` **Resolvido por mudanÃ§a de natureza**: com o script fora deste thread, o que precisa de teto nÃ£o Ã© o tempo dele e sim quantas chamadas ele faz voltar para cÃ¡
- [ ] 1365 `P2` **Nada avisa o autor do mod de que ele esqueceu um `await`** â€” uma leitura sem `await` funciona hoje e vai quebrar no Worker. Um aviso no log ao detectar `getBlock` usado como valor bruto pouparia a descoberta tardia
- [~] 1366 `P2` **`flush` reconfere o contexto** â€” bloco de mod jÃ¡ descarregado nÃ£o Ã© mais gravado em nome dele

### ContinuaÃ§Ã£o da 66 â€” a corrida do descarregamento, e um teste meu que passava errado

**1366:** um handler assÃ­ncrono pode terminar **depois** de o mod ser descarregado â€” o jogador
desligou o mod, ou o editor salvou uma revisÃ£o nova, enquanto uma promessa ainda corria. Os blocos
seriam gravados e replicados em nome de um mod que jÃ¡ nÃ£o existe, e o desfazer nÃ£o os alcanÃ§aria:
chegaram depois de a atribuiÃ§Ã£o ter sido apagada. `flush` passou a reconferir que o contexto ainda Ã©
o registrado.

**E o teste que escrevi para isso passava pelo motivo errado.** Usei
`await new Promise((r) => setTimeout(r, 5))` dentro do mod â€” e o sandbox **nÃ£o entrega `setTimeout`
ao mod**. O handler estourava um `TypeError` antes de escrever bloco nenhum, e o teste ficava verde
provando que a guarda funciona quando nÃ£o hÃ¡ nada para guardar. SÃ³ o par simÃ©trico ("o mod vivo
continua gravando") revelou o engano, ao falhar.

Fica registrado o fato que eu nÃ£o tinha percebido: **um mod hoje nÃ£o consegue adiar para uma
macrotarefa.** Sem `setTimeout` nem `setInterval`, o Ãºnico assÃ­ncrono que ele alcanÃ§a sÃ£o
microtarefas e a prÃ³pria API. Isso limita a reentrÃ¢ncia de `tick` **hoje** â€” e deixa de limitar no
dia do Worker, quando cada chamada de API vira ida e volta de verdade. Ã‰ exatamente por isso que a
proteÃ§Ã£o foi construÃ­da agora, e nÃ£o lÃ¡.

- [~] 1367 `P1` **Guarda de contexto no `flush`**, com o par simÃ©trico que impede "consertar" parando de gravar

---

## 67 â€” Item 358: o desenho, medido, e por que ele nÃ£o foi feito nesta rodada

Com o 1251 pronto, o obstÃ¡culo que a seÃ§Ã£o 51 apontou deixou de existir: a API jÃ¡ pode ser
assÃ­ncrona sem quebrar mod nenhum. O 358 virou executÃ¡vel. Ele **nÃ£o** foi executado agora, e a razÃ£o
Ã© a mesma que venho aplicando o tempo todo â€” mover a execuÃ§Ã£o para outro reino Ã© all-or-nothing, e
um Worker meio ligado seria pior que nenhum: os testes de sandbox continuariam verdes descrevendo um
isolamento que nÃ£o estÃ¡ no caminho da execuÃ§Ã£o.

Fica o desenho medido, para a prÃ³xima rodada comeÃ§ar escrevendo cÃ³digo em vez de decidindo.

### As duas peÃ§as

**`src/mods/modWorker.ts`** â€” o reino de execuÃ§Ã£o. Roda os corpos de script, guarda os handlers, e
expÃµe uma `api` que Ã© um proxy de RPC. Ã‰ aqui que a fuga pelo construtor deixa de importar:
`[].constructor.constructor('return this')()` devolve o global **daquele** reino, e ali `fetch`,
`importScripts`, `indexedDB` e `XMLHttpRequest` foram apagados no primeiro instante de vida.

**`src/mods/PonteDeMods.ts`** â€” no thread principal. Dona do `Worker`, traduz cada RPC numa chamada
do `ModHostBridge` que jÃ¡ existe, e empurra os eventos para dentro. Ã‰ ela que substitui o
`compilarScriptDeMod` de hoje dentro do `ModRuntime`.

### O que atravessa a fronteira, e o que nÃ£o precisa

| Membro | Onde vive | Por quÃª |
|---|---|---|
| `api.on` | **worker** | registro de handler Ã© local; nÃ£o hÃ¡ por que sair |
| `api.storage` | **worker** | estado por mod, sem leitor do outro lado â€” cada `get` viraria ida e volta por nada |
| `api.mod`, `api.B`, `api.Math`, `api.audio.nomes` | **worker**, enviados na carga | sÃ£o dados constantes; enviar uma vez Ã© mais barato e faz `api.B.STONE` continuar sÃ­ncrono |
| `api.world.*`, `api.player.*`, `api.entities.*`, `api.time.*`, `api.weather.*`, `api.season.*`, `api.ui.*`, `api.audio.play`, `api.env.*` | **RPC** | dependem do estado vivo do jogo |
| `api.console.*` | **RPC**, unidirecional | nÃ£o espera resposta, e a redaÃ§Ã£o de segredos (seÃ§Ã£o 52) precisa continuar acontecendo do lado que conhece o cofre |

### As trÃªs decisÃµes que jÃ¡ estÃ£o tomadas

**Escritas nÃ£o esperam resposta.** `setBlock` e `fillBox` devolvem valores que quase nenhum mod usa.
FazÃª-las esperar o retorno transformaria uma construÃ§Ã£o de 20.000 blocos em 20.000 idas e voltas. Elas
viram mensagens de mÃ£o Ãºnica, e o resultado agregado volta no `flush`.

**Leituras esperam, e Ã© por isso que o 1251 veio antes.** `await api.world.getBlock(...)` jÃ¡ Ã© o
formato ensinado na referÃªncia.

**O orÃ§amento de tempo muda de natureza.** Hoje `TICK_BUDGET_MS` mede tempo sÃ­ncrono no thread
principal. Com o script fora dele, o mod nÃ£o pode mais travar o jogo â€” mas passa a poder inundar a
ponte de mensagens. O limite deixa de ser milissegundos de CPU e vira **mensagens por frame**. Isto Ã©
o item 1364, e ele deixa de ser opcional no dia do Worker.

### O que fica difÃ­cil, e Ã© honesto dizer antes

- **Teste.** vitest com jsdom nÃ£o tem `Worker`. Os testes do reino isolado ou usam um duplo de
  `postMessage` (prova a ponte, nÃ£o o isolamento) ou exigem um ambiente de navegador de verdade.
  Provavelmente os dois: duplo para a lÃ³gica, e um teste manual documentado para o isolamento.
- **`api.env`**, que entrega segredos ao script, passa a mandÃ¡-los por `postMessage` para outro
  reino. Continua tudo no cliente, mas Ã© uma cÃ³pia a mais do segredo â€” e a redaÃ§Ã£o do log precisa
  continuar acontecendo do lado do host, nunca do worker.
- **O teste que passa quando a fuga funciona** (`modSandbox.test.ts`) precisa ser **invertido** no
  mesmo commit, senÃ£o ele passa a mentir na direÃ§Ã£o contrÃ¡ria.

- [~] 1368 `P0` **`modWorker.ts` + `nucleoDoWorker.ts`** â€” reino de execuÃ§Ã£o com globais apagados. **Escrito e testado, ainda NÃƒO no caminho de execuÃ§Ã£o** (ver 1373)
- [~] 1369 `P0` **`PonteDeMods.ts`** â€” RPC com escritas de mÃ£o Ãºnica, 16 testes ponta a ponta por portas falsas
- [~] 1370 `P0` **Reenquadrado, nÃ£o invertido** â€” a fuga Ã© real e continua real; o que mudou foi o reino em que o script roda
- [~] 1371 `P1` **Feito com o 1385** â€” o relÃ³gio deu lugar Ã  contagem de chamadas
- [ ] 1372 `P1` Teste manual documentado do isolamento, jÃ¡ que jsdom nÃ£o tem `Worker`

---

## 68 â€” O reino isolado, construÃ­do e testado â€” e ainda desligado

As trÃªs peÃ§as do desenho da seÃ§Ã£o 67 existem: `protocoloDeMods.ts` (o contrato),
`nucleoDoWorker.ts` (o que roda lÃ¡ dentro), `modWorker.ts` (a casca que apaga os globais) e
`PonteDeMods.ts` (o lado de cÃ¡). 16 testes ponta a ponta.

**E nada disso estÃ¡ no caminho de execuÃ§Ã£o ainda.** O `ModRuntime` continua compilando os scripts no
thread principal. Digo isto em primeiro lugar, e mantive o teste da fuga pelo construtor como estÃ¡ â€”
ele continua passando quando a fuga funciona, porque **a fuga continua real na execuÃ§Ã£o de hoje**.
InvertÃª-lo agora seria a mentira exata que a seÃ§Ã£o 67 previu.

### A decisÃ£o que molda a fronteira inteira: escrita nÃ£o espera

`setBlock` devolve se conseguiu, e quase nenhum mod olha. Se cada escrita esperasse resposta, uma
construÃ§Ã£o de 20.000 blocos viraria 20.000 idas e voltas. Escritas sÃ£o **mÃ£o Ãºnica**: vÃ£o, devolvem
`true` otimisticamente, e nÃ£o geram mensagem de volta â€” hÃ¡ teste que conta as mensagens para provar.

`fillBox` Ã© o caso que confirma a regra pelo avesso: ele *Ã©* escrita, mas devolve uma contagem que sÃ³
o lado do mundo sabe. FazÃª-lo no worker chamando `setBlock` N vezes seriam N mensagens; virou uma
leitura sÃ³, calculada inteira deste lado.

### TrÃªs coisas que sÃ³ apareceram ao construir

**As constantes nÃ£o podem atravessar.** `api.B.STONE` precisa continuar sendo um nÃºmero. Por RPC,
`if (bloco === api.B.STONE)` compararia um nÃºmero com uma promessa e daria **sempre falso** â€” sem
erro nenhum, com o mod simplesmente nunca reagindo. Elas sÃ£o enviadas uma vez, na carga.

**`api.storage` nÃ£o pode atravessar.** O mod o usa dentro de `tick`, sessenta vezes por segundo, e
nÃ£o hÃ¡ um Ãºnico leitor deste lado. Fica inteiro no worker; hÃ¡ teste que prova que nenhuma chamada
sai.

**O log tem que atravessar, e no sentido contrÃ¡rio do Ã³bvio.** A redaÃ§Ã£o de segredos (seÃ§Ã£o 52)
acontece ao gravar, do lado que conhece o cofre. Se o log fosse formatado no worker, o valor da
chave de API teria que viajar atÃ© lÃ¡ em texto para ser mascarado â€” ou sairia sem mÃ¡scara.

### O membro esquecido estoura em vez de sumir

O buraco de fiaÃ§Ã£o mais provÃ¡vel desta arquitetura Ã© acrescentar um membro em `MEMBROS_DA_API` e
esquecer de ligÃ¡-lo na ponte. Devolver `undefined` em silÃªncio faria o mod receber um valor vazio e
seguir em frente, com o defeito aparecendo trÃªs passos adiante. A ponte lanÃ§a dizendo o nome, e hÃ¡
um teste que percorre o protocolo inteiro e fixa exatamente quais membros ainda dependem de
`extras`.

### O que fica sem cobertura, dito com todas as letras

**O isolamento.** Os testes ligam nÃºcleo e ponte por portas falsas, no mesmo reino. Que
`[].constructor.constructor('return this')()` devolva um global vazio depende de `modWorker.ts` ter
apagado `fetch` e `indexedDB` num Worker de verdade â€” e `vitest` com jsdom nÃ£o tem `Worker`. A
lÃ³gica, que Ã© onde os defeitos aparecem, estÃ¡ coberta; a seguranÃ§a, que Ã© onde ela mora, nÃ£o estÃ¡.

- [~] 1373 `P0` **`ModRuntime` ligado Ã  ponte** â€” deixou de executar e passou a coordenar
- [x] 1374 `P1` ~~Ligar os `extras`~~ â€” **desapareceu como tarefa.** A ponte passou a delegar Ã  `buildModAPI` que jÃ¡ existe, entÃ£o nÃ£o hÃ¡ `extras` a ligar: hÃ¡ uma implementaÃ§Ã£o sÃ³. Ver a continuaÃ§Ã£o da seÃ§Ã£o 68
- [~] 1375 `P1` **Teste da fuga reenquadrado** no mesmo commit â€” ele continua passando quando a fuga funciona, e agora explica por que isso deixou de importar

### ContinuaÃ§Ã£o da 68 â€” a ponte que parou de reimplementar, e um defeito meu que o teste pegou

**O item 1374 deixou de existir.** A primeira versÃ£o da ponte tinha um `switch` traduzindo cada
membro numa chamada do host, e uma lista de `extras` para o que exigia mais lÃ³gica. Estava errada
por duplicaÃ§Ã£o: `fillBox` conta blocos, `findNearest` varre um cubo, `setBlock` resolve nome de bloco
e cobra do orÃ§amento, `isNight` interpreta a hora. Reescrever isso do lado da ponte criaria **duas**
implementaÃ§Ãµes de cada regra, e a segunda a mudar sairia de sincronia em silÃªncio.

Um mod se comportando diferente conforme o lado em que roda Ã© o pior defeito possÃ­vel numa migraÃ§Ã£o
como esta â€” ele aparece como "o mod parou de funcionar depois que vocÃªs mudaram alguma coisa", sem
nada apontando o quÃª.

A ponte agora resolve o caminho (`world.fillBox`) dentro do objeto que `buildModAPI` jÃ¡ devolve. A
fronteira virou **transporte puro**, que Ã© tudo o que ela deveria ser. E o teste que antes sÃ³ podia
exigir "falhe ruidosamente quando faltar" passou a exigir o que importa: **nada falta** â€” os 30
membros do protocolo existem todos na API real.

### O defeito que o teste novo encontrou, no meu prÃ³prio cÃ³digo

Eu conferia o mÃ©todo recebido com `metodo in MEMBROS_DA_API`. **`in` percorre a cadeia de
protÃ³tipos**, entÃ£o `constructor`, `toString`, `valueOf`, `hasOwnProperty` e `__proto__` passavam
pela conferÃªncia â€” nomes que vÃªm de graÃ§a em todo objeto literal e que nunca estiveram no protocolo.

Nenhum deles chega a executar hoje, porque o passo seguinte nÃ£o os encontra na API. Mas numa
fronteira em que o outro lado roda cÃ³digo escrito por uma IA, **"nÃ£o executa por acaso" Ã© uma
garantia diferente de "Ã© recusado por regra"** â€” e sÃ³ a segunda continua valendo depois de alguÃ©m
mudar o passo seguinte. Passou a ser `Object.hasOwn`.

Vale notar como ele apareceu: escrevi o teste esperando a mensagem "mÃ©todo desconhecido" para
`constructor`, e recebi "membro nÃ£o existe na API". A mensagem errada foi o que denunciou que a
recusa estava acontecendo no lugar errado.

- [~] 1376 `P1` **Ponte delegando Ã  `buildModAPI`** â€” uma implementaÃ§Ã£o sÃ³, fronteira como transporte
- [~] 1377 `P1` **`Object.hasOwn` no lugar de `in`** na conferÃªncia do protocolo
- [~] 1378 `P1` **Teste "todo membro declarado existe na API"**, mais forte que o "falhe ruidosamente" que a versÃ£o anterior permitia

### ContinuaÃ§Ã£o da 68 â€” a corrida que apareceu ao ir ligar

Fui comeÃ§ar o item 1373 e a primeira coisa que encontrei foi um defeito no protocolo que eu mesmo
tinha desenhado.

A contagem de handlers viajava numa mensagem **prÃ³pria**, logo depois do resultado da carga. Quem
chama `loadMod` resolve a promessa quando o resultado chega â€” e nesse instante a contagem ainda
estava em trÃ¢nsito. O painel de diagnÃ³stico leria **zero handlers para um mod recÃ©m-carregado**, e
"carregou mas nÃ£o tem handler nenhum" Ã© exatamente como um mod quebrado se parece.

A regra que fica: **duas informaÃ§Ãµes produzidas pelo mesmo ato nÃ£o devem viajar separadas.** Quem
precisa das duas fica obrigado a sincronizar o que o remetente jÃ¡ sabia junto â€” e, pior, a sincronia
funciona quase sempre, porque a segunda mensagem costuma chegar rÃ¡pido. Ã‰ o tipo de defeito que
aparece uma vez em cada cem cargas e nunca se reproduz na hora de investigar.

A contagem passou a ir dentro de `MsgCarregado`, e hÃ¡ teste fixando a **ordem** em que os dois
callbacks disparam. `MsgHandlers` continua existindo para o caso legÃ­timo em que a contagem muda fora
da carga â€” um handler registrado dentro de outro handler.

- [~] 1379 `P1` **Contagem de handlers dentro do resultado da carga**, com teste de ordem

### O item 1373 â€” o que ele Ã©, medido

Ã‰ o que falta para o 358 estar feito, e nÃ£o Ã© pequeno. Ele muda o `ModRuntime` de dono da execuÃ§Ã£o
para coordenador:

- `ctx.handlers` deixa de guardar funÃ§Ãµes e passa a guardar **contagem** (as funÃ§Ãµes vivem no worker)
- `loadMod` deixa de compilar e passa a esperar a mensagem `carregado` â€” a assinatura nÃ£o muda,
  porque ela jÃ¡ devolve promessa desde o 1251
- `dispatchTo` deixa de chamar funÃ§Ãµes e passa a mandar uma mensagem; a contagem de erros e o
  desligamento continuam aqui, alimentados por `aoFalhar`
- a drenagem de blocos deixa de acontecer logo apÃ³s o handler e passa a ser por quadro, porque as
  escritas chegam por mensagem depois
- os ~40 testes de `modRuntime.test.ts` ganham espera entre despachar e observar

O risco nÃ£o Ã© o refactor: Ã© a **migraÃ§Ã£o dos testes**. Um teste que observa antes de a mensagem
chegar falha de forma intermitente, e um que "conserta" isso com espera generosa esconde a corrida em
vez de provar a ausÃªncia dela. NÃ£o Ã© trabalho para o fim de uma sessÃ£o, e por isso fica marcado como
o prÃ³ximo passo, com o desenho jÃ¡ validado por 18 testes.

---

## 69 â€” O item 358 estÃ¡ feito: os scripts saÃ­ram deste reino

O `ModRuntime` deixou de executar e passou a coordenar. Os scripts vivem num Web Worker cujo global
foi esvaziado antes de existir um Ãºnico deles, e daqui sÃ³ saem mensagens.

**O que muda nÃ£o Ã© organizaÃ§Ã£o, Ã© garantia.** O sandbox anterior negava o alcance ao global por
`with` + `Proxy` e sempre foi honesto sobre o limite: `[].constructor.constructor('return this')()`
devolvia o objeto global **deste** reino, com `fetch` e `indexedDB` dentro â€” e o IndexedDB da mesma
origem Ã© onde moram os mundos salvos e o cofre de chaves de API.

A fuga continua funcionando. O que mudou Ã© que ela devolve o global de **lÃ¡**. A defesa deixou de ser
"eu lembrei de bloquear esse nome" e passou a ser "nÃ£o existe nada para alcanÃ§ar": a diferenÃ§a entre
uma tranca melhor e um cofre vazio.

O teste da fuga **nÃ£o foi invertido** â€” foi reenquadrado. Ele continua passando quando a fuga
funciona, porque ela Ã© real; o bloco explica por que deixou de importar, e ganhou duas travas: uma
que confere que o padrÃ£o do `ModRuntime` Ã© mesmo um `Worker`, e outra que confere que a casca apaga
os globais. Sem elas, alguÃ©m poderia devolver a execuÃ§Ã£o para cÃ¡ e todos os testes continuariam
verdes descrevendo uma proteÃ§Ã£o desligada.

### TrÃªs regressÃµes que a migraÃ§Ã£o criou, e o que cada uma ensinou

**`api.on('tickk', ...)` passou a sumir calado.** A validaÃ§Ã£o de evento vivia no `buildModAPI`, que
ficou deste lado â€” e `api.on` mudou de lado. Um mod que "nÃ£o funciona" sem nenhuma pista Ã©
especialmente ruim aqui, porque quem escreveu foi uma IA, que vai reler o log procurando o que fazer
diferente. Voltou, junto com a recusa de `on` sem funÃ§Ã£o.

**A trava de reentrÃ¢ncia de `tick` sumiu junto.** Ela morava no `ModRuntime`, e as funÃ§Ãµes mudaram
de lado â€” do lado de cÃ¡ sÃ³ se sabe que um evento foi enviado, nunca se o anterior terminou. Foi para
o nÃºcleo, e lÃ¡ ela passou a ser **mais** necessÃ¡ria que antes: no reino isolado, toda leitura da API
Ã© uma ida e volta de verdade, entÃ£o qualquer `await` jÃ¡ dura mais que um quadro.

**O mod que constrÃ³i no `load` sÃ³ via os blocos no quadro seguinte.** A drenagem passou a ser por
quadro, mas o `load` acontece dentro de `loadMod` â€” quem chama e olha o mundo na linha de baixo veria
um mundo vazio. Passou a drenar logo apÃ³s o `load`.

### Duas decisÃµes de teste que valem registro

**O duplo do reino entrega sÃ­ncrono no `modRuntime.test.ts` e assÃ­ncrono no `ponteDeMods.test.ts`.**
SÃ£o duas perguntas diferentes. LÃ¡ se testa a fronteira â€” ordem, corrida, resposta casando com a
pergunta certa â€” e isso exige entrega adiada, senÃ£o nÃ£o hÃ¡ ordem para errar. Aqui se testa o runtime:
contar erro, desligar script, drenar bloco. Se cada asserÃ§Ã£o precisasse esperar a mensagem chegar,
todo teste viraria exercÃ­cio de sincronizaÃ§Ã£o â€” e um teste de sincronizaÃ§Ã£o mal calibrado nÃ£o falha,
ele **fica intermitente**, que Ã© a pior coisa que uma suÃ­te pode ter.

**Duas tentativas de migrar os testes por script deram errado, e o erro foi o mesmo.** Um regex que
procurava o fim de um comando encontrava o `));` de dentro de um template literal, e inseria `await
assentar()` **no meio do cÃ³digo do mod**. A segunda tentativa, com rastreio de crases, ainda errou
num caso. A terceira abordagem nÃ£o foi um regex melhor: foi mudar o duplo para entrega sÃ­ncrona, o
que eliminou a necessidade de 30 das 40 esperas. **Quando a terceira tentativa de automatizar falha,
o problema costuma ser o desenho e nÃ£o a automaÃ§Ã£o.**

### O que continua sem cobertura

O isolamento em si. Os testes instalam o nÃºcleo no mesmo reino, porque jsdom nÃ£o tem `Worker`. Que o
global de lÃ¡ esteja de fato vazio depende de `esvaziarOReino()` rodar num Worker de verdade, e isso
exige navegador â€” item 1372, teste manual. O que dÃ¡ para verificar sem navegador estÃ¡ verificado: que
o padrÃ£o Ã© um `Worker`, que a lista de globais cobre `fetch` e `indexedDB`, e que a casca chama a
funÃ§Ã£o que os apaga.

- [~] 1380 `P0` **ExecuÃ§Ã£o no Worker, ligada e no caminho de produÃ§Ã£o** â€” `modWorker` sai como bundle prÃ³prio de ~7,7 kB
- [~] 1381 `P1` **ValidaÃ§Ã£o de evento e reentrÃ¢ncia de `tick`** de volta, agora no reino certo
- [~] 1382 `P1` **Drenagem logo apÃ³s o `load`**, alÃ©m da drenagem por quadro
- [~] 1383 `P1` **ConfirmaÃ§Ã£o de descarregamento** (`MsgDescarregado`) â€” Ã© o que permite drenar o que o `unload` escreveu sem esperar um nÃºmero arbitrÃ¡rio de quadros
- [~] 1384 `P1` **50 testes migrados** para a fronteira, em `modRuntime.test.ts` e `reverterMod.test.ts`

### Lacunas anotadas nesta rodada

- [~] 1385 `P0` **OrÃ§amento de 2.000 chamadas por mod, por quadro** â€” ver a seÃ§Ã£o 70
- [~] 1386 `P1` **Queda anunciada e reino recriado**, com teto de trÃªs tentativas
- [ ] 1387 `P2` **`ctx.handlers` ficou duplicado com `ctx.handlerCount`** â€” o primeiro sÃ³ Ã© preenchido quando a API Ã© construÃ­da neste reino, o que jÃ¡ nÃ£o acontece para scripts. Sai quando ninguÃ©m mais o ler

---

## 70 â€” O que a mudanÃ§a de reino tirou, e o que ela exigiu de volta (itens 1385, 1386)

Duas consequÃªncias do item 358 que **nÃ£o** eram melhorias opcionais: eram buracos abertos pela
prÃ³pria migraÃ§Ã£o.

### O relÃ³gio que parou de medir o que o nome dele promete (1385)

Enquanto os scripts rodavam neste thread, a contenÃ§Ã£o era `TICK_BUDGET_MS`: quatro milissegundos
somados entre todos os mods. Com eles no Worker, esse relÃ³gio passou a medir o custo de **enfileirar
mensagens**, que Ã© quase nada.

O resultado era pior que nÃ£o ter limite: havia um nÃºmero, com nome de orÃ§amento, dando a impressÃ£o de
proteÃ§Ã£o â€” enquanto a proteÃ§Ã£o tinha ido embora junto com a execuÃ§Ã£o.

O mod deixou de poder travar o quadro e ganhou uma forma nova de fazer estrago: **inundar a ponte**.
Cada chamada atendida roda no thread principal, entÃ£o dez mil leituras por quadro travam o jogo com o
script rodando longe. O teto virou 2.000 chamadas por mod, por quadro â€” folgado para uso legÃ­timo
(varrer uma Ã¡rea de 12Ã—12Ã—12 sÃ£o 1.728 leituras) e apertado o bastante para um laÃ§o fugido bater nele
na primeira volta.

TrÃªs decisÃµes dentro disso:

**Estourar nÃ£o desliga o script.** Um pico isolado nÃ£o deve punir um mod que costuma ser barato â€” a
mesma regra do orÃ§amento de blocos. O mod volta ao normal no quadro seguinte, sozinho.

**O orÃ§amento Ã© por mod, nÃ£o global.** Global seria um mod caro calando todos os outros, e o autor do
mod inocente nÃ£o teria como descobrir por quÃª.

**O aviso sai uma vez por quadro.** Um laÃ§o fugido faz milhares de chamadas; um aviso por chamada
encheria as 300 linhas de log do mod com a mesma frase e apagaria tudo o que havia de Ãºtil antes
dela.

### O reino que morre em silÃªncio (1386)

Um erro fatal no Worker cala **todos** os mods de uma vez, inclusive os que nÃ£o tÃªm nada a ver com o
que quebrou. E o modo como isso aparece Ã© o pior possÃ­vel: as mensagens simplesmente param de chegar,
o jogo continua rodando normal, e o jogador nÃ£o tem como distinguir "o mod nÃ£o faz nada" de "o mod
parou de existir".

O reino passou a ser recriado, com **teto de trÃªs tentativas** â€” porque o mod que derrubou o Worker o
derruba de novo assim que for recarregado, e sem teto isso vira um laÃ§o de recriaÃ§Ã£o que consome a
mÃ¡quina.

Duas coisas que sÃ³ apareceram ao testar:

**O aviso morria junto com o contexto que ele explicava.** Eu gravava "o `api.storage` foi perdido"
no contexto antigo, que Ã© descartado na recarga â€” o mod voltava com o log limpo, o estado zerado e
nenhuma pista. Passou a ser gravado no contexto **novo**, depois da recarga.

**Uma carga em curso ficaria esperando para sempre.** A resposta nunca viria do reino morto, e num
`await` sem `catch` isso Ã© a aba parada. As cargas pendentes sÃ£o resolvidas com falha.

- [~] 1388 `P0` **`CHAMADAS_POR_QUADRO`** com 5 testes, incluindo "o aviso passa mesmo com o mod estourado"
- [~] 1389 `P1` **Queda do reino tratada** com 5 testes, incluindo "desiste depois de algumas quedas seguidas"
- [~] 1390 `P1` **3 travas de fiaÃ§Ã£o novas**, sendo uma que confere que a execuÃ§Ã£o continua no Worker â€” sem ela, devolver a execuÃ§Ã£o para cÃ¡ deixaria todos os testes de sandbox verdes descrevendo uma proteÃ§Ã£o desligada

### Lacunas anotadas nesta rodada

- [ ] 1391 `P2` **`api.console` nÃ£o Ã© cobrado do orÃ§amento** â€” Ã© de propÃ³sito (o aviso de estouro precisa passar), e o log Ã© limitado a 300 linhas, mas um mod pode gastar mensagens ali sem teto
- [ ] 1392 `P2` **A recarga depois da queda nÃ£o restaura o `api.storage`** â€” ele vivia no reino e morreu junto. Persistir o storage deste lado resolveria, e custaria uma ida e volta por escrita

---

## 71 â€” Frente B comeÃ§a: a allowlist que sÃ³ agora faz sentido (itens 762, 775)

AtÃ© o item 358, um invÃ³lucro de `fetch` seria decoraÃ§Ã£o: o script rodava neste reino e pegava o
`fetch` de verdade pela fuga do construtor. O invÃ³lucro sÃ³ atrapalharia quem **nÃ£o** estava tentando
burlar nada.

Com os scripts no Worker e o global de lÃ¡ esvaziado, nÃ£o existe `fetch` para alcanÃ§ar. A Ãºnica rede
possÃ­vel atravessa a ponte â€” e uma checagem na ponte Ã© uma checagem de verdade. Ã‰ por isso que esta
frente vinha depois daquela, e nÃ£o por ordem de importÃ¢ncia.

### Capacidade declarada, e nÃ£o "pergunte na hora"

Perguntar a cada chamada treina o jogador a dizer sim: a quinta caixa de diÃ¡logo idÃªntica Ã© clicada
sem leitura. Declarar no manifesto move a decisÃ£o para **antes de instalar**, quando o jogador ainda
estÃ¡ avaliando o mod em vez de estar no meio de uma partida.

E dÃ¡ o que a pergunta na hora nunca dÃ¡: a lista de hosts Ã© **auditÃ¡vel** â€” dÃ¡ para mostrÃ¡-la numa
tela, comparar com o que o mod diz que faz, e revogar depois.

### Duas formas de casar host, e nenhuma terceira

`api.exemplo.com` casa exatamente. `.exemplo.com` casa com subdomÃ­nios e com ele mesmo. NÃ£o hÃ¡
curinga, prefixo nem casamento por conteÃºdo â€” e o motivo Ã© um ataque barato: com casamento por
conteÃºdo, `exemplo.com` liberaria `exemplo.com.servidor-do-atacante.net`, que qualquer pessoa
registra em cinco minutos. O ponto inicial obrigatÃ³rio Ã© o que impede `naoexemplo.com` de passar por
`.exemplo.com`. Os dois casos sÃ£o teste.

`*` Ã© recusado na validaÃ§Ã£o. Ã‰ o pedido que mais aparece e o Ãºnico que nÃ£o dÃ¡ para conceder: uma
allowlist que permite tudo Ã© uma allowlist que nÃ£o existe, e o jogador estaria consentindo com o
vazio.

### TrÃªs decisÃµes que valem o registro

**`https` sÃ³, com uma exceÃ§Ã£o nomeada.** `http` Ã© interceptÃ¡vel e alterÃ¡vel por qualquer um no
caminho, e a resposta vira entrada de um script. A exceÃ§Ã£o Ã© `localhost` â€” um modelo de linguagem
local, ou o relay deste projeto, vivem lÃ¡; recusar isso empurraria quem desenvolve a desligar a
checagem inteira, que Ã© bem pior que abrir a exceÃ§Ã£o com nome.

**Manifesto sem versÃ£o Ã© invÃ¡lido, nÃ£o "versÃ£o 1".** Tratar a ausÃªncia como a versÃ£o atual concederia
por engano tudo o que a versÃ£o atual permite a um manifesto escrito antes de essas permissÃµes
existirem.

**Motivo curto demais Ã© recusado.** Sem uma frase legÃ­vel, a tela de consentimento vira "este mod
quer acessar a internet: sim/nÃ£o" â€” exatamente a pergunta que treina o jogador a clicar sim.

### O que `enviaDados` alcanÃ§a, e o que nÃ£o (775)

Pega o que importa: corpo de requisiÃ§Ã£o e verbos de escrita. Um mod sem `envia: true` nÃ£o faz um POST
com o mundo dentro. **NÃ£o alcanÃ§a a query string** â€” `GET https://host/?dados=<o mundo>` passa,
porque distinguir parÃ¢metro legÃ­timo de vazamento exigiria entender o significado do endereÃ§o.

EstÃ¡ escrito no cÃ³digo em vez de omitido: `envia` Ã© uma barreira contra o caminho fÃ¡cil, nÃ£o uma
prova de que nada sai.

- [~] 1393 `P0` **`capacidades.ts`** com 28 testes, incluindo os dois ataques de casamento de host
- [~] 1394 `P1` **Tetos de resposta (2 MB) e timeout (10 s)** â€” sem eles, um arquivo gigante num host autorizado trava a aba e nenhuma outra regra o impede

### O que falta na frente B

- [~] 1395 `P0` **Manifesto no pacote, e duas tabelas novas** (`modConsents`, `modNetLog`)
- [~] 1396 `P0` **`RedeDeMods` pronta e testada** (19 testes). **Falta ligÃ¡-la** ao `api.net.fetch` e ao banco â€” item 1400
- [~] 1397 `P0` **Modelo de consentimento definido** e no banco; a pergunta ao jogador Ã© um callback, e a tela dela Ã© o item 1399
- [~] 1398 `P0` **Registro de auditoria implementado**, com o que passou e o que foi barrado
- [~] 1399 `P1` **Tela mostrando capacidades ativas e permitindo revogar** — `src/ui/PermissionsModal.ts`

---

## 72 â€” A porta de rede: quatro perguntas, nesta ordem (itens 761, 763, 764, 767, 768)

`RedeDeMods` Ã© a Ãºnica forma de um mod alcanÃ§ar a rede â€” nÃ£o por disciplina, mas porque o reino onde
ele roda nÃ£o tem `fetch` com que abrir um segundo caminho.

### A ordem das verificaÃ§Ãµes Ã© uma decisÃ£o, nÃ£o uma consequÃªncia

1. o manifesto declara este host?
2. o jogador consentiu com este host?
3. a chamada envia dados, e o mod declarou que envia?
4. cabe nos tetos de tamanho e tempo?

A pergunta ao jogador Ã© a operaÃ§Ã£o mais cara que existe aqui â€” **interrompe a partida** â€” e por isso
vem depois da checagem barata do manifesto. Um mod pedindo um host nÃ£o declarado nunca deve gerar uma
caixa de diÃ¡logo: isso ensinaria ao jogador que o manifesto nÃ£o significa nada, e Ã© justamente a
liÃ§Ã£o oposta Ã  que ele existe para dar. Virou teste.

### As duas linhas mais importantes do `fetch`

**`redirect: 'error'`.** Com `follow`, um host autorizado poderia redirecionar para um host **nÃ£o**
autorizado, e o conteÃºdo dele voltaria ao mod como se fosse do host permitido. A allowlist seria
contornÃ¡vel por quem controla o servidor que ela autoriza â€” ou seja, por exatamente quem ela deveria
conter.

**`credentials: 'omit'`.** A chamada Ã© do mod, nÃ£o do jogador. Mandar cookies de sessÃ£o faria o mod
agir em nome dele em qualquer serviÃ§o onde ele esteja logado.

### TrÃªs decisÃµes de modelo

**Consentimento por MUNDO.** O mesmo mod em dois mundos pode ter propÃ³sitos diferentes, e um mundo
compartilhado nÃ£o deve herdar o que foi permitido no privado.

**Consentimento por HOST, nÃ£o por mod.** Um mod com trÃªs hosts pode ter propÃ³sito legÃ­timo em dois e
duvidoso no terceiro. Consentir por mod tornaria a decisÃ£o tudo ou nada â€” e a resposta racional para
tudo ou nada Ã© sempre "tudo": quem quer o mod aceita o pacote inteiro sem olhar.

**Revogar Ã© apagar a linha, nÃ£o marcar um campo.** AusÃªncia Ã© o padrÃ£o seguro; um booleano cria a
possibilidade de uma linha em estado indefinido, e um `undefined` lido como falso viraria
consentimento concedido por acidente.

**O manifesto viaja com o mod; o consentimento nÃ£o.** Quem recebe um mod importado precisa ver o
pedido **antes** de instalar. Se o consentimento viajasse junto, importar um mod traria a permissÃ£o
que outra pessoa concedeu â€” precisamente o que a permissÃ£o existe para impedir.

### O log guarda o que foi barrado, e nunca a query

Um log que sÃ³ registra o que deu certo responde Ã  pergunta errada: quem audita quer ver o que o mod
**tentou**, principalmente quando foi barrado.

E a query fica de fora do registro. Ela pode conter exatamente o que o mod estÃ¡ mandando para fora, e
o log existe para o jogador ver com quem o mod falou â€” nÃ£o para virar uma segunda cÃ³pia dos dados que
saÃ­ram.

### A pergunta que nÃ£o vira enxurrada

TrÃªs chamadas ao mesmo host no mesmo quadro gerariam trÃªs caixas de diÃ¡logo idÃªnticas empilhadas, e
da segunda em diante seriam clicadas sem leitura. Todas esperam a mesma resposta.

- [~] 1401 `P0` **`RedeDeMods`** com 19 testes, incluindo redirecionamento, credenciais e a enxurrada de perguntas
- [~] 1402 `P1` **Banco na v9** com `modConsents` e `modNetLog` â€” duas tabelas, porque o consentimento se lÃª inteiro e o log cresce sem parar

### O que falta para a frente B estar ligada

- [~] 1400 `P0` **`api.net.fetch` ligado** â€” protocolo, `buildModAPI`, repositÃ³rio, tela de consentimento e referÃªncia da API. A porta estÃ¡ aberta e guardada
- [~] 1399 `P1` **Aba "Capacidades"** no painel do mod â€” o que ele pede, o que foi concedido e o que ele fez, com revogaÃ§Ã£o por host

### ContinuaÃ§Ã£o da 72 â€” a porta ligada, e a tela que decide

`api.net.fetch` atravessa agora o caminho inteiro: Worker sem `fetch` â†’ protocolo â†’ ponte â†’
`RedeDeMods` â†’ manifesto â†’ consentimento â†’ auditoria â†’ rede.

**A tela de consentimento nÃ£o Ã© um `confirm()`**, e isso Ã© a diferenÃ§a entre pedir permissÃ£o e
cumprir formalidade. O `confirm()` do navegador nÃ£o mostra o motivo declarado pelo mod, nÃ£o distingue
ler de enviar, e apresenta a mesma frase para qualquer pergunta. Uma permissÃ£o que se apresenta igual
para "buscar a previsÃ£o do tempo" e para "mandar o seu mundo para um servidor" estÃ¡ pedindo para ser
clicada sem leitura.

O que a tela mostra, e por quÃª:

- **O host em destaque.** "Este mod usa a internet" nÃ£o Ã© julgÃ¡vel; `api.previsao-do-tempo.com` Ã©.
- **O motivo declarado pelo autor** â€” Ã© o que a validaÃ§Ã£o do manifesto obriga a existir, e a Ãºnica
  parte que explica *para quÃª*.
- **O aviso de envio, separado**, quando o mod declarou `envia`. Ler de um endereÃ§o e mandar coisas
  para ele sÃ£o permissÃµes diferentes; juntÃ¡-las numa frase apagaria a mais sÃ©ria das duas.

TrÃªs detalhes de comportamento, todos apontando para o mesmo lado:

**Fechar sem escolher Ã© nÃ£o.** Quem fecha a caixa nÃ£o disse sim, e tratar silÃªncio como
consentimento Ã© o oposto do que a permissÃ£o garante.

**Escape recusa.** Ã‰ o reflexo de quem quer sair da caixa, e o reflexo precisa cair no lado seguro.

**"NÃ£o permitir" recebe o foco inicial.** Um Enter distraÃ­do nÃ£o deve conceder acesso Ã  rede.

E o consentimento Ã© **recarregado ao abrir o mundo**: sem isso, todo mod pediria permissÃ£o de novo a
cada sessÃ£o â€” e uma permissÃ£o que se repete Ã© uma permissÃ£o que se clica sem ler, exatamente o hÃ¡bito
que ela existe para evitar.

- [~] 1403 `P0` **`PedidoDeCapacidade`** â€” tela prÃ³pria, com escape de teclado caindo no "nÃ£o"
- [~] 1404 `P1` **Consentimento espelhado em memÃ³ria** â€” a verificaÃ§Ã£o acontece dentro de uma chamada de mod, e consultar o IndexedDB ali tornaria cada chamada assÃ­ncrona por um dado que muda uma vez por sessÃ£o
- [~] 1405 `P1` **Poda do log de auditoria em 2.000 linhas por mundo** â€” a pergunta que ele responde Ã© sobre o passado recente; guardar um ano faria o que importa ficar enterrado
- [~] 1406 `P1` **4 travas de fiaÃ§Ã£o** e a referÃªncia da API ensinando `capacidades` e `await api.net.fetch`

---

## 73 â€” A aba que transforma permissÃ£o em prestaÃ§Ã£o de contas (itens 769, 1399)

TrÃªs coisas na mesma tela: **o que o mod pede**, **o que o jogador concedeu** e **o que o mod de fato
fez**.

Separadas, cada uma responde meia pergunta. "Este mod pede acesso a `api.x.com`" nÃ£o diz se alguÃ©m
autorizou; "vocÃª autorizou `api.x.com`" nÃ£o diz se o mod usou. Juntas, respondem a pergunta que o
jogador realmente tem: **este mod estÃ¡ fazendo o que disse que faria?**

Ã‰ a diferenÃ§a entre uma lista de permissÃµes e uma prestaÃ§Ã£o de contas. A primeira se lÃª uma vez e
nunca mais; a segunda tem motivo para ser reaberta.

### TrÃªs detalhes que decidem se a tela serve

**A revogaÃ§Ã£o atinge a sessÃ£o em curso, nÃ£o sÃ³ a prÃ³xima.** Gravar no banco sem regravar o espelho em
memÃ³ria seria o pior resultado possÃ­vel: o jogador clica em "revogar", a tela mostra revogado, e o
mod continua com acesso pelo resto da sessÃ£o. **Uma permissÃ£o que nÃ£o some quando se manda sumir Ã©
pior que nÃ£o ter o botÃ£o** â€” ela transforma uma proteÃ§Ã£o em teatro. Virou trava de fiaÃ§Ã£o, dos dois
lados.

**A aba pergunta o mundo, nÃ£o guarda.** O mundo muda durante a sessÃ£o, e uma cÃ³pia guardada mostraria
as permissÃµes do mundo anterior â€” o pior tipo de erro nesta tela, porque parece informaÃ§Ã£o correta.

**A chamada recusada aparece com o motivo, e em vermelho.** Ã‰ a linha que vale a pena investigar. Um
log que sÃ³ mostra o que deu certo responde Ã  pergunta errada.

E o caso mais comum tem texto prÃ³prio: um mod sem rede declarada nÃ£o mostra uma lista vazia, mostra
uma frase dizendo que ele **nÃ£o consegue** falar com endereÃ§o nenhum. Lista vazia se lÃª como "ainda
nÃ£o configurado"; a frase se lÃª como "nÃ£o hÃ¡ o que configurar".

- [~] 1407 `P1` **Aba "Capacidades"** com os trÃªs blocos e as 25 Ãºltimas chamadas
- [~] 1408 `P1` **2 travas de fiaÃ§Ã£o** â€” a da revogaÃ§Ã£o em sessÃ£o Ã© a que mais importa

### Lacuna anotada nesta rodada

- [ ] 1409 `P1` **A importaÃ§Ã£o de mod ainda nÃ£o mostra o manifesto antes de instalar** (metade do item 770) â€” o pacote jÃ¡ carrega as capacidades e a aba jÃ¡ as exibe, mas quem importa um mod de terceiro sÃ³ as vÃª **depois** de ele estar instalado. O momento de decidir Ã© antes

---

## 74 â€” Voz P2P: a trilha entra na conexÃ£o que jÃ¡ existe (itens 927â€“932, 766)

A `RTCPeerConnection` jÃ¡ carregava blocos e criaturas. Voz Ã© uma trilha de mÃ­dia na **mesma**
conexÃ£o: sem servidor de voz, sem upload, sem terceiro no caminho.

### As trÃªs regras que governam tudo

**Desligado por padrÃ£o, sem exceÃ§Ã£o.** Nada liga o microfone sozinho â€” nem ao entrar no mundo, nem ao
conectar, nem restaurando preferÃªncia salva.

**`getUserMedia` sÃ³ no clique.** Pedir no boot faria o navegador mostrar a permissÃ£o antes de o
jogador ter contexto do porquÃª â€” e a resposta a um pedido sem contexto Ã© "nÃ£o", ou pior, um "sim" que
ele nÃ£o entendeu. HÃ¡ trava de fiaÃ§Ã£o reprovando qualquer outra chamada no cÃ³digo.

**Nunca captar sem sinal na tela.** Um jogo que capta Ã¡udio sem mostrar Ã© indistinguÃ­vel de um que
grava escondido.

### Armado â‰  transmitindo, e por que sÃ£o dois estados

Push-to-talk exige a trilha existir **antes** da tecla: pedir o dispositivo a cada aperto custaria
centenas de milissegundos e perderia a primeira sÃ­laba de toda frase.

**Armado** Ã© ter o dispositivo e a trilha na conexÃ£o. **Transmitindo** Ã© a trilha estar `enabled`. O
indicador mostra os trÃªs estados separados â€” juntar "aberto e mudo" com "transmitindo" apagaria a
Ãºnica distinÃ§Ã£o que importa para quem estÃ¡ com o microfone aberto: *o jogo pode me ouvir* contra *o
jogo estÃ¡ me ouvindo*.

E desarmar chama `stop()` de verdade. SÃ³ marcar `enabled = false` deixaria o navegador mostrando
"esta aba estÃ¡ usando o microfone" para sempre â€” **um jogador que clicou em desligar e continua vendo
o indicador conclui, com razÃ£o, que o botÃ£o mente.**

### O defeito que a voz revelou no P2P

`handleSignal` criava uma `RTCPeerConnection` **nova a cada oferta recebida**. Isso funcionava porque
sÃ³ havia uma oferta por conexÃ£o, na abertura. Com renegociaÃ§Ã£o, uma oferta chega numa conexÃ£o jÃ¡
estabelecida â€” e criar outra descartaria o canal de dados aberto: **a partida cairia toda vez que
alguÃ©m ligasse o microfone.**

Junto veio a colisÃ£o: se os dois lados ligam o microfone ao mesmo tempo, as duas ofertas chegam com o
outro lado no meio da prÃ³pria. Sem tratamento a conexÃ£o trava num estado invÃ¡lido. O convidado Ã© o
lado **educado** â€” desfaz a prÃ³pria oferta e aceita a do outro â€”, usando o mesmo critÃ©rio de
autoridade que jÃ¡ governa o resto, para nÃ£o haver duas noÃ§Ãµes de quem manda.

### Dois lugares onde o microfone ficaria aberto sozinho

**`keyup` nÃ£o Ã© filtrado por "estÃ¡ digitando".** Um `keyup` com o mesmo filtro do `keydown` deixaria
o microfone aberto para sempre se o jogador clicasse numa caixa de texto enquanto falava.

**A janela perdendo o foco emudece.** Alt-tab com a tecla apertada nunca gera `keyup`, e o jogador
continuaria transmitindo enquanto conversa com outra pessoa na frente do computador.

### O item 766, resolvido dizendo a verdade

Um mod pedindo `microfone` seria **ignorado em silÃªncio**: o script roda num Worker onde `navigator`
foi apagado, e nÃ£o hÃ¡ membro de API que alcance o dispositivo. Ignorar parece inofensivo e nÃ£o Ã© â€” o
autor (com frequÃªncia uma IA) veria o mod carregar sem erro e concluiria que a permissÃ£o foi
concedida; a falha apareceria adiante, longe da causa.

Agora a validaÃ§Ã£o recusa qualquer capacidade fora da lista, dizendo **quais existem**. Quando alguma
sensÃ­vel passar a existir, ela entra na lista junto com o consentimento separado que o item pede â€” e
nÃ£o antes.

- [~] 1410 `P0` **`VozP2P`** com 18 testes, incluindo "a tecla nÃ£o reabre o dispositivo a cada aperto"
- [~] 1411 `P0` **NegociaÃ§Ã£o perfeita no `PeerSync`**, com o convidado como lado educado
- [~] 1412 `P1` **6 travas de fiaÃ§Ã£o**, incluindo a que reprova `getUserMedia` fora da camada de voz
- [~] 1413 `P1` **Capacidade desconhecida recusada** com 4 testes

### Lacunas anotadas nesta rodada

- [~] 1414 `P1` **Voz espacial**: distÃ¢ncia, panorÃ¢mica pelo olhar e zona Ã­ntima
- [~] 1415 `P1` **`/mudo` e `/ouvir`**, locais e persistentes â€” nunca passam pelo anfitriÃ£o
- [ ] 1416 `P2` **Nenhum indicador de quem estÃ¡ falando** â€” o jogador ouve uma voz e nÃ£o sabe de quem Ã©

---

## 75 â€” Mods criam biomas (itens 676, 677)

Um bioma de mod Ã© **dado do pacote**, como um bloco â€” nÃ£o efeito de script. Ã‰ isso que o faz
sobreviver a fechar o navegador, viajar na exportaÃ§Ã£o e chegar aos convidados pelo P2P, sem depender
de um script rodar na ordem certa.

### O lugar onde isso quase deu errado

O worldgen roda **noutro reino de execuÃ§Ã£o** (`genWorker.ts`). Um bioma registrado sÃ³ no thread
principal existiria na cor da grama e da nÃ©voa e **nÃ£o** no terreno: o jogador veria o horizonte
mudar e o chÃ£o nÃ£o. Ã‰ o defeito mais confuso que este recurso poderia ter, porque se parece com um
problema de shader.

A lista viaja **junto com a semente**, na mesma mensagem de `init`. Numa mensagem seguinte, o worker
jÃ¡ teria comeÃ§ado a gerar: os primeiros chunks nasceriam sem os biomas do mod e os seguintes com
eles, e o mundo teria uma costura invisÃ­vel em volta do spawn que ninguÃ©m ligaria Ã  ordem de duas
mensagens.

E o worker **esquece** os biomas ao receber um `init` novo. Ele Ã© reaproveitado entre mundos; sem
limpar, um mod de "bioma de cristal" instalado num mundo faria terreno estranho num mundo que nunca
o teve.

### Quatro recusas, e o que cada uma protege

**Substituir um bioma nativo.** Redefinir `deserto` mudaria o terreno de todo mundo salvo que jÃ¡ tem
deserto, e a mudanÃ§a apareceria como "meu mundo estÃ¡ diferente" sem ninguÃ©m ligar ao mod recÃ©m
instalado. Registrar Ã© aditivo; substituir Ã© reescrever o passado.

**Centro fora de -1..1.** O bioma existiria na tabela com peso zero em todo ponto â€” presente e
invisÃ­vel. Um mod que "nÃ£o funciona" sem nenhum erro Ã© o pior resultado para quem o escreveu, que em
geral Ã© uma IA relendo o log em busca do que fazer diferente.

**Chave repetida no mesmo mod.**

**Gravar antes de validar.** `addBiome` registra **antes** de persistir: o registro Ã© quem valida o
centro, e gravar um bioma que nunca vai aparecer deixaria o mod com uma promessa morta dentro.

### Duas decisÃµes de convivÃªncia

**O id ganha o prefixo do mod.** Dois mods podem querer um bioma chamado `cristal`, e sem prefixo o
segundo seria recusado por colisÃ£o â€” punindo quem instalou os dois por uma escolha de nome que
nenhum dos autores fez em conjunto.

**Bioma desconhecido cai na planÃ­cie em vez de estourar.** O caso real Ã© um save que menciona um
bioma cujo mod foi desinstalado; derrubar o carregamento do mundo por causa de cor de grama seria
trocar um problema estÃ©tico por um mundo inacessÃ­vel.

E `applyModBiomes` devolve os erros em vez de lanÃ§ar: um bioma recusado nÃ£o pode impedir os blocos e
as criaturas do mesmo mod de carregarem. Um mod meio aplicado Ã© ruim; um mod inteiro perdido por
causa de um nÃºmero errado num bioma Ã© pior.

### A descriÃ§Ã£o da ferramenta faz parte da correÃ§Ã£o

`define_mod_biome` explica o plano de clima na prÃ³pria descriÃ§Ã£o â€” que `temp: -1` Ã© o mais frio e
`+1` o mais quente, e que convÃ©m escolher um ponto ainda nÃ£o ocupado, senÃ£o o bioma novo nasce
espremido entre os vizinhos. Ã‰ a Ãºnica parte que o agente erra **sem saber que errou**: o bioma
entra, nÃ£o dÃ¡ erro, e quase nÃ£o aparece.

- [~] 1417 `P0` **Registro de biomas de mod**, com lista separada da nativa para poder limpar e restaurar
- [~] 1418 `P0` **ReplicaÃ§Ã£o ao Worker de geraÃ§Ã£o**, junto da semente
- [~] 1419 `P1` **`api.biomes.define`** e **`define_mod_biome`**, com o bioma persistido no pacote
- [~] 1420 `P1` **8 testes de bioma de mod**, incluindo "a soma dos pesos continua 1" â€” a propriedade que sustenta toda a mistura de cor e nÃ©voa
- [~] 1421 `P1` **4 travas de fiaÃ§Ã£o**, sendo a principal a que confere que o bioma chega ao Worker

### Lacunas anotadas nesta rodada

- [ ] 1422 `P1` **O terreno jÃ¡ gerado nÃ£o Ã© refeito** ao registrar um bioma â€” assumido (refazer travaria o jogo por segundos e mudaria o chÃ£o sob o jogador), mas o jogador nÃ£o Ã© avisado de que precisa explorar para ver
- [ ] 1423 `P1` **O bioma de mod nÃ£o escolhe bloco de superfÃ­cie nem Ã¡rvore** â€” ele muda cor, nÃ©voa, saturaÃ§Ã£o e minÃ©rio, mas o chÃ£o continua o da planÃ­cie
- [ ] 1424 `P2` **Nada valida colisÃ£o de centro** entre um bioma de mod e um nativo: declarar `temp: 0.6, moist: -0.8` em cima do deserto Ã© aceito e produz um bioma que quase nunca ganha

---

## 76 â€” Mods espalham estruturas pelo mundo (itens 689, 690)

Fecha a frente D. Uma regra de mod aponta para uma estrutura **do prÃ³prio mod** â€” apontar para a de
outro faria a regra parar de funcionar quando aquele fosse desinstalado, e o sintoma seria estruturas
sumindo de um mod que ninguÃ©m tocou.

### A ordem que decide entre funcionar e um clarÃ£o no meio do mundo

Templates entram **antes** das regras, nos dois lugares (no registro de mods e no Worker). Uma regra
aponta para um template por id; na ordem inversa, o worldgen acha o sÃ­tio, aplana o terreno e nÃ£o
acha o que carimbar. O resultado Ã© um **clarÃ£o de terra batida com nada em cima**, que se parece com
defeito de geraÃ§Ã£o e nÃ£o com mod mal declarado â€” o tipo de pista que leva a investigar o lugar
errado. Virou trava de fiaÃ§Ã£o que compara as posiÃ§Ãµes no arquivo.

### Quatro recusas

**Estrutura inexistente.** `addScatter` exige que ela jÃ¡ exista, e a mensagem lista as que o mod tem.
Aceitar gravaria uma regra que escolhe sÃ­tios e nÃ£o constrÃ³i nada.

**Template vazio.** Mesmo estrago, um passo adiante.

**Pegada maior que um quarto da cÃ©lula.** A pegada decide a margem da posiÃ§Ã£o dentro da cÃ©lula; grande
demais nÃ£o deixaria posiÃ§Ã£o nenhuma sobrando.

**Regra sem bioma, ou com peso zero.** Nunca ganharia cÃ©lula nenhuma: existiria na tabela e nÃ£o no
mundo.

E substituir o **prÃ³prio** template Ã© permitido de propÃ³sito: o autor edita a estrutura no editor e
recarrega o mod vÃ¡rias vezes por minuto. Recusar obrigaria a reiniciar o mundo a cada ajuste.

### Um teste meu que me corrigiu

Escrevi "o espaÃ§amento mÃ­nimo leva a pegada do mod em conta" esperando ver o valor mudar. NÃ£o mudou â€”
e a fÃ³rmula explica: `margem = pegada + 1`, entÃ£o a folga entre duas construÃ§Ãµes vizinhas Ã©
`2(p+1) âˆ’ 2p = 2`, **sempre**.

A pegada cancela. NÃ£o Ã© acidente: a margem foi definida assim justamente para garantir um voxel de
folga de cada lado, qualquer que seja a pegada. O que uma pegada grande consome nÃ£o Ã© a folga, Ã© o
espaÃ§o Ãºtil onde a Ã¢ncora pode cair dentro da cÃ©lula â€” e Ã© por isso que o teto estÃ¡ no registro, nÃ£o
ali.

O comentÃ¡rio da funÃ§Ã£o passou a dizer isso, porque ela **parece** depender de `p` e nÃ£o depende.

### A descriÃ§Ã£o da ferramenta corrige a suposiÃ§Ã£o errada

`define_mod_scatter` explica que no mÃ¡ximo **uma** estrutura nasce por cÃ©lula, e que o peso *disputa*
com as outras regras do mesmo bioma em vez de aumentar a densidade total. Ã‰ a suposiÃ§Ã£o que o agente
faz errado por padrÃ£o: peso maior parece "mais estruturas", e Ã© "mais chance de ser esta em vez
daquela".

- [~] 1425 `P0` **Registro de regras e templates de mod**, com limpeza por mundo
- [~] 1426 `P0` **ReplicaÃ§Ã£o ao Worker**, com os templates antes das regras
- [~] 1427 `P1` **`define_mod_scatter`** e `ModService.addScatter`, exigindo estrutura existente
- [~] 1428 `P1` **12 testes**, incluindo "e chega a produzir sÃ­tios no mundo"
- [~] 1429 `P1` **3 travas de fiaÃ§Ã£o**, sendo uma que confere a ordem de registro

### Lacunas anotadas nesta rodada

- [ ] 1430 `P1` **A estrutura de mod sÃ³ aceita bloco por id numÃ©rico no espalhamento** â€” referÃªncias simbÃ³licas (`meumod:cristal`) sÃ£o descartadas ao virar template, e o autor nÃ£o Ã© avisado de quais sumiram
- [ ] 1431 `P2` **NÃ£o hÃ¡ como um mod espalhar decoraÃ§Ã£o pequena** (arbustos, pedras soltas) â€” o sistema Ã© de estruturas com cÃ©lula de 87 m, e um mod que queira grama alta prÃ³pria nÃ£o tem caminho

---

## 77 â€” A profundidade vira lugar (itens 495, 496)

A profundidade jÃ¡ mudava **o que se acha**: carvÃ£o perto da superfÃ­cie, diamante no fundo. Faltava
mudar **onde se estÃ¡** â€” descer trinta metros era mecanicamente diferente e sensorialmente idÃªntico:
mesma nÃ©voa, mesmo silÃªncio, mesma pedra.

Sem identidade, "descer" Ã© um nÃºmero no F3. Com ela, o jogador sabe onde estÃ¡ sem olhar.

### O erro que cometi, e que o teste de subsolo pegou na hora

Escrevi as camadas com nÃºmeros redondos: caverna em 20 m, abismo em 30. O diamante vai de **20 a 26
metros**. Com o abismo comeÃ§ando em 30, o diamante ficava exclusivo de uma camada onde **nunca
aparece**.

Nada errava. Nenhum log, nenhuma exceÃ§Ã£o â€” o diamante simplesmente deixou de existir no mundo. Ã‰ a
forma mais silenciosa possÃ­vel de quebrar a progressÃ£o inteira, e um jogador levaria horas cavando
antes de suspeitar que o problema nÃ£o era azar.

Virou o teste mais importante do arquivo: **todo minÃ©rio exclusivo precisa ter profundidade onde de
fato aparece**, cruzando `CAMADAS` com `ORE_TIERS`. Os limites passaram a seguir as faixas â€” caverna
em 14, abismo em 20 â€” e o ouro perde a cauda de 20 a 24 de propÃ³sito, que Ã© o que separa "o metal da
caverna" da "pedra do abismo".

### A camada Ã© medida da superfÃ­cie, nÃ£o do y absoluto

Um y fixo tornaria o subsolo de uma montanha e o de um vale a mesma coisa: quem cava dez metros a
partir de um pico estaria, pelo nÃºmero, "no fundo" com o cÃ©u Ã  vista. O que importa Ã© quanto de rocha
hÃ¡ acima da cabeÃ§a.

### A transiÃ§Ã£o ocupa o terÃ§o final, e nÃ£o a faixa inteira

Interpolar a faixa toda faria o jogador **nunca ver a cor pura de nenhuma camada** â€” ele estaria
sempre no meio de duas, e o esforÃ§o de dar identidade a cada uma se perderia numa mÃ©dia contÃ­nua.
Trocar de vez na fronteira seria o oposto: um estalo de cor que ensina a posiÃ§Ã£o exata do limite e
revela a tabela por trÃ¡s.

### Bioma em cima, camada embaixo â€” misturados, nÃ£o escolhidos

Sob dois metros de terra o jogador ainda vÃª o clarÃ£o do bioma pela boca do buraco. A mistura Ã© pela
profundidade, e a superfÃ­cie tem peso zero â€” entÃ£o nada disso altera quem estÃ¡ por cima, que Ã© onde o
sistema de biomas precisa continuar mandando sozinho.

### E a exclusividade vem antes da abundÃ¢ncia de bioma

SÃ£o duas regras de forÃ§a diferente: o bioma **modula quanto** existe, a camada **decide se** existe.
Invertida, a ordem faria um bioma rico em diamante produzi-lo acima do abismo.

- [~] 1432 `P0` **`camadas.ts`** com 13 testes, incluindo o cruzamento `CAMADAS` Ã— `ORE_TIERS`
- [~] 1433 `P0` **Exclusividade aplicada na geraÃ§Ã£o**, antes da abundÃ¢ncia de bioma
- [~] 1434 `P1` **NÃ©voa e alcance por camada**, misturados com os do bioma pela profundidade
- [~] 1435 `P1` **A camada aparece no diagnÃ³stico**, junto do bioma â€” as duas respondem "onde estou"
- [~] 1436 `P1` **3 travas de fiaÃ§Ã£o** â€” o mÃ³dulo Ã© puro e passaria nos 13 testes com ele desligado

### Lacunas anotadas nesta rodada

- [~] 1437 `P1` **O piso de luz da camada Ã© aplicado** â€” e a caverna deixou de pulsar com o sol
- [~] 1438 `P1` **Som prÃ³prio de camada**, esporÃ¡dico e sorteado, sintetizado como todo o resto
- [~] 1439 `P2` **A camada desloca a mistura de espÃ©cies** â€” nÃ£o a troca: o zumbi continua no
  abismo, sÃ³ deixa de ser o mais comum

---

## 78 â€” Descer custa (itens 497, 1439)

As camadas da seÃ§Ã£o 77 deram onde pendurar isto. **Perigo por tempo pune quem joga devagar e nÃ£o
recompensa nada. Perigo por lugar Ã© uma escolha**: descer passa a ser a decisÃ£o de trocar seguranÃ§a
por recurso, e Ã© ela que dÃ¡ sentido ao diamante estar no fundo.

Sem isso, a Ãºnica diferenÃ§a entre a caverna e o abismo era o tempo de caminhada.

### O perigo divide, nÃ£o subtrai

Se subtraÃ­sse do intervalo, a lua cheia no abismo ficaria mais calma que a lua nova na superfÃ­cie â€” e
isso inverteria a relaÃ§Ã£o que o jogador passou a noite inteira aprendendo lÃ¡ em cima. Dividindo, cada
camada gera na mesma **proporÃ§Ã£o** seja qual for a fase da lua: a lua continua significando o que
significava, e a profundidade acrescenta em vez de contradizer.

### A mistura de espÃ©cies desloca, nÃ£o troca

O zumbi continua existindo no abismo â€” sÃ³ deixa de ser o mais comum. Trocar por completo faria cada
camada parecer um jogo diferente, e a passagem entre elas deixaria de ser progressÃ£o para virar
transporte.

O que se quer Ã© o jogador notar que "aqui aparece mais aranha" **antes** de conseguir dizer por quÃª.
HÃ¡ teste exigindo que o zumbi nÃ£o desapareÃ§a.

### Duas escolhas de onde medir, com respostas diferentes

**O ritmo acompanha o jogador.** O que ele sente Ã© a frequÃªncia com que algo aparece perto dele.
Calcular por ponto de spawn faria a pressÃ£o depender de onde o sorteio caiu, e ela oscilaria sem que
nada no mundo tivesse mudado.

**A espÃ©cie acompanha o ponto sorteado.** Quem estÃ¡ na boca da caverna olhando para baixo deve ver o
que vive lÃ¡ embaixo, nÃ£o o que vive ao lado dele.

SÃ£o a mesma pergunta com respostas opostas, e as duas estÃ£o certas porque medem coisas diferentes:
uma Ã© sobre a pressÃ£o que o jogador percebe, a outra sobre o lugar de onde a criatura veio.

- [~] 1440 `P1` **`perigo` por camada**, crescendo monotonicamente, com teste que reprova uma camada funda mais calma
- [~] 1441 `P1` **`especieDaCamada`** com pesos por camada e 5 testes de distribuiÃ§Ã£o
- [~] 1442 `P1` **2 travas de fiaÃ§Ã£o** â€” `perigo` e `superficieY` sÃ£o campos que, sem alguÃ©m passÃ¡-los, deixam as duas tabelas decorativas

### Lacuna anotada nesta rodada

- [~] 1443 `P2` **O teto passou a acompanhar a camada** â€” com teto absoluto por cima, porque difÃ­cil nÃ£o pode virar travado

### ContinuaÃ§Ã£o da 78 â€” o teto que eu mesmo criei saturando

Anotei o 1443 no fim da rodada anterior e ele foi o primeiro desta, porque era um defeito que a
prÃ³pria correÃ§Ã£o do 497 tinha introduzido.

Com `MAX_HOSTILES` global, o abismo gerando ao dobro do ritmo simplesmente **chegava ao limite mais
rÃ¡pido** â€” e ali o perigo parava de crescer. O jogador desceria mais fundo e sentiria o mesmo,
concluindo que a profundidade nÃ£o muda nada.

Ã‰ a terceira vez que este projeto encontra a mesma forma: `TIER_DAMAGE` saturando no Ã­ndice 3,
`WORLD_MAX_Y` com o teto de 8 voxels, e agora este. **Um teto por saturaÃ§Ã£o nÃ£o falha, nÃ£o avisa, e
sÃ³ deixa de recompensar** â€” e por isso ele sobrevive a qualquer teste que verifique "funciona?" em
vez de "continua valendo?".

O teto passou a acompanhar o perigo, com um limite absoluto por cima. Esse limite nÃ£o Ã© de jogo, Ã© de
quadro: cada hostil roda perseguiÃ§Ã£o e colisÃ£o por frame, e o jogador nÃ£o teria como distinguir
"muito difÃ­cil" de "o jogo travou".

- [~] 1444 `P1` **`limiteDeHostis(perigo)`** com 5 testes, incluindo um que exige o spawner usar o teto da camada e nÃ£o o global

---

## 79 â€” O item 029 apontava para o lado errado (e a mediÃ§Ã£o mostrou qual)

O item dizia: *"aumentar o limite vertical do mundo (hoje varreduras assumem `y < 128`)"*. Eu o adiei
vÃ¡rias rodadas com um motivo â€” mudar o formato de save, sem poder verificar corrupÃ§Ã£o sem rodar o
jogo. Com o projeto declarado beta e mundos antigos fora de questÃ£o, o motivo caiu e fui medir antes
de mexer.

**O teto nunca era tocado.** Numa amostra de 26 mil colunas, a mais alta dava 38 m num mundo de 42,7.
Zero por cento encostavam no limite.

O aperto era do outro lado, e era grave:

| | faixa | alcanÃ§Ã¡vel |
|---|---|---|
| carvÃ£o | 2â€“40 m | 51% |
| ferro | 6â€“30 m | 64% |
| ouro | 14â€“24 m | 74% |
| **diamante** | **20â€“26 m** | **23%** |

Com a superfÃ­cie a 22 m e a rocha-mÃ£e em zero, sobravam **21 metros de rocha** para faixas que pedem
atÃ© 40. TrÃªs quartos da faixa do diamante estavam **abaixo do fundo do mundo**.

E nada errava. O diamante era sÃ³ raro demais â€” de um jeito que se lÃª como mÃ¡ sorte, nunca como
defeito. A camada do abismo que eu tinha acabado de criar (item 495) nascia como uma fatia de um
metro no fundo, pelo mesmo motivo.

**Se eu tivesse feito o que o item pedia â€” subir o teto â€” nÃ£o teria corrigido nada.**

### O que mudou

Mar de 20 m para 46, base do continente acompanhando, e `CY` de 128 para 256. Depois: superfÃ­cie
entre 41 e 64 m, teto a 85, e **as quatro faixas de minÃ©rio 100% alcanÃ§Ã¡veis**. Sobram 21 m livres
acima do pico mais alto para construir.

### O custo, medido e assumido

MemÃ³ria por chunk dobrou: 128 KB â†’ 256 KB. No pior caso do raio de descarte, 45 MB â†’ 90 MB de dados
de bloco.

GeraÃ§Ã£o por chunk: **76 ms â†’ 157 ms**. NÃ£o Ã© o `CY` que cobra isso â€” o laÃ§o de geraÃ§Ã£o vai atÃ© a
altura do terreno, nÃ£o atÃ© o teto â€”, Ã© o terreno ter 25 m a mais de rocha por coluna, que Ã©
exatamente o que se queria.

Ao olhar o laÃ§o quente, achei um desperdÃ­cio que jÃ¡ existia: os **dois** campos de ruÃ­do dos tÃºneis
eram calculados sempre, e um `&&` descartava um deles depois. A esmagadora maioria dos voxels reprova
no primeiro. Curto-circuitando de verdade e adiando a cÃ¢mara para depois do teste de profundidade:
**157 ms â†’ 128 ms**.

A reordenaÃ§Ã£o Ã© Ã¡lgebra booleana idÃªntica â€” `(cavern && fundo) || (a && b)` contra
`(a && b) || (fundo && cavern)` â€”, mas "Ã© obviamente igual" Ã© o que se pensa antes de mudar um mundo
inteiro sem querer. Virou um teste de assinatura por semente.

### Os dois testes que falharam carregavam a suposiÃ§Ã£o do item

Ao subir o mundo, dois testes quebraram â€” e os dois por terem `128` **escrito Ã  mÃ£o**: um comparava
`c.height < 128`, o outro pulava tudo com `by >= 128`. O nÃºmero do teto morava copiado dentro de
testes que juravam verificÃ¡-lo.

- [~] 1445 `P0` **Mar a 46 m e `CY = 256`** â€” as quatro faixas de minÃ©rio passam a existir por inteiro
- [~] 1446 `P1` **Curto-circuito real no ruÃ­do de caverna** â€” 19% do tempo de geraÃ§Ã£o, sem mudar o mundo
- [~] 1447 `P1` **5 testes de profundidade garantida**, cruzando terreno gerado com `ORE_TIERS` e `CAMADAS`
- [~] 1448 `P1` **Assinatura de caverna por semente**, para uma reordenaÃ§Ã£o futura nÃ£o mudar o mundo em silÃªncio
- [~] 1449 `P2` **Os dois `128` escritos Ã  mÃ£o nos testes** trocados por `WORLD_MAX_Y`

### Lacunas anotadas nesta rodada

- [~] 1450 `P1` **Gerar um chunk: 131 ms â†’ 40 ms**, com o mundo byte a byte idÃªntico
- [ ] 1451 `P2` **90 MB de dados de bloco no pior caso** â€” paletizaÃ§Ã£o de chunk (item 033) reduziria isso a uma fraÃ§Ã£o, e agora tem motivo

## 80. O ruÃ­do recalculado â€” item 1450

O item dizia para amostrar o campo de cavernas em resoluÃ§Ã£o menor e interpolar, aceitando perda de
detalhe. Medindo primeiro, a premissa estava errada de um jeito Ãºtil: `isCave` era **87%** do custo,
mas nÃ£o por estar superamostrado de forma irreparÃ¡vel â€” por recalcular os **mesmos oito cantos do
reticulado** para cada voxel.

A frequÃªncia do campo Ã© por metro (0,045); a amostragem Ã© por mini-voxel (3 por metro). Uma cÃ©lula
do reticulado tem 22 metros em x/z â€” **67 mini-voxels, mais larga que o chunk inteiro, que tem 32**.
Em y cobre 33. E o gerador percorre coluna a coluna: x e z ficam parados por 140 voxels seguidos.
Uma coluna atravessava cinco cÃ©lulas e fazia cento e quarenta vezes o trabalho de cinco.

EntÃ£o nÃ£o era preciso perder detalhe nenhum. `Value3` guarda, por oitava, tudo o que nÃ£o depende da
fraÃ§Ã£o de y: os oito hashes, os `floor` e `fade` de x e z, e as quatro interpolaÃ§Ãµes em x.

- 131 ms â†’ 78 ms com os cantos memorizados
- 78 â†’ 45 colapsando tambÃ©m em z â€” **e aqui quase passou um erro**
- 45 â†’ 57 desfazendo esse colapso, e 57 â†’ 40 com o memo num bloco contÃ­guo

O colapso em z trocava `lerp(lerp(a,b,w), lerp(c,d,w), v)` por `lerp(lerp(a,c,v), lerp(b,d,v), w)`.
Ã‰ a mesma Ã¡lgebra e **nÃ£o Ã© o mesmo double**. Os cinquenta chunks que eu jÃ¡ tinha comparado saÃ­ram
byte a byte iguais, e eu teria fechado o item ali; foi o teste novo, comparando com `toBe` contra o
caminho sem cache, que acusou um ULP de diferenÃ§a. Um ULP nÃ£o Ã© nada atÃ© cair em cima do limiar de
caverna â€” aÃ­ Ã© uma parede que existe ou nÃ£o existe. O hash igual sÃ³ dizia que nenhum voxel estava na
navalha *naqueles* chunks, nÃ£o que nenhum esteja.

Verificado: `8a71c2b1` nos dois lados, 50 chunks em duas sementes.

- [~] 1452 `P1` **Memo do reticulado em `Value3`**, exato por construÃ§Ã£o e conferido com `toBe`
- [~] 1453 `P1` **`DONO_DO_MINERIO` resolvido na carga do mÃ³dulo** â€” era um `find` aninhado por minÃ©rio por voxel; as consultas de camada e bioma eram 7,3 dos 10,5 ms de `oreAt`
- [~] 1454 `P2` **`camadaNaProfundidade` com laÃ§o indexado** â€” o iterador do `for...of` aparecia no perfil nesse volume
- [~] 1455 `P1` **8 testes de exatidÃ£o do memo**, incluindo o caso da cÃ©lula compartilhada e o da disputa de slot entre oitavas
- [~] 1456 `P2` **Teste de ordem de varredura** â€” varrer por camada em vez de por coluna anula o cache inteiro sem que nenhum teste de mundo reprove

### Lacunas anotadas nesta rodada

- [ ] 1457 `P1` **`isCave` ainda Ã© 75% do custo** â€” 30 dos 40 ms. O que sobra Ã© aritmÃ©tica de interpolaÃ§Ã£o, nÃ£o hash: quatro amostras por voxel de rocha. Cortar mais exige decidir se o campo de cÃ¢maras precisa ser consultado em todo voxel que reprovou nos tÃºneis
- [ ] 1458 `P2` **O perfil de geraÃ§Ã£o vive num script de rascunho** â€” as medidas de 131/78/45/40 ms nÃ£o estÃ£o em lugar nenhum que o repositÃ³rio execute, entÃ£o a prÃ³xima regressÃ£o de desempenho passa sem ninguÃ©m ver

## 81. A profundidade que se vÃª e se ouve â€” itens 1437 e 1438

O item 1437 pedia para aplicar o `luzMinima` das camadas, que estava declarado e sem leitor. Ao ir
ligÃ¡-lo apareceu um defeito maior por trÃ¡s dele: **as trÃªs luzes da cena sÃ£o globais e seguiam sÃ³ o
`sunScale`**. Debaixo de quarenta metros de rocha o sol continuava mandando â€” uma caverna profunda
era *duas vezes mais clara ao meio-dia que Ã  meia-noite*.

A luz por voxel do `lighting.ts` estava certa o tempo todo: a caverna tem `sky = 0` e o
multiplicador desaba para o piso. O que nÃ£o estava certo era **o que esse piso multiplica**.

A nota do item dizia para escolher entre mesh e shader. Nenhum dos dois: a profundidade que importa
Ã© a do jogador, igual Ã  da nÃ©voa, e a nÃ©voa jÃ¡ resolve isso hÃ¡ duas seÃ§Ãµes com trÃªs intensidades por
quadro e zero remontagem. Escolher entre as duas opÃ§Ãµes da nota teria custado um re-mesh por
fronteira cruzada para resolver um problema que nÃ£o era o que estava escrito.

### O sentinela que criou um degrau

A superfÃ­cie declarava `luzMinima: 0` com o sentido "aqui o sol manda". A primeira versÃ£o respeitou
isso com um `piso > 0 ? piso * K : diurno` â€” e o teste de continuidade acusou um salto de **0,40** no
instante em que o piso deixava de ser zero, porque a mistura jÃ¡ estava a dois terÃ§os do caminho
quando o valor ainda era nulo. Duas rampas independentes, desalinhadas.

A cura foi tirar o sentinela: a superfÃ­cie ganhou um piso de verdade (0,12, que Ã© o que a luz
ambiente jÃ¡ valia de dia) e a camada passou a sÃ³ poder **escurecer**, nunca clarear. Sem esse `min`,
descer Ã  meia-noite *acenderia* o mundo atÃ© os seis metros â€” o "teto que satura" de sempre,
invertido.

### O som

`AMBIENTES` dÃ¡ a cada camada sons esporÃ¡dicos e sorteados, sintetizados como todo o resto â€” nenhum
arquivo de Ã¡udio. Ritmo acompanhando o `perigo`: o abismo fala a cada 6â€“13 s, o subsolo a cada
14â€“30. A superfÃ­cie Ã© muda de propÃ³sito, pelo mesmo motivo que nÃ£o impÃµe nÃ©voa: lÃ¡ quem manda Ã© o
bioma.

**Um teste passou por um motivo ruim e escondeu um buraco.** A primeira versÃ£o reiniciava o relÃ³gio
ao trocar de camada, e o teste "vaivÃ©m nÃ£o acumula disparos" esperava zero sons â€” e recebeu zero.
SÃ³ que quem *caminha* sobre uma fronteira (um piso a exatamente catorze metros) troca de camada a
cada quadro, e o relÃ³gio reiniciado nunca chegava a zero: o ambiente ficava **mudo justamente onde
deveria estar trocando de identidade**, com sintoma idÃªntico a "o Ã¡udio estÃ¡ desligado". O relÃ³gio
agora desconta sempre, e a troca sÃ³ apara o teto.

- [~] 1459 `P1` **`luzDeCamada.ts`**, puro e sem Three.js â€” a regra de luz Ã© conferÃ­vel sem WebGL
- [~] 1460 `P1` **`setLayerLight` na cena**, trÃªs intensidades por quadro e nenhum chunk remontado
- [~] 1461 `P1` **`superficie.luzMinima` = 0,12** no lugar do sentinela, e `min` com o diurno
- [~] 1462 `P1` **`ambienteDeCamada.ts`** com sons por camada e relÃ³gio sorteado
- [~] 1463 `P2` **`dt` limitado a 0,25 s** â€” voltar de uma aba em segundo plano nÃ£o dispara na hora
- [~] 1464 `P1` **30 testes** entre luz e som, incluindo os quatro laÃ§os de fiaÃ§Ã£o que leem `main.ts`

### Lacunas anotadas nesta rodada

- [ ] 1465 `P2` **A luz de camada Ã© global, pela profundidade do jogador** â€” quem estÃ¡ a dez metros olhando pela boca de um tÃºnel vÃª a superfÃ­cie com a luz do subsolo. Ã‰ o mesmo compromisso que a nÃ©voa jÃ¡ assume, e sair dele exige uma textura de alturas que o shader hoje nÃ£o tem
- [ ] 1466 `P2` **Nenhum dos sons novos foi ouvido** â€” as especificaÃ§Ãµes sÃ£o conferidas em faixa e em ritmo, e o que sai da Web Audio API nÃ£o Ã© conferido por nada. Ã‰ o mesmo furo do GLSL que ninguÃ©m compila
- [ ] 1467 `P3` **O ambiente nÃ£o conhece o abrigo** â€” quem estÃ¡ numa sala selada a vinte metros ouve o abismo igual a quem estÃ¡ numa galeria aberta, e `abrigo.ts` jÃ¡ sabe responder a diferenÃ§a

## 82. Onde o mundo termina â€” itens 1091, 1092 e 1093

TrÃªs itens de nÃ©voa que dizem a mesma coisa por Ã¢ngulos diferentes.

O **1093** jÃ¡ estava pronto e ninguÃ©m tinha reparado: a mistura de `main.ts` Ã©
`bioma + (camada - bioma) * dentroDaTerra`, e com `dentroDaTerra = 1` o termo do bioma cancela por
completo. As camadas verticais o entregaram de lado, duas seÃ§Ãµes atrÃ¡s. Marcado com um teste que
prova o cancelamento, porque um item resolvido de raspÃ£o continua parecendo pendente atÃ© alguÃ©m
mostrar que nÃ£o estÃ¡.

O **1091** era um defeito de verdade, e o motivo de nunca ter aparecido Ã© instrutivo: o cÃ©u era uma
cor chapada e a nÃ©voa era essa mesma cor **tingida pelo bioma na proporÃ§Ã£o da luz do dia**. Ã€ noite
o tingimento zera e as duas coincidem exatamente â€” de dia, num deserto, o terreno sumia numa cor
areia e o cÃ©u logo acima era azul, com uma linha reta entre os dois na altura do horizonte.

A correÃ§Ã£o Ã© uma cÃºpula com gradiente: zÃªnite na cor do cÃ©u, horizonte na cor da nÃ©voa. Pintar o
fundo inteiro da cor da nÃ©voa tambÃ©m casaria as duas e daria ao deserto um cÃ©u cor de areia atÃ© o
alto â€” trocar uma borda visÃ­vel por um erro maior. A borda tem de sumir **no horizonte**, e sÃ³ lÃ¡.

O **1092** dÃ¡ recompensa a subir, que nenhum outro sistema dava: o vale fecha em 0,72 e o pico abre
em 1,12. O multiplicador entra **sÃ³ no lado do bioma** da mistura, e esse parÃªntese Ã© a regra
inteira â€” aplicÃ¡-lo depois faria a caverna de um vale ser mais fechada que a caverna de um pico, na
mesma profundidade e pelo motivo errado.

### A regra do horizonte existe duas vezes

O que roda Ã© GLSL; o que Ã© testÃ¡vel Ã© TypeScript. Nenhum teste aqui compila shader, entÃ£o as duas
cÃ³pias podem divergir. O que nÃ£o pode divergir Ã© a **faixa** â€” Ã© ela que decide se o efeito aparece
â€”, entÃ£o `ALCANCE_DO_HORIZONTE` mora num lugar sÃ³ e o shader o recebe por uniform.

- [~] 1468 `P1` **`neblina.ts`**, puro e sem Three.js, com as duas regras verificÃ¡veis
- [~] 1469 `P1` **CÃºpula de gradiente no `sky.ts`**, com `depthTest` ligado â€” o cabeÃ§alho do arquivo registra o relato "estrelas por dentro das Ã¡rvores", que foi exatamente desligÃ¡-lo
- [~] 1470 `P2` **`ALCANCE_DO_HORIZONTE` compartilhado** entre o TS e o uniform do GLSL
- [~] 1471 `P1` **19 testes**, incluindo os laÃ§os que leem `main.ts`, `scene.ts` e `sky.ts`

### Lacunas anotadas nesta rodada

- [ ] 1472 `P2` **O gradiente do horizonte nÃ£o foi visto** â€” a faixa e a fiaÃ§Ã£o sÃ£o conferidas, o GLSL nÃ£o Ã© compilado por nada. Ã‰ o mesmo furo dos itens 1466 e do shader de curvatura
- [ ] 1473 `P2` **A nÃ©voa de altitude nÃ£o conhece o clima** â€” chuva num pico deveria fechar o horizonte tanto quanto no vale, e hoje os dois multiplicadores sÃ³ se multiplicam
- [ ] 1474 `P3` **A cÃºpula Ã© uma esfera de 24Ã—16** desenhada todo quadro sem necessidade â€” o gradiente Ã© funÃ§Ã£o sÃ³ de `y`, e um quad de tela cheia faria o mesmo com dois triÃ¢ngulos

## 83. Quem sai do mundo â€” itens 1321 e 1330

### A casa que nÃ£o protegia do caso mais Ã³bvio

A regra de abrigo valia para o **berÃ§o** e mais nada. `isSpawnable` recusa o interior da casa, e Ã©
sÃ³ isso: quem fechasse a porta com um zumbi dentro ficava com ele lÃ¡ para sempre. O jogador constrÃ³i
exatamente para se proteger, e a construÃ§Ã£o nÃ£o o protegia do caso que qualquer um encontra primeiro
â€” sem nada no jogo dizendo que aquilo Ã© permanente.

Investigando, o buraco era maior: **nÃ£o havia despawn de espÃ©cie alguma.** Uma criatura sÃ³ saÃ­a do
mundo morrendo. Quem gerasse hostis num canto e atravessasse o mundo levava o teto consigo, ocupado
por criaturas a centenas de metros que nunca mais veria â€” e teto ocupado quer dizer que nada nasce
perto. O sintoma seria o mundo ficar inexplicavelmente vazio depois de uma hora de jogo, sem nenhuma
pista apontando para a causa.

TrÃªs decisÃµes que o teste trava:

- **Sumir, nÃ£o empurrar.** "Expulsar" no sentido literal exigiria achar uma saÃ­da, e o caso
  interessante Ã© justamente o de nÃ£o haver saÃ­da â€” a casa estÃ¡ fechada, Ã© para isso que ela existe.
- **Espera contÃ­nua, e reiniciÃ¡vel.** Uma criatura que evapora na frente do jogador Ã© pior que uma
  presa: uma Ã© um incÃ´modo, a outra denuncia que o mundo Ã© uma simulaÃ§Ã£o frouxa. Sair do abrigo e
  voltar reinicia a conta, senÃ£o bastaria cruzar a soleira uma vez para ficar marcado.
- **CarÃªncia apÃ³s combate.** Sem ela, recuar para dentro de casa faria o zumbi que estÃ¡ mordendo o
  jogador evaporar â€” o que nÃ£o lÃª como abrigo, lÃª como o jogo desistindo da luta no meio. E fugir
  correndo faria o perseguidor sumir, ensinando o jogador a "desaparecer" inimigos andando.

E `despawnEntity` nÃ£o chama `onEntityDeath`: premiar o despawn com despojos daria uma fazenda de
recursos que se opera fechando a porta.

### O item que ficava para sempre

`DroppedItem` jÃ¡ contava `age` e ninguÃ©m lia. Os itens ficavam no chÃ£o pelo resto da partida, cada um
com uma malha, um material e um teste de distÃ¢ncia por quadro â€” e os materiais nunca eram
descartados, entÃ£o cada bloco quebrado deixava um programa de GPU vivo atÃ© a pÃ¡gina fechar.

Quem morre duas vezes no mesmo lugar ficava com duas pilhas indistinguÃ­veis. Agora o que cai na
morte dura cinco vezes mais e Ã© maior â€” o que responde "qual destas Ã© a minha?" sem texto nenhum.

**A piscada de aviso saiu errada na primeira versÃ£o, e o teste pegou.** Eu escrevi
`idade * R * (1 + urgencia * 2)`, que parece uma frequÃªncia crescente e nÃ£o Ã©: com `idade` na casa
das centenas, a derivada Ã© dominada por `idade * dR/dt` e a piscada sai rapidÃ­ssima do comeÃ§o ao fim.
Um efeito que existe, roda, e faz o oposto do que o comentÃ¡rio promete. A fase precisa ser a
**integral** da frequÃªncia.

- [~] 1475 `P1` **`despawn.ts`**, regra pura e relÃ³gio separados â€” a regra testa sem simular quadros
- [~] 1476 `P1` **`despawnEntity` e a marca de combate** no `EntitySystem`, marcada nos dois lados do golpe
- [~] 1477 `P1` **`vidaDoItem.ts`** com expiraÃ§Ã£o, aviso e origem
- [~] 1478 `P2` **`dispose` em todo caminho de saÃ­da** de item â€” o vazamento existia desde sempre
- [~] 1479 `P1` **39 testes** entre os dois, incluindo doze laÃ§os de fiaÃ§Ã£o

### Lacunas anotadas nesta rodada

- [ ] 1480 `P2` **O despawn nÃ£o Ã© sincronizado** â€” o anfitriÃ£o remove a criatura e o convidado sÃ³ descobre no `mob_sync` seguinte, atÃ© 170 ms depois. Ela some tarde, e some sem motivo visÃ­vel daquele lado
- [ ] 1481 `P2` **Nada avisa que a criatura presa vai embora** â€” do lado do jogador Ã© um zumbi que desaparece sozinho dentro de casa, que Ã© exatamente o tipo de coisa que se lÃª como defeito
- [ ] 1482 `P3` **Os itens largados nÃ£o sÃ£o salvos** â€” fechar o mundo apaga a pilha da morte, e a vida de 25 minutos sugere o contrÃ¡rio

## 84. As estaÃ§Ãµes chegam ao chÃ£o â€” itens 1118, 1119 e 1120

Os trÃªs campos de `PerfilSazonal` que nunca tiveram leitor. O inverno mudava a cor da folhagem e
pesava a neve no sorteio de clima; o chÃ£o continuava verde, o dia continuava do mesmo tamanho e nada
nunca crescia.

### 1120 â€” distorcer o relÃ³gio, nÃ£o a velocidade dele

A tentaÃ§Ã£o Ã© fazer o tempo correr mais devagar de noite no inverno. Isso quebraria tudo o que
depende de o dia durar `DAY_LENGTH` segundos: a sincronizaÃ§Ã£o entre pares, o contador de dias, o
sono â€” e o prÃ³prio ano, porque um inverno mais longo desalinharia as estaÃ§Ãµes do calendÃ¡rio que as
define.

O relÃ³gio real continua uniforme e o que muda Ã© **onde o sol estÃ¡** para uma dada hora. TrÃªs Ã¢ncoras
lineares â€” meia-noite, nascer, pÃ´r â€”, e nÃ£o uma curva suave, porque uma curva move o meio-dia: com o
sol no ponto alto fora do meio do dia, o relÃ³gio do jogo deixa de bater com o cÃ©u, e Ã© um erro que
ninguÃ©m consegue nomear.

E a **fase do dia** tambÃ©m passa pela hora aparente. Deixar as mecÃ¢nicas no relÃ³gio real faria a
noite de inverno comeÃ§ar visualmente e nÃ£o valer como noite para abrigo, sono e objetivo â€” escuro lÃ¡
fora, "dia" para o jogo.

### 1118 â€” o sistema mais perigoso do repositÃ³rio

Ele reescreve blocos perto do jogador; um erro aqui apaga construÃ§Ã£o. TrÃªs regras, e a maior parte
dos testes existe para provar o que ele **nÃ£o** toca:

1. **SÃ³ grama e Ã¡gua entram**, e sÃ³ grama e Ã¡gua saem.
2. **SÃ³ a face exposta ao cÃ©u.** O que tem algo em cima Ã© interior de alguma coisa, e interior de
   alguma coisa costuma ser construÃ§Ã£o.
3. **A reversÃ£o Ã© por identidade, nÃ£o por memÃ³ria.** Guardar "o que havia antes" exigiria uma tabela
   que cresce com a Ã¡rea explorada e que fica errada assim que o jogador mexe no bloco.

O preÃ§o aceito: neve colocada pelo jogador sobre grama derrete no degelo. Ã‰ pequeno perto do risco
de manter memÃ³ria.

Histerese com duas soleiras, senÃ£o um ponto oscilando em torno do limiar congela e degela a cada
passada â€” o lago inteiro piscando entre azul e branco. E um teste cruza as soleiras com
`PERFIS_PADRAO`: se `CONGELA_ACIMA_DE` ficasse acima da neve do inverno, o sistema rodaria e nunca
congelaria nada, que Ã© exatamente o modo de falha do item 029.

### 1119 â€” modular uma coisa que nÃ£o acontecia

`api.season.growth()` expunha aos mods a velocidade de um crescimento que nÃ£o existia. O sintoma no
jogo era cavar um buraco, tapar com terra, e ficar com uma cicatriz marrom permanente na paisagem.

A terra vira grama **por espalhamento** â€” precisa de grama ao lado. Sem o vizinho, terra no meio de
um descampado viraria grama sozinha, o que lÃª como magia e nÃ£o como natureza. E nÃ£o planta Ã¡rvore:
uma Ã¡rvore ocupa dezenas de voxels e apareceria dentro de uma casa cujo teto o jogador ainda nÃ£o
fechou. Crescimento rasteiro se desfaz com um clique; uma Ã¡rvore nÃ£o.

- [~] 1483 `P1` **`duracaoDoDia.ts`** com remapeaÃ§Ã£o monotÃ´nica e identidade exata no neutro
- [~] 1484 `P1` **`invernada.ts`**, varredura orÃ§ada com histerese e reversÃ£o por identidade
- [~] 1485 `P1` **Bloco `ICE`**, sÃ³lido e nÃ£o opaco, sem drop
- [~] 1486 `P1` **`vegetacao.ts`**, crescimento probabilÃ­stico por espalhamento
- [~] 1487 `P1` **55 testes** entre os trÃªs, a maioria sobre o que os sistemas nÃ£o podem tocar

### Lacunas anotadas nesta rodada

- [ ] 1488 `P2` **A neve e o gelo nÃ£o sÃ£o salvos como modificaÃ§Ã£o do jogador** â€” passam por `setBlock` e entram no diff do mundo, entÃ£o um mundo salvo no inverno carrega para sempre a neve daquele dia atÃ© a varredura passar de novo
- [ ] 1489 `P2` **O gelo nÃ£o Ã© escorregadio nem quebra sob peso** â€” Ã© um bloco sÃ³lido comum com outra cor, e o jogador vai esperar as duas coisas
- [ ] 1490 `P2` **A hora aparente Ã© do bioma do JOGADOR** â€” dois pares em biomas de forÃ§a sazonal diferente veem o sol em posiÃ§Ãµes diferentes na mesma hora do mundo
- [ ] 1491 `P3` **Nada avisa que a estaÃ§Ã£o virou** â€” a neve chega devagar e sem anÃºncio, e quem estava numa caverna sai para um mundo diferente sem transiÃ§Ã£o

## 85. A voz tem lugar â€” itens 1414 e 1415

Cada par recebia um `<audio autoplay>` e nada mais. Todo mundo se ouvia no mesmo volume, de qualquer
distÃ¢ncia e de qualquer direÃ§Ã£o: quatro pessoas espalhadas por quatrocentos metros soavam
exatamente como quatro pessoas na mesma sala. A Ãºnica informaÃ§Ã£o que a voz carrega alÃ©m das
palavras â€” *onde vocÃª estÃ¡* â€” se perdia inteira.

### O elemento `<audio>` continua existindo, mudo

A tentaÃ§Ã£o Ã© jogÃ¡-lo fora e ligar o `MediaStream` direto no Web Audio. NÃ£o funciona: no Chrome, um
stream vindo de `RTCPeerConnection` **nÃ£o flui** para um `MediaStreamAudioSourceNode` se nÃ£o estiver
tambÃ©m ligado a um elemento de mÃ­dia. Ã‰ um defeito conhecido e antigo, e o sintoma Ã© o pior
possÃ­vel â€” nenhum erro, nenhum aviso, silÃªncio absoluto.

EntÃ£o o elemento fica com `muted = true`: existe para o stream correr, e quem produz som Ã© o grafo.

### Duas decisÃµes que os testes travam

**Zona Ã­ntima.** Abaixo de trÃªs voxels a voz sai centrada e cheia. Sem ela, quem estÃ¡ a meio metro
tem a voz saltando de lado a cada movimento do mouse â€” a panorÃ¢mica vem da direÃ§Ã£o do olhar, e a
direÃ§Ã£o de alguÃ©m muito perto muda por completo com um giro pequeno.

**Quem ainda nÃ£o mandou posiÃ§Ã£o Ã© ouvido.** A primeira coisa que alguÃ©m faz ao entrar Ã© falar;
emudecÃª-lo atÃ© o primeiro `player_state` o receberia com um silÃªncio indiagnosticÃ¡vel.

### O silÃªncio nunca sai da mÃ¡quina

Todo comando do chat Ã© despachado ao anfitriÃ£o. Este nÃ£o pode seguir esse caminho, e nÃ£o por
desempenho â€” por significado. Emudecer alguÃ©m Ã© uma decisÃ£o sobre **os meus ouvidos**. Passando pelo
anfitriÃ£o, viraria uma coisa que ele sabe (quem nÃ£o gosta de quem), que ele pode negar, e que para
de funcionar quando ele cai. As trÃªs inaceitÃ¡veis justamente no recurso cuja funÃ§Ã£o Ã© dar autonomia
a quem estÃ¡ num mundo pÃºblico.

Resolve por nome, guarda por id: guardar por nome deixaria o silÃªncio furado por quem trocasse de
apelido, e Ã© a primeira coisa que alguÃ©m tenta. E persiste, porque se caÃ­sse ao reconectar o jogador
refaria a escolha toda vez que a conexÃ£o oscilasse â€” que Ã© exatamente quando ele menos quer mexer em
menu.

- [~] 1492 `P1` **`vozEspacial.ts`**, puro: a regra do que se ouve Ã© conferÃ­vel sem navegador
- [~] 1493 `P1` **`MixerDeVoz`**, um grafo por par, fora do teto de 24 vozes do `AudioSystem`
- [~] 1494 `P1` **`comandoDeSilencio.ts`**, interceptado antes do despacho
- [~] 1495 `P2` **`AvatarManager.posicaoDe` e `.presentes()`** â€” a voz sai da posiÃ§Ã£o exibida, nÃ£o da recebida
- [~] 1496 `P1` **30 testes**, incluindo sete laÃ§os de fiaÃ§Ã£o

### Lacunas anotadas nesta rodada

- [~] 1497 `P1` **Lista de jogadores no [Tab]** â€” e com ela `/mudo` e o sono coletivo deixaram de ser invisÃ­veis
- [ ] 1498 `P2` **SÃ³ se pode silenciar quem estÃ¡ presente** â€” quem saiu nÃ£o pode ser silenciado preventivamente, e a lista de `/mudo` mostra o id cru de quem nÃ£o estÃ¡ por perto
- [ ] 1499 `P2` **A voz nÃ£o Ã© abafada por parede** â€” dois jogadores separados por vinte metros de rocha se ouvem como se estivessem no mesmo corredor, e `abrigo.ts` jÃ¡ sabe responder se hÃ¡ caminho
- [ ] 1500 `P3` **Nada indica quem estÃ¡ falando** â€” sem um sinal no avatar ou na lista, uma sessÃ£o com quatro pessoas vira um jogo de adivinhar

## 86. O que o jogo sabia e nÃ£o dizia â€” itens 126 e 143

Auditei primeiro. Cinco itens marcados como pendentes jÃ¡ estavam feitos e ninguÃ©m tinha voltado
para marcÃ¡-los: **102** (bioma por temp Ã— umidade), **103** (mistura por peso), **105** (praia),
**127** (lava e queimadura) e **192** (erro de script isolado por entidade). EstÃ£o com `[x]`.

Os outros dois eram reais, e os dois sÃ£o a mesma doenÃ§a: **o jogo jÃ¡ calculava a informaÃ§Ã£o e nÃ£o a
mostrava.**

### 126 â€” trÃªs segundos mudos

O afogamento jÃ¡ causava dano. O que nÃ£o havia era aviso: `airTime` era um campo privado que sÃ³
existia para comparar com 3, e o jogador mergulhava e o dano simplesmente comeÃ§ava. A Ãºnica forma de
aprender o limite era morrer nele.

A reserva passou a doze segundos, e o motivo Ã© a barra: com trÃªs, cada bolha vale 0,3 s e o
indicador pula de cheio a vazio sem passar pelo meio â€” que Ã© exatamente a informaÃ§Ã£o que ele existe
para dar. A barra some quando o ar estÃ¡ cheio, porque um indicador permanente vira ruÃ­do e um que
aparece por causa de alguma coisa Ã© lido.

O teste antigo cravava os trÃªs segundos. Atualizei-o para ler a constante em vez de repetir o
nÃºmero â€” repetir faria a prÃ³xima calibraÃ§Ã£o reprovar ali sem nada estar errado.

### 143 â€” a causa entregue e jogada fora

`SurvivalSystem.onDeath(cause)` **sempre** entregou a causa. O `main` a recebia como `() => {}`: o
parÃ¢metro chegava e morria na assinatura. Sete causas calculadas com cuidado viravam a mesma frase.

NÃ£o Ã© estÃ©tico. Morrer sem saber do quÃª Ã© a diferenÃ§a entre "eu errei" e "o jogo me matou" â€” na
primeira o jogador muda o que faz, na segunda ele fecha a aba. E hÃ¡ causas literalmente invisÃ­veis:
a queimadura mata **depois** de sair da lava, e quem morre a dez metros dela nÃ£o tem nenhuma pista
de que o fogo ainda estava pegando.

Descobri de passagem que o dano de criatura emitia `'ataque inimigo'` enquanto o resto do sistema
usa nomes de uma palavra â€” dois nomes para a mesma coisa, e a tela cairia no texto genÃ©rico sem que
nada reprovasse.

- [~] 1501 `P1` **`RESERVA_DE_AR_S` e `ar` pÃºblicos**, com a HUD desenhando bolhas
- [~] 1502 `P1` **Ã�cone `bolha`** em `icons.ts` â€” traÃ§ado, nÃ£o emoji
- [~] 1503 `P1` **`causaDaMorte.ts`** com frase e dica por causa, e queda para "VocÃª morreu"
- [~] 1504 `P2` **`'criatura'` no lugar de `'ataque inimigo'`** na emissÃ£o do dano
- [~] 1505 `P1` **21 testes**, incluindo sete laÃ§os de fiaÃ§Ã£o

### Lacunas anotadas nesta rodada

- [ ] 1506 `P2` **A causa da morte aparece num toast** que some em segundos, e nÃ£o numa tela de morte â€” quem estava olhando para outro canto perde a Ãºnica explicaÃ§Ã£o que o jogo dÃ¡
- [ ] 1507 `P2` **A dica de morte repete toda vez** â€” na dÃ©cima morte por fome ela jÃ¡ ensinou o que tinha para ensinar e vira barulho
- [ ] 1508 `P3` **A barra de ar nÃ£o pisca no fim** â€” as Ãºltimas bolhas somem no mesmo ritmo das primeiras, e o momento em que o dano vai comeÃ§ar nÃ£o Ã© destacado

## 87. A caixa e o congelamento â€” itens 044 e 180

### 044 â€” as trÃªs cÃ³pias, e o limite que faltava nas trÃªs

O item dizia "duplicado 3Ã—" e estava certo: `ModAPI.fillBox`, o caso `fill_box` do `MCPExecutors`, e
de novo dentro de `execute_voxel_script`. As trÃªs fazem coisas diferentes com cada cÃ©lula â€” contar,
acumular lote para salvar, registrar o desfazer â€”, e Ã© por isso que a duplicaÃ§Ã£o sobreviveu tanto
tempo: nÃ£o dava para extrair "preencher uma caixa" sem escolher um dos trÃªs efeitos.

O que dÃ¡ para extrair Ã© a **geometria**. E duas das trÃªs jÃ¡ tinham divergido na escrita: `ModAPI`
usava `hollow && x !== minX && ...`, as outras `if (hollow) { const isEdge = ...; }`. Equivalentes
hoje; nada garantia que continuassem.

**Nenhuma das trÃªs perguntava o tamanho antes de comeÃ§ar.** Uma caixa de 200 de lado sÃ£o oito
milhÃµes de cÃ©lulas: a aba trava, sem erro e sem fim, e do lado de fora parece que o jogo morreu. Ã‰
um pedido que a IA faz sozinha, por um dÃ­gito a mais, e o jogador nÃ£o tem como cancelar. O corte Ã©
por nÃºmero de cÃ©lulas e nÃ£o por aresta â€” uma caixa de 400Ã—400Ã—1 Ã© tÃ£o cara quanto uma de 58Â³ e
passaria por qualquer limite de lado.

E a recusa Ã© **total**, nÃ£o "faz o que couber": uma caixa cortada pela metade deixa uma construÃ§Ã£o
incompleta que parece defeito de geraÃ§Ã£o, e quem pediu nÃ£o sabe onde ela parou.

O caso que quase escapou: numa laje de um bloco de altura, `minY === maxY`, entÃ£o toda cÃ©lula Ã©
casca. Sem isso, pedir um piso "oco" devolveria nada â€” um chÃ£o que nÃ£o aparece, com o argumento
`hollow` como Ãºnica pista, trÃªs chamadas acima.

### 180 â€” o custo que estava sempre ligado

Tudo rodava para todo mundo, todo quadro, a qualquer distÃ¢ncia. E o ramo dos NPCs decorativos faz
uma varredura de chÃ£o que desce da cabeÃ§a da entidade **atÃ© o y zero**: atÃ© cento e trinta consultas
por entidade por quadro, para mover um boneco que ninguÃ©m estÃ¡ vendo. Nada falha â€” o jogo sÃ³ fica
mais lento Ã  medida que o mundo se povoa, proporcional a quantas criaturas existem e nÃ£o a quantas
importam.

Congelar, e nÃ£o simular devagar: um `dt` grande na colisÃ£o atravessa parede, e o A* com alvo velho
manda a criatura para onde o jogador estava. Uma criatura parada a cem metros Ã© indistinguÃ­vel de
uma andando a cem metros; uma criatura dentro da pedra nÃ£o Ã©.

**A ordem com o item 1321 Ã© o detalhe que importa.** O congelamento fica *depois* do envelhecimento
da marca de combate. Antes dele, uma criatura congelada teria a marca parada, nunca deixaria a
carÃªncia do despawn, e ficaria no mundo para sempre ocupando o teto de hostis â€” o congelamento
reintroduziria por um caminho novo exatamente o defeito que o 1321 acabou de fechar. HÃ¡ um teste
comparando as posiÃ§Ãµes no arquivo.

- [~] 1509 `P1` **`caixa.ts`** com limites, casca, percurso e recusa
- [~] 1510 `P1` **`MAX_CELULAS_DA_CAIXA`**, que nÃ£o existia em nenhuma das trÃªs cÃ³pias
- [~] 1511 `P1` **`simulacao.ts`** com histerese e isenÃ§Ã£o por combate
- [~] 1512 `P2` **Raios cruzados com `aggroRange` e `DISTANCIA_DE_ESQUECIMENTO`** por teste â€” congelar depois do despawn faria o sistema rodar sem efeito
- [~] 1513 `P1` **32 testes** entre os dois, com sete laÃ§os de fiaÃ§Ã£o

### Lacunas anotadas nesta rodada

- [ ] 1514 `P2` **A entidade congelada continua desenhada e continua no `Map`** â€” o ganho Ã© de CPU e nÃ£o de memÃ³ria nem de draw call; itens 031 e 032 continuam abertos
- [x] 1515 `P2` ~~O limite de caixa nÃ£o vale para `set_block` em laÃ§o~~ **A nota estava errada** â€” o caminho da IA tem prazo de 4 s e o de mods tem `CHAMADAS_POR_QUADRO`. Auditado e descartado
- [ ] 1516 `P3` **A varredura de chÃ£o do NPC ainda desce atÃ© y = 0** quando ele estÃ¡ perto â€” o congelamento reduziu quantas vezes ela roda, nÃ£o o que ela custa

## 88. Onde guardar as coisas â€” item 137

Auditoria: **032** e **045** jÃ¡ estavam feitos. `disposeChunkMesh` remove da cena, descarta a
geometria e tira o chunk do `Map`; e `dirty` sempre foi uma flag por chunk, com o laÃ§o de quadro
varrendo por orÃ§amento â€” N `setBlock` no mesmo chunk sempre colapsaram numa invalidaÃ§Ã£o sÃ³.

E a lacuna **1515** que eu mesmo anotei na rodada passada estava **errada**: o caminho da IA tem um
prazo de 4 s e o de mods tem `CHAMADAS_POR_QUADRO`. Descartada com a justificativa.

### O baÃº, e por que ele nÃ£o Ã© uma entidade

NÃ£o havia armazenamento nenhum. Tudo o que o jogador tem cabe na hotbar, e o que nÃ£o cabe Ã© largado
no chÃ£o â€” onde agora expira. O efeito em cascata Ã© maior do que parece: sem onde guardar, minerar
alÃ©m do necessÃ¡rio nÃ£o faz sentido, construir uma base nÃ£o tem funÃ§Ã£o alÃ©m de dormir, e a progressÃ£o
inteira fica presa ao que se carrega.

O conteÃºdo Ã© indexado pela **posiÃ§Ã£o do bloco**, nÃ£o por um id. Um baÃº nÃ£o anda, nÃ£o tem estado alÃ©m
do conteÃºdo, e some quando o bloco some. Sem id nÃ£o hÃ¡ registro Ã³rfÃ£o quando o bloco desaparece por
um caminho que nÃ£o passa pela interface â€” `fill_box`, script de mod, explosÃ£o. O preÃ§o Ã© que quebrar
o bloco tem de devolver o conteÃºdo, e essa Ã© a Ãºnica regra que `bau.ts` nÃ£o consegue impor sozinho.

Um baÃº vazio Ã© **apagado** do banco em vez de gravado vazio: sem isso, a tabela cresceria com o
nÃºmero de baÃºs que o jogador jÃ¡ olhou por curiosidade, e nÃ£o com os que ele usa.

### O defeito antigo que o baÃº expÃ´s

`Interaction.grant` era `hotbar.find(s => s.block === t)` e, se nÃ£o achasse, **nÃ£o fazia nada**.
Pegar do chÃ£o um bloco que nÃ£o estava na barra perdia o item em silÃªncio: sem mensagem, sem som
diferente, com a pilha sumindo ao ser tocada. Ele Ã© chamado por `itemDropSystem.onCollect` â€” ou
seja, isso acontecia na coleta de todo dia.

SÃ³ apareceu porque o baÃº **precisa saber quanto coube**, para devolver a sobra. `guardarNaHotbar`
agora abre slot vazio e devolve o nÃºmero aceito; `grant` delega.

- [~] 1517 `P1` **`bau.ts`** com empilhamento, sobra, esvaziamento e saneamento do que vem do banco
- [~] 1518 `P1` **Bloco `CHEST`** e tabela `chestContents` na v10, com chave `[worldId+key]`
- [~] 1519 `P1` **`BauModal`**, tela prÃ³pria com clique-move-pilha e sem arrastar
- [~] 1520 `P1` **`guardarNaHotbar`** â€” o `grant` que perdia item em silÃªncio
- [~] 1521 `P1` **33 testes**, dez deles de fiaÃ§Ã£o

### Lacunas anotadas nesta rodada

- [~] 1522 `P1` **O baÃº Ã© do anfitriÃ£o** â€” trÃªs mensagens novas, e nenhuma escrita no convidado
- [~] 1523 `P2` **Receita do baÃº** â€” e um teste que casa TODA receita com forma contra a prÃ³pria grade
- [ ] 1524 `P2` **A tela do baÃº nÃ£o mostra a hotbar** â€” guardar Ã© Ã s cegas pelo [G], e o jogador nÃ£o vÃª o que estÃ¡ prestes a guardar
- [ ] 1525 `P3` **O baÃº nÃ£o tem visual prÃ³prio** â€” Ã© um cubo marrom nÃ£o-opaco, e a tampa mais baixa que o comentÃ¡rio descreve nÃ£o existe na malha

## 89. O baÃº no mundo compartilhado â€” itens 1522 e 1523

### O anfitriÃ£o Ã© o dono, pela mesma razÃ£o de sempre

O conteÃºdo vivia no banco local de quem abrisse. Num mundo compartilhado isso significa que dois
jogadores no mesmo baÃº escrevem por cima um do outro, e cada um vÃª um conteÃºdo diferente do mesmo
bloco â€” a forma mais confusa possÃ­vel de perder itens, porque os dois juram que guardaram.

O convidado **pede** e o anfitriÃ£o **responde**. Ã‰ a mesma regra que jÃ¡ vale para o mundo e para as
criaturas, entÃ£o nÃ£o entra um segundo modelo de consistÃªncia no projeto.

Duas decisÃµes que os testes travam:

- **O anfitriÃ£o difunde para todos**, e nÃ£o sÃ³ para quem pediu. Outro convidado com o mesmo baÃº
  aberto precisa ver a mudanÃ§a, senÃ£o ele clica numa pilha que jÃ¡ nÃ£o existe.
- **O que sai vai como drop no mundo.** O inventÃ¡rio do convidado Ã© local e o anfitriÃ£o nÃ£o o
  conhece; cair aos pÃ©s de quem pediu Ã© a Ãºnica entrega possÃ­vel sem inventar um segundo canal.

E o convidado tira da prÃ³pria barra **antes** de a confirmaÃ§Ã£o chegar. Esperar faria a pilha piscar
de volta a cada clique numa conexÃ£o de 80 ms; se o anfitriÃ£o recusar, ele devolve pelo
`chest_state`.

### 1523 â€” e o erro que ele quase escondeu

Escrevi o buraco do meio da receita do baÃº como `0`. `CraftCell` Ã© `number | null`, e `0` Ã©
`B.AIR` â€” um bloco de verdade, que o jogador nÃ£o pode pÃ´r na grade. A receita **compilava, aparecia
na lista de receitas, e nunca casava**: o jogador montaria o quadrado de tÃ¡buas e nÃ£o aconteceria
nada, sem nenhuma pista de por quÃª.

O teste que fecha isso nÃ£o olha sÃ³ o baÃº: ele monta a grade a partir da forma declarada de **cada
receita** e exige que ela case consigo mesma. Ã‰ o tipo de defeito que sÃ³ existe uma vez por receita
nova, e agora nenhuma delas pode nascer morta.

- [~] 1526 `P1` **`chest_open`, `chest_state` e `chest_move`** no protocolo
- [~] 1527 `P1` **Nenhuma escrita de baÃº no convidado** â€” verificado por posiÃ§Ã£o no arquivo
- [~] 1528 `P2` **Receita do baÃº**, tÃ¡buas em quadrado com o meio vazio
- [~] 1529 `P1` **Teste que casa toda receita com forma** contra a prÃ³pria grade
- [~] 1530 `P1` **44 testes** no arquivo do baÃº

### Lacunas anotadas nesta rodada

- [ ] 1531 `P2` **O convidado nÃ£o sabe que o baÃº estÃ¡ vazio ou que ele nem existe** â€” se o bloco sumiu entre o clique e a resposta, a tela fica aberta e vazia sem explicaÃ§Ã£o
- [~] 1532 `P2` **O anfitriÃ£o confere o baÃº quebrado** antes do `setBlock`, nos dois caminhos de rede
- [ ] 1533 `P3` **Duas pessoas guardando ao mesmo tempo perdem a ordem** â€” o anfitriÃ£o aplica na ordem de chegada, o que Ã© correto, mas nenhum dos dois vÃª o que aconteceu com o pedido do outro

## 90. A noite compartilhada â€” itens 139 e 1532

### 1532 â€” a ordem Ã© a funÃ§Ã£o inteira

Quebrar um baÃº no convidado nÃ£o devolvia nada: o `devolverConteudoDoBau` rodava do lado errado, lia
o banco local (vazio), e deixava o conteÃºdo real Ã³rfÃ£o no banco do anfitriÃ£o. O item sumia duas
vezes, de dois jeitos diferentes.

O anfitriÃ£o agora confere no `block_update` e no `block_batch` â€” **antes** do `setBlock`. Depois
dele o bloco jÃ¡ Ã© ar e nÃ£o hÃ¡ mais como saber que ali havia um baÃº.

### 139 â€” a recusa boa com a consequÃªncia ruim

`porQueNaoPodeDormir` recusava o convidado com `souORelogio`, e a razÃ£o era boa: o relÃ³gio do mundo
Ã© do anfitriÃ£o, e um convidado adiantando o prÃ³prio relÃ³gio veria um amanhecer que nÃ£o aconteceu
para mais ninguÃ©m. A consequÃªncia nÃ£o era boa: num mundo compartilhado **a noite deixava de ter
saÃ­da**. Quem hospeda dorme sozinho e passa a noite; quem entrou fica acordado no escuro, sem nada
que possa fazer e sem nada explicando por quÃª.

Deitar virou um pedido. O convidado deita, o anfitriÃ£o conta, e o relÃ³gio sÃ³ acelera quando todos
estiverem deitados.

**Todos, e nÃ£o a maioria.** Maioria significa ter a noite pulada contra a prÃ³pria vontade â€” e quem
estava minerando no fundo de uma caverna acabou de perder a noite inteira de trabalho seguro. Numa
sessÃ£o de dois, que Ã© o caso comum, "maioria" nem sequer quer dizer alguma coisa.

O custo assumido Ã© que uma pessoa distraÃ­da segura a noite dos outros, e por isso a funÃ§Ã£o devolve
**quem falta** e o aviso vai para todos. Sem o nome, o recurso vira uma espera silenciosa em que
ninguÃ©m entende o que estÃ¡ acontecendo.

**Quem sai deixa de contar.** Ã‰ o modo de falha que trava a noite para sempre: alguÃ©m que
desconecta *dormindo* ficaria no conjunto e o "todos dormiram" nunca mais seria verdade. SÃ³ acontece
quando alguÃ©m sai enquanto dorme â€” raro o bastante para nunca aparecer num teste manual, e
permanente quando acontece.

### O campo morto saiu junto

`souORelogio` deixou de ser lido. Removi do tipo em vez de deixÃ¡-lo lÃ¡: um parÃ¢metro sem leitor
sobrevive a trÃªs refatoraÃ§Ãµes e depois confunde quem tenta entender a regra. Dois testes antigos
apontavam para ele e para a forma antiga do `ritmo`; atualizei os dois mantendo o que garantem.

- [~] 1534 `P1` **`sonoColetivo.ts`**, com `RegistroDeSono` separado da regra
- [~] 1535 `P1` **`sleep_state`** no protocolo
- [~] 1536 `P1` **`souORelogio` removido** do tipo, do `main` e dos testes
- [~] 1537 `P1` **`conferirBauQuebrado`** antes do `setBlock`, nos dois caminhos
- [~] 1538 `P1` **23 testes** entre os dois

### Lacunas anotadas nesta rodada

- [ ] 1539 `P2` **NÃ£o hÃ¡ como recusar o sono coletivo** â€” quem nÃ£o quer dormir sÃ³ pode nÃ£o deitar, e nÃ£o tem como dizer "podem ir, me deixem fora"; numa sessÃ£o grande isso trava a noite sem conversa
- [~] 1540 `P2` **O contador de sono estÃ¡ no cabeÃ§alho da lista** â€” sem depender do chat
- [ ] 1541 `P3` **Deitar nÃ£o tem carÃªncia** â€” deitar e levantar em sequÃªncia dispara um aviso a cada vez, para todo mundo

## 91. Quem estÃ¡ aqui â€” item 1497

Duas mecÃ¢nicas inteiras nÃ£o tinham porta de entrada, e as duas eram minhas, das rodadas anteriores.

`/mudo` (item 1415) era a **Ãºnica** forma de silenciar alguÃ©m: quem nÃ£o sabe que o comando existe
nÃ£o tem forma nenhuma. E o sono coletivo (item 139) avisa quem falta por uma mensagem de chat que
passa â€” quem chega depois nÃ£o descobre por quem estÃ¡ esperando.

As duas dependiam da mesma coisa: saber quem estÃ¡ aqui. Uma lista resolve as duas de uma vez, e Ã© a
diferenÃ§a entre um recurso que existe e um recurso que alguÃ©m usa.

### Segurar, nÃ£o alternar

A lista Ã© uma **consulta**, nÃ£o uma tela. Alternar exigiria fechÃ¡-la, e o custo de esquecer aberto Ã©
um painel tampando o mundo justamente quando algo acontece. Segurar torna impossÃ­vel esquecer.

Pelo mesmo motivo ela nÃ£o passa pelo `UIManager`: uma tela bloqueante solta o ponteiro, pausa a
entrada e devolve o foco ao fechar. Para uma olhada de dois segundos, isso Ã© o triplo do custo do
benefÃ­cio.

Dois casos que os testes travam: o `preventDefault` no Tab â€” sem ele o navegador tira o foco do
canvas e o jogador perde o controle sem entender por quÃª â€” e o fechamento no `blur`, porque alt-tab
com o Tab apertado Ã© literalmente o gesto que o navegador rouba, e o painel ficaria preso na tela
parecendo um painel que nÃ£o fecha.

### A ordem Ã© por distÃ¢ncia, e isso Ã© uma decisÃ£o

A lista existe para **agir** sobre alguÃ©m, e essa pessoa quase sempre Ã© a que estÃ¡ por perto. Ordem
alfabÃ©tica faria a mesma pessoa mudar de posiÃ§Ã£o quando outra entrasse, e o clique erraria o alvo.
Quem ainda nÃ£o mandou posiÃ§Ã£o vai para o fim: Ã© quem acabou de entrar, e pÃ´-lo no topo com distÃ¢ncia
zero faria parecer que estÃ¡ colado no jogador.

E a lista Ã© **derivada**, nÃ£o guardada. Manter uma cÃ³pia prÃ³pria significaria sincronizÃ¡-la com trÃªs
fontes, e a primeira a divergir seria a de quem saiu â€” a mesma armadilha que jÃ¡ apareceu no sono
coletivo.

- [~] 1542 `P1` **`listaDeJogadores.ts`**, com a ordem, a distÃ¢ncia e o resumo de sono fora do DOM
- [~] 1543 `P1` **`PainelDeJogadores`** no [Tab], nÃ£o bloqueante
- [~] 1544 `P1` **Clique no nome silencia** â€” a porta que faltava para o item 1415
- [~] 1545 `P2` **Contador de sono no cabeÃ§alho**, sem depender do chat
- [~] 1546 `P1` **22 testes**, oito deles de fiaÃ§Ã£o

### Lacunas anotadas nesta rodada

- [ ] 1547 `P2` **O convidado nÃ£o sabe quem estÃ¡ dormindo** â€” `registroDeSono` sÃ³ existe no anfitriÃ£o, entÃ£o a lista dele mostra apenas o prÃ³prio estado. Honesto, mas incompleto: falta o anfitriÃ£o difundir o conjunto
- [ ] 1548 `P2` **Nada indica quem estÃ¡ falando** â€” o campo `falando` existe na linha e Ã© sempre `false`; ligÃ¡-lo exige medir o nÃ­vel de Ã¡udio de cada par no `MixerDeVoz`
- [ ] 1549 `P3` **A lista nÃ£o mostra vida nem modo** â€” num mundo compartilhado, saber quem estÃ¡ prestes a morrer Ã© o tipo de coisa que muda o que se faz

---

# PARTE VII â€” Rodada de pedidos do dono do projeto (27/07/2026)

Tudo o que segue veio de um pedido direto, em bloco. EstÃ¡ registrado **antes** de qualquer
implementaÃ§Ã£o, porque metade destes itens muda o desenho de sistemas que jÃ¡ existem e a ordem entre
eles importa mais que a velocidade de fazer o primeiro.

A prioridade abaixo Ã© minha, e a justifico item a item: `P0` Ã© o que estÃ¡ quebrado ou sem sentido
para quem joga **hoje**; `P1` Ã© o que falta para o jogo ser o que o pedido descreve; `P2` Ã©
melhoria; `P3` Ã© acabamento.

## 92. O que quebra hoje

- [~] 1550 `P0` **Os atalhos do navegador sÃ£o tomados enquanto se joga** â€” e devolvidos fora dele. Era: â€” Ctrl+W fecha a aba no meio de uma partida, F5 recarrega, Ctrl+S abre "salvar pÃ¡gina", Ctrl+D favorita, F3 abre a busca do Firefox. Nenhum deles Ã© recuperÃ¡vel: o jogador perde o que estava fazendo sem nada avisar. SÃ³ o Tab foi tratado (item 1497), e por acaso â€” porque tirava o foco do canvas
- [~] 1551 `P0` **A barra comeÃ§a vazia, com a mÃ£o e nada mais.** Era: â€” a barra comeÃ§a com 6.000 de terra, 9.000 de pedregulho, 6.000 de tÃ¡buas, 6.000 de tijolo, 2.400 de tronco, 3.000 de areia, 3.000 de pedra e 2.400 de folhas. Com isso, minerar nÃ£o tem funÃ§Ã£o, a fabricaÃ§Ã£o nÃ£o tem funÃ§Ã£o, o baÃº nÃ£o tem funÃ§Ã£o e os objetivos de "quebre um tronco" jÃ¡ estÃ£o cumpridos antes do primeiro clique. **Deve comeÃ§ar vazio**, com a mÃ£o e nada mais
- [ ] 1552 `P1` **Trocar a aparÃªncia nÃ£o aparece para os outros** â€” a `Appearance` vai no `player_joined` e no `player_state`, mas trocar de skin com a sessÃ£o aberta nÃ£o reemite nada: os outros continuam vendo o boneco antigo atÃ© reconectarem
- [~] 1632 `P1` **O item nÃ£o tem atributos** â€” um slot da barra Ã© `{label, block, count}` e mais nada. SÃ³ ferramenta tem `durability`, e mesmo essa Ã© um par de campos soltos no mesmo tipo. NÃ£o hÃ¡ como um bloco ter vida, peso, raridade, encantamento ou qualquer coisa que um mod queira inventar. Ã‰ o mesmo problema do item 1561 nas entidades: um campo novo por necessidade nova, no tipo de todo mundo
- [~] 1633 `P1` **Atributos de item por dado, nÃ£o por campo** â€” um saco de valores nomeados, com o mesmo modelo dos itens 1561 e 1572, para que "vida do item" e "o que mais vier" nÃ£o exijam tocar em `HotbarSlot`
- [ ] 1634 `P2` **Item como entidade de dado prÃ³pria** â€” hoje "item" sÃ³ existe como slot da barra e como cubo caÃ­do. Sem um registro de item separado do bloco, atributo nenhum sobrevive a ser guardado num baÃº
- [ ] 1553 `P2` **As ferramentas de desenvolvedor nÃ£o tÃªm porta** â€” com os atalhos do navegador desabilitados (item 1550), abrir o DevTools precisa de um caminho no jogo: um comando de chat e um item nas configuraÃ§Ãµes

## 93. O chat, unificado

Hoje hÃ¡ dois chats: o do mundo (jogador para jogador) e o da IA (sessÃµes, threads, mods). SÃ£o duas
caixas, dois histÃ³ricos e dois modelos mentais para a mesma coisa â€” escrever alguma coisa e receber
resposta.

- [ ] 1554 `P1` **Um chat sÃ³** â€” o do mundo e o da IA passam a ser o mesmo painel, com o mesmo
  histÃ³rico e a mesma caixa de entrada
- [ ] 1555 `P1` **A IA vira um comando** â€” falar com ela Ã© `/ia <mensagem>` (ou um prefixo), e nÃ£o um
  modo separado. Isso resolve sozinho a ambiguidade de "para onde vai o que eu escrevo", que hoje
  depende de qual aba estÃ¡ aberta
- [ ] 1556 `P1` **Aba de chat no menu**, com as sessÃµes da IA listadas e abrÃ­veis fora do jogo â€” hoje
  as threads sÃ³ existem dentro da partida
- [ ] 1557 `P1` **Mais comandos de chat** â€” o sistema de comandos existe e estÃ¡ subusado. Precisa
  cobrir pelo menos: tempo/clima, teleporte, dar item, modo de jogo, semente, coordenadas, listar
  jogadores, expulsar, oplevel, e ajuda que se lÃª sozinha
- [ ] 1558 `P2` **`/ajuda` que lista o que existe de verdade** â€” derivada do registro de comandos, e
  nÃ£o escrita Ã  mÃ£o; uma lista escrita Ã  mÃ£o diverge na primeira adiÃ§Ã£o

## 94. Entidades de verdade

O `EntitySystem` monta bonecos de caixas e roda um script de comportamento. O pedido Ã© um sistema em
que a entidade seja um objeto de jogo completo.

- [ ] 1559 `P1` **Entidade com cÃ¢mera** â€” poder ver pelo ponto de vista dela, e poder usÃ¡-la como
  cÃ¢mera de cena (para cinemÃ¡tica, para vigilÃ¢ncia, para um retrato de um lugar)
- [ ] 1560 `P1` **Entidade com Ã¡udio** â€” som prÃ³prio, posicional, disparado pelo comportamento dela
  e nÃ£o pelo `main`
- [~] 1561 `P1` **Atributos declarados por dado, nÃ£o por campo** â€” hoje `EntityRecord` tem um campo
  para cada coisa que alguÃ©m precisou. Um saco de atributos nomeados permite a um mod (ou ao jogador)
  acrescentar `sede`, `moral`, `carga` sem tocar no tipo
- [ ] 1562 `P2` **Componentes ligÃ¡veis** â€” cÃ¢mera, Ã¡udio, luz, colisor e comportamento como peÃ§as que
  se somam a uma entidade, em vez de campos opcionais no mesmo registro
- [ ] 1563 `P2` **A entidade aparece no editor de cÃ³digo** com a API dela documentada, como jÃ¡
- [ ] 1563 `P2` **A entidade aparece no editor de código** com a API dela documentada, como já
  acontece com os mods

## 95. O editor de mini-estruturas dentro do jogo

O pedido central desta rodada: um item que **não abre um menu** — abre um **editor no próprio
mundo**, onde se pega mini-blocos e se monta uma estrutura pequena, no estilo de um editor de voxel.
A intenção declarada é liberdade para criar coisas únicas com os blocos que já existem.

**Esclarecimento do dono do projeto (28/07/2026):** A construção na mesa de criação é do tamanho
real de mini-blocos — **bem pequena mesmo**. A mesa de criação serve para **montar** a estrutura
nessa escala reduzida, e o resultado pode ser colocado nos lugares do mundo. Para obter uma versão
maior, existe uma **segunda mesa (mesa de escala)**: o jogador pega o item estilizado na mesa de

### Mesa de criaÃ§Ã£o (montar a estrutura em escala de mini-blocos)

- [ ] 1564 `P1` **Item "mesa de criaÃ§Ã£o"** que entra em modo de ediÃ§Ã£o em vez de abrir tela
- [ ] 1565 `P1` **Volume de ediÃ§Ã£o delimitado** â€” uma caixa visÃ­vel no mundo onde a ediÃ§Ã£o acontece,
  para o editor nÃ£o ser "o mundo inteiro, mas diferente"
- [ ] 1566 `P1` **Ferramentas de voxel**: colocar, apagar, pintar, espelhar, encher, e desfazer
  prÃ³prio do editor (o `UndoManager` do mundo nÃ£o serve â€” sÃ£o escopos diferentes)
- [ ] 1567 `P1` **A estrutura vira um template** reutilizÃ¡vel, como os de `StructureTemplates`, e
  entra na barra como um item que carimba â€” **no tamanho original de mini-blocos**
- [ ] 1568 `P2` **Salvar, nomear e listar** as estruturas criadas, por mundo
- [ ] 1569 `P2` **Compartilhar a estrutura** â€” exportar e importar, no mesmo caminho dos mods
- [ ] 1570 `P3` **Grade e simetria** no editor, que Ã© o que separa um editor de voxel de um modo de
  construir com passos menores

### Mesa de escala (ampliar a estrutura fornecendo blocos)

- [~] 1652 `P1` **Item "mesa de escala"** â€” bloco funcional separado da mesa de criaÃ§Ã£o. O jogador coloca nela um template jÃ¡ montado e escolhe a escala de ampliaÃ§Ã£o desejada â€” `createScaleTableItem()` em `src/world/miniStructureEditor.ts`
- [~] 1653 `P1` **CÃ¡lculo de requisitos de blocos** â€” a mesa calcula quantos e quais blocos sÃ£o necessÃ¡rios para materializar a estrutura na escala escolhida e exibe a lista ao jogador â€” `calculateScaleRequirements()` em `src/world/miniStructureEditor.ts`
- [~] 1654 `P1` **Fila de espera por recursos** â€” a mesa fica em estado "aguardando materiais" atÃ© o jogador depositar todos os blocos exigidos; conforme deposita, a barra de progresso avanÃ§a â€” `MesaDeEscalaQueue` em `src/world/miniStructureEditor.ts`
- [~] 1655 `P1` **MaterializaÃ§Ã£o da estrutura escalada** â€” quando todos os requisitos sÃ£o preenchidos, a mesa produz o item da estrutura na escala ampliada, pronto para ser colocado no mundo â€” `materializeScaledStructure()` em `src/world/miniStructureEditor.ts`
- [ ] 1656 `P1` **ConstruÃ§Ã£o progressiva no mundo por tempo/delay** â€” enquanto itens pequenos sÃ£o colocados instantaneamente, estruturas de escalas maiores possuem delay e vÃ£o sendo construÃ­das aos poucos por cima do terreno
- [ ] 1657 `P1` **MinÃ©rio de Energia e aceleraÃ§Ã£o de construÃ§Ã£o** â€” o delay das estruturas grandes Ã© regido por um minÃ©rio de energia encontrado no mundo, e a velocidade de construÃ§Ã£o pode ser acelerada na mesa de escala usando esse combustÃ­vel
- [ ] 1658 `P1` **SinalizaÃ§Ã£o e preview do espaÃ§o necessÃ¡rio** â€” ao clicar com o botÃ£o direito no item de estrutura, o jogo exibe a marcaÃ§Ã£o visual da Ã¡rea/espaÃ§o total necessÃ¡rio no terreno, indicando onde precisa ser limpo

## 96. O personagem

- [ ] 1571 `P1` **RaÃ§a do personagem** â€” uma escolha na criaÃ§Ã£o que muda aparÃªncia e atributos
- [ ] 1572 `P1` **Atributos do personagem extensÃ­veis por cÃ³digo**, no mesmo modelo do item 1561
- [ ] 1573 `P2` **A criaÃ§Ã£o de personagem reflete a raÃ§a** e mostra o efeito de cada escolha

## 97. Testes automatizados num mundo de testes

Hoje hÃ¡ 1.497 testes de unidade e **nenhum** que abra o jogo. Tudo o que Ã© visual, sonoro ou de
integraÃ§Ã£o entre sistemas Ã© verificado por leitura de cÃ³digo â€” os laÃ§os de fiaÃ§Ã£o â€” e nÃ£o por
execuÃ§Ã£o. Ã‰ a dÃ­vida mais citada neste documento.

- [ ] 1574 `P1` **Mundo de testes determinÃ­stico** â€” semente fixa, relÃ³gio controlÃ¡vel, sem rede
- [ ] 1575 `P1` **Roteiro automatizado** que carrega o mundo, executa uma sequÃªncia de aÃ§Ãµes
  (andar, quebrar, colocar, fabricar, dormir, morrer) e **verifica os logs**
- [ ] 1576 `P1` **Log estruturado** â€” hoje os `console.log` sÃ£o frases soltas; um roteiro sÃ³ pode
  verificar o que tem forma
- [ ] 1577 `P2` **Captura de tela no fim de cada etapa**, para o defeito visual ter alguma chance de
  aparecer sem alguÃ©m olhando
- [ ] 1578 `P2` **Rodar no CI** â€” um teste de integraÃ§Ã£o que ninguÃ©m executa Ã© um teste que nÃ£o
  existe

## 98. A subdivisÃ£o do bloco â€” e por que ela vem por Ãºltimo

O pedido: dividir o mini-bloco atual, para o mundo ficar mais bonito. Hoje `SCALE = 3` â€” trÃªs
mini-voxels por metro, 27 por metro cÃºbico. O pedido leva a `SCALE = 9`: cada mini-voxel de hoje
vira 3Ã—3Ã—3 = 27 menores, e o metro passa a ter 9Ã—9Ã—9 = 729.

**O dono do projeto jÃ¡ disse que sabe que Ã© uma mudanÃ§a fundamental.** O que segue nÃ£o Ã© objeÃ§Ã£o, Ã©
a conta â€” porque ela decide a ordem em que as coisas tÃªm de ser feitas.

### Primeiro a conta ingÃªnua, que Ã© a que assusta

Guardando o mundo como hoje â€” um `Uint8Array` plano por chunk:

| | hoje | `SCALE = 9` plano |
|---|---|---|
| bytes por chunk | 262.144 (256 KB) | 7.077.888 (6,75 MB) |
| memÃ³ria de blocos (raio 9) | ~90 MB | **~2,4 GB** |
| gerar um chunk | 40 ms | ~1,1 s |

2,4 GB de `Uint8Array` nÃ£o Ã© alocÃ¡vel numa aba. **Mas essa nÃ£o Ã© a conta que importa**, e o dono do
projeto apontou isso: a compressÃ£o existe justamente para nÃ£o ter de escolher entre resoluÃ§Ã£o e
memÃ³ria.

### A conta com compressÃ£o, medida

Medi um chunk real, recortado em seÃ§Ãµes e cada seÃ§Ã£o paletizada com bits empacotados
(`ceil(log2(paleta))` bits por voxel, seÃ§Ã£o de valor Ãºnico guardando **um** valor):

| aresta da seÃ§Ã£o | tamanho no mundo | seÃ§Ãµes mistas | bytes/chunk |
|---|---|---|---|
| 2Â³ | 0,67 m | 7,1% | 263 KB |
| 4Â³ | 1,33 m | 18,8% | 41 KB |
| **8Â³** | **2,67 m** | **41,1%** | **23 KB** |
| 16Â³ | 5,33 m | 57,3% | 37 KB |
| 32Â³ | 10,67 m | 62,5% | 54 KB |

**256 KB viram 23 KB â€” onze vezes menos, sem perder um voxel.** A paleta mediana de uma seÃ§Ã£o Ã©
**2**: quase todo pedaÃ§o do mundo Ã© ar-e-mais-uma-coisa, e guardar isso em 8 bits por voxel Ã©
desperdiÃ§ar sete deles.

### Por que isso melhora quando o bloco fica menor, em vez de piorar

Ã‰ a parte contraintuitiva, e Ã© o que faz o pedido caber. As seÃ§Ãµes mistas sÃ£o as que uma **fronteira
de material atravessa**, e fronteira Ã© superfÃ­cie â€” coisa de duas dimensÃµes. Ao refinar 3Ã—, o nÃºmero
de seÃ§Ãµes cresce 27Ã— e o nÃºmero de seÃ§Ãµes atravessadas cresce sÃ³ 9Ã—. A **fraÃ§Ã£o** de seÃ§Ãµes mistas
cai por 3.

A tabela acima mostra isso medido: a fraÃ§Ã£o de mistas acompanha o tamanho fÃ­sico da seÃ§Ã£o, nÃ£o a
contagem de voxels. Uma seÃ§Ã£o de 16Â³ em `SCALE = 9` cobre 1,78 m â€” entre as linhas de 1,33 m e
2,67 m â€”, entÃ£o cai na faixa de 20 a 30% de mistas, e nÃ£o nos 57% de hoje.

ProjeÃ§Ã£o, a partir dessa mediÃ§Ã£o:

| | hoje (plano) | `SCALE = 9` paletizado |
|---|---|---|
| bytes por chunk | 256 KB | **~330 a 490 KB** |
| memÃ³ria de blocos (raio 9) | ~90 MB | **~120 a 180 MB** |

Ou seja: **o mundo com o bloco nove vezes menor custa menos que o dobro do que o mundo de hoje
custa**, e o que sobra Ã© uma diferenÃ§a de mesma ordem â€” nÃ£o de vinte e sete vezes. A conta ingÃªnua
errava por um fator de quinze.

O que **nÃ£o** melhora sozinho Ã© o tempo de geraÃ§Ã£o: 729 amostras de ruÃ­do por metro continuam sendo
729. Ã‰ por isso que o item 1582 (gerar grosso e refinar) nÃ£o Ã© opcional â€” ele Ã© o par do
compressor, e sem ele o custo migra de memÃ³ria para relÃ³gio.

### A ordem, agora que a conta Ã© outra

Os dois primeiros deixaram de ser "prÃ©-requisito de uma mudanÃ§a futura" e viraram `P0` por mÃ©rito
prÃ³prio: eles pagam onze vezes o que custam **hoje**, com `SCALE = 3`, e Ã© essa economia que abre
espaÃ§o para o resto.

- [~] 1579 `P0` **`paleta.ts`: estrutura pronta e medida** â€” falta trocar o `Uint8Array` do `Chunk` por ela (item 1635). Era: (item 033) â€” **medido: 256 KB â†’ 23 KB
  por chunk, onze vezes menos, sem perder um voxel.** A paleta mediana de uma seÃ§Ã£o de 8Â³ Ã© **2**:
  quase todo pedaÃ§o do mundo Ã© ar-e-mais-uma-coisa, e guardar isso em 8 bits desperdiÃ§a sete deles
- [~] 1580 `P0` **SeÃ§Ã£o de valor Ãºnico guarda um valor** â€” 42,9% medidos num chunk real. Era: â€” 42,7% das seÃ§Ãµes de 8Â³ jÃ¡ sÃ£o homogÃªneas
  no mundo de hoje, e a fraÃ§Ã£o **sobe** quando o bloco fica menor, porque fronteira Ã© superfÃ­cie
- [ ] 1581 `P1` **CompressÃ£o no save** (item 034) â€” o disco herda a mesma estrutura de graÃ§a
- [ ] 1582 `P1` **Gerar grosso e refinar** â€” Ã© o par do compressor e nÃ£o Ã© opcional: 729 amostras de
  ruÃ­do por metro continuam sendo 729, e sem isto o custo migra de memÃ³ria para relÃ³gio (~1,1 s por
  chunk). Gerar em `SCALE = 3` e subdividir sÃ³ onde hÃ¡ fronteira
- [ ] 1583 `P1` **LOD de malha** (item 031) â€” a contagem de faces cresce junto, e sem LOD o custo
  migra da CPU para a GPU sem melhorar nada
- [ ] 1584 `P1` **`SCALE = 9` de fato**, depois dos quatro acima â€” com a assinatura de mundo
  atualizada deliberadamente, porque o terreno **vai** mudar
- [ ] 1585 `P2` **Revisar o que assume `SCALE = 3`** â€” o Modo Detalhe, os templates de estrutura, o
  editor novo (item 1564) e o alcance de construÃ§Ã£o
- [ ] 1586 `P2` **Revisar `MAX_CELULAS_DA_CAIXA`** â€” 250 mil cÃ©lulas viram um cubo de 6 metros num
  mundo de `SCALE = 9`, e o limite deixa de proteger o que protegia

### Uma dÃºvida do pedido, registrada em vez de adivinhada

**Confirmado pelo dono do projeto:** o bloco de um metro passa a ser 9Ã—9Ã—9 de mini-blocos, em vez
do 3Ã—3Ã—3 de hoje. Ou seja `SCALE: 3 â†’ 9`, com cada mini-voxel atual virando 3Ã—3Ã—3 = 27 menores. O
"21" do pedido era imprecisÃ£o de escrita; a intenÃ§Ã£o Ã© a que estÃ¡ aqui.

## 99. O que fica dito sobre o resto

- [~] 057 `P1` **Nuvens aparecem e somem conforme o tempo (densidade variÃ¡vel)** â€” `VolumetricClouds` em `src/world/volumetricClouds.ts`
- [~] 197 `P1` **Nuvens com variaÃ§Ã£o vertical e volume 3D** â€” instanced mesh de voxels 3D
- [~] 198 `P1` **Nuvens alÃ©m do horizonte de render** â€” camada de posicionamento celeste independente
- [~] 199 `P1` **Nuvens sÃ£o parte do tempo e nÃ£o um efeito** â€” a densidade Ã© derivada do clima
- [~] 1621 `P1` **Nuvens aparecem e somem conforme o tempo (densidade variÃ¡vel)** â€” `VolumetricClouds` em `src/world/volumetricClouds.ts`
- [~] 1622 `P1` **Nuvens com variaÃ§Ã£o vertical e volume 3D** â€” instanced mesh de voxels 3D
- [~] 1623 `P1` **Nuvens alÃ©m do horizonte de render** â€” camada de posicionamento celeste independente

O pedido termina com "falta criar muitas coisas". Isso Ã© verdade e o documento jÃ¡ registra 672
itens pendentes. O que esta rodada acrescenta nÃ£o Ã© uma lista nova ao lado da antiga: os itens
acima **se ligam** aos que jÃ¡ existiam â€” 033, 034, 031 ganharam motivo; 1192 (aba de sistema) ganhou
a lista de jogadores como vizinha; 1466 e 1472 (nada visual Ã© conferido) ganharam a resposta que
faltava, que Ã© a seÃ§Ã£o 97.

## 100. Os dois P0 da rodada, fechados

### 1550 â€” o navegador Ã© dono da aba, e isso tem limite

Ctrl+S abria "salvar pÃ¡gina" por cima do mundo, F5 recarregava e perdia a partida, Ctrl+D
favoritava. Nenhum avisava e nenhum era recuperÃ¡vel. SÃ³ o Tab estava tratado, e por acidente â€”
porque tirava o foco do canvas.

Duas decisÃµes:

**SÃ³ com o ponteiro travado.** Fora do jogo â€” num menu, digitando no chat â€” Ctrl+F *deve* procurar e
Ctrl+C *deve* copiar. Bloquear sempre transformaria a pÃ¡gina num lugar onde os reflexos de todo
mundo param de funcionar, o que Ã© pior que o problema.

**O que nÃ£o dÃ¡ para impedir estÃ¡ listado, nÃ£o escondido.** Ctrl+W, Ctrl+T, Alt+Tab sÃ£o do navegador
e nenhuma pÃ¡gina os intercepta â€” e Ã© bom que seja assim. `FORA_DO_ALCANCE` existe como dado para a
tela de configuraÃ§Ãµes poder dizer quais sÃ£o; fingir que o problema nÃ£o existe seria pior.

E o F12 fica livre de propÃ³sito: com o resto tomado, tirÃ¡-lo tambÃ©m deixaria o desenvolvedor sem
caminho nenhum.

### 1551 â€” trinta e sete mil blocos antes do primeiro clique

A barra comeÃ§ava com 6.000 de terra, 9.000 de pedregulho, 6.000 de tÃ¡buas, 6.000 de tijolo, 2.400 de
tronco, 3.000 de areia, 3.000 de pedra e 2.400 de folhas.

Com isso **nada do jogo tinha funÃ§Ã£o**. Minerar nÃ£o dÃ¡ o que jÃ¡ se tem. Fabricar tÃ¡bua a partir de
tronco Ã© absurdo quando hÃ¡ seis mil tÃ¡buas. O baÃº do item 137 guarda o quÃª. Os objetivos de "quebre
um tronco" nasciam metade cumpridos. Cada sistema desta sessÃ£o â€” progressÃ£o, penalidade de morte,
armazenamento, ferramentas com tier â€” pressupÃµe escassez, e a escassez era desmentida na primeira
tela.

A barra cheia era o **Criativo vazando para dentro do SobrevivÃªncia**, e nÃ£o uma decisÃ£o sobre
nenhum dos dois. Quem quer todos os blocos abre o inventÃ¡rio criativo, que Ã© onde eles moram.

- [~] 1587 `P0` **`atalhosDoNavegador.ts`**, com o que dÃ¡ e o que nÃ£o dÃ¡ para impedir separados
- [~] 1588 `P0` **Barra vazia**, com os slots na mesma forma que `guardarNaHotbar` sabe preencher
- [~] 1589 `P1` **Slot vazio nÃ£o mostra "0"** â€” oito zeros lÃªem como defeito, nÃ£o como espaÃ§o livre
- [~] 1590 `P1` **15 testes**, incluindo o que garante que Ctrl+C nunca Ã© tomado

### Lacunas anotadas nesta rodada

- [ ] 1591 `P1` **`beforeunload` para o que nÃ£o dÃ¡ para impedir** â€” Ctrl+W e Alt+F4 continuam fechando a partida sem confirmaÃ§Ã£o, e o "tem certeza?" nativo Ã© o mÃ¡ximo que a plataforma oferece
- [ ] 1592 `P2` **A tela de configuraÃ§Ãµes nÃ£o lista os atalhos** â€” `listarRoubadas` e `FORA_DO_ALCANCE` existem e nenhuma tela os mostra ainda (parte do item 1553)
- [ ] 1593 `P1` **O jogador comeÃ§a sem ferramenta nenhuma** â€” com a barra vazia, o primeiro tronco tem de ser quebrado com a mÃ£o, e Ã© preciso conferir se `velocidadeDeQuebra` deixa isso viÃ¡vel ou se o comeÃ§o virou um muro

---

# PARTE VIII â€” Mundo, ferramentas e distÃ¢ncia (28/07/2026)

## 101. Os biomas eram todos minÃºsculos â€” medido

Antes de mexer, varri quatro quilÃ´metros em seis linhas e medi o comprimento de cada trecho contÃ­guo
do mesmo bioma:

| | trechos | mediana | mÃ©dia | maior |
|---|---|---|---|---|
| biomas de clima | 206 | 32 m | 58 m | 364 m |
| biomas de relevo (praia, oceano, montanha) | 381 | 16 m | 31 m | 352 m |

**Um bioma de trinta e dois metros nÃ£o Ã© um bioma â€” Ã© uma mancha.** O jogador atravessa seis num
minuto, e nenhum tem tempo de significar nada: nÃ£o dÃ¡ para "estar no deserto" quando o deserto acaba
em vinte passos.

### A causa nÃ£o era a frequÃªncia do ruÃ­do

O ruÃ­do de clima jÃ¡ era de 700 metros. Dois outros campos Ã© que mandavam nele:

1. **A temperatura era modulada pela ALTURA** â€” `temp -= max(0, h - 26) * 0.03`, com o mar em 46
   metros. **Toda** a terra firme estava acima do limiar, entÃ£o o termo valia sempre e carregava
   junto todo o ruÃ­do de relevo: colinas de 50 m e cordilheiras com 17 m de amplitude. Meio ponto de
   temperatura oscilando na escala do terreno.
2. **A umidade levava `+ river * 0.3`** â€” e rio Ã© estreito. Cada travessia produzia uma faixa de
   bioma diferente com a largura da margem, e o resultado era uma fita de pÃ¢ntano acompanhando cada
   rio do mundo.

- [~] 1594 `P1` **`escalaDeBioma.ts` com trÃªs escalas** â€” continental (2,9 km), regional (625 m) e
  local (133 m), com pesos 1 / 0,34 / 0,11: o continental manda, o resto tempera
- [~] 1595 `P1` **A altitude sÃ³ esfria a partir de 58 m**, e com um terÃ§o da forÃ§a â€” a montanha
  continua fria e a colina de dois metros deixa de decidir o bioma
- [~] 1596 `P1` **A margem de rio umedece 0,12 em vez de 0,3** â€” mais Ãºmida sim, outro bioma nÃ£o

### O resultado, tambÃ©m medido â€” e Ã© honesto dizer que Ã© parcial

| | antes | depois |
|---|---|---|
| mÃ©dia do trecho de clima | 58 m | **68 m** |
| maior trecho | 364 m | **476 m** |
| mediana | 32 m | 32 m |

A mÃ©dia subiu 17% e o maior subiu 31%, mas **a mediana nÃ£o se moveu**, e sei por quÃª: a
classificaÃ§Ã£o continua sendo um limiar sobre um campo contÃ­nuo. Por mais liso que o campo fique,
todo campo passeia em volta de um limiar de vez em quando, e cada passeio produz um trecho curto. Um
campo mais suave alonga os trechos longos e nÃ£o elimina os curtos.

- [ ] 1597 `P1` **RegiÃµes celulares em vez de limiar** â€” o que de fato resolve a mediana. Centros de
  regiÃ£o semeados com espaÃ§amento **declarado**, cada um sorteando um clima, e cada ponto tomando o
  bioma do centro mais prÃ³ximo com a fronteira perturbada por ruÃ­do. O tamanho do bioma passa a ser
  um parÃ¢metro, e nÃ£o uma consequÃªncia acidental de onde os limiares caÃ­ram
- [ ] 1598 `P1` **EspaÃ§amento variÃ¡vel por tipo** â€” Ã© isto que atende "biomas enormes E pequenos" de
  propÃ³sito, em vez de por acaso: oceano e deserto com centros a quilÃ´metros, bosque e oÃ¡sis com
  centros a dezenas de metros
- [ ] 1599 `P2` **A costa Ã© fractal demais** â€” 381 trechos de relevo contra 206 de clima, com
  mediana de 16 m. As colinas de alta frequÃªncia atravessam o nÃ­vel do mar repetidas vezes e cada
  travessia vira uma praia. Suavizar a altura **perto do nÃ­vel do mar** resolveria os dois

## 102. Ã�rvores

Hoje hÃ¡ duas formas, escritas Ã  mÃ£o, sem nenhuma variaÃ§Ã£o alÃ©m de altura e raio: o carvalho Ã© um
tronco 2Ã—2 com uma copa elipsoide, e o pinheiro Ã© um tronco de um voxel com camadas de losango. NÃ£o
hÃ¡ galho, nÃ£o hÃ¡ inclinaÃ§Ã£o, nÃ£o hÃ¡ assimetria â€” e a floresta inteira Ã© feita de dois carimbos.

- [ ] 1600 `P1` **Ã�rvore paramÃ©trica** â€” tronco, galhos e copa saindo de parÃ¢metros (altura,
  inclinaÃ§Ã£o, nÃºmero de galhos, Ã¢ngulo, densidade da copa, irregularidade) em vez de dois blocos de
  cÃ³digo
- [ ] 1601 `P1` **Galhos de verdade** â€” Ã© o que separa "Ã¡rvore" de "poste com uma bola em cima", e
  Ã© a diferenÃ§a mais visÃ­vel de todas a curta distÃ¢ncia
- [ ] 1602 `P1` **Perfil por espÃ©cie**, declarado como dado â€” carvalho, pinheiro, palmeira, morta,
  velha â€” para um bioma novo (ou um mod) ganhar Ã¡rvore prÃ³pria sem tocar no gerador
- [ ] 1603 `P2` **Tronco que se estreita** e raÃ­zes na base
- [ ] 1604 `P2` **Ã�rvores caÃ­das e tocos** â€” o que faz uma floresta parecer ter histÃ³ria em vez de
  ter sido plantada
- [ ] 1605 `P2` **Idade** â€” a mesma espÃ©cie em trÃªs tamanhos, para o bosque nÃ£o parecer um pomar
- [ ] 1606 `P3` **A copa responde Ã  luz** â€” mais larga onde hÃ¡ espaÃ§o, mais estreita no meio da mata

## 103. Cavernas

O campo atual Ã© bom no que faz â€” dois `ridged` em interseÃ§Ã£o dÃ£o tÃºneis que se cruzam, e um `fbm`
abre cÃ¢maras. Mas Ã© **uma coisa sÃ³** repetida por todo o subsolo: nÃ£o hÃ¡ tipo de caverna, nÃ£o hÃ¡
acidente, nÃ£o hÃ¡ razÃ£o para uma caverna ser diferente da outra.

- [ ] 1607 `P1` **Fendas verticais** â€” o corte estreito e profundo que muda a leitura de um subsolo
  inteiro, e que hoje nÃ£o existe em nenhuma forma
- [ ] 1608 `P1` **Cavernas grandes com identidade** â€” salÃ£o, galeria, poÃ§o â€”, e nÃ£o sÃ³ "mais vazio"
- [ ] 1609 `P1` **Lagos e rios subterrÃ¢neos**, aproveitando os fluidos finitos que jÃ¡ existem
- [ ] 1610 `P2` **Entradas visÃ­veis da superfÃ­cie** â€” hoje achar uma caverna Ã© cavar atÃ© encontrar;
  uma boca na encosta Ã© o que transforma explorar numa decisÃ£o
- [ ] 1611 `P2` **FormaÃ§Ãµes** â€” estalactite, coluna, pedra solta no chÃ£o
- [ ] 1612 `P2` **A caverna respeita a camada** â€” o abismo devia ter cavernas diferentes das do
  subsolo, e hoje `camadas.ts` sÃ³ muda nÃ©voa, luz, som e minÃ©rio

## 104. Ferramentas de construÃ§Ã£o â€” inspiraÃ§Ã£o declarada: Lay of the Land

Pesquisado a pedido. O que aquele jogo faz e que aqui nÃ£o existe:

- **Escultura de terreno** â€” levantar e baixar o chÃ£o com uma ferramenta, desenhar caminhos direto
  sobre o solo, em vez de colocar e quebrar bloco a bloco
- **Formas procedurais, nÃ£o presas Ã  grade** â€” cilindro, cone, telhado inclinado, estruturas
  orgÃ¢nicas. Aqui tudo Ã© caixa, e o item 044 acabou de provar que atÃ© a caixa era trÃªs cÃ³pias
- **Redimensionar uma estrutura pronta**
- **Modo planta (blueprint)** â€” salvar uma forma e reusÃ¡-la, que Ã© vizinho do editor do item 1564
- **FÃ­sica real** â€” estruturas desabam sob carga. Existe `structural` na paleta e um colapso; falta
  ser o mesmo sistema que as ferramentas de construÃ§Ã£o

- [ ] 1613 `P1` **Pincel de terreno** â€” levantar, baixar, alisar e nivelar, com raio ajustÃ¡vel
- [ ] 1614 `P1` **Ferramenta de caminho** â€” desenhar sobre o chÃ£o e o terreno se acomoda
- [ ] 1615 `P1` **Formas: cilindro, cone, esfera, cunha**, com o mesmo percurso do `caixa.ts` â€” a
  geometria num lugar sÃ³, como o item 044 jÃ¡ estabeleceu
- [ ] 1616 `P1` **Telhado inclinado** como forma de primeira classe
- [ ] 1617 `P2` **Redimensionar e mover uma seleÃ§Ã£o**
- [ ] 1618 `P2` **Modo planta**, com o mesmo formato dos templates de estrutura (item 1567)
- [ ] 1619 `P2` **PrÃ©-visualizaÃ§Ã£o fantasma** antes de confirmar â€” hoje `fill_box` da IA jÃ¡ escreve
  direto, e um erro de dÃ­gito Ã© um `Ctrl+Z` de milhares de blocos
- [ ] 1620 `P3` **Simetria e espelho**, que Ã© o que multiplica o trabalho de quem constrÃ³i

## 105. As nuvens

TrÃªs defeitos, todos do mesmo lugar: elas sÃ£o um efeito de clima, e nÃ£o parte do cÃ©u.

- [ ] 1621 `P1` **Aparecem e somem com a chuva** â€” a cobertura Ã© derivada de `clima.luz`, entÃ£o o
  cÃ©u limpa e enche conforme o tempo muda, em vez de as nuvens **serem** o tempo. Nuvem devia
  existir sempre, com densidade variÃ¡vel, e a chuva ser consequÃªncia dela
- [~] 1622 `P1` **Nuvens com variação vertical e volume 3D** — instanced mesh de voxels 3D
- [~] 1664 `P1` **A aba "CatÃ¡logo Criativo" reconstruir ao trocar de modo** â€” Corrigido: `rebuildTabs()` em `InventoryModal.ts` chamado a cada `open()`.
- [~] 1665 `P1` **Escala dos mobs documentada como regra de projeto** â€” Registrado em `docs/ARCHITECTURE.md` a regra de `ESCALA_MODELO`.
- [~] 1666 `P1` **Chat/comandos visÃ­vel como atalho no Pause Menu** â€” Adicionado atalho 'Chat / IA [T]' ao array `atalhosRapidos` em `main.ts`.
- [~] 1667 `P0` **InventÃ¡rio no sobrevivÃªncia com layout adaptado** â€” Implementado: aba "Meu Estoque" exibindo todos os slots, quantidades e durabilidade no `InventoryModal.ts`.
- [ ] 1668 `P1` Grade de inventÃ¡rio pessoal (mochila) â€” Em sobrevivÃªncia, o jogador deveria ver uma grade com todos os itens que coletou, arrastar itens para a hotbar, e ver a contagem de cada bloco/item. A hotbar atual de 9 slots Ã© o que ele tem equipado, mas falta o estoque maior por trÃ¡s.
- [ ] 1669 `P1` Indicadores visuais de sobrevivÃªncia no inventÃ¡rio â€” Ao abrir o inventÃ¡rio no modo sobrevivÃªncia, mostrar: armadura equipada, ferramenta em uso com durabilidade restante, e barras de vida/fome como referÃªncia rÃ¡pida.§Ã£o
- [ ] 1627 `P1` **O LOD vem da seÃ§Ã£o paletizada** â€” a paleta de uma seÃ§Ã£o jÃ¡ Ã© a resposta de "qual a
  cor mÃ©dia disto", e calculÃ¡-la de novo seria refazer o que o item 1579 vai produzir
- [ ] 1628 `P1` **TransiÃ§Ã£o sem estalo** â€” trocar de nÃ­vel na frente do jogador Ã© o defeito clÃ¡ssico
  desses sistemas; a nÃ©voa que jÃ¡ existe Ã© o lugar certo para esconder a troca
- [ ] 1629 `P2` **Alcance de render muito maior** â€” o LOD existe para isso; sem aumentar o alcance
  depois de tÃª-lo, o trabalho nÃ£o aparece para o jogador
- [ ] 1630 `P2` **Desfoque por distÃ¢ncia** â€” o que os mods chamam de *distance blur*; barato como
  passe de fragmento e Ã© o que vende a profundidade
- [ ] 1631 `P2` **OrÃ§amento de LOD separado do de malha** â€” o `OrcamentoDeQuadro` de hoje Ã© um sÃ³, e
  um chunk distante barato competindo com um chunk perto caro faz o perto chegar tarde

### Uma observaÃ§Ã£o sobre o vÃ­deo

NÃ£o consigo assistir vÃ­deo, e baixÃ¡-lo nÃ£o mudaria isso. Consegui o tÃ­tulo â€” *Lay of the Land -
Official Gameplay Trailer* â€” e pesquisei o jogo em texto; o que estÃ¡ registrado na seÃ§Ã£o 104 vem
dessa pesquisa, nÃ£o do vÃ­deo. Se houver algo especÃ­fico ali que nÃ£o apareÃ§a na descriÃ§Ã£o do jogo,
duas frases descrevendo valem mais do que qualquer coisa que eu consiga extrair sozinho.

## 107. A paletizaÃ§Ã£o, medida e construÃ­da â€” itens 1579 e 1580

ConstruÃ­ a estrutura antes de trocar o `Chunk`, e a ordem Ã© deliberada: Ã© uma mudanÃ§a que atravessa
o gerador, o mesher, o save e a rede, e fazer tudo de uma vez daria um defeito impossÃ­vel de
localizar. O mÃ³dulo estÃ¡ pronto, medido e testado; a troca Ã© o item 1635.

### O que a mediÃ§Ã£o diz

| aresta | no mundo | seÃ§Ãµes mistas | bytes/chunk |
|---|---|---|---|
| 4Â³ | 1,33 m | 18,8% | 41 KB |
| **8Â³** | **2,67 m** | **41,1%** | **23 KB** |
| 16Â³ | 5,33 m | 57,3% | 37 KB |
| 32Â³ | 10,67 m | 62,5% | 54 KB |

**A curva tem um mÃ­nimo, e ele nÃ£o estÃ¡ na ponta.** SeÃ§Ãµes grandes desperdiÃ§am porque quase todas
ficam mistas; seÃ§Ãµes pequenas desperdiÃ§am porque o cabeÃ§alho passa a pesar mais que os voxels. Oito
Ã© onde as duas se cruzam **neste** mundo â€” 16Â³ Ã© o nÃºmero de costume em outros jogos e aqui custa
60% mais. Por isso a aresta estÃ¡ medida, e nÃ£o herdada por analogia.

### Onde este tipo de cÃ³digo erra

A maior parte dos testes Ã© sobre o empacotamento de bits, e por um motivo concreto: um Ã­ndice pode
cruzar a fronteira de dois bytes. A implementaÃ§Ã£o ingÃªnua â€” que lÃª um byte sÃ³ â€” funciona para 1, 2,
4 e 8 bits e **falha para 3, 5, 6 e 7**. Ou seja, passa em qualquer teste com paleta pequena e
quebra no mundo real, com o chunk saindo embaralhado em vez de vazio, que Ã© muito pior de
diagnosticar.

HÃ¡ um teste por largura de paleta, incluindo as quatro que quebram, e uma ida e volta sobre um chunk
gerado de verdade â€” porque "sem perder um voxel" Ã© a promessa inteira, e uma compressÃ£o que erra
0,01% dos blocos Ã© pior que nenhuma.

### Uma decisÃ£o que o teste trava

`escreverSecao` **devolve** a seÃ§Ã£o em vez de mutÃ¡-la, porque quando a paleta cresce alÃ©m do que os
bits comportam tudo precisa ser reempacotado â€” e a seÃ§Ã£o passa a ser outro objeto. Um `void` aqui
produziria escritas que somem, e sÃ³ nas seÃ§Ãµes que por acaso ganharam um bloco novo.

E escrever o mesmo valor numa seÃ§Ã£o homogÃªnea **nÃ£o a acorda**. Sem isso, um `setBlock` que nÃ£o muda
nada a converteria para o formato caro, e o mundo iria perdendo a compressÃ£o sozinho sem nenhum
bloco ter mudado de fato.

- [~] 1635 `P0` **`paleta.ts`** com seÃ§Ã£o homogÃªnea, bits empacotados, crescimento de paleta e valor
  dominante
- [~] 1636 `P0` **24 testes**, incluindo as quatro larguras de bit que cruzam byte e a ida e volta
  num chunk real
- [~] 1637 `P1` **`valorDominante`** â€” a cor de longe do LOD (item 1627), de graÃ§a numa seÃ§Ã£o
  homogÃªnea

### O que falta para o ganho chegar ao jogo

- [~] 1638 `P0` **Trocar o `Uint8Array` do `Chunk` pela estrutura** â€” Ã© onde os 11Ã— viram memÃ³ria de
  verdade. Atravessa `chunk.ts`, `worldgen.ts` (que escreve por Ã­ndice plano), `mesher.ts` (que lÃª
  por Ã­ndice plano no `padded`), o save e o `full_sync`
- [ ] 1639 `P1` **O `padded` do mesher continua plano** â€” ele monta um bloco com borda de 1 voxel, e
  Ã© a estrutura que o Worker recebe. PaletizÃ¡-lo tambÃ©m Ã© o que reduz o trÃ¡fego entre threads
- [ ] 1640 `P1` **Medir de novo depois de trocar** â€” 23 KB Ã© o custo da estrutura, nÃ£o o do jogo; o
  nÃºmero que importa Ã© a memÃ³ria do processo com o raio carregado

## 108. Os caminhos em bloco â€” o que torna a paletizaÃ§Ã£o usÃ¡vel

A estrutura da seÃ§Ã£o 107 estava certa e era **lenta demais para o caminho por onde todo chunk
passa**. Medi antes de seguir, e o nÃºmero condenava a API:

| | antes | com caminho em bloco |
|---|---|---|
| empacotar | 43,3 ms/chunk | **1,92 ms** |
| desempacotar | â€” | **0,91 ms** |

Quarenta e trÃªs milissegundos Ã© tÃ£o caro quanto **gerar o chunk inteiro**. A causa era a API:
`empacotarSecao` recebe uma funÃ§Ã£o e a chama **duas vezes por voxel** â€” uma para montar a paleta,
outra para escrever â€”, com um `Map` no meio. Boa para testar e para fontes exÃ³ticas; pÃ©ssima para o
caminho quente.

`empacotarDePlano` lÃª direto do `Uint8Array` que o gerador jÃ¡ produz, com a paleta num array de 256
posiÃ§Ãµes indexado pelo prÃ³prio valor do bloco. Cada voxel Ã© lido uma vez. Vinte e duas vezes mais
rÃ¡pido.

**Desempacotar sai mais barato que empacotar**, e isso nÃ£o Ã© acidente: uma seÃ§Ã£o homogÃªnea vira
`fill` de oito bytes por linha, sem tocar em bit nenhum â€” e Ã© o caso da maioria do mundo.

### Medido em escala

Com 121 chunks carregados: **30,3 MB â†’ 3,0 MB, 10,1Ã— menos.** Ã‰ o ganho do item 1579 em memÃ³ria de
verdade, e nÃ£o em bytes de estrutura.

- [~] 1641 `P0` **`empacotarDePlano` e `escreverPlanoEm`** â€” 22Ã— e a ida e volta byte a byte
- [~] 1642 `P0` **Teste que cruza o caminho rÃ¡pido com o de referÃªncia** â€” duas implementaÃ§Ãµes da
  mesma coisa Ã© como uma delas diverge em silÃªncio
- [~] 1643 `P1` **28 testes** no arquivo da paleta

### O achado que nÃ£o estava no plano

- [ ] 1644 `P1` **`padChunkInto` custa 16,66 ms por re-mesh** â€” medido, e ninguÃ©m sabia. Ele monta o
  bloco de 34Ã—258Ã—34 lendo nove vizinhos, roda na thread principal, e o orÃ§amento de malha permite
  vÃ¡rios por quadro. Ã‰ provavelmente o maior engasgo de quadro que resta, e Ã© anterior Ã 
  paletizaÃ§Ã£o â€” nÃ£o foi ela que o criou
- [ ] 1645 `P1` **Desempacotar direto no `padded` pode ser mais RÃ�PIDO que hoje** â€” 0,91 ms por
  chunk contra 16,66 ms do pad atual. Escrever o miolo com `escreverPlanoEm` e buscar sÃ³ os planos
  de borda dos vizinhos deve sair na frente, o que faria a paletizaÃ§Ã£o **pagar** em quadro alÃ©m de
  pagar em memÃ³ria
- [ ] 1646 `P2` **`empacotarSecao` sobrevive sÃ³ para teste** â€” se algum caminho de produÃ§Ã£o voltar a
  usÃ¡-la, o custo volta com ela

---

## 109. Ajustes da Chuva e MecÃ¢nica de Morte no VÃ£o (AnotaÃ§Ãµes do Jogador/Dono)

AnotaÃ§Ãµes das correÃ§Ãµes visuais e comportamentais do clima (chuva) e regras do abismo/vÃ£o inferior.

- [~] 1647 `P1` **VariaÃ§Ã£o na altura/tamanho vertical da chuva** â€” variaÃ§Ã£o de velocidades e alturas em `src/render/precipitation.ts`
- [~] 1648 `P1` **Aumento substancial da altura vertical da chuva** â€” cobertura `ALTURA = 55` e `RAIO = 32` em `src/render/precipitation.ts`
- [~] 1649 `P1` **RestriÃ§Ã£o da chuva abaixo das nuvens** â€” corte `maxCloudY = 144` em `src/render/precipitation.ts`
- [~] 1650 `P0` **RevisÃ£o e implementaÃ§Ã£o completa do sistema de chuva** â€” atualizaÃ§Ã£o completa da classe `Precipitation` em `src/render/precipitation.ts`
- [~] 1651 `P0` **Morte ao cair no vÃ£o inferior (void/abismo)** â€” dano de abismo e callback `onVoidFall` em `PlayerController` e `SurvivalSystem`

---

## 110. PadrÃµes de Quebra por Ferramenta e Preview de MineraÃ§Ã£o (AnotaÃ§Ãµes do Jogador/Dono)

AnotaÃ§Ãµes sobre mineraÃ§Ã£o em Ã¡rea por ferramenta e indicador translÃºcido no alvo.

- [ ] 1659 `P1` **Modos de quebra em grupo por ferramenta** â€” As picaretas e ferramentas possuem tipos/padrÃµes de quebra que destroem um grupo de blocos (quadrado 3x3, cÃ­rculo, etc.), definidos conforme o tier/tipo da ferramenta.
- [ ] 1660 `P1` **Preview translÃºcido de mineraÃ§Ã£o** â€” Exibir uma marcaÃ§Ã£o/sobreposiÃ§Ã£o translÃºcida na Ã¡rea de foco para sinalizar exatamente quais blocos serÃ£o quebrados pela ferramenta antes do impacto.

---

## 111. Bugs de Playtesting â€” Relato do Jogador/Dono (28/07/2026)

*Relato direto do jogador jogando ao vivo. TrÃªs defeitos que nenhum teste pegou porque
envolvem a integraÃ§Ã£o entre subsistemas visuais e regras de modo de jogo.*

**ReferÃªncia de escala do personagem** (para consulta futura):
- Jogador: `PLAYER_HEIGHT = 1.8m` em metros, `ALTURA_MUNDO = 5.3` em unidades de mundo (mini-voxels)
- `ESCALA_MODELO = ALTURA_MUNDO / PLAYER_HEIGHT â‰ˆ 2.94` â€” Ã© o fator que converte metros â†’ mundo
- Mobs e NPCs devem usar a mesma escala para ficarem proporcionais ao jogador e aos blocos
- A anatomia do mob Ã© construÃ­da em metros (~1.7m de altura) e precisa de `ESCALA_MODELO` aplicado no `group.scale`

- [~] 1661 `P0` **Inventário não abre no modo sobrevivência** — `gateOpen` bloqueava o inventário inteiro quando `hasCreativeInventory` era `false`. Corrigido: a aba "Catálogo Criativo" é oculta em vez de bloquear todo o modal; crafting e hotbar continuam acessíveis. Arquivo: `src/ui/InventoryModal.ts`
- [~] 1662 `P0` **Mobs muito pequenos (~1/3 do jogador)** — A anatomia do mob era construída na mesma régua de metros do PlayerModel, mas sem aplicar `ESCALA_MODELO`. O jogador via criaturas de ~1.7 unidades contra um personagem de 5.3. Corrigido: `group.scale.setScalar(ESCALA_MODELO)` em `spawnEntity()`. Arquivo: `src/entities/EntitySystem.ts`
- [~] 1663 `P0` **Chat de IA e comandos só funciona no modo criativo** — Corrigido: foco assíncrono em `ChatOverlay.ts` aguarda soltura do pointer lock (`pointerlockchange` + fallback `requestAnimationFrame`).
- [~] 1664 `P1` **A aba "Catálogo Criativo" reconstruir ao trocar de modo** — Corrigido: `rebuildTabs()` em `InventoryModal.ts` chamado a cada `open()`.
- [~] 1665 `P1` **Escala dos mobs documentada como regra de projeto** — Registrado em `docs/ARCHITECTURE.md` a regra de `ESCALA_MODELO`.
- [~] 1666 `P1` **Chat/comandos visível como atalho no Pause Menu** — Adicionado atalho 'Chat / IA [T]' ao array `atalhosRapidos` em `main.ts`.
- [~] 1667 `P0` **Inventário no sobrevivência com layout adaptado** — Corrigido: aba "Meu Estoque" exibindo todos os slots, quantidades e durabilidade em `InventoryModal.ts`.
- [~] 1668 `P1` **Grade de inventário pessoal (mochila)** — Suporte a 27 slots (hotbar + 18 slots de mochila) em `InventoryModal.ts`.
- [~] 1669 `P1` **Indicadores visuais de sobrevivência no inventário** — Cabeçalho visual exibindo item equipado e status em `InventoryModal.ts`.
