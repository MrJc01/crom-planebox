# Changelog — Crom Planebox (Item 517 P1)

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.
O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [1.1.0] - 2026-07-28

### Adicionado
- **Suporte a Canal de Voz de Áudio**: Adicionado canal `'voice'` separado em `AudioSystem` para controle independente de volume de voz do jogador.
- **Canal de Rede de Mods com Modo Offline Global**: Método `setModoOffline(true)` em `RedeDeMods` permitindo desligar instantaneamente todas as conexões externas de mods.
- **Ferramenta MCP `run_mod_script`**: Permite aos agentes de IA testarem scripts de mods em sandbox sem salvar no pacote do mod.
- **Resolução e Herança de Variáveis de Ambiente Globais**: Suporte a `$GLOBAL` e sobrescritas de chaves locais por mod em `ModEnv.ts`.
- **Aba "Meu Estoque" no Inventário de Sobrevivência**: Exibição dos itens coletados pelo jogador na hotbar, com contadores e barras de durabilidade.

### Corrigido
- **Abertura do Inventário no Modo Sobrevivência**: `InventoryModal` não fica mais bloqueado quando `hasCreativeInventory` é `false`.
- **Escala de Mobs e Entidades**: Aplicado `group.scale.setScalar(ESCALA_MODELO)` em `EntitySystem.spawnEntity()`, ajustando a proporção de 1.7m para 5.3 unidades de mundo.
- **Foco do Chat no Modo Sobrevivência**: Foco assíncrono em `ChatOverlay` aguarda a liberação do pointer lock.
- **Detecção de Erros de CORS**: Mensagem descritiva exibida quando uma requisição HTTP externa é bloqueada pelo navegador.

---

## [1.0.0] - 2026-07-20

### Adicionado
- **Engine Voxel em Three.js**: Substituição completa do legado Babylon por Three.js nativo.
- **Protocolo MCP e Suporte LLM**: Integração com OpenRouter / Google AI Studio para geração procedural de voxels por agentes de IA.
- **Multiplayer P2P com WebRTC**: Suporte a host autoritativo e sincronização de diffs de mundo.
- **Storage Persistente**: Armazenamento IndexedDB com Dexie.js para mundos, mods e inventários.
