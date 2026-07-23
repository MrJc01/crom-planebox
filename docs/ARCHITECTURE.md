# Arquitetura do Projeto Crom Planebox (Voxel 3D + MCP + OpenRouter LLM)

O **Crom Planebox** é um ambiente 3D interativo construído em **TypeScript** e **Babylon.js**, permitindo a exploração de mundos voxels em chunks infinitos e a construção assistida por Inteligência Artificial via o protocolo **MCP (Model Context Protocol)** e a API do **OpenRouter**.

---

## 🏗 Visão Geral dos Subsistemas

```
 ┌─────────────────────────────────────────────────────────┐
 │                      Interface UI                       │
 │    HUD | Chat Overlay (T) | Settings/Pause Modal (ESC)  │
 └────────────────────────────┬────────────────────────────┘
                              │
 ┌────────────────────────────▼────────────────────────────┐
 │              InputManager & Control Layer               │
 └──────────────┬───────────────────────────┬──────────────┘
                │                           │
 ┌──────────────▼───────────┐   ┌───────────▼──────────────┐
 │    Camera & Render Engine │   │   AI & MCP Tool Engine   │
 │   (Babylon.js Engine)    │   │  (OpenRouter + Tools)    │
 └──────────────┬───────────┘   └───────────┬──────────────┘
                │                           │
 ┌──────────────▼───────────────────────────▼──────────────┐
 │             VoxelWorld & ChunkManager                   │
 │   (Greedy Meshing, Terreno Superflat, Blocos Diff)      │
 └────────────────────────────┬────────────────────────────┘
                              │
 ┌────────────────────────────▼────────────────────────────┐
 │              IndexedDB Storage (Dexie.js)               │
 │       (Mundos, Modificações de Chunks, Chat Logs)       │
 └─────────────────────────────────────────────────────────┘
```

---

## 📁 Estrutura de Módulos (`/src`)

- **`src/engine/`**:
  - `EngineManager.ts`: Inicialização do Canvas 3D, loop de renderização, iluminação e gerenciamento do ciclo de vida da cena Babylon.js.
  - `CameraManager.ts`: Gerencia as 3 visões do sistema: Top-Down (visão aérea), Primeira Pessoa (FPS com FOV e Render Distance) e Fantasma (Ghost/Fly sem colisão). Possui também a `SnapshotCamera` para visão da LLM.

- **`src/voxel/`**:
  - `BlockTypes.ts`: Enumeração de blocos, cores, transparências e emissividade.
  - `Chunk.ts`: Representação tridimensional ($16 \times 16 \times 16$) de voxels.
  - `GreedyMesher.ts`: Algoritmo otimizado para unir faces visíveis contíguas de blocos em malhas únicas para alta taxa de quadros (FPS).
  - `ChunkManager.ts`: Geração infinita procedural superflat e manipulação dinâmica de blocos.

- **`src/ai/`**:
  - `OpenRouterClient.ts`: Cliente HTTP para chamadas com streaming e suporte a ferramentas (Function Calling) com a API do OpenRouter.
  - `MCPRegistry.ts`: Declaração dos schemas JSON das ferramentas MCP expostas à LLM.
  - `MCPExecutors.ts`: Execução em tempo real das ferramentas no mundo 3D (ex: construir, limpar, alterar parâmetros de chunks, tirar snapshots).

- **`src/storage/`**:
  - `Database.ts`: Configuração do Dexie/IndexedDB para salvar estados dos mundos e histórico do chat sem recarregar a página.
  - `WorldRepository.ts`: CRUD de mundos e diffs de blocos.

- **`src/ui/`**:
  - Componentes gráficos flutuantes em CSS/HTML Vanilla sobre o canvas Babylon.js.

---

## 🔄 Fluxo de Funcionamento da LLM & Visão
1. O usuário abre o chat digitando `T` ou clicando no chat no canto esquerdo.
2. O usuário envia um pedido (ex: *"Construa um castelo com uma torre no centro e tire uma foto"*).
3. O `OpenRouterClient` envia o prompt + catálogo MCP.
4. A LLM invoca `build_structure` / `set_block` para montar o objeto no mundo Voxel.
5. A LLM invoca `capture_snapshot` passando coordenadas e rotação.
6. A `CameraManager` posiciona a câmera de snapshot offscreen, renderiza a imagem base64 e devolve no chat para o modelo validar visualmente a construção.
