# Checklist Mestre — Painel de Especialistas (520 itens)

> **Como este documento foi produzido.** Simulamos uma banca de 22 especialistas, cada um
> auditando o Crom Planebox sob a sua própria lente e emitindo um parecer com ~24 tarefas
> acionáveis. Todos os itens foram escritos **depois** de ler o código real deste repositório
> (`src/world/blocks.ts`, `src/ai/MCPExecutors.ts`, `src/storage/`, `src/entities/`, …), por isso
> muitos apontam arquivo e função concretos.
>
> **Legenda de status**
> - `[x]` — já existe no repositório e foi verificado no código.
> - `[~]` — entregue **nesta rodada** (sistema de mods persistente + testes).
> - `[ ]` — pendente / backlog priorizado.
>
> **Prioridade**: `P0` bloqueia o objetivo declarado (jogo completo + IA que modifica tudo com
> save), `P1` é essencial para a experiência, `P2` é refinamento, `P3` é ambição de longo prazo.

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

---

## 01 — Diretor de Game Design (loop Minecraft/Terraria)

*Parecer: a engine tem cinco modos de jogo e sobrevivência básica, mas falta o "porquê" — um
loop de objetivos que puxe o jogador do primeiro dia até um chefe final.*

- [x] 001 `P0` Cinco modos de jogo distintos (`classic`, `survival`, `ghost`, `creative`, `adventure`) — `src/game/GameModeManager.ts`
- [x] 002 `P0` Ciclo básico de sobrevivência com vida e fome — `src/game/SurvivalSystem.ts`
- [x] 003 `P0` Quebrar/colocar blocos com tier de ferramenta — `src/player/interaction.ts`
- [x] 004 `P1` Drops de item ao quebrar blocos — `src/game/ItemDropSystem.ts`
- [x] 005 `P1` Bancada de crafting com receitas — `src/crafting/CraftingSystem.ts`
- [ ] 006 `P0` Definir e documentar o **loop central de 30 minutos** (acordar → coletar → craftar → abrigar → explorar)
- [ ] 007 `P0` Sistema de objetivos/conquistas guiando o jogador novato ("faça sua primeira picareta")
- [ ] 008 `P0` Curva de progressão em tiers de material (madeira → pedra → ferro → diamante) com gate real de acesso
- [ ] 009 `P1` Primeira noite como evento de tensão: inimigos surgem só após o anoitecer
- [ ] 010 `P1` Sistema de "camas"/ponto de renascimento definido pelo jogador
- [ ] 011 `P1` Morte com penalidade escolhível por mundo (dropar inventário / manter / hardcore)
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
- [ ] 030 `P0` Extrair as constantes de altura mágicas (`120`, `128`) para `WORLD_MAX_Y` único
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

*Parecer: o mesher greedy com jitter de cor já entrega o ar artesanal característico; falta
oclusão de ambiente, sombras suaves e neblina atmosférica para fechar a estética.*

- [x] 049 `P0` Mesher próprio com faces por bloco e sombreamento direcional — `src/world/mesher.ts`
- [x] 050 `P1` Jitter procedural de cor por voxel (`hash3`) evitando superfícies chapadas
- [x] 051 `P1` Blocos decorativos renderizados como caixinhas menores (`addDecor`)
- [x] 052 `P1` Camada de água separada com topo rebaixado
- [ ] 053 `P0` **Ambient occlusion por vértice** nos cantos — principal item que falta para o look alvo
- [ ] 054 `P0` Neblina atmosférica com gradiente de distância combinando com a cor do céu
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
- [ ] 076 `P0` Validador de contraste: recusar bloco novo cuja cor de topo seja idêntica a um existente
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
- [ ] 124 `P0` Comida real: itens comestíveis restaurando fome
- [ ] 125 `P0` Regeneração de vida com fome cheia
- [ ] 126 `P1` Afogamento com barra de oxigênio embaixo d'água
- [ ] 127 `P1` Dano por lava e por queimadura persistente
- [ ] 128 `P1` Temperatura por bioma exigindo abrigo ou roupa
- [ ] 129 `P1` Durabilidade de ferramentas com quebra
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

- [ ] 145 `P0` Sistema de dano jogador↔entidade com alcance e cooldown
- [ ] 146 `P0` Inimigos hostis com spawn noturno e em cavernas
- [ ] 147 `P0` Armas corpo a corpo com dano por tier
- [ ] 148 `P1` Arco e flecha com projétil balístico
- [ ] 149 `P1` Knockback ao receber e causar dano
- [ ] 150 `P1` Invulnerabilidade temporária pós-dano
- [ ] 151 `P1` Barra de vida sobre entidades hostis
- [ ] 152 `P1` Drops de inimigo com loot table
- [ ] 153 `P2` Bloqueio/parry com escudo
- [ ] 154 `P2` Ataque carregado
- [ ] 155 `P2` Inimigos com resistências elementais
- [ ] 156 `P2` Bosses com fases e padrões de ataque
- [ ] 157 `P2` Arenas de boss com invocação por item
- [ ] 158 `P2` Inimigos voadores com pathfinding 3D
- [ ] 159 `P2` Armadilhas colocáveis
- [ ] 160 `P2` Torres/defesas automáticas
- [ ] 161 `P1` Feedback visual e sonoro claro de acerto
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
- [ ] 175 `P0` Pathfinding A* respeitando colisão e altura de pulo
- [ ] 176 `P1` Colisão de entidade com blocos (hoje atravessam paredes)
- [ ] 177 `P1` Máquina de estados (ocioso, patrulha, perseguir, fugir, atacar)
- [ ] 178 `P1` Percepção com raio de visão e cone frontal
- [ ] 179 `P1` Limite de entidades ativas por região com despawn
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
- [ ] 195 `P0` Árvore de receitas cobrindo todos os tiers de ferramenta
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
- [ ] 221 `P0` Simulação de fluido: água escoando por níveis
- [ ] 222 `P0` Lava escoando, solidificando em contato com água
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
- [~] 248 `P1` **Recalcular luz incrementalmente ao colocar/quebrar bloco (`recalcRegion`)**
- [~] 249 `P2` **Luz atravessando blocos translúcidos com atenuação (água, folhagem, vidro)**
- [ ] 250 `P2` Luz da lua com intensidade por fase
- [ ] 251 `P2` Luz colorida por bloco emissivo
- [~] 252 `P1` **Mods podem definir nível de luz emitido pelo bloco** (`lightLevel`) — na rodada 3 era só metadado; agora o motor de luz realmente o consome
- [ ] 253 `P2` Sombra projetada por entidades
- [ ] 254 `P2` Adaptação de exposição ao sair de uma caverna
- [ ] 255 `P2` Spawn de inimigos condicionado ao nível de luz
- [ ] 256 `P2` Debug view mostrando o mapa de luz
- [ ] 257 `P1` Luz calculada no worker, não na thread principal
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
- [ ] 276 `P0` Migração versionada de save com `saveVersion` realmente aplicada
- [ ] 277 `P1` Backup automático rotativo antes de migração
- [ ] 278 `P1` Verificação de integridade ao carregar (ids órfãos, coordenadas inválidas)
- [ ] 279 `P1` Compactação do save de blocos (RLE por chunk)
- [ ] 280 `P2` Save incremental em background sem travar o frame
- [ ] 281 `P2` Indicador de "salvando…" na UI
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
- [ ] 305 `P1` Dependências entre mods com ordem de carga resolvida
- [ ] 306 `P1` Versionamento de mod com migração de conteúdo
- [ ] 307 `P1` Conflito de chave entre mods detectado e reportado
- [ ] 308 `P2` Mods registrando receitas de crafting
- [ ] 309 `P2` Mods registrando itens não-bloco
- [ ] 310 `P2` Mods registrando biomas
- [ ] 311 `P2` Mods registrando eventos de mundo
- [ ] 312 `P2` Mods assinando hooks (`onBlockPlaced`, `onTick`)
- [ ] 313 `P2` Painel de gerenciamento de mods na UI do jogo
- [ ] 314 `P2` Recarga a quente de mod sem reiniciar o mundo
- [ ] 315 `P2` Sandbox de permissões por mod (o que ele pode alterar)
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
- [ ] 344 `P2` Streaming de progresso de construções longas para a UI
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
- [ ] 358 `P0` Executar scripts da IA em Web Worker isolado sem acesso a `window`/`fetch`
- [ ] 359 `P0` Allowlist explícita de funções expostas ao script (hoje o escopo global vaza)
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
- [ ] 382 `P0` Sincronizar entidades e seu estado
- [ ] 383 `P1` Interpolação de posição de jogadores remotos
- [ ] 384 `P1` Reconexão automática com re-sync incremental
- [ ] 385 `P1` Delta sync em vez de mundo inteiro ao reconectar
- [ ] 386 `P1` Compressão das mensagens de bloco
- [ ] 387 `P1` Validação de permissão (OP) no host antes de aplicar edição do convidado
- [ ] 388 `P2` Chat multiplayer separado do chat da IA
- [ ] 389 `P2` Lista de jogadores com latência
- [ ] 390 `P2` Kick/ban por jogador
- [ ] 391 `P2` Migração de host quando o host sai
- [ ] 392 `P2` Limite de convidados configurável
- [ ] 393 `P2` Indicador de estado de conexão no HUD
- [ ] 394 `P2` Fila de mensagens com backpressure
- [ ] 395 `P2` Testes do protocolo com peers simulados
- [ ] 396 `P2` Modo offline explícito desabilitando toda a rede
- [ ] 397 `P3` Servidor dedicado opcional
- [ ] 398 `P3` Replicação de entidades por interesse (área)
- [ ] 399 `P2` Versionamento de protocolo com handshake
- [ ] 400 `P2` Métricas de banda por sessão

## 17 — Engenheiro de Performance

- [x] 401 `P0` Geração de chunk fora da thread principal
- [x] 401b `P0` Save de blocos em lote (era 2N round-trips, virou 2 escritas)
- [ ] 402 `P0` Orçamento de frame: limitar chunks re-meshados por frame
- [ ] 403 `P0` Mesh em worker além da geração
- [ ] 404 `P1` Pool de geometrias reaproveitadas em vez de realocar
- [ ] 405 `P1` `dispose()` consistente de geometria e material ao descarregar chunk
- [ ] 406 `P1` Instanced mesh para decorativos e entidades repetidas
- [ ] 407 `P1` Reduzir draw calls agrupando chunks vizinhos
- [ ] 408 `P1` Profiling embutido (F3) com FPS, chunks, draw calls, memória
- [ ] 409 `P1` Distância de render adaptativa ao FPS medido
- [ ] 410 `P2` Cache de resultado de `getGroundY` por coluna
- [ ] 411 `P2` Estruturas tipadas (`Uint8Array`) em vez de `Map<string, number>` no hot path
- [ ] 412 `P2` Evitar concatenação de string como chave de bloco no loop crítico
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
- [ ] 430 `P0` Painel de mods (listar, ativar, remover, exportar) na UI
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
- [ ] 442 `P2` Tela de configurações unificada
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

- [ ] 477 `P0` Sistema de áudio base com Web Audio API
- [ ] 478 `P0` Som por material ao quebrar/colocar bloco
- [ ] 479 `P1` Passos variando por bloco pisado
- [ ] 480 `P1` Áudio posicional 3D para entidades
- [ ] 481 `P1` Ambiência por bioma
- [ ] 482 `P1` Música dinâmica por contexto (dia, noite, caverna, combate)
- [ ] 483 `P1` Volume separado por canal (mestre, música, efeitos, ambiente)
- [ ] 484 `P1` Som de dano e de morte
- [ ] 485 `P2` Som de água e lava por proximidade
- [ ] 486 `P2` Reverb em cavernas
- [ ] 487 `P2` Abafamento embaixo d'água
- [ ] 488 `P2` Som de UI (clique, abrir inventário)
- [ ] 489 `P2` Mods podem registrar sons próprios
- [ ] 490 `P2` Pool de fontes de áudio com limite de vozes
- [ ] 491 `P2` Pré-carregamento assíncrono sem travar o boot
- [ ] 492 `P2` Silenciar ao perder o foco da aba
- [ ] 493 `P3` Síntese procedural de som de bloco a partir do material
- [ ] 494 `P2` Testes de que nenhum som toca com volume zero

## 21 — Designer de Conteúdo Terraria-like

- [ ] 495 `P0` Camadas verticais com identidade (superfície, subsolo, caverna, inferno)
- [ ] 496 `P0` Recursos exclusivos por camada
- [ ] 497 `P1` Perigos crescentes com a profundidade
- [ ] 498 `P1` Masmorras com chave/mecanismo de abertura
- [ ] 499 `P1` Eventos de invasão temporizados
- [ ] 500 `P1` Bosses invocáveis com item de convocação
- [ ] 501 `P1` NPCs que se mudam para a base quando há condições (casa válida)
- [ ] 502 `P1` Validador de "casa" (paredes, porta, luz, mobília)
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
- [ ] 514 `P0` CI rodando `tsc --noEmit` e `vitest run` a cada push
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
| 1 | 145–147 (combate) | O único pilar do gênero ainda totalmente ausente |
| 2 | 255 (spawn por nível de luz) | O motor de luz já entrega o dado; falta o inimigo para consumi-lo |
| 3 | 175–176 (pathfinding + colisão de entidade) | NPCs atravessando parede quebram a imersão |
| 4 | 124–125 (comida e regeneração) | A fome já drena, mas não há como saciá-la |
| 5 | 403 (mesh em worker) | O re-mesh do ciclo dia/noite tornou o custo de malha mais visível |
| 6 | 358–359 (sandbox em worker) | Pré-requisito para compartilhar mods com segurança |
| 7 | 609 (sync de entidades no P2P) | Última lacuna grande do multiplayer |
| 8 | 514 (CI) | Impede regressão silenciosa nos 195 testes |

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
