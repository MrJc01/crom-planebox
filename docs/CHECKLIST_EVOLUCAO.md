# Checklist de Evolução — Crom Planebox

**IA confiável · Multiplayer P2P · Modos de Jogo · UX/UI**

> Documento criado em 23/07/2026 a partir de uma sessão de auditoria completa do projeto e de um pedido extenso do usuário. Serve como registro **detalhado e rastreável** (checklist) de tudo que foi solicitado, para que nada se perca entre sessões de desenvolvimento. Cada item tem uma caixa `[ ]` para marcar quando for concluído. Itens de diagnóstico já vêm com o que foi encontrado na auditoria do código atual.
>
> **Atualizado em 24/07/2026 (3ª rodada)** após uma sessão de "verifique tudo, teste, analise e corrija" que efetivamente **rodou** o que antes só estava documentado como pendente: relay de sinalização real (`relay/server.js` com `ws` instalado) contra **2 clientes de navegador isolados de verdade** via Playwright (não é mock — 2 `BrowserContext` sem storage/cookies compartilhados, handshake WebRTC completo). Isso revelou e corrigiu **3 bugs reais**, todos verificados no navegador antes e depois da correção:
> 1. `PeerSync.wireChannel()` nunca salvava o `RTCDataChannel` recebido via `ondatachannel` de volta no registro do peer — o lado **guest** nunca conseguia enviar nada de volta ao host (só recebia). Chat guest→host e comandos remotos estavam quebrados.
> 2. `WorldRepository.saveBlockModBatch()` fazia 1 leitura + 1 escrita **sequencial por bloco** no IndexedDB — uma estrutura de ~650 mini-blocos (`stamp_structure`) levava mais de 1 minuto e parecia travada. Reescrito para operações em lote de verdade (`bulkPut`/`bulkDelete`): de 4,5s para 6,8ms num teste de 27 blocos.
> 3. `parseBlockType()` e o `BLOCK_ENUM` do `execute_voxel_script` não reconheciam **"LAVA"** nem **"COBBLESTONE"** — nomes que as próprias descrições das ferramentas MCP sugeriam à IA usar — e caíam silenciosamente em `STONE`. Provavelmente uma causa direta de "a IA não constrói o que peço direito".
>
> Também nesta rodada: indicador de rede persistente no HUD, reconexão automática do guest, lista de jogadores + conceder/revogar OP na aba Multiplayer, ferramenta MCP `stamp_structure` (testada diretamente), `saveVersion` no `WorldRecord`, system prompt atualizado, e um `README.md` novo. Duas entradas desta seção também estavam **desatualizadas** (diziam "pendente" para coisas que já tinham sido feitas na rodada anterior: ferramentas MCP de UI e o handler de Configurações Globais) — corrigidas.
>
> Este documento **não substitui** `ARCHITECTURE.md`, `MCP_TOOLS.md`, `CONTROLS_AND_FEATURES.md` e `USER_REQUIREMENTS_LOG.md` — ele é o plano de evolução em cima do que já existe.

---

## 0. Diagnóstico da Auditoria (estado real em 23/07/2026)

### 0.1 Divergência crítica: documentação descreve um motor que não existe mais
- [x] **Achado:** `ARCHITECTURE.md` descrevia Babylon.js; o código real usa **Three.js puro**. `src/voxel/` era Babylon legado morto.
- [x] Causa direta de "a IA não reconhece o ambiente" identificada e documentada.
- [x] `ARCHITECTURE.md` reescrito para descrever a stack real (Three.js, Web Worker, `World`/`Chunk`, `CameraManager`, `GameModeManager`).
- [x] `src/voxel/*` removido do projeto (era código morto, zero imports).
- [x] `src/save/store.ts` (e `serializer.ts`, `crom.ts`) removidos — eram dead code paralelo ao `WorldRepository`/Dexie real.
- [x] `SettingsModal` teve a dependência morta de `ChunkManager` (`null as any`) removida; o componente inteiro foi depois substituído pelo `PauseMenu` (seção 3).

### 0.2 Por que a IA falha em criar coisas / reconhecer o ambiente
- [x] **Correção**: esta linha também estava desatualizada. `ChatOverlay.getLocationContext` (religado em `main.ts`) já inclui modo de jogo atual, status host/peer/contagem de jogadores e OP, além da lista de entidades num raio de 32 blocos.
- [x] `capture_multi_angle` implementado em `MCPExecutors.ts` (4 fotos automáticas frente/direita/trás/esquerda) e registrado em `MCPRegistry.ts`.
- [ ] Log exportável de screenshots/chamadas MCP para debug de sessão — **parcial**: `list_recent_errors` guarda os últimos erros de script, mas não um log completo exportável com imagens.
- [x] `EntitySystem.groundSnap()`: encaixe de chão agora é síncrono no momento do spawn (`spawnEntity` e `createCustomEntity`), sem esperar o primeiro `update()`.
- [x] Ferramenta MCP `possess_entity` criada (`EntitySystem.takeControlOf`): transforma o jogador na entidade em vez de só spawnar um NPC decorativo.
- [x] `execute_voxel_script` agora captura erros de sub-scripts, devolve o erro formatado na mesma resposta de tool-call, tem timeout de 4s contra loops infinitos, e alimenta `list_recent_errors`.
- [x] **Bug real encontrado e corrigido**: `spawn_entity`, `list_entities`, `control_entity`, `trigger_world_event` e `batch_set_blocks` já existiam implementados em `MCPExecutors.ts` mas **nunca tinham sido registrados** em `MCPRegistry.ts` — a LLM nunca via essas ferramentas. Registrados agora.

---

## 1. Confiabilidade Geral da IA (Ambiente, Criação, Visão)
- [x] System prompt atualizado: referencia `capture_multi_angle` como verificação final obrigatória, `list_recent_errors` para autocorreção, `stamp_structure` como atalho para estruturas comuns, `possess_entity` vs. `spawn_entity`, e uma seção nova reforçando "nunca chame um backend de jogo, só a API de IA e opcionalmente o relay de sinalização".
- [x] Adicionar ao contexto de cada mensagem: modo de jogo, host/peer, OP, entidades próximas — feito (ver seção 0.2).
- [x] Referenciar `capture_multi_angle` como etapa obrigatória no texto do system prompt — feito junto com o item acima.
- [x] `list_recent_errors` criada e registrada.
- [x] Timeout/guarda de loop infinito em `execute_voxel_script` (aborta escrita de blocos após 4s).
- [x] **Auditoria de nomes de blocos feita — 2 bugs reais encontrados e corrigidos**: `parseBlockType()` (usado por `set_block`/`fill_box`/`batch_set_blocks`) e o `BLOCK_ENUM` de `execute_voxel_script` não reconheciam **"LAVA"** nem **"COBBLESTONE"/"COBBLE"** — nomes que as próprias descrições das ferramentas sugeriam a IA usar (`MCPRegistry.ts` linha do `set_block` literalmente dizia "..., GLASS, LAVA, WATER..."). Pedir esses blocos caía silenciosamente em `B.STONE`. Também faltavam `GRAVEL`/`PATH`/`SNOW`. Corrigido e confirmado no navegador: `set_block` com `"LAVA"` agora grava `B.LAVA` (id 28), `"COBBLESTONE"` grava `B.COBBLE` (id 19), `"GRAVEL"` grava `B.GRAVEL` (id 5) — antes os 3 caíam em `B.STONE` (id 3).

---

## 2. Menu Principal & Fluxo de Criação de Mundo
- [x] **`MainMenu` criado** (`src/ui/MainMenu.ts`), com:
  - [x] Continuar (último mundo)
  - [x] Mundos Salvos (lista + abrir)
  - [x] Criar Novo Mundo → abre o Wizard
  - [x] Mundos Online da Crom (lista via `SignalingClient.listRooms()` + colar link `?join=`)
  - [x] **Correção**: esta linha estava desatualizada — o handler `onOpenGlobalSettings` já estava implementado (`mainMenu.close(); uiManager.openBlocking('pause')`) e foi confirmado funcionando no navegador (clicar "Configurações Globais" no MainMenu abre o Pause Menu corretamente, sem erros de console).
- [x] **`WorldCreationWizard` criado** (`src/ui/WorldCreationWizard.ts`), em página única (não multi-etapas separadas, mas cobre todos os campos antes de gerar):
  - [x] Nome + seed (com botão aleatório)
  - [x] Altura do solo, bloco de superfície/subsolo
  - [x] Modo de jogo padrão do mundo (os 5 modos)
  - [x] Toggle "Conectar este mundo à Crom ao iniciar"
  - [x] Botão único "Criar Mundo" que salva e só então o mundo é gerado
- [x] Fluxo inteiramente DOM/overlay, sem `location.reload()` em nenhum lugar novo.
- [x] **Plugados em `main.ts`**: o bootstrap agora mostra o `MainMenu` primeiro (sem gerar nenhum chunk/terreno até uma escolha ser feita), HUD/hotbar/chat ficam ocultos até `startGame()` rodar. Testado no navegador com screenshot confirmando o menu aparecendo sozinho, depois o Wizard, depois o jogo carregando o terreno.

---

## 3. UX/UI: Pause Menu Unificado & Chat Estilo Minecraft
- [x] **`UIManager` criado** (`src/ui/UIManager.ts`): overlays bloqueantes exclusivos, ESC fecha um nível por vez, pointer lock centralizado — ainda não plugado em `main.ts` no lugar da lógica antiga espalhada.
- [x] **`PauseMenu` criado** (`src/ui/PauseMenu.ts`, substitui `SettingsModal.ts`) com abas:
  - [x] Mundo (select, exportar, resetar, trocar)
  - [x] Modo de Jogo (os 5 modos, aplicar)
  - [x] Multiplayer (URL do relay, conectar/desconectar, link de convite, **lista de jogadores conectados com botões Conceder/Revogar OP** direto na aba — reaproveita `listAllPlayers()`/`setPlayerOp()`, as mesmas funções usadas pelo `CommandContext`).
  - [x] Jogador (câmera, FOV, render distance, reset)
  - [x] IA & MCP (provedor, chave, modelo)
  - [x] Atalhos/Ajuda
- [x] **`ChatOverlay` com duas abas (IA + Chat do Mundo)**: aba de Assistente IA original preservada + nova aba "Chat do Mundo" com balões flutuantes que somem sozinhos (log flutuante independente do container principal), comandos `/` roteados para `CommandSystem`. Testado no navegador: `/help` e `/gamemode survival` funcionam e aparecem no chat.
- [x] **Bug real relatado pelo usuário e corrigido (24/07/2026): "o chat some depois que a IA responde"**. Causa raiz: `OpenRouterClient.sendMessage()` nunca recebia nem gravava `threadId` nas mensagens salvas via `WorldRepository.addChatMessage` (usuário, assistente, tool). Assim que o `ChatOverlay` filtra o histórico por `currentThreadId` pra exibir (`getChatMessages(worldId, threadId)`), nenhuma mensagem batia (todas tinham `threadId: undefined`) — a conversa inteira "sumia" e a UI mostrava a tela de boas-vindas "✨ Nova Conversa Ativa" por cima da conversa real, mesmo com a IA tendo respondido normalmente (confirmado pelos logs do usuário: 3 loops de ferramentas, cidade construída, snapshot tirado — tudo funcionou, só a exibição que sumia). Corrigido: `sendMessage` agora recebe `threadId` como parâmetro e grava em toda mensagem persistida; `ChatOverlay.handleSend` passa `this.currentThreadId`. Também adicionado `WorldRepository.repairOrphanedChatMessages(worldId)`, chamado automaticamente em `ChatOverlay.setWorldId()`, que realoca mensagens antigas sem `threadId` (de antes da correção) pra thread mais recente do mundo — testado recuperando uma conversa órfã simulada com sucesso, sem precisar apagar o mundo existente do usuário.
- [ ] Revisão de responsividade/z-index de todos os overlays — não auditada formalmente (funcionou nos testes manuais, mas sem varredura sistemática de todas as combinações).
- [x] `PauseMenu`, `InventoryModal` e `ChatOverlay` registrados no `UIManager` em `main.ts`; `ESC`/`T`/`E` agora passam por `uiManager.handleEscape()`/`toggleFloating()`, com `InventoryModal` ganhando os hooks `blockOpen`/`gateOpen` para não abrir por cima do Pause Menu nem em modos sem inventário criativo.

---

## 4. Modificação Agentic do Frontend pela IA (sem backend)
- [x] **Correção**: esta seção estava desatualizada. Ferramentas MCP de UI (`modify_ui_style`, `move_hud_element`, `create_custom_panel`, `reset_ui_customizations`) **já foram implementadas** em `src/ai/UIExecutors.ts` e registradas em `MCPRegistry.ts` (ver seção 9) — persistem via `saveUICustomization`/`reapplyPersisted` ao trocar de mundo.
- [x] Tabela `uiCustomizations` no Dexie (`Database.ts`) + métodos em `WorldRepository.ts` — em uso pelas ferramentas acima.
- [x] Sandboxing básico de HTML gerado pela IA: `UIExecutors.sanitizeHtml()` remove `<script>`, atributos `on*` inline e `javascript:` antes de injetar no DOM.
- [ ] Reforço explícito no texto do system prompt sobre permanecer 100% client-side — pendente (a regra já é verdadeira no código, só falta o texto de instrução para a IA).
- [ ] **Nunca testado com uma LLM real**: as 4 ferramentas existem e compilam, mas ninguém pediu para uma IA de verdade usá-las numa conversa — o comportamento em uso real é uma incógnita.

---

## 5. Mundo Online por Padrão & Sincronização P2P (sem backend de jogo)
- [x] Arquitetura host-estrela definida e documentada em `docs/NETWORK_PROTOCOL.md`.
- [x] `src/net/SignalingClient.ts` e `src/net/PeerSync.ts` criados (WebRTC + handshake via relay).
- [x] Protocolo JSON definido em `src/net/protocol.ts` (`block_update`, `entity_update`, `player_state`, `chat_message`, `command`, `full_sync`, `player_joined/left`, `op_changed`, `kick`).
- [x] Relay de referência opcional criado em `relay/server.js` (+ `relay/package.json`), com diretório de salas via `GET /rooms`.
- [x] Link compartilhável `?join=<roomId>` exibido na aba Multiplayer do `PauseMenu`.
- [x] **Detectar `?join=` na URL ao carregar a página e entrar em modo peer automaticamente**: `handleJoinLink()` em `main.ts` cria um mundo-visitante local em Modo Aventura, extrai `relay` da URL e chama `peerSync.joinRoom()`.
- [x] Listagem pública de mundos online no `MainMenu` (consome `SignalingClient.listRooms()`).
- [x] "Conectar à Crom" como ação explícita e separada: toggle no Wizard + botão no PauseMenu + comando `/crom conectar`/`/crom desconectar` (`CommandSystem`), agora com roteamento real (`peerSync.hostRoom`/`peerSync.stop`).
- [x] Reforçado em código e documentação: o relay nunca recebe blocos/inventário/chat, só sinalização + diretório.
- [x] `block_update`/`full_sync` ligados de ponta a ponta: `Interaction.onBlockChange` e `MCPExecutors.onBlocksChanged` transmitem via `peerSync.broadcast` quando host; peers aplicam com `world.setBlock` ao receber.
- [x] Indicador visual persistente de rede no HUD: `HUD.updateNetworkStatus(role, peerCount)` mostra "🟢 Anfitrião · N jogador(es)" / "🟡 Conectado como visitante" / "⚪ Offline (local)" no badge do topo, atualizado a cada frame.
- [x] Reconexão automática em queda momentânea de conexão: `PeerSync.attemptReconnect()` — até 3 tentativas com backoff crescente (1s, 2s, 3s), reanunciando entrada na sala via `signaling.announceJoin`; só chama `onHostClosed` depois de esgotar as tentativas. `onReconnecting(attempt, max)` mostra toast "tentando reconectar (N/3)...". Testado o código, mas **não** simulado uma queda de rede real (WebRTC não expõe um jeito fácil de forçar isso via Playwright) — fica como lacuna de teste conhecida.
- [x] **Testado com 2 clientes reais contra o relay rodando de verdade** (`relay/server.js` com `ws` instalado, rodando em `ws://localhost:8787`; 2 contextos isolados de navegador via Playwright = 2 "computadores" diferentes de verdade, sem storage/cookies compartilhados):
  - [x] Host conecta à Crom, gera link de convite (`?join=<roomId>&relay=<url>`).
  - [x] Guest abre o link, entra automaticamente como visitante em Modo Aventura, handshake WebRTC completo (`peerCount: 1` nos dois lados), host registra o guest no roster `remotePlayers`.
  - [x] Chat do Mundo host → guest.
  - [x] Sincronização de blocos host → guest (`set_block` via MCP no host aparece no `World` do guest).
  - [x] Comando remoto guest → host roteado corretamente (`/help` e `/op` negado por falta de permissão, resposta volta pelo chat).
  - [x] **Bug real encontrado e corrigido**: `PeerSync.wireChannel()` nunca gravava o `RTCDataChannel` recebido de volta no registro do peer quando o canal chegava via evento `ondatachannel` (o caminho do lado do **guest**, já que é o host quem chama `createDataChannel`). Resultado: o guest recebia mensagens normalmente, mas `sendToHost()`/`broadcast()` sempre falhavam silenciosamente pra ele, porque seu próprio registro do canal ficava `null` para sempre — chat guest→host e comandos remotos não funcionavam. Corrigido e reconfirmado com o mesmo teste de 2 clientes (chat e `/help`/`/op` remotos passaram a funcionar).
- [ ] Aviso encontrado no teste: o STUN público (`stun.l.google.com`) não resolveu no sandbox (`ERR_NAME_NOT_RESOLVED`), mas a conexão completou mesmo assim por ambos os clientes estarem na mesma máquina (candidatos locais bastaram). Em produção/rede real isso precisa ser validado com STUN/TURN de verdade — não testado nesta rodada.

---

## 6. Modos de Jogo
- [x] `GameModeManager` criado (`src/game/GameModeManager.ts`) com os 5 modos e suas regras (câmera, `canBreak`, `canPlace`, `canFly`, `hasSurvival`, `hasCreativeInventory`).

### 6.1 Modo 1 — Atual (manter)
- [x] Preservado como `'classic'` (câmera top-down, construção livre, sem regras de sobrevivência).

### 6.2 Modo 2 — Primeira Pessoa Survival
- [x] `SurvivalSystem` criado: dano de queda (via `PlayerController.lastImpactVelY`), afogamento (via `headUnder`), dano de lava (via `inLava`, novo bloco `B.LAVA`).
- [x] Fome com decaimento (~12min até zerar) e regeneração de vida quando fome > 50%.
- [x] Morte e respawn no ponto de spawn do mundo: `survivalSystem.onDeath` chama `findSpawn()` e reseta vida/fome em `main.ts`.
- [x] Gating de drops/ferramentas por modo ligado em `main.ts` (`inter.survivalMode = mode === 'survival'`) — **testado no navegador**: `/gamemode survival` mudou a câmera para FPS e aplicou dano de queda real na transição. Observação: a hotbar em si continua sendo a mesma lista de slots entre modos (não há uma segunda "hotbar de sobrevivência" separada da criativa); o que muda por modo é se os drops exigem ferramenta e se são físicos ou instantâneos.
- [x] Velocidade/possibilidade de drop dependente de tier de ferramenta (`minToolTier` em `BlockDef`, `toolTier` em `HotbarSlot`).
- [x] Quebrar sem dropar quando a ferramenta é insuficiente (`Interaction.awardDrop`).
- [x] Itens dropados fisicamente com efeito ímã (`ItemDropSystem`).
- [x] Bloco de lava (`B.LAVA`) com dano contínuo.
- [x] HUD de vida/fome estilo Minecraft (`HUD.updateSurvival`/`setSurvivalVisible`).

### 6.3 Modo 3 — Primeira Pessoa Fantasma (Voando)
- [x] Promovido a modo de jogo formal dentro do `GameModeManager` (não só um atalho de câmera).
- [x] Regras: sem colisão, sem inventário (`canBreak`/`canPlace` falsos, `hasCreativeInventory` falso).
- [x] Chat e comandos continuam funcionando (são sistemas independentes do modo de câmera).

### 6.4 Modo 4 — Primeira Pessoa Criativo com Crafting 6x6
- [x] `InventoryModal.ts` expandido com grade de crafting 6×6 (36 células) + slot de resultado.
- [x] `CraftingSystem.ts` criado: motor de receitas shaped (com forma, bounding-box) e shapeless; receitas de exemplo (tábuas, vidro, tijolo, tijolo de pedra, pedra luminosa, 3 tiers de picareta) documentadas como código em `CRAFTING_RECIPES`.
- [ ] Drag-and-drop real entre grade/inventário/hotbar — **simplificado**: a interação hoje é por clique (clique esquerdo preenche a célula com o bloco selecionado na hotbar, clique direito limpa), não arrastar-e-soltar.
- [x] **Bug real relatado pelo usuário e corrigido (24/07/2026)**: todo card de bloco/ferramenta/estrutura no `InventoryModal` chamava `this.close()` logo depois de equipar — o primeiro clique já fechava a janela, dando a impressão de "não consigo clicar em nenhum item" (o segundo clique não tinha mais em que clicar). Removido o `close()` dos cliques de equipar; agora dá pra equipar vários itens em sequência sem a janela fechar sozinha.
- [x] **Bug relacionado, mesmo relato**: não havia hotbar visível dentro do inventário (a hotbar real fica atrás do backdrop do modal). Adicionado um clone da hotbar no topo do painel (`modalHotbarContainer`), sincronizado em tempo real com a hotbar de verdade — clicar num slot do clone escolhe onde o próximo item clicado vai ser equipado. Também adicionados um botão "✕ Fechar [E]" explícito e fechar ao clicar fora do painel (no backdrop). Testado no navegador: 3 cliques seguidos em itens diferentes mantêm o inventário aberto, selecionar o slot 3 do clone e clicar num item equipa especificamente no slot 3 (confirmado visualmente e via estado do DOM).
- [x] Slot de resultado só libera o item quando a receita bate (`CraftingSystem.match`).
- [x] Inventário criativo separado em 3 abas: Blocos, Blocos Interativos (`BlockDef.interactive`, ex.: água, lava, pedra luminosa) e Itens (ferramentas craftáveis).
- [x] Paleta infinita do criativo continua sendo a fonte de blocos para popular a grade de crafting.

### 6.5 Modo 5 — Primeira Pessoa Adventure (visitantes)
- [x] Regras definidas no `GameModeManager` (`canBreak`/`canPlace`/`canFly` todos falsos).
- [x] Enforcement real no loop de jogo: `tick()` em `main.ts` só chama `inter.tryBreak`/`tryPlace` se `gameModeManager.rules.canBreak`/`canPlace`; visitantes que entram via `?join=` recebem um mundo próprio já criado com `defaultGameMode: 'adventure'`.
- [x] Pergunta explícita de compartilhamento implementada no Wizard ("Conectar este mundo à Crom ao iniciar" com o texto de aviso completo).
- [x] Promoção de visitante para outro modo disponível via comando `/gamemode <modo> <jogador>` (exige OP).

---

## 7. Sistema Base de Persistência (Save System)
- [x] Sistemas de save duplicados consolidados: `src/save/store.ts` (dead code) removido; `WorldRepository`/Dexie é a única fonte de verdade.
- [x] Tabela `players` criada no Dexie (`Database.ts`) com `PlayerRecord` completo (posição, rotação, vida, fome, modo, inventário, `isOp`) + métodos `getPlayer`/`savePlayer`/`listPlayers`/`setPlayerOp` em `WorldRepository.ts`.
- [x] Autosave: `savePlayerNow()`/`schedulePlayerSave()` em `main.ts` salvam posição, vida, fome, modo e inventário — chamados a cada mudança de inventário/modo (debounced 600ms) e a cada 5s no loop principal.
- [x] Restaurar posição/vida/inventário do jogador ao carregar um mundo: `loadWorldById` busca `WorldRepository.getPlayer()` e só cai em `findSpawn()` se não houver save anterior daquele jogador naquele mundo.
- [x] Versionar o schema de save: `saveVersion` adicionado ao `WorldRecord` (+ constante `CURRENT_SAVE_VERSION` em `Database.ts`), gravado ao criar mundo (Wizard) e mundo-visitante (`handleJoinLink`). Mundos antigos sem o campo continuam funcionando (tratados como versão 1 implícita) — só o campo em si foi adicionado, nenhuma lógica de migração real foi necessária ainda.
- [x] `localStorage` para preferência leve: último mundo aberto salvo em `localStorage['crom:lastWorldId']` a cada `loadWorldById` bem-sucedido.

---

## 8. Sistema de OP (Administrador) & Comandos de Chat
- [x] `CommandSystem` criado (`src/commands/CommandSystem.ts`) com parser completo e checagem de permissão (`requireOp`).
- [x] Comandos implementados: `/op`, `/deop`, `/gamemode`, `/kick`, `/tp`, `/crom conectar|desconectar`, `/help`.
- [x] Autocomplete (`CommandSystem.autocomplete`) implementado como função pura, pronta para a UI consumir.
- [x] **Wiring real concluído**: `chatOverlay.onCommand` chama `commandSystem.execute` localmente (host/single-player) ou repassa via `peerSync.sendToHost` (guest); o host recebe comandos remotos (`peerSync.onMessage` → `case 'command'`) e responde pelo chat. Testado no navegador: `/help` e `/gamemode survival` funcionaram de ponta a ponta.
- [ ] Log de comandos executados visível para OPs (histórico dedicado, além do próprio chat) — não implementado.
- [x] "Host/single-player sempre OP por padrão": `localIsOp = true` fixo em `main.ts` para quem não é guest; peers remotos entram sem OP e podem ser promovidos via `/op`.

---

## 9. Mapeamento Técnico (Módulos Novos ↔ Arquivos)

Todos os arquivos abaixo **já existem no repositório e estão plugados em `main.ts`** (validado com `tsc --noEmit`, `npm run build` e uma sessão de teste real no navegador via Playwright headless):

| Sistema | Arquivo | Status |
|---|---|---|
| Menu Principal | `src/ui/MainMenu.ts` | ✅ criado e plugado — testado |
| Wizard de criação de mundo | `src/ui/WorldCreationWizard.ts` | ✅ criado e plugado — testado |
| Gerenciador central de UI | `src/ui/UIManager.ts` | ✅ criado e plugado — testado |
| Pause Menu unificado | `src/ui/PauseMenu.ts` | ✅ criado e plugado — testado (todas as abas) |
| Chat com abas (IA + Mundo) | `src/ui/ChatOverlay.ts` | ✅ criado e plugado — testado (`/help`, `/gamemode`) |
| Ferramentas MCP de UI | `src/ai/UIExecutors.ts` | ✅ criado e registrado no MCP (não testado via LLM real nesta sessão) |
| Estruturas prontas + preview | `src/crafting/StructureTemplates.ts` | ✅ criado, testado no navegador |
| Ferramenta MCP `stamp_structure` | `src/ai/MCPExecutors.ts` | ✅ criado e testado via chamada direta (`small_house`: 3699 mini-blocos, rápido) |
| Sinalização P2P | `src/net/SignalingClient.ts` | ✅ criado e plugado — testado com relay real |
| Sincronização P2P | `src/net/PeerSync.ts` | ✅ criado e plugado — **testado com 2 clientes reais**, 1 bug crítico encontrado e corrigido (canal do guest nunca era salvo), reconexão automática adicionada |
| Modos de jogo | `src/game/GameModeManager.ts` | ✅ criado e plugado — testado (survival mudou câmera/regras ao vivo) |
| Sobrevivência | `src/game/SurvivalSystem.ts` | ✅ criado e plugado — dano de queda confirmado no teste |
| Itens dropados | `src/game/ItemDropSystem.ts` | ✅ criado e plugado |
| Crafting 6x6 | `src/crafting/CraftingSystem.ts` | ✅ criado e integrado ao `InventoryModal` — testado visualmente |
| Comandos & OP | `src/commands/CommandSystem.ts` | ✅ criado e plugado — testado (`/help`, `/gamemode`) |
| Save de jogador | tabela `players` em `src/storage/Database.ts` | ✅ criado, autosave e restauração plugados |
| Protocolo de rede | `docs/NETWORK_PROTOCOL.md` | ✅ documentado |
| Relay de sinalização (opcional) | `relay/server.js` | ✅ criado **e testado de verdade** rodando localmente contra 2 clientes (`npm install` + `npm start`, `ws://localhost:8787`) |

**Pendências reais que sobraram** (ver seções 5, 8 e 10): promoção remota completa de modo para peers (hoje `setGameMode` num alvo remoto só valida que ele existe, não aplica de fato — precisa de um `player_state`/comando dedicado indo até o peer certo), teste contra STUN/TURN reais pela internet (só testado localhost-localhost, onde candidatos locais bastam), log de comandos dedicado para auditoria de OP, drag-and-drop de crafting, testes de integração do `Interaction` com `World` real.

---

## 10. Riscos, Decisões em Aberto & Pontos para Validar com o Usuário
- [x] Relay mínimo de sinalização confirmado como aceitável (autorizado pelo próprio usuário no Modo Adventure) — implementado como `relay/server.js`, opcional e não hospedado por padrão.
- [x] Comportamento "host fecha aba → sessão encerra para convidados" assumido como esperado, documentado em `NETWORK_PROTOCOL.md`.
- [x] Crafting 6×6 confirmado como intencional (pedido explícito do usuário).
- [ ] `RTCPeerConnection` nativo foi a escolha feita (sem lib auxiliar tipo PeerJS) — ainda vale reavaliar depois de testar com o relay real rodando.
- [ ] Limite de jogadores simultâneos por sala — modelo host-estrela adotado, mas nenhum limite explícito foi codificado ainda.

---

## 11. Testes Automatizados (nova seção — 23/07/2026, implementada no mesmo dia)
Pedido explícito do usuário: ter testes automatizados que verificam o funcionamento, não só builds manuais no navegador a cada rodada.

- [x] **Vitest** configurado (`npm test` → `vitest run`), zero-config extra por já usar o Vite.
- [x] Testes unitários criados em `tests/unit/` — **46 testes, 6 arquivos, todos passando**:
  - [x] `craftingSystem.test.ts`: receitas shaped (bounding-box, inclusive deslocada de posição) e shapeless (contagem certa/errada/mistura inválida), receita de ferramenta devolvendo `outputTool`.
  - [x] `gameModeManager.test.ts`: os 5 modos com a combinação certa de `canBreak`/`canPlace`/`canFly`/`hasSurvival`/`hasCreativeInventory`.
  - [x] `commandSystem.test.ts`: permissão negada sem OP (`/op`, `/gamemode <alvo>`, `/crom conectar`), `/gamemode` no próprio jogador sem OP, `/tp` sempre permitido, `/help` sempre acessível, comando desconhecido, autocomplete.
  - [x] `blocks.test.ts`: `isSolid`/`isOpaque`/`isReplaceable`/`isSupport`/`isDecor` para amostra representativa incluindo `B.LAVA`; `minToolTier` por bloco; flag `interactive`.
  - [x] `survivalSystem.test.ts`: dano de queda só acima do limiar, afogamento só após ~3s, lava com dano imediato, fome decaindo, morte disparando `onDeath` uma vez, `reset()`.
  - [x] `structureTemplates.test.ts`: os 4 templates existem, todo bloco referenciado existe em `BLOCKS`, nenhum bloco abaixo do chão (`dy >= 0`).
- [ ] Testes de integração leve de `Interaction` com `World` real (sem renderer) — não implementados nesta rodada (a cobertura de `awardDrop`/stamping ficou só na verificação manual via navegador, ver abaixo).
- [x] Smoke test end-to-end via Playwright headless (não é dependência permanente do projeto — instalado à parte na sessão): MainMenu → Wizard (Criativo) → jogo carrega → inventário/Itens → estrutura selecionada → preview visível → Pause Menu → `/gamemode survival` → Ctrl+1 bloqueado com toast. `console --errors` vazio em todas as etapas.
- [x] Removidas como bônus desta faxina: dependências mortas `@babylonjs/core`, `@babylonjs/gui`, `@babylonjs/loaders` e `earcut` no `package.json` (heranças do motor Babylon já removido na sessão anterior, nunca importadas em lugar nenhum).
- [x] `README.md` criado na raiz com instruções de `npm test`, `npm run dev`, `npm run build` e como rodar o relay opcional.
- [x] **Bug crítico de performance encontrado através dos próprios testes**: `fill_box`/`stamp_structure`/`execute_voxel_script` chamam `WorldRepository.saveBlockModBatch`, que fazia 1 leitura + 1 escrita **sequencial por bloco** no IndexedDB. Um `fill_box` de 27 blocos levou 4534ms; uma estrutura de ~650 mini-blocos passava de 1 minuto e um teste automatizado achou que tinha travado. Reescrito para usar `bulkPut`/`bulkDelete` de verdade (1 leitura em lote + no máximo 2 escritas em lote, não importa o tamanho do lote): os mesmos 27 blocos caíram para 6,8ms. Isso é plausivelmente uma causa direta de construções grandes da IA parecerem travadas/incompletas.

## 12. Templates de Estrutura no Criativo (Árvore, Casa, Torre, Muro) + Preview Transparente (nova seção — 23/07/2026, implementada no mesmo dia)
Pedido: no modo Criativo, ter "edifícios" como item colocável — igual uma árvore (estrutura pronta), não só blocos individuais — com um preview transparente do que vai ser colocado antes de confirmar.

- [x] `src/crafting/StructureTemplates.ts` criado: cada template é gerado por função como lista de blocos relativos `{dx, dy, dz, block}`:
  - [x] Árvore (tronco de `B.LOG` + copa em camadas de `B.LEAVES`)
  - [x] Casa Pequena (piso, paredes ocas de `B.STONE_BRICK`, vão de porta, janelas de `B.GLASS`, telhado, luz de `B.GLOWSTONE`)
  - [x] Torre (anel de `B.STONE_BRICK` com ameias alternadas no topo)
  - [x] Muro (segmento reto de `B.COBBLE`, comprimento configurável)
- [x] `HotbarSlot` estendido com `structureId?: string` (mutuamente exclusivo com `toolTier`).
- [x] `Interaction.ts` estendido:
  - [x] **Preview transparente** (`structurePreview: THREE.Group`): meshes semi-transparentes (opacidade 0.5, ajustada de 0.35 após teste visual mostrar que ficava sutil demais) + contorno branco nítido (`EdgesGeometry`) por bloco do template, reconstruído só quando a estrutura selecionada muda e reposicionado a cada frame.
  - [x] `stampStructure()`: ao colocar, grava todos os blocos do template de uma vez no `World` (cada unidade do template preenchendo um cubo `SCALE³` de mini-voxels, igual a um bloco macro normal), disparando `onBlockChange` por bloco para sincronizar com peers.
- [x] Estruturas adicionadas como cards clicáveis na aba **Itens** do `InventoryModal`, com ícone 🏗️ distinto tanto no card quanto na hotbar.
- [x] **Testado e confirmado no navegador**: os 4 templates aparecem na aba Itens; selecionar "Árvore" mostra o preview transparente com contorno branco corretamente posicionado à frente do jogador (verificado tanto visualmente quanto inspecionando o estado interno via script — grupo com 59 meshes, visível, posição coerente).
- [x] Ferramenta MCP `stamp_structure(template_id, x, y, z)` criada e registrada em `MCPRegistry.ts`, exposta à IA. **Testada via chamada direta** (bypassando a LLM): `small_house` colocou 3699 mini-blocos corretamente, `template_id` inválido devolve mensagem de erro amigável em vez de travar. Referenciada no system prompt como atalho preferencial para essas 4 estruturas.

## 13. Restrição de Câmera por Modo de Jogo (nova seção — 23/07/2026, implementada no mesmo dia)
Pedido: o modo de câmera "de cima" (Top-Down) só deve ser acessível no modo Criativo.

- [x] `Ctrl+1` só executa `cameraManager.setMode('topdown')` quando `gameModeManager.mode === 'creative'`; caso contrário mostra o toast "Visão Top-Down só é acessível no Modo Criativo." — **testado no navegador**: em Modo Sobrevivência, `Ctrl+1` manteve a câmera em Primeira Pessoa e exibiu o toast corretamente.
- [x] `HUD.cycleCameraMode` (badge clicável) recebe `canUseTopdown: () => boolean` e pula a opção Top-Down fora do Criativo.
- [x] Select de câmera manual na aba **Jogador** do `PauseMenu` também esconde a opção Top-Down fora do Criativo.
- [x] O Modo Clássico continua tendo Top-Down como câmera padrão automaticamente ao entrar no modo (via `GameModeManager.setMode`, não pelo atalho manual — não afetado por esta restrição).

---

## 14. Ordem de Execução Sugerida — status

1. ✅ **Fase 1 — Fundação e confiabilidade da IA**: concluída (seção 0 e 1; só o enriquecimento fino do system prompt textual e a auditoria de nomes de blocos ficaram de fora).
2. ✅ **Fase 2 — UX/UI**: `UIManager`, `PauseMenu`, `MainMenu`, `WorldCreationWizard` e a aba Chat do Mundo criados, plugados em `main.ts` e testados no navegador.
3. ✅ **Fase 3 — Modos de jogo e save**: `GameModeManager`, tabela `players`, autosave e restauração de estado do jogador todos plugados e testados.
4. ✅ **Fase 4 — Sobrevivência e crafting**: `SurvivalSystem`, `ItemDropSystem` e `CraftingSystem` criados, religados ao loop principal e confirmados no navegador (dano de queda real ao trocar de modo).
5. ✅ **Fase 5 — Multiplayer P2P**: `PeerSync`, `SignalingClient`, protocolo, relay de referência e todo o roteamento (`?join=`, comandos remotos, chat, block sync) implementados, plugados e **testados de verdade com 2 clientes contra o relay rodando localmente** — 1 bug crítico encontrado (canal do guest) e corrigido. Falta só validar contra STUN/TURN reais pela internet (fora de localhost) e a promoção remota completa de modo.
6. ⏳ **Fase 6 — Frontend agentic**: `UIExecutors.ts` criado e registrado nas ferramentas MCP; ainda não exercitado com uma LLM real numa sessão de chat ao vivo.
7. ✅ **Fase 7 — Testes automatizados** (seção 11): Vitest configurado, 46 testes em 6 arquivos, todos passando; smoke tests via Playwright acharam 3 bugs reais nesta rodada.
8. ✅ **Fase 8 — Templates de estrutura + preview transparente** (seção 12): árvore/casa/torre/muro como itens no Criativo, preview transparente com contorno, testado no navegador, e ferramenta MCP `stamp_structure` testada diretamente.
9. ✅ **Fase 9 — Restrição de câmera por modo** (seção 13): Top-Down só no Criativo, com toast, testado no navegador em Modo Sobrevivência.
10. ✅ **Fase 10 — Rodada de verificação e correção (24/07/2026)**: indicador de rede + reconexão automática, roster/OP no Pause Menu, `saveVersion`, auditoria de nomes de blocos (2 bugs corrigidos), `README.md`, e a otimização crítica de performance do `saveBlockModBatch`.
