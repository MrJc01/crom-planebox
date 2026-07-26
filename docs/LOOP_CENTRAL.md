# O loop central — os primeiros 30 minutos

Item 006 do checklist. Este documento define o que o jogador *faz* no Crom Planebox, na ordem em
que ele faz, e — mais importante — **por que cada passo obriga o seguinte**.

## O problema que ele resolve

O jogo tinha cinco modos, sobrevivência com vida e fome, minérios distribuídos por profundidade e
uma corrente de ferramentas de quatro degraus. Faltava a única coisa que transforma isso em jogo:
**um motivo para o passo seguinte**. Quem entrava pela primeira vez via um mundo aberto, uma
hotbar e nenhuma direção. O sintoma não é confusão — é o jogador construir uma casinha, achar que
viu tudo, e sair em dez minutos.

A progressão inteira já existia no código. Ela era **invisível**: nada dizia que a picareta de
madeira abre a pedra, que o carvão vira tocha, nem que a tocha é o que torna a caverna explorável.
Descobrir a cadeia exigia ler receitas.

## O loop, em cinco batidas

```
  acordar ──► coletar ──► craftar ──► abrigar ──► explorar
     ▲                                                │
     └────────────────────────────────────────────────┘
        (a exploração devolve material melhor, e a volta
         é mais rápida porque a ferramenta é melhor)
```

O loop **fecha**, e é isso que o faz um loop em vez de uma lista: cada volta recomeça no mesmo
lugar com ferramenta melhor, e por isso mais curta. Uma corrente que só vai para frente termina; um
ciclo que encurta a cada volta é o que mantém alguém jogando.

## Os quinze passos concretos

São os objetivos de `src/game/Objetivos.ts`, na ordem, com o tempo aproximado. Não é uma lista de
sugestões: cada degrau depende do anterior **por mecânica**, não por decreto.

| # | Passo | ~min | O que o obriga |
|---|-------|------|----------------|
| 1 | Derrube uma árvore | 0–1 | É a única coisa que se quebra com a mão e rende material |
| 2 | Tronco → tábuas | 1–2 | A picareta pede tábuas |
| 3 | Picareta de madeira | 2–3 | **Sem ela a pedra quebra e não rende nada** |
| 4 | Minere pedra | 3–5 | Pedregulho é o material da picareta seguinte |
| 5 | Picareta de pedra | 5–6 | Dura mais e minera mais rápido (`velocidadeDeQuebra.ts`) |
| 6 | Esteja abrigado ao escurecer | 6–9 | À noite nascem criaturas hostis lá fora |
| 7 | Encontre carvão | 9–12 | Aparece nos primeiros metros abaixo da superfície |
| 8 | Faça tochas | 12–13 | **A caverna é escura demais para achar minério sem elas** |
| 9 | Sobreviva ao amanhecer | 13–16 | O dia volta sozinho; é a primeira tensão real |
| 10 | Desça 15 metros | 16–19 | O ferro não existe na superfície |
| 11 | Encontre ferro | 19–22 | A picareta de pedra já dá conta dele |
| 12 | Picareta de ferro | 22–24 | **Só ela coleta minério de diamante** |
| 13 | Encontre diamante | 24–28 | Entre 20 e 26 metros, e raro (`ORE_TIERS`) |
| 14 | Picareta de diamante | 28–29 | O último degrau da corrente |
| 15 | Colete obsidiana | 29–30 | **Nenhuma outra picareta a recolhe** |

Os números em negrito são os **portões**: os pontos onde o jogo diz "não" e o jogador precisa
voltar um passo. Sem eles a ordem seria decorativa e o jogador poderia pular direto para o fim.

## As três regras do guia

Implementadas em `RastreadorDeObjetivos`, testadas em `tests/unit/objetivos.test.ts`.

**Um passo de cada vez.** O HUD mostra **um** objetivo, nunca a lista. Um novato diante de quinze
caixinhas continua sem saber por onde começar — que é exatamente o problema que o guia existe para
resolver.

**A ordem é sugestão, não trilho.** Cada evento é testado contra *todos* os objetivos pendentes.
Quem cair numa caverna e achar ferro no primeiro minuto tem aquele objetivo marcado na hora.
Ninguém desce numa caverna seguindo uma lista, e obrigar a refazer o que já foi feito é a maneira
mais rápida de transformar um guia em estorvo.

**Concluído nunca volta a pendente.** Sem isso, gastar as tábuas na bancada desmarcaria "fabrique
tábuas", e o guia mandaria de volta à árvore alguém que já está no ferro.

## Onde o loop está instrumentado

Quatro pontos, todos em código que já existia — nenhum laço novo por quadro:

| Evento | Origem |
|--------|--------|
| `quebrou` | `inter.onBlockChange` (`src/main.ts`) |
| `fabricou` | `InventoryModal.onCrafted`, disparado em `collectCraft` |
| `amanheceu` | a transição para a fase `amanhecer`, no laço principal |
| `profundidade` | posição do jogador, amostrada a cada 0,5 s |
| `abrigado` | `estaAbrigado`, só de noite e só enquanto o objetivo está pendente |

O `abrigado` é o único que mede um **estado do mundo** em vez de um ato do jogador: uma busca em
largura pelo ar em volta (`src/game/abrigo.ts`). Se ela se esgota, o espaço é fechado; se estoura o
orçamento, o ar não acaba e o jogador está lá fora. Um buraco na parede ou no teto derruba o
resultado sozinho, sem regra própria, porque o ar de fora entra pela busca.

O guia só aparece no **Modo Sobrevivência**. Nos outros o jogador já tem todos os blocos e não
gasta ferramenta: "fabrique a picareta de madeira para abrir a pedra" seria um passo sem obstáculo,
e um guia que manda fazer o que já está feito ensina a ignorar o guia.

## O que este loop ainda NÃO tem

Registrado com honestidade, porque um documento de desenho que só descreve o que funciona é
propaganda:

- **Não há razão para uma segunda volta.** O loop fecha no papel, mas depois da obsidiana não há
  material melhor nem objetivo maior. Falta o topo: armadura, chefe, ou uma dimensão (itens 018,
  019, 1286).
- **A noite não é perigosa o bastante** para justificar o abrigo do passo 6. Os hostis nascem, mas
  não há evento que force o jogador a se esconder (item 009).
- **O ponto de renascimento é sempre o spawn original** (item 010). O custo da morte já existe e é
  escolhido na criação do mundo (item 011), mas a caminhada de volta do fundo de uma caverna é
  sempre a mesma caminhada longa.
- **O tempo da tabela é estimativa**, não medição. Nada no jogo registra quanto o jogador leva de
  fato até a primeira ferramenta (item 022).
- **Não há tutorial de controles.** O guia diz *o que* fazer; quem não sabe que se coloca bloco com
  o botão direito ainda descobre isso sozinho (item 021).
