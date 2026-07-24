# Crom Planebox

Sandbox voxel 3D em Three.js, com assistente de IA agentico (MCP + OpenRouter/Google AI Studio), 5 modos de jogo, crafting, sobrevivência e multiplayer P2P opcional — tudo 100% client-side, sem backend de jogo.

## Rodando localmente

```bash
npm install
npm run dev
```

Abra o endereço que o Vite mostrar (geralmente `http://localhost:5173`). Nenhum passo de servidor é necessário para jogar sozinho — tudo roda no navegador com IndexedDB (Dexie) para persistência.

## Testes automatizados

```bash
npm test
```

Roda a suíte de testes unitários (Vitest) em `tests/unit/`: `CraftingSystem`, `GameModeManager`, `CommandSystem`, `blocks.ts`, `SurvivalSystem` e `StructureTemplates`. São testes de lógica pura (sem DOM/WebGL), então rodam em milissegundos e não precisam de navegador.

Esses testes **não** cobrem renderização 3D, física de colisão ou sincronização de rede — para isso, veja a seção de smoke test manual abaixo.

## Build de produção

```bash
npm run build   # tsc --noEmit + vite build
npm run preview # serve o build de dist/
```

## Multiplayer P2P (opcional)

Por padrão o mundo é 100% local. Para testar o multiplayer, é preciso rodar o relay mínimo de sinalização (não guarda nenhum dado de jogo — só troca handshake WebRTC e mantém a lista de salas abertas):

```bash
cd relay
npm install
npm start   # ouve em ws://localhost:8787 por padrão
```

No jogo, abra o Pause Menu (`ESC`) → aba **Multiplayer** → cole `ws://localhost:8787` em "URL do Relay da Crom" → **Conectar à Crom**. Copie o link de convite gerado e abra em outra aba/navegador para entrar como visitante.

Ver `docs/NETWORK_PROTOCOL.md` para o protocolo completo e `docs/CHECKLIST_EVOLUCAO.md` para o histórico de testes reais já feitos (incluindo bugs encontrados e corrigidos).

## Documentação

- `docs/ARCHITECTURE.md` — arquitetura real do motor (Three.js, Web Worker de geração, etc.)
- `docs/CONTROLS_AND_FEATURES.md` — atalhos de teclado e controles
- `docs/MCP_TOOLS.md` — ferramentas MCP disponíveis para a IA
- `docs/NETWORK_PROTOCOL.md` — protocolo de sincronização P2P
- `docs/CHECKLIST_EVOLUCAO.md` — checklist detalhado de evolução do projeto (o que já foi feito, testado e o que falta)
