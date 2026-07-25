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
- [~] 255 `P2` **Spawn de inimigos condicionado ao nível de luz — consome o motor da rodada 4**
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
- [~] 276 `P0` **Migração de save versionada e idempotente — `src/storage/SaveMigration.ts`**
- [~] 277 `P1` **Backup automático antes de migrar (mundo + mods, no localStorage)**
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
- [~] 386 `P1` **Compressão das mensagens de bloco — gzip nativo no `full_sync`**
- [ ] 387 `P1` Validação de permissão (OP) no host antes de aplicar edição do convidado
- [ ] 388 `P2` Chat multiplayer separado do chat da IA
- [ ] 389 `P2` Lista de jogadores com latência
- [ ] 390 `P2` Kick/ban por jogador
- [ ] 391 `P2` Migração de host quando o host sai
- [ ] 392 `P2` Limite de convidados configurável
- [ ] 393 `P2` Indicador de estado de conexão no HUD
- [~] 394 `P2` **Fila de mensagens com fragmentação — `src/net/wire.ts`**
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
- [ ] 642 `P0` Painel de mods na UI: listar, ativar, versões, rollback, exportar
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

- [ ] 665 `P0` `BiomeDef` declarativo: clima, superfície, vegetação, recursos
- [ ] 666 `P0` Seleção por pontuação contínua, com fronteiras graduais
- [ ] 667 `P0` Recursos com abundância por bioma (ouro no deserto, diamante na tundra)
- [ ] 668 `P0` Recurso exclusivo de bioma — o que obriga a expedição
- [ ] 669 `P0` Oito biomas base: planície, floresta, taiga, tundra, deserto, savana, pântano, montanha
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
- [ ] 681 `P0` **Construções espalhadas**: estruturas distribuídas proceduralmente pelo mundo
- [ ] 682 `P0` Regra de espalhamento por bioma, raridade e espaçamento mínimo
- [ ] 683 `P0` Uma estrutura por célula de grade, com vencedor único (como as árvores)
- [ ] 684 `P0` Estrutura assenta no terreno (nivela a base, não flutua nem afunda)
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
- [ ] 704 `P0` `set_block`/`fill_box`/`execute_voxel_script` também atribuídos ao mod da sessão
- [ ] 705 `P0` Registrar no mod quais blocos do mundo ele colocou, para reverter com precisão
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

- [ ] 721 `P0` Arquivo `mod.env` criado por padrão em todo mod novo, com cabeçalho explicativo
- [ ] 722 `P0` Sintaxe de herança `CHAVE=$CHAVE_GLOBAL` resolvida em tempo de execução
- [ ] 723 `P0` Valores literais para configuração não sensível (modelo, idioma, unidades)
- [ ] 724 `P0` **`export_mod` exporta o esquema, nunca os valores** — segue `stripLocalState`
- [ ] 725 `P0` **`mod_sync` no P2P nunca transporta valores de `mod.env`**
- [ ] 726 `P0` Cofre global de segredos separado do pacote do mod (tabela própria, não em `mods`)
- [ ] 727 `P0` Declaração de chaves obrigatórias vs opcionais, com descrição de cada uma
- [ ] 728 `P0` Mod não carrega se faltar chave obrigatória — vai para quarentena com o motivo
- [ ] 729 `P1` UI pede a chave que falta ao ativar o mod, explicando para que serve
- [ ] 730 `P1` Importar um mod lista as chaves que ele exige antes de instalar
- [ ] 731 `P1` Validação de formato por chave (URL, token, enum de modelos)
- [ ] 732 `P1` Editar `mod.env` pela UI, com os campos sensíveis mascarados
- [ ] 733 `P1` Ferramenta MCP `read_mod_env` — devolve o esquema e quais chaves estão preenchidas, **nunca o valor**
- [ ] 734 `P1` Ferramenta MCP `set_mod_env` para as chaves não sensíveis (modelo, idioma)
- [ ] 735 `P0` Agente **não consegue ler valor de segredo** por nenhuma ferramenta
- [ ] 736 `P0` Segredo nunca aparece em log, toast, snapshot ou mensagem de erro
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
- [ ] 765 `P0` Mod **nunca** recebe acesso ao `fetch` global (hoje o escopo do script vaza)
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

- [ ] 845 `P0` **Página de Mods**: lista, conteúdo, ativar/desativar, quarentena com motivo
- [ ] 846 `P0` Histórico de versões na página, com rollback em um clique (expõe 631–633)
- [ ] 847 `P0` Exportar/importar mod pela página, sem passar pela IA
- [ ] 848 `P1` Qual sessão de chat originou o mod, com link para abri-la
- [ ] 849 `P1` Aviso visual de mod em quarentena, com o erro legível
- [ ] 850 `P0` **Página de Editor de Código** com árvore de arquivos do mod à esquerda
- [ ] 851 `P0` CodeMirror 6 com destaque de sintaxe JS, carregado sob demanda
- [ ] 852 `P0` Salvar gera nova revisão do mod (integra com o versionamento)
- [ ] 853 `P0` Executar/recarregar o script sem reiniciar o mundo
- [ ] 854 `P0` Painel de console mostrando `api.console` e erros do script
- [ ] 855 `P1` Erro aponta linha e coluna, com salto para o ponto no editor
- [ ] 856 `P1` Autocomplete da API do mod (usa a tipagem do item 835)
- [ ] 857 `P1` Editar também o `mod.env` pela mesma árvore (seção 29)
- [ ] 858 `P1` Editar as definições de bloco/entidade/estrutura como JSON no editor
- [ ] 859 `P1` Validação ao salvar, recusando JSON inválido antes de gravar
- [ ] 860 `P1` Atalhos: salvar, executar, buscar, comentar linha
- [ ] 861 `P1` Buscar e substituir dentro do arquivo
- [ ] 862 `P1` Estado do editor preservado ao fechar e reabrir a página
- [ ] 863 `P1` Editor não bloqueia o jogo: pausa opcional enquanto está aberto
- [ ] 864 `P2` Diff entre a versão salva e a editada, antes de salvar
- [ ] 865 `P2` Desfazer/refazer com histórico próprio do editor
- [ ] 866 `P2` Modelos de script prontos (reagir a bloco, gerar estrutura, ciclo do dia)
- [ ] 867 `P2` Snippet de exemplo inserido em todo mod novo
- [ ] 868 `P2` **Página de Diagnóstico**: FPS, chunks, entidades, memória, custo por mod
- [ ] 869 `P2` **Página de Mundo**: semente, hora, regras, distância de render, regenerar região
- [ ] 870 `P2` **Página de Blocos**: navegar a paleta, ver propriedades, ir até um bloco no mundo
- [ ] 871 `P2` **Página de Entidades**: listar, seguir, remover, editar espécie
- [ ] 872 `P2` **Página de Rede**: peers, latência, o que está sendo sincronizado
- [ ] 873 `P2` Navegação unificada entre as páginas, com atalho único
- [ ] 874 `P2` Todas as páginas entram no `UIManager` como telas bloqueantes
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

## Onda 2 — Tornar o jogo mantenível `~2 rodadas`

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

## Onda 5 — Pilares ausentes e desempenho `contínuo`

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

## Correção: o binário está correto — o domínio é que é outro

A primeira leitura destes números levantou a hipótese de que o motor de dedup estivesse inerte
na build WASM. **A documentação do projeto mostra que não.** O `README` e o `docs/benchmarks.md`
do crompressor declaram, para o modo **Archive (lossless)**:

> Compressão ~1.5–2.5x (tensores densos) · *"obedecer aos limites de entropia de Shannon sobre
> o resíduo"*

Medimos **2,1x a 2,7x**. Ou seja: **o crompressor entregou exatamente o que promete.** A build
está correta e a medição também — o que estava errado era a expectativa.

### O que o crompressor realmente é

Um compressor **de domínio específico para pesos de LLM e tensores**, construído sobre três
primitivas: CDC (chunking por conteúdo), VQ (quantização vetorial contra um codebook treinado) e
XOR delta. Ele tem dois modos mutuamente exclusivos:

| Modo | Compressão | Fidelidade | Uso declarado |
|---|---|---|---|
| **Edge** | ~5–8x | **Lossy** (MSE ~2,55) | inferência de borda, LLM em CPU |
| **Archive** | ~1,5–2,5x | bit-exact | backup, cold storage, distribuição P2P |

O número que dá sentido ao projeto é o **8x do modo Edge** — e ele custa perda. Funciona para
pesos de rede neural porque o resíduo descartado é ruído que não muda a qualidade da inferência,
exatamente como GPTQ e AWQ fazem.

### Por que isso não serve para voxels

**Id de bloco é símbolo discreto, não grandeza contínua.** Um peso de rede neural aproximado de
0,732 para 0,729 continua funcionando; um bloco 3 (pedra) aproximado para 4 (areia) é um mundo
corrompido, não um mundo levemente degradado. Não existe tolerância perceptual em id de bloco.

Isso elimina o modo Edge — o único em que o crompressor supera o gzip. Resta o Archive, cujo
teto de ~2,5x é **principiado, não um defeito**: o resíduo XOR de uma aproximação VQ é quase
aleatório, e a própria tabela de benchmarks do projeto registra Archive sobre `urandom` = 1,0x
com a nota *"resíduo XOR consome todo o espaço (limite de Shannon)"*.

### Sobre a deduplicação em blocos, especificamente

O ganho de dedup entre chunks medido foi **1,00x para os dois compressores**. Chunks de terreno
não são duplicatas uns dos outros: cada um tem coordenada diferente, logo relevo diferente. A
redundância de dado voxel é *local* — sequências longas do mesmo bloco dentro do chunk — e isso
é o que LZ77/gzip explora. Deduplicação vence quando os **mesmos bytes** se repetem por um
acervo, que não é o caso aqui nem com um codebook treinado.

### Correção maior: eu medi o modo errado

O artigo *"A ilusão da compressão: por que o Crompressor não é o novo gzip, e sim um Git para
dados"* deixa explícito que **a comparação que fiz não é a que o projeto propõe**. O próprio
autor afirma que, em uso isolado, o crompressor chega a **inflar o arquivo (125% do original)** —
e que o ganho aparece quando ele opera como **motor de deduplicação de borda com codebook
compartilhado**, onde reduz *"até 99,4% do tráfego de rede"*.

Os números do artigo, no modo pretendido:

| Benchmark | Resultado |
|---|---|
| V5 (chunks de 128 B) | 80,5% de redução de tráfego — o limite dado o overhead de 24 B por chunk |
| V6 (chunks de 4 KB) | 460,81 MB → **2,81 MB (99,38%)** em projetos reais |

O modelo é o do Git, e a analogia é precisa: **não se transmite o que o outro lado já tem.**
Treina-se um `.cromdb` sobre dados históricos, distribui-se esse dicionário aos nós uma vez, e a
partir daí um bloco reconhecido viaja como um identificador de 24 bytes em vez do conteúdo.

Ou seja: minha tabela mediu empacotamento autônomo, que é justamente o cenário que o autor
classifica como mau uso. **A medição estava correta; a pergunta é que estava errada.**

### A pergunta certa: esse modelo se aplica a este jogo?

Aqui a resposta continua sendo majoritariamente não, mas por um motivo **completamente
diferente** do que eu havia registrado — e que vale mais que a discussão de razão de compressão:

**O `full_sync` deste jogo já não transmite o dado redundante.** O terreno é gerado
proceduralmente a partir da semente, e o convidado o regenera localmente. O que trafega são só
as `blockMods` — as alterações do jogador. A redundância entre pares que o crompressor existe
para eliminar **já foi eliminada por construção**, pela geração determinística.

É o mesmo princípio do artigo (não mandar o que o outro lado consegue obter sozinho), aplicado
uma camada acima: em vez de um codebook de padrões, a semente. E o dicionário aqui custa 4 bytes.

Onde o modelo do artigo *encostaria* neste projeto, e por que ainda não fecha:

| Candidato | Avaliação |
|---|---|
| `full_sync` P2P | A redundância já foi removida pela semente; sobra o diff do jogador, que é único por mundo |
| Snapshots da IA (`capture_multi_angle`) | 4 fotos quase idênticas — é literalmente o caso CCTV do artigo. Mas elas vão para a API do modelo, que precisa do PNG real |
| Distribuição de mods entre usuários | **Caso mais forte.** Mods compartilham estruturas e blocos comuns; um codebook de padrões de mod dedupli­caria bem numa galeria |
| Export de mundos numa plataforma de compartilhamento | Mesmo raciocínio, se muitos mundos partirem de templates comuns |

Os dois últimos são reais, mas dependem de algo que ainda não existe: **uma plataforma de
distribuição**. Com um usuário e um navegador, não há segundo nó para deduplicar contra.

### O ponto do artigo que mais interessa a este projeto

A afirmação sobre **"12,7x de ganho ao injetar o motor em simulações em RAM (pathfinding,
física), deduplicando estados matemáticos repetidos"** é a mais relevante aqui — e não tem
relação com tamanho de arquivo.

Este projeto acabou de ganhar A* ([`src/entities/Pathfinding.ts`](src/entities/Pathfinding.ts)),
com vários mobs recalculando rota contra o mesmo jogador, no mesmo terreno, a cada 0,35 s. São
estados repetidos, e hoje cada um é recomputado do zero. Isso é memoização de estado — parente
próximo da deduplicação — e é mensurável sem depender de plataforma nenhuma.

### Onde ele caberia neste projeto

Há um caso real, e é específico: **se o jogo passar a embarcar um modelo de linguagem local**
para o agente rodar sem API externa (o que a seção 30 prevê como capacidade de mod), pesos de
LLM no navegador são exatamente o domínio do modo Edge, com os 8x documentados. Aí a conversa
muda por completo.

Para blocos, saves e P2P: não.

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
- [ ] 911 `P3` **Reavaliar o crompressor se o jogo embarcar um LLM local** — pesos de rede são o domínio do modo Edge (8x documentados), diferente de id de bloco
- [ ] 914 `P3` Se um dia houver LLM local no navegador, medir Edge do crompressor contra quantização padrão (GPTQ/AWQ)
- [ ] 915 `P3` Medir o cenário de codebook compartilhado: treinar sobre chunks reais, distribuir uma vez, e comparar só o tráfego de índices contra gzip
- [ ] 916 `P3` Pré-requisito do anterior: expor `cromPack(bytes, codebook, modo)` no WASM — a API atual não recebe nenhum dos três
- [ ] 917 `P3` Resolver a distribuição do codebook entre peers (ele próprio é grande, e vira um problema de sync)
- [ ] 918 `P1` **Cache de rotas do A\***: mobs recalculam contra o mesmo alvo e terreno a cada 0,35 s — memoizar estado repetido é o análogo local do que o artigo mede como 12,7x
- [ ] 919 `P2` Medir quantas consultas de `findPath` são repetidas numa cena real, antes de otimizar
- [ ] 920 `P3` Reavaliar o crompressor **se** surgir uma galeria de mods/mundos — aí existe o segundo nó contra o qual deduplicar
- [ ] 921 `P2` Documentar que o `full_sync` já elimina a redundância por regeneração via semente (o dicionário custa 4 bytes)
- [ ] 912 `P2` Isolar segredo de dado de terceiro em fluxos comprimidos distintos (CRIME/BREACH)
- [ ] 913 `P2` Documentar em `docs/NETWORK_PROTOCOL.md` o formato de quadro e o limiar de fragmentação

