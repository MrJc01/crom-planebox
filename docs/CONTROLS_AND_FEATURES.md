# Guia de Controles e Funcionalidades

Este documento contém os atalhos de teclado, modos de câmera, gerenciamento de mundos e configurações do **Crom Planebox**.

---

## ⌨️ Atalhos de Teclado & Teclas Principais

| Tecla | Ação / Função |
| :--- | :--- |
| **`ESC`** | Pausa o jogo, solta a trava do ponteiro do mouse e abre o **Menu de Configurações & Mundos**. |
| **`T`** | Abre e coloca foco na **Caixa de Chat com o Bot LLM** no canto esquerdo. |
| **`W`, `A`, `S`, `D`** | Movimentação do jogador/câmera nos modos **Primeira Pessoa (FPS)** e **Fantasma (Ghost)**. |
| **`Espaço` / `E`** | Subir (Voar para cima no modo Fantasma / Pular no modo FPS). |
| **`Shift` / `Q`** | Descer (Voar para baixo no modo Fantasma). |
| **`Clique Esquerdo`** | Quebrar bloco apontado pela mira no modo FPS. |
| **`Clique Direito`** | Colocar bloco selecionado na barra de atalhos. |

---

## 🎥 Modos de Câmera

1. **Visão Top-Down (Superior - Padrão)**:
   - A visão inicia no topo do mundo em ângulo aéreo, permitindo uma visão geral do mapa e terreno.

2. **Primeira Pessoa (FPS)**:
   - Trava o cursor do mouse no centro da tela (Pointer Lock).
   - Permite controlar a velocidade de movimento, altura dos olhos e **Distância de Visão (Render Distance)**.
   - O campo de visão (FOV - Field of View) pode ser ajustado no painel de configurações.

3. **Modo Fantasma (Ghost / Fly)**:
   - Câmera estilo Noclip/Spectator.
   - Permite atravessar paredes e blocos para visualizar interiores e construções por dentro.

---

## 💾 Gerenciador de Mundos & Persistência (IndexedDB)

- **Salvar & Carregar**: Todos os blocos colocados ou destruídos são armazenados em um banco de dados **IndexedDB** local no navegador.
- **Histórico de Chat por Mundo**: Cada mundo possui seu próprio histórico isolado de conversas com a IA.
- **Sem Reload da Página**: A troca entre mundos criados e o reset ocorrem instantaneamente em memória, sem nunca atualizar ou recarregar a página web.
