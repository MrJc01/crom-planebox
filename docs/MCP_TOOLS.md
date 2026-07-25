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

---

## 🧩 Sistema de Mods — modificações inteiras salvas no mundo

Estas ferramentas são o caminho correto quando o usuário pede **conteúdo novo** ("crie um bioma
de cristal", "faça um mod de dragões"). A diferença para `execute_voxel_script` é decisiva:
o que é definido aqui é **persistido no mundo** e recarregado automaticamente na sessão seguinte.

> **Por que isso existe.** Antes, `registerCustomBlock` só criava o bloco em memória. Ao recarregar,
> o registro voltava ao estado base enquanto o mundo continuava guardando posições que apontavam
> para o id perdido — e o mesher quebrava o chunk inteiro. Todo bloco criado pela IA corrompia o
> mundo no reload. O pacote de mod carrega o `blockId` junto, e é isso que dá identidade estável.

### Fluxo típico
1. `list_mods` — veja o que já existe antes de duplicar.
2. `create_mod` — crie o recipiente.
3. `define_mod_block` / `define_mod_entity` / `define_mod_structure` — encha o mod.
4. `place_mod_structure` / `spawn_mod_entity` — coloque no mundo.
5. `export_mod` — entregue o JSON ao usuário, se ele pedir.

### `create_mod`
Cria a modificação. Devolve o `mod_id` usado em todas as outras chamadas.
- `name` (obrigatório), `description`, `mod_id` (opcional; derivado do nome).

### `define_mod_block`
Adiciona um bloco inédito, com id estável, utilizável imediatamente em `set_block`/`fill_box`.
- `mod_id`, `name`, `top_color` (obrigatórios).
- `key`, `side_color`, `bottom_color`, `solid`, `opaque`, `decor`, `gravity`, `structural`,
  `min_tool_tier`, `light_level`, `interactive`.
- Referenciável depois como `"mod_id:chave"` ou pelo nome exibido.

### `define_mod_entity`
Adiciona uma **espécie** (molde) de criatura, montada com caixas 3D.
- `mod_id`, `name`, `parts` (obrigatórios); `key`, `faction`, `role`, `health`, `behavior_script`.

### `define_mod_structure`
Adiciona uma estrutura reutilizável como lista de blocos relativos a (0,0,0).
- `mod_id`, `name`, `blocks` (obrigatórios); `key`.
- Cada bloco aceita id numérico, nome da paleta base (`"STONE"`) ou chave do mod (`"cristal_azul"`).
- A ferramenta **recusa** a estrutura se citar um bloco inexistente, em vez de carimbar buracos.

### `spawn_mod_entity`
Coloca um indivíduo da espécie no mundo. **A instância é salva** e reaparece no reload.
- `mod_id`, `entity_key`, `x`, `z` (obrigatórios); `y` (sem ele, encaixa no chão).

### `place_mod_structure`
Carimba a estrutura na origem indicada; os blocos são salvos normalmente.
- `mod_id`, `structure_key`, `x`, `y`, `z`.

### `list_mods`
Lista os mods instalados com blocos, espécies e estruturas de cada um.

### `set_mod_enabled`
Liga/desliga sem apagar. Desligado, os blocos saem do registro mas as definições ficam salvas.
- `mod_id`, `enabled`.

### `delete_mod`
Remove o mod e limpa do mundo os blocos que ele havia colocado. **Confirme com o usuário antes.**
- `mod_id`; `purge_placed_blocks` (padrão `true`).

### `export_mod` / `import_mod`
`export_mod(mod_id)` devolve o JSON portátil. `import_mod(mod_json)` instala em outro mundo,
**realocando os ids de bloco** para não colidir com o que já existe ali.
