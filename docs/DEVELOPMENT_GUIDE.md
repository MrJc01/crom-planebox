# Guia do Desenvolvedor

Instruções para executar, testar e expandir o projeto **Crom Planebox**.

---

## 🚀 Como Executar o Projeto Localmente

1. Instalar as dependências:
```bash
npm install
```

2. Iniciar o servidor de desenvolvimento:
```bash
npm run dev
```

3. Abrir o endereço fornecido no navegador (ex: `http://localhost:5173`).

---

## 🔑 Configuração da API do OpenRouter

Para habilitar a construção inteligente e ferramentas MCP via LLM:
1. Abra a aplicação no navegador.
2. Pressione a tecla **`ESC`** para abrir o modal de **Configurações**.
3. Insira sua **Chave de API do OpenRouter** (`sk-or-v1-...`).
4. Selecione o modelo desejado (ex: `anthropic/claude-3.5-sonnet` ou `google/gemini-2.5-flash`).
5. Feche o modal e aperte **`T`** para conversar com o assistente 3D.

---

## 🧱 Como Adicionar Novos Tipos de Blocos

Para incluir um novo bloco no sistema:
1. Edite `src/voxel/BlockTypes.ts`.
2. Adicione o novo valor ao enum `BlockType`.
3. Adicione a definição em `BLOCK_DEFINITIONS` com nome, cor HEX, rugosidade (`roughness`), transparência ou emissividade.
