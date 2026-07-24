# Arquitetura do Projeto Crom Planebox (Voxel 3D + MCP + OpenRouter LLM)

> **Nota de correção (23/07/2026)**: versões anteriores deste documento descreviam Babylon.js como engine 3D. Isso estava desatualizado — o motor real em execução é **Three.js puro**. O código Babylon (`src/voxel/*`) era legado morto (nunca importado por `main.ts`) e foi removido do projeto. Este documento agora reflete o que de fato roda.

O **Crom Planebox** é um ambiente 3D interativo construído em **TypeScript** e **Three.js**, permitindo a exploração de mundos voxels em chunks infinitos (superflat, gerados em um Web Worker) e a construção assistida por Inteligência Artificial via o protocolo **MCP (Model Context Protocol)** e a API do **OpenRouter** / Google AI Studio.

---

## 🏗 Visão Geral dos Subsistemas

```
 ┌─────────────────────────────────────────────────────────┐
 │                      Interface UI                       │
 │  MainMenu → WorldCreationWizard → HUD | Chat (T) |       │
 │  PauseMenu em abas (ESC) | InventoryModal (E)            │
 └────────────────────────────┬────────────────────────────┘
                              │
 ┌────────────────────────────▼────────────────────────────┐
 │         GameModeManager (Classic/Survival/Ghost/          │
 │         Creative/Adventure) & Input (main.ts)             │
 └──────────────┬───────────────────────────┬──────────────┘
                │                           │
 ┌──────────────▼───────────┐   ┌───────────▼──────────────┐
 │  Camera & Render Engine   │   │   AI & MCP Tool Engine    │
 │  (Three.js WebGLRenderer) │   │  (OpenRouter/Gemini +     │
 │  CameraManager: topdown/  │   │   MCPExecutors + UI       │
 │  fps/ghost                │   │   Executors)              │
 └──────────────┬───────────┘   └───────────┬──────────────┘
                │                           │
 ┌──────────────▼───────────────────────────▼──────────────┐
 │           World & ChunkManager (src/world/)              │
 │   (Web Worker de geração, meshing, terreno superflat,     │
 │    diffs de blocos, física de voxel)                      │
 └────────────────────────────┬────────────────────────────┘
                              │
 ┌────────────────────────────▼────────────────────────────┐
 │       Rede P2P opcional (src/net/) — WorldRepository      │
 │       host-autoritativo, sincroniza diffs JSON             │
 └────────────────────────────┬────────────────────────────┘
                              │
 ┌────────────────────────────▼────────────────────────────┐
 │              IndexedDB Storage (Dexie.js)                │
 │   (Mundos, Modificações de Chunks, Jogadores, Chat Logs,  │
 │    Customizações de UI da IA)                              │
 └─────────────────────────────────────────────────────────┘
```

---

## 📁 Estrutura de Módulos (`/src`)

- **`src/world/`** (motor de voxels real, Three.js):
  - `world.ts` / `chunk.ts`: `World` e `Chunk` — grade de voxels em chunks (`CX`×`CZ`), diffs por bloco.
  - `worldgen.ts` / `genWorker.ts`: geração procedural de terreno rodando em Web Worker (não trava a thread principal).
  - `mesher.ts`: geração de geometria (malhas sólida/água/vidro) por chunk.
  - `physics.ts`: física simples de voxel (queda de areia/cascalho, derrubar árvores).
  - `blocks.ts`: enum `B` e `BLOCKS` — definição de todos os tipos de bloco, cores por face e propriedades (`solid`, `opaque`, `gravity`, `drops`).

- **`src/engine/`**:
  - `CameraManager.ts`: 3 modos de câmera Three.js — Top-Down (órbita RTS), Primeira Pessoa (FPS) e Fantasma (Ghost/Fly noclip).

- **`src/player/`**:
  - `controller.ts`: `PlayerController` — física de jogador em mini-voxels (colisão AABB vs voxels, pulo, nado, voo, auto-step).
  - `interaction.ts`: raycast DDA, quebrar/colocar bloco, modo Box, hotbar.

- **`src/render/scene.ts`**: cena Three.js (sol, sombras, névoa, curvatura de horizonte, materiais dos chunks).

- **`src/entities/EntitySystem.ts`**: NPCs/criaturas 3D geradas pela IA (partes proceduais, scripts de comportamento).

- **`src/events/EventSystem.ts`**: eventos de mundo disparados pela IA (vulcão, raio, terremoto, meteoro, bênção).

- **`src/ai/`**:
  - `OpenRouterClient.ts`: cliente HTTP com streaming e tool-calling (OpenRouter / Google AI Studio).
  - `MCPRegistry.ts`: schemas JSON das ferramentas MCP expostas à LLM.
  - `MCPExecutors.ts`: execução real das ferramentas no mundo 3D (`set_block`, `fill_box`, `execute_voxel_script`, `capture_snapshot`, etc.).
  - `WorldPerception.ts`: análise de terreno/bioma e resumo do mundo para dar contexto à IA.

- **`src/storage/`**:
  - `Database.ts`: schema Dexie/IndexedDB (`CromPlaneboxDB`) — mundos, diffs de blocos, chat, jogadores, customizações de UI.
  - `WorldRepository.ts`: CRUD de mundos, diffs, chat, jogadores e export/import completo.
  - `UndoManager.ts`: histórico de undo/redo de alterações de blocos.

- **`src/ui/`**: componentes flutuantes em CSS/HTML Vanilla sobre o canvas (`HUD`, `ChatOverlay`, `InventoryModal`, `SettingsModal`/`PauseMenu`, `MainMenu`, `WorldCreationWizard`).

---

## 🔄 Fluxo de Funcionamento da LLM & Visão
1. O usuário abre o chat digitando `T` ou clicando no chat no canto esquerdo.
2. O usuário envia um pedido (ex: *"Construa um castelo com uma torre no centro e tire uma foto"*).
3. O `OpenRouterClient` envia o prompt + catálogo MCP + contexto de localização (`ChatOverlay.getLocationContext`).
4. A LLM invoca `execute_voxel_script` / `fill_box` / `set_block` para montar o objeto no mundo Voxel.
5. A LLM invoca `capture_snapshot` (ou o multi-ângulo automático) passando coordenadas e rotação.
6. O `MCPExecutors` renderiza a câmera de snapshot offscreen com o `THREE.WebGLRenderer` real e devolve a imagem base64 no chat para o modelo validar visualmente a construção.

> Ver `docs/CHECKLIST_EVOLUCAO.md` para o roadmap detalhado de multiplayer P2P, modos de jogo, crafting e sobrevivência construídos sobre esta base.
