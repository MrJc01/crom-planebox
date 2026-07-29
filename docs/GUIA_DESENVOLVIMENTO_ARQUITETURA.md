# Guia de Desenvolvimento e Arquitetura do Crom-Planebox

## 🧪 Testes Automatizados

O projeto utiliza **Vitest** como runner oficial de testes unitários e de integração.

### Comandos de Teste:
- **Execução Única (CI/Produção)**:
  ```bash
  npm test
  ```
- **Modo Watch (Desenvolvimento)**:
  `npm run test:watch` (Executa os testes em tempo real observando alterações em `src/` e `tests/`).
  ```bash
  npm run test:watch
  ```

---

## 🏗️ Build e Deploy de Produção (Itens 518 & 519 P2)

### Build de Produção com Source Maps:
```bash
npm run build
```
O build é compilado no diretório `dist/` gerando os bundles otimizados em JavaScript e CSS acompanhados de *source maps* (`.map`) para facilitar depuração em ambiente de produção.

### Deploy Estático (GitHub Pages / Vercel / Netlify):
O artefato gerado na pasta `dist/` é um aplicativo SPA 100% estático sem dependências de servidor backend. Pode ser publicado diretamente em plataformas como GitHub Pages via GitHub Actions:

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

---

## 🏛️ Arquitetura do Projeto

- `src/core/`: Motores de aleatoriedade determinística (RNG, hashing), utilitários e ruído procedural (Simplex 2D/3D).
- `src/world/`: Geração de terreno em voxels, biomas, física, colisão e persistência.
- `src/render/`: Renderizador Three.js, shaders, iluminação, curvatura planetária e pós-processamento.
- `src/entities/`: Ecossistema de criaturas (NPCs, IA de rebanho, rotinas, facções).
- `src/crafting/`: Receitas, economia de vilas, reparo de ferramentas e auto-crafting.
- `src/mods/`: Sandbox e API de mods em tempo de execução.
- `src/net/`: Comunicação P2P WebRTC, sincronização de estado e protocolo de rede.
