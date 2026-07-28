# Referência Única da Mod API (Itens 887 & 888 P1)

> **Fonte Única de Verdade**: Este documento descreve os métodos, eventos e ferramentas expostos para scripts de mods e pelo Model Context Protocol (MCP) no **Crom Planebox**.

---

## 📌 Visão Geral do Ambiente de Execução do Mod

Os scripts de mods executam dentro de um **Web Worker isolado** (`src/mods/ModRuntime.ts`) com acesso à ponte de host autoritativa (`ModHostBridge` em `src/mods/ModAPI.ts`).

- **Isolamento de Threads**: Scripts de mods não têm acesso ao DOM, `window`, `document` nem `fetch` global.
- **Rede Controlada**: Toda comunicação de rede é realizada via `modFetch` / `RedeDeMods`.

---

## 🛠 Métodos da API (`mod`)

### 1. Sistema de Eventos
```typescript
mod.on(evento: string, callback: (dados: any) => void): void
```
Inscreve o mod para reagir a eventos do mundo 3D.
- Eventos comuns: `'block_break'`, `'block_place'`, `'player_spawn'`, `'time_change'`, `'weather_change'`.

### 2. Manipulação de Voxels e Blocos
```typescript
mod.setBlock(x: number, y: number, z: number, blockId: number): void
mod.getBlock(x: number, y: number, z: number): number
mod.fillBox(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number, blockId: number): void
```
Permite ler ou alterar a grade de voxels.

### 3. Chamadas de Rede Controladas (`modFetch`)
```typescript
modFetch(url: string, options?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{ status: number; ok: boolean; texto: string }>
```
Executa chamadas HTTP para hosts previamente declarados no `capabilities.network.allow` do manifesto.

### 4. Configuração e Variáveis de Ambiente (`modEnv`)
```typescript
modEnv.get(chave: string): string | undefined
```
Lê uma variável de ambiente configurada no `mod.env` do mod (suporta herança de `$GLOBAL`).

---

## 🤖 Ferramentas MCP para Agentes de IA

| Ferramenta MCP | Descrição |
| :--- | :--- |
| `list_mods` | Lista todos os mods ativos e seus status (ativo, quarentena, erro). |
| `read_mod` | Inspeciona os arquivos e o esquema de um mod (somente leitura). |
| `set_mod_env` | Define chaves de ambiente não-sensíveis para um mod. |
| `inspect_project_structure` | Retorna a estrutura do projeto e arquivos modificados na sessão. |
| `check_session_budget` | Verifica o orçamento de edições e tempo restante da sessão. |
