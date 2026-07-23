# Especificação de Ferramentas MCP (Model Context Protocol)

As ferramentas MCP abaixo permitem que modelos de Inteligência Artificial (LLMs configuradas no OpenRouter) interajam diretamente com o mundo 3D, consultem dados e utilizem visão computacional via captura de imagem.

---

## 🛠 Ferramentas de Construção & Manipulação do Mundo

### `set_block`
Coloca ou remove um único bloco em uma coordenada $(X, Y, Z)$ específica.
- **Parâmetros**:
  - `x` (number): Coordenada X.
  - `y` (number): Coordenada Y.
  - `z` (number): Coordenada Z.
  - `block_type` (string/number): Nome ou ID do bloco (ex: `GRASS`, `STONE`, `WOOD`, `GLASS`, `AIR`).

### `fill_box`
Preenche um volume retangular 3D (Caixa) delimitado por duas posições $(X_1, Y_1, Z_1)$ e $(X_2, Y_2, Z_2)$.
- **Parâmetros**:
  - `x1`, `y1`, `z1` (number): Canto 1.
  - `x2`, `y2`, `z2` (number): Canto 2.
  - `block_type` (string/number): Tipo de bloco a preencher.
  - `hollow` (boolean, opcional): Se verdadeiro, preenche apenas as paredes externas deixando o interior oco.

### `spawn_structure`
Gera uma estrutura pré-programada (ex: `tree`, `house`, `pyramid`, `tower`, `wall`).
- **Parâmetros**:
  - `structure_type` (string): Tipo de estrutura.
  - `x`, `y`, `z` (number): Ponto de origem da base.

---

## 📷 Ferramentas de Visão & Inspeção

### `capture_snapshot`
Posiciona uma câmera virtual nas coordenadas indicadas, renderiza um quadro da cena e retorna uma imagem em formato base64. A LLM recebe a imagem no contexto multimodal para verificar e corrigir a construção.
- **Parâmetros**:
  - `x`, `y`, `z` (number): Posição da câmera no espaço 3D.
  - `targetX`, `targetY`, `targetZ` (number): Ponto para onde a câmera está apontada.
  - `fov` (number, opcional): Campo de visão em graus (padrão $60^\circ$).

### `query_area`
Retorna uma lista dos blocos existentes em um raio ao redor de uma coordenada $(X, Y, Z)$.
- **Parâmetros**:
  - `x`, `y`, `z` (number): Centro da consulta.
  - `radius` (number): Raio em blocos.

---

## ⚙️ Ferramentas de Gerenciamento do Mundo & Projeto

### `reset_world`
Limpa todas as modificações do mundo atual, retornando ao estado superflat original.

### `reconfigure_chunk_generator`
Altera as configurações de geração do mundo em chunks.
- **Parâmetros**:
  - `ground_height` (number): Altura base do solo.
  - `surface_block` (string): Bloco da superfície.
  - `sub_surface_block` (string): Bloco do subsolo.

### `search_project_context`
Permite que a LLM pesquise no histórico de chat do mundo atual e leia dados sobre o ambiente e o estado dos blocos.
