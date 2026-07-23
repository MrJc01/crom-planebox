# Registro Completo dos Requisitos do Usuário (Crom Planebox)

Este documento registra detalhadamente todas as especificações e solicitações feitas pelo usuário para o projeto **Crom Planebox**.

---

## 📌 Requisitos Principais & Funcionalidades

### 1. Tecnologia & Plataforma
- **Linguagem**: TypeScript puro com modularização rigorosa.
- **Engine 3D**: Babylon.js.
- **Execução**: 100% Client-Side no navegador (Single Page Application - SPA).
- **Sem Recarregamento de Página**: A página **NUNCA** deve atualizar ao carregar, resetar, alternar ou importar mundos.
- **Persistência Local**: Todo o armazenamento (mundos, blocos modificados, histórico de chat, configurações) deve ser feito localmente no navegador utilizando **IndexedDB** (Dexie.js) e **localStorage**.

### 2. Estilo do Mundo & Voxels
- **Blocos Pequenos (Micro-blocos)**: Estilo Vintage Story / Voxel de alta densidade (tamanho do bloco ajustado para 0.5 unidades).
- **Mundo Superflat Infinito em Chunks**: O terreno padrão é um plano infinito gerado em chunks retangulares ($16 \times 16 \times 16$).
- **Reconfiguração e Reset**:
  - Capacidade de resetar o mundo limpando blocos colocados.
  - O usuário ou a IA podem reconfigurar os parâmetros do chunk (altura do solo, bloco da superfície, bloco do subsolo).

### 3. Visões e Câmeras
- **Visão Inicial Top-Down**: Ao abrir, a câmera começa no topo olhando de cima em ângulo aéreo.
- **Modo Primeira Pessoa (FPS)**: Câmera com trava de mouse (Pointer Lock), movimentação WASD, pulo e controle de **FOV** e **Tamanho de Visão (Render Distance)**.
- **Modo Fantasma (Ghost / Fly)**: Câmera livre no-clip para voar através de blocos e inspecionar interiores de construções.

### 4. Interface (HUD, Atalhos & Modais)
- **Teclas de Atalho**:
  - **`T`**: Abre o chat de texto no canto inferior esquerdo e foca no campo de input.
  - **`ESC`**: Pausa a cena 3D, libera o cursor do mouse e abre o **Modal de Configurações & Mundos**.
- **Popup / Modal de Configurações**:
  - Configuração da API do **OpenRouter** (API Key, Seleção de Modelo como Claude 3.5 Sonnet, Gemini Flash, etc., System Prompt).
  - Configuração de Gráficos (FOV, Distância de Renderização em Chunks).
- **Gerenciador de Mundos & Exportação/Importação**:
  - Salvar múltiplos mundos independentes.
  - **Histórico de Chat Isolado por Mundo**: Cada mundo possui seu próprio histórico de conversas com a IA.
  - **Exportar Tudo**: Exportação completa do mundo (dados do mapa, blocos alterados, configurações e histórico de chat) em um arquivo `.json` baixável.
  - **Importar Tudo**: Importação completa de arquivos `.json` restaurando o mundo e todas as conversas sem dar reload na página.

### 5. Agente LLM Inteligente + Servidor MCP (Model Context Protocol)
- **Interação no Mundo 3D**: O chatbot usa o protocolo MCP para executar ações de construção no mapa (`fill_box`, `set_block`, `spawn_structure`, `reset_world`, `reconfigure_chunk`).
- **Visão & Autocorreção via Screenshots**:
  - O modelo de IA pode definir a posição de uma câmera virtual no espaço 3D usando MCP, tirar um print/screenshot da tela e receber a imagem no chat.
  - A IA usa essa imagem para validar se o que construiu ficou correto e aplicar correções autônomas caso haja erros.
- **Busca no Histórico e Código**: O modelo pode consultar todo o seu próprio histórico de chat e a documentação do projeto via ferramentas MCP.

### 6. Arquitetura do Código
- **Modular, Isolado e Independente**: Separação estrita de responsabilidades (`src/engine/`, `src/voxel/`, `src/ai/`, `src/storage/`, `src/ui/`, `src/input/`).
