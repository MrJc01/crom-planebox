// "Está ligado?" — o teste que faltava nas oito vezes.
//
// ## Por que este arquivo existe
//
// O modo dominante de falha deste repositório **não é código errado**. É código certo, completo,
// comentado e às vezes até testado, que **ninguém invoca**. Já aconteceu oito vezes:
//
//  1. `setViewRange` — ajustava a névoa, e `scene.fog` era `null`
//  2. `applyCurvature` — o shader existia com `invR = 0`
//  3. `UndoManager.recordBatch` — nenhuma edição o chamava
//  4. As estações — mudavam o clima e o F3, e nada no mundo
//  5. Os biomas — o worldgen usava limiares paralelos próprios
//  6. A onda da água — `applyCurvature(waterMaterial)` sem o segundo argumento
//  7. A tabela `CAMADA` — sete das nove telas escreviam `z-index` literal
//  8. `WorldRepository.deleteWorld` — completa, transacional em nove tabelas, e não havia botão
//
// O que os oito têm em comum é que **todo teste passava**. Uma função nunca chamada não quebra
// nada; ela simplesmente não acontece. Testes de unidade provam que a função funciona — nenhum
// deles pergunta se alguém a usa.
//
// ## O que este teste faz, e o que ele não faz
//
// Ele varre o código fonte procurando um chamador para cada API que já esteve dormente. É um
// teste **textual**, com a fragilidade que isso implica: um `grep` sofisticado, não uma prova.
//
// Não é a ferramenta ideal. A ideal seria cobertura de integração com o jogo rodando, e isso
// exige WebGL, que jsdom não tem. Enquanto não existir, este arquivo é o que separa "a função
// existe" de "a função acontece" — e falha exatamente nos oito acidentes que já ocorreram.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('../../src/', import.meta.url).pathname;

/** Todo o código fonte concatenado, com o caminho de cada arquivo à frente. */
function todoOFonte(): Array<{ arquivo: string; texto: string }> {
  const saida: Array<{ arquivo: string; texto: string }> = [];
  const andar = (dir: string): void => {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) { andar(caminho); continue; }
      if (!nome.endsWith('.ts')) continue;
      saida.push({ arquivo: caminho.slice(SRC.length), texto: readFileSync(caminho, 'utf8') });
    }
  };
  andar(SRC);
  return saida;
}

const FONTE = todoOFonte();

/**
 * Procura um chamador de `padrao` fora dos arquivos que o **definem**.
 *
 * Excluir o arquivo de definição é o ponto todo: uma função que só aparece onde foi escrita é
 * precisamente a que está dormente.
 */
function temChamador(padrao: RegExp, ondeMora: string[]): string[] {
  return FONTE
    .filter(({ arquivo }) => !ondeMora.some((m) => arquivo.endsWith(m)))
    .filter(({ texto }) => padrao.test(texto))
    .map(({ arquivo }) => arquivo);
}

describe('as oito funcionalidades que já estiveram dormentes seguem ligadas', () => {
  const casos: Array<{ nome: string; padrao: RegExp; mora: string[] }> = [
    {
      nome: 'setViewRange — ajusta a névoa à distância de render',
      padrao: /\.setViewRange\s*\(/,
      mora: ['render/scene.ts'],
    },
    {
      nome: 'setCurvature — a curvatura do horizonte',
      padrao: /\.setCurvature\s*\(/,
      mora: ['render/scene.ts'],
    },
    {
      nome: 'UndoManager.recordBatch — o desfazer de uma edição em lote',
      padrao: /recordBatch\s*\(/,
      mora: ['storage/UndoManager.ts'],
    },
    {
      nome: 'estações — o tingimento sazonal chega ao mundo',
      padrao: /setSeasonTint\s*\(/,
      mora: ['render/scene.ts'],
    },
    {
      nome: 'biomas — o worldgen consulta a mistura de biomas',
      padrao: /pesosDeBioma|biomaDominante/,
      mora: ['world/biomes.ts'],
    },
    {
      nome: 'onda da água — o relógio é avançado por alguém',
      padrao: /ondaUniforms\.tempo\.value\s*=/,
      mora: [],
    },
    {
      nome: 'CAMADA — a tabela de empilhamento é consultada',
      padrao: /CAMADA\.\w+/,
      mora: ['ui/theme.ts'],
    },
    {
      nome: 'deleteWorld — existe um caminho para apagar um mundo',
      padrao: /deleteWorld\s*\(/,
      mora: ['storage/WorldRepository.ts'],
    },
  ];

  for (const { nome, padrao, mora } of casos) {
    it(`CRÍTICO: ${nome}`, () => {
      const chamadores = temChamador(padrao, mora);
      expect(
        chamadores.length,
        `nada fora de [${mora.join(', ') || '—'}] usa isto: a funcionalidade está escrita e inerte`,
      ).toBeGreaterThan(0);
    });
  }
});

describe('objetivos — o guia do novato está de fato ligado (item 007)', () => {
  // O candidato mais óbvio a virar o nono caso. `RastreadorDeObjetivos` é uma classe pura,
  // testável e completamente inerte sozinha: sem os quatro pontos de instrumentação abaixo, todos
  // os testes de `objetivos.test.ts` passariam e **nenhum objetivo jamais avançaria em jogo**.
  //
  // Cada linha aqui corresponde a um evento do tipo `EventoDeProgresso`. Se alguém acrescentar uma
  // variante nova ao tipo e não a emitir, é este arquivo que deveria crescer junto.
  const main = FONTE.find((f) => f.arquivo.endsWith('main.ts'))!.texto;

  it('CRÍTICO: quebrar um bloco alimenta o progresso', () => {
    expect(/registrarProgresso\(\{\s*tipo:\s*'quebrou'/.test(main)).toBe(true);
  });

  it('CRÍTICO: quebrar reporta o bloco que SAIU, não o ar que ficou', () => {
    // `onBlockChange` recebe `blockType = 0` ao quebrar. Passar esse zero faria "derrube uma
    // árvore" nunca casar, e o guia travaria no primeiro passo para sempre.
    expect(/tipo:\s*'quebrou',\s*bloco:\s*blocoAnterior/.test(main)).toBe(true);
  });

  it('CRÍTICO: o abrigo é VERIFICADO, não contado', () => {
    // A versão anterior contava doze blocos colocados, e doze blocos de terra em fila cumpriam.
    // `estaAbrigado` é uma busca em largura pura: sem esta chamada ela seria mais um módulo
    // completo, testado e inerte.
    expect(/mapearAbrigo\s*\(/.test(main), 'a verificação de abrigo não é chamada').toBe(true);
    expect(/registrarProgresso\(\{\s*tipo:\s*'abrigado'/.test(main)).toBe(true);
  });

  it('CRÍTICO: a casa também protege de spawn — o abrigo chega ao MobSpawner', () => {
    // O mesmo mapa serve a duas coisas, e ligar só uma delas é o erro provável: o objetivo marcaria
    // e o jogador continuaria acordando com um zumbi dentro do quarto.
    expect(/dentroDoAbrigo:/.test(main), 'o spawner não recebe o abrigo').toBe(true);
    const spawner = FONTE.find((f) => f.arquivo.endsWith('entities/MobSpawner.ts'))!.texto;
    expect(/dentroDoAbrigo\?\.\(/.test(spawner), 'o spawner recebe e ignora').toBe(true);
  });

  it('CRÍTICO: o mapa do abrigo é LIMPO quando amanhece', () => {
    // Um `Set` que nunca é zerado deixaria uma bolha permanente sem spawn onde a casa esteve —
    // seguindo o jogador pelo mundo inteiro, e sem nada denunciando por quê.
    expect(/abrigoAtual = null/.test(main), 'o mapa nunca é limpo').toBe(true);
  });

  it('o aviso de "está descoberto" é uma vez por noite, não a cada verificação', () => {
    // A verificação roda a cada 2 s. Sem a trava, o jogador a céu aberto receberia trinta toasts
    // por noite — e um aviso que aparece trinta vezes deixa de ser aviso e vira ruído que se
    // aprende a ignorar, inclusive quando ele estiver certo.
    expect(/avisouDescoberto = true/.test(main), 'não trava').toBe(true);
    expect(/avisouDescoberto = false/.test(main), 'trava e nunca solta').toBe(true);
  });

  it('CRÍTICO: fabricar alimenta o progresso', () => {
    expect(/onCrafted\s*=/.test(main)).toBe(true);
    expect(/registrarProgresso\(\{\s*tipo:\s*'fabricou'/.test(main)).toBe(true);
  });

  it('CRÍTICO: `onCrafted` é disparado por quem coleta a receita', () => {
    const inv = FONTE.find((f) => f.arquivo.endsWith('ui/InventoryModal.ts'))!.texto;
    expect(/this\.onCrafted\(/.test(inv)).toBe(true);
  });

  it('CRÍTICO: o amanhecer alimenta o progresso', () => {
    expect(/registrarProgresso\(\{\s*tipo:\s*'amanheceu'/.test(main)).toBe(true);
  });

  it('CRÍTICO: o amanhecer é o AMANHECER, não a virada do contador de dias', () => {
    // O relógio do mundo dá a volta em `timeOfDay = 0`, que é **meia-noite**. Pendurar o evento na
    // virada de `worldDay` — o lugar mais óbvio, e onde ele esteve — fecharia "sobreviva até o
    // amanhecer" no meio da noite, antes da parte perigosa. Nada falharia: o objetivo marcaria, o
    // toast apareceria, e a única coisa errada seria o jogo ter dado a vitória cedo demais.
    const trecho = main.slice(
      Math.max(0, main.indexOf("registrarProgresso({ tipo: 'amanheceu'") - 400),
      main.indexOf("registrarProgresso({ tipo: 'amanheceu'"),
    );
    expect(/faseAtual === 'amanhecer'/.test(trecho), 'não está preso à fase do dia').toBe(true);
    expect(/worldDay\+\+/.test(trecho), 'voltou a pendurar na virada do contador de dias').toBe(false);
  });

  it('CRÍTICO: a profundidade alimenta o progresso', () => {
    expect(/registrarProgresso\(\{\s*tipo:\s*'profundidade'/.test(main)).toBe(true);
  });

  it('CRÍTICO: o cartão do HUD é desenhado por alguém', () => {
    // A classe podia estar perfeitamente alimentada e ainda assim invisível.
    expect(temChamador(/mostrarObjetivo\s*\(/, ['ui/HUD.ts']).length).toBeGreaterThan(0);
  });

  it('CRÍTICO: a aba de objetivos do hub recebe a lista de verdade', () => {
    // A aba existe, monta e desenha uma lista vazia se ninguém a alimentar — e uma lista vazia
    // parece "nenhum objetivo neste mundo", não "esqueci de ligar".
    const pause = FONTE.find((f) => f.arquivo.endsWith('ui/PauseMenu.ts'))!.texto;
    expect(/id:\s*'objetivos'/.test(pause), 'a aba não existe').toBe(true);
    expect(/listarObjetivos:/.test(main), 'main não fornece a lista').toBe(true);
    expect(/objetivos\.listar\(\)/.test(main), 'a lista fornecida não vem do rastreador').toBe(true);
  });

  it('CRÍTICO: o progresso é salvo E restaurado', () => {
    // Salvar sem restaurar é o meio-caminho que não falha em lugar nenhum: tudo funciona na
    // sessão, e o jogador perde a corrente inteira ao fechar a aba.
    expect(/objetivos\.serializar\(\)/.test(main), 'não é salvo').toBe(true);
    expect(/objetivos\.restaurar\(/.test(main), 'não é restaurado').toBe(true);
  });
});

describe('callback é propriedade, não lista de assinantes (casos 11 e 12)', () => {
  // O nono e o décimo modos de "código presente não é código ativo", e os mais silenciosos até
  // agora. `survivalSystem.onDamage` e `onDeath` são **propriedades**: a segunda atribuição apaga a
  // primeira. Havia duas de cada, separadas por umas sessenta linhas.
  //
  // O que se perdeu: o som de dano, o som de morte e o evento `playerDamaged` dos mods. Todos
  // escritos, corretos, comentados — e nunca executados. Nada falhava. O jogo só era silencioso ao
  // apanhar e ao morrer, e quem notasse pensaria que faltava o som, não que ele estava lá.
  const main = FONTE.find((f) => f.arquivo.endsWith('main.ts'))!.texto;

  const atribuicoes = (nome: string) =>
    (main.match(new RegExp(`survivalSystem\\.${nome}\\s*=`, 'g')) ?? []).length;

  it('CRÍTICO: `onDamage` tem UMA atribuição', () => {
    expect(atribuicoes('onDamage'), 'mais de uma: a última apaga as outras').toBe(1);
  });

  it('CRÍTICO: `onDeath` tem UMA atribuição', () => {
    expect(atribuicoes('onDeath'), 'mais de uma: a última apaga as outras').toBe(1);
  });

  it('CRÍTICO: o som de dano e o de morte sobreviveram à fusão', () => {
    // Consertar o conflito removendo o handler "errado" resolveria o teste acima e perderia
    // exatamente o que se queria de volta.
    expect(/SOUNDS\.morte/.test(main), 'som de morte sumiu').toBe(true);
    expect(/SOUNDS\.dano/.test(main), 'som de dano sumiu').toBe(true);
    expect(/dispatch\('playerDamaged'/.test(main), 'evento de mod sumiu').toBe(true);
  });
});

describe('penalidade de morte — o custo chega ao jogo (item 011)', () => {
  const main = FONTE.find((f) => f.arquivo.endsWith('main.ts'))!.texto;

  it('CRÍTICO: a regra é consultada na morte', () => {
    expect(/aplicarPenalidade\s*\(/.test(main)).toBe(true);
    expect(/penalidadeDoMundo\s*\(/.test(main)).toBe(true);
  });

  it('CRÍTICO: os itens caem E os slots são esvaziados', () => {
    // Largar sem esvaziar duplicaria o inventário: os itens no chão E na mão. É o tipo de defeito
    // que ninguém reporta como defeito — reportam como "achei um jeito de multiplicar item".
    expect(/efeito\.largar/.test(main), 'nada é largado').toBe(true);
    expect(/efeito\.esvaziar/.test(main), 'nada é esvaziado').toBe(true);
  });

  it('CRÍTICO: o mundo hardcore encerrado não pode ser reaberto', () => {
    // Marcar e não checar seria o pior dos dois mundos: o jogador veria "mundo encerrado", voltaria
    // ao menu, clicaria no mesmo mundo e continuaria jogando.
    expect(/encerradoEm = Date\.now\(\)/.test(main), 'não marca').toBe(true);
    expect(/wRecord\.encerradoEm/.test(main), 'marca e não confere').toBe(true);
  });

  it('CRÍTICO: a escolha existe na criação do mundo', () => {
    const wizard = FONTE.find((f) => f.arquivo.endsWith('ui/WorldCreationWizard.ts'))!.texto;
    expect(/wiz-morte/.test(wizard), 'não há seletor').toBe(true);
    expect(/penalidadeDeMorte:/.test(wizard), 'o seletor não é gravado').toBe(true);
  });
});

describe('cama — o ponto de renascimento chega ao jogo (item 010)', () => {
  const main = FONTE.find((f) => f.arquivo.endsWith('main.ts'))!.texto;

  it('CRÍTICO: clicar na cama é atendido', () => {
    const inter = FONTE.find((f) => f.arquivo.endsWith('player/interaction.ts'))!.texto;
    expect(/this\.onUseBlock\(/.test(inter), 'a interação não dispara').toBe(true);
    expect(/inter\.onUseBlock\s*=/.test(main), 'ninguém atende').toBe(true);
  });

  it('CRÍTICO: a morte usa o ponto de renascimento, não o spawn do mundo', () => {
    // O erro provável: gravar o ponto e continuar renascendo em `findSpawn()`. A cama funcionaria,
    // salvaria, apareceria no save — e não faria absolutamente nada.
    expect(/player\.pos\.copy\(ondeRenascer\(\)\)/.test(main)).toBe(true);
  });

  it('CRÍTICO: o ponto é salvo E restaurado', () => {
    expect(/pontoDeRenascimento:/.test(main), 'não é salvo').toBe(true);
    expect(/savedPlayer\?\.pontoDeRenascimento/.test(main), 'não é restaurado').toBe(true);
  });

  it('CRÍTICO: mundo sem save zera o ponto', () => {
    // Sem isto, a cama do mundo anterior puxaria o jogador para dentro de um mundo novo, em
    // coordenadas que ali não significam nada — possivelmente dentro de pedra maciça.
    expect(/pontoDeRenascimento = pr \? .* : null/.test(main)).toBe(true);
  });

  it('CRÍTICO: dormir chega ao relógio do mundo', () => {
    // `porQueNaoPodeDormir` e `RITMO_DORMINDO` são um módulo puro: sem estas duas linhas, ele
    // passaria nos 11 testes próprios e a cama continuaria só definindo o spawn.
    expect(/porQueNaoPodeDormir\(/.test(main), 'ninguém pergunta se pode').toBe(true);
    expect(/if \(dormindo\) ritmo = RITMO_DORMINDO/.test(main), 'o relógio não acelera').toBe(true);
    expect(/deveAcordar\(/.test(main), 'ninguém acorda').toBe(true);
  });

  it('CRÍTICO: o corpo é cobrado pelo tempo que o mundo pulou', () => {
    // O relógio corre a 90×, mas `update(dt)` recebe o `dt` real. Sem esta chamada, metade da barra
    // de fome deixa de ser cobrada por noite dormida, e dormir vira a maneira de não comer. Não
    // falha em lugar nenhum: a fome só decai mais devagar para quem dorme.
    expect(/survivalSystem\.descansar\(/.test(main), 'ninguém cobra o tempo pulado').toBe(true);
    expect(/horaAoDeitar/.test(main), 'não se sabe quanto tempo passou').toBe(true);
  });

  it('a tela de sono acompanha o estado de dormir', () => {
    // Acender e nunca apagar deixaria o jogador com a tela preta para sempre depois da primeira
    // noite — e nada, nem o menu, indicaria por quê.
    expect(/mostrarSono\(true\)/.test(main), 'nunca escurece').toBe(true);
    expect(/mostrarSono\(false\)/.test(main), 'escurece e nunca clareia').toBe(true);
  });

  it('CRÍTICO: o ponto de renascimento é conferido na hora de USAR', () => {
    // Conferir só na hora de gravar não adianta: entre gravar e morrer o mundo muda, e quem tapou
    // o próprio quarto renasceria dentro da pedra, preso, logo depois de morrer.
    expect(/soterrado/.test(main), 'nada confere o ponto').toBe(true);
  });

  it('CRÍTICO: acordar avisa os convidados na hora', () => {
    // O envio periódico é de 10 em 10 segundos. Nesse intervalo o convidado ainda estaria de noite,
    // com o céu de outro horário e criaturas que o anfitrião já não simula.
    const trecho = main.slice(main.indexOf('deveAcordar('), main.indexOf('deveAcordar(') + 900);
    expect(/world_time/.test(trecho), 'acorda em silêncio').toBe(true);
  });

  it('usar um bloco vem ANTES da recusa por estar com ferramenta na mão', () => {
    // O estado normal de quem acabou de minerar é ter a picareta selecionada. Se a recusa viesse
    // primeiro, clicar na cama não faria nada, e nada explicaria por quê.
    const inter = FONTE.find((f) => f.arquivo.endsWith('player/interaction.ts'))!.texto;
    const corpo = inter.slice(inter.indexOf('tryPlace('));
    expect(corpo.indexOf('onUseBlock')).toBeLessThan(corpo.indexOf('slot.toolTier !== undefined'));
  });
});

describe('o reino dos mods — item 358 e a queda dele', () => {
  const main = FONTE.find((f) => f.arquivo.endsWith('main.ts'))!.texto;

  it('CRÍTICO: a execução de mod acontece num Worker, não neste thread', () => {
    // A trava mais importante deste arquivo. Trocar o padrão do `ModRuntime` de volta para execução
    // local deixaria TODOS os testes de sandbox verdes descrevendo uma proteção desligada — e a
    // única diferença visível seria nenhuma.
    const rt = FONTE.find((f) => f.arquivo.endsWith('mods/ModRuntime.ts'))!.texto;
    expect(/criarPorta: \(\) => Porta = criarPortaDeWorker/.test(rt)).toBe(true);
    expect(/new Worker\(new URL\('\.\/modWorker\.ts'/.test(rt)).toBe(true);
  });

  it('CRÍTICO: a queda do reino chega ao jogador', () => {
    // `onReinoCaiu` é um callback com padrão vazio: sem alguém o atribuindo, o reino cai, todos os
    // mods param, e o jogo continua rodando normal. O jogador não teria como distinguir "o mod não
    // faz nada" de "o mod parou de existir".
    expect(/modRuntime\.onReinoCaiu\s*=/.test(main), 'ninguém escuta a queda').toBe(true);
  });

  it('CRÍTICO: o orçamento de chamadas por quadro é recarregado', () => {
    // `novoQuadro()` nunca chamado deixaria todo mod estourado para sempre depois de 2.000
    // chamadas — os mods funcionariam por alguns segundos e parariam, com um aviso só no log.
    const rt = FONTE.find((f) => f.arquivo.endsWith('mods/ModRuntime.ts'))!.texto;
    expect(/this\.ponte\.novoQuadro\(\)/.test(rt)).toBe(true);
  });
});

describe('rede de mod — a porta está ligada (itens 761-768)', () => {
  const main = FONTE.find((f) => f.arquivo.endsWith('main.ts'))!.texto;

  it('CRÍTICO: `api.net.fetch` chega à `RedeDeMods`', () => {
    // `RedeDeMods` é uma classe pura com 19 testes que passariam com ela desligada — e desligada
    // significa mod nenhum alcançando a rede, o que é seguro e não é o recurso.
    expect(/modFetch: \(modId, endereco, opcoes\)/.test(main), 'o host não oferece rede').toBe(true);
    expect(/new RedeDeMods\(/.test(main), 'ninguém constrói o serviço').toBe(true);
    const api = FONTE.find((f) => f.arquivo.endsWith('mods/ModAPI.ts'))!.texto;
    expect(/host\.modFetch\(/.test(api), 'a api não chama o host').toBe(true);
  });

  it('CRÍTICO: o consentimento é PERSISTIDO e RECARREGADO', () => {
    // Gravar sem recarregar faz todo mod pedir permissão de novo a cada vez que o mundo abre — e
    // uma permissão que se repete é uma permissão que se clica sem ler.
    expect(/grantConsent\(/.test(main), 'não grava').toBe(true);
    expect(/getConsents\(/.test(main), 'não recarrega').toBe(true);
  });

  it('CRÍTICO: a auditoria é gravada', () => {
    expect(/logModNetCall\(/.test(main), 'nada é auditado').toBe(true);
  });

  it('CRÍTICO: a revogação atinge a sessão em curso, não só a próxima', () => {
    // Revogar gravando no banco e não regravando o espelho em memória é o pior resultado possível:
    // o jogador clica em "revogar", a tela mostra revogado, e o mod continua com acesso pelo resto
    // da sessão. Uma permissão que não some quando se manda sumir é pior que não ter o botão.
    const mods = FONTE.find((f) => f.arquivo.endsWith('ui/ModsPage.ts'))!.texto;
    expect(/revokeConsent\(/.test(mods), 'não revoga').toBe(true);
    expect(/onConsentimentosMudaram\(\)/.test(mods), 'revoga e não avisa').toBe(true);
    expect(/modsPage\.onConsentimentosMudaram\s*=/.test(main), 'ninguém escuta').toBe(true);
  });

  it('CRÍTICO: a aba de capacidades sabe de que mundo está falando', () => {
    // Uma cópia guardada do `worldId` mostraria as permissões do mundo anterior — o pior tipo de
    // erro nesta tela, porque parece informação correta.
    expect(/modsPage\.worldIdAtual\s*=/.test(main)).toBe(true);
  });

  it('CRÍTICO: a pergunta ao jogador tem tela própria', () => {
    // Sem ela, `pedirConsentimento` teria que devolver `false` sempre — a porta ficaria construída
    // e permanentemente fechada, sem nada dizendo por quê.
    expect(/pedirCapacidade\(/.test(main), 'ninguém pergunta').toBe(true);
  });
});

describe('voz P2P — o microfone está ligado ao jogo (itens 927-932)', () => {
  const main = FONTE.find((f) => f.arquivo.endsWith('main.ts'))!.texto;

  it('CRÍTICO: `getUserMedia` só é chamado dentro da camada de voz', () => {
    // Item 930. Um `getUserMedia` solto em qualquer outro lugar do código seria um pedido de
    // permissão fora do clique — e um pedido sem contexto recebe "não", ou um "sim" que o jogador
    // não entendeu.
    // O padrão casa a CHAMADA (com abre-parênteses e objeto), não a menção: `VozP2P.ts` cita o
    // nome no comentário que explica esta mesma regra, e um teste que casasse a menção proibiria
    // documentar a decisão.
    const chamadas = FONTE.filter((f) => /getUserMedia\(\{/.test(f.texto)).map((f) => f.arquivo);
    expect(chamadas).toEqual(['main.ts']);
    expect(/pedirMicrofone: \(\) => navigator\.mediaDevices\.getUserMedia/.test(main)).toBe(true);
  });

  it('CRÍTICO: o indicador da tela acompanha o estado', () => {
    // Item 929. `VozP2P` avisa a cada transição; se ninguém escutar, o jogo capta áudio sem
    // mostrar — indistinguível de um que grava escondido.
    expect(/voz\.aoMudar = /.test(main), 'ninguém escuta as mudanças').toBe(true);
    expect(/hud\.atualizarMicrofone\(/.test(main), 'o indicador não é atualizado').toBe(true);
  });

  it('CRÍTICO: a trilha entra na conexão que já existe', () => {
    // Item 931. Sem servidor de voz: é a mesma `RTCPeerConnection` dos blocos.
    expect(/peerSync\.adicionarTrilhaDeAudio\(/.test(main)).toBe(true);
    const peer = FONTE.find((f) => f.arquivo.endsWith('net/PeerSync.ts'))!.texto;
    expect(/conn\.addTrack\(/.test(peer)).toBe(true);
  });

  it('CRÍTICO: a renegociação reaproveita a conexão em vez de criar outra', () => {
    // Item 932, e o defeito que a voz revelou: `handleSignal` criava uma `RTCPeerConnection` nova a
    // cada oferta. Numa renegociação isso descartaria o canal de dados aberto — a partida cairia a
    // cada vez que alguém ligasse o microfone.
    const peer = FONTE.find((f) => f.arquivo.endsWith('net/PeerSync.ts'))!.texto;
    expect(/const conn = existente\?\.conn \?\? this\.newConnection\(peerId\)/.test(peer)).toBe(true);
  });

  it('CRÍTICO: o áudio que chega é tocado', () => {
    // Um `MediaStream` que chega e não é ligado a um elemento simplesmente não toca, sem erro
    // nenhum: o áudio atravessa a rede e morre em silêncio.
    expect(/peerSync\.onTrilhaRemota = /.test(main)).toBe(true);
  });

  it('CRÍTICO: soltar a tecla emudece mesmo digitando, e perder o foco também', () => {
    // Um `keyup` filtrado pelo mesmo `isTyping` do `keydown` deixaria o microfone aberto para
    // sempre se o jogador clicasse numa caixa de texto enquanto falava. E alt-tab com a tecla
    // apertada nunca gera `keyup`.
    expect(/addEventListener\('keyup'[\s\S]{0,200}definirTecla\(false\)/.test(main)).toBe(true);
    expect(/addEventListener\('blur'[\s\S]{0,120}definirTecla\(false\)/.test(main)).toBe(true);
  });
});

describe('biomas de mod — o registro chega ao terreno (item 676)', () => {
  const main = FONTE.find((f) => f.arquivo.endsWith('main.ts'))!.texto;

  it('CRÍTICO: `api.biomes.define` chega ao registro', () => {
    const api = FONTE.find((f) => f.arquivo.endsWith('mods/ModAPI.ts'))!.texto;
    expect(/host\.registrarBioma\?\.\(/.test(api), 'a api não chama o host').toBe(true);
    expect(/registrarBioma: \(modId, def\)/.test(main), 'o host não implementa').toBe(true);
  });

  it('CRÍTICO: o bioma novo chega ao Worker que gera o terreno', () => {
    // Sem isto, o bioma existiria na cor da névoa e **não** no terreno: o jogador veria o horizonte
    // mudar e o chão não. É o defeito mais confuso possível, porque parece um problema de shader.
    expect(/biomasDeMod: biomasDeModRegistrados\(\)/.test(main), 'a lista não é enviada').toBe(true);
    const gw = FONTE.find((f) => f.arquivo.endsWith('world/genWorker.ts'))!.texto;
    expect(/registrarBiomaDeMod\(b\)/.test(gw), 'o worker recebe e ignora').toBe(true);
  });

  it('CRÍTICO: o worker esquece os biomas do mundo anterior', () => {
    // O worker é reaproveitado entre mundos. Sem limpar, um mod de um mundo faria terreno estranho
    // num mundo que nunca o teve.
    const gw = FONTE.find((f) => f.arquivo.endsWith('world/genWorker.ts'))!.texto;
    expect(/limparBiomasDeMod\(\)/.test(gw)).toBe(true);
    expect(/limparBiomasDeMod\(\)/.test(main)).toBe(true);
  });

  it('CRÍTICO: registrar durante a partida refaz a geração', () => {
    // O worker já tem uma cópia da lista de quando foi iniciado. Sem reiniciá-lo, o bioma só
    // existiria na próxima vez que o mundo abrisse.
    expect(/reiniciarGeracao\(\)/.test(main)).toBe(true);
  });
});

describe('espalhamento de mod — a estrutura chega ao terreno (item 689)', () => {
  const main = FONTE.find((f) => f.arquivo.endsWith('main.ts'))!.texto;

  it('CRÍTICO: regras e templates de mod chegam ao Worker de geração', () => {
    expect(/regrasDeMod: regrasDeModRegistradas\(\)/.test(main)).toBe(true);
    expect(/templatesDeMod: templatesDeModRegistrados\(\)/.test(main)).toBe(true);
    const gw = FONTE.find((f) => f.arquivo.endsWith('world/genWorker.ts'))!.texto;
    expect(/registrarRegraDeMod\(r\)/.test(gw), 'o worker recebe as regras e ignora').toBe(true);
    expect(/registrarTemplateDeMod\(t\)/.test(gw), 'o worker recebe os templates e ignora').toBe(true);
  });

  it('CRÍTICO: os templates são registrados ANTES das regras', () => {
    // Uma regra aponta para um template por id. Na ordem inversa, o worldgen acha o sítio e não
    // acha o que carimbar: um clarão de terreno aplanado com nada em cima, que se parece com
    // defeito de geração e não com mod mal declarado.
    const gw = FONTE.find((f) => f.arquivo.endsWith('world/genWorker.ts'))!.texto;
    expect(gw.indexOf('registrarTemplateDeMod(t)')).toBeLessThan(gw.indexOf('registrarRegraDeMod(r)'));
    const reg = FONTE.find((f) => f.arquivo.endsWith('mods/ModRegistry.ts'))!.texto;
    expect(reg.indexOf('registrarTemplateDeMod(')).toBeLessThan(reg.indexOf('registrarRegraDeMod('));
  });

  it('CRÍTICO: o worker esquece as do mundo anterior', () => {
    const gw = FONTE.find((f) => f.arquivo.endsWith('world/genWorker.ts'))!.texto;
    expect(/limparRegrasDeMod\(\)/.test(gw)).toBe(true);
    expect(/limparTemplatesDeMod\(\)/.test(gw)).toBe(true);
    expect(/limparRegrasDeMod\(\)/.test(main)).toBe(true);
  });
});

describe('camadas verticais — a profundidade se vê e se sente (itens 495/496)', () => {
  const main = FONTE.find((f) => f.arquivo.endsWith('main.ts'))!.texto;

  it('CRÍTICO: a névoa da camada chega ao renderizador', () => {
    // `camadas.ts` é um módulo puro com 13 testes que passariam com ele completamente desligado —
    // e desligado significa descer trinta metros continuar sensorialmente idêntico à superfície,
    // que é exatamente o problema que o item 495 descreve.
    expect(/ambienteDaProfundidade\(/.test(main), 'a névoa da camada não é consultada').toBe(true);
    expect(/gs\.setBiomeAmbience\(/.test(main), 'a névoa não chega ao renderizador').toBe(true);
  });

  it('CRÍTICO: a exclusividade por camada chega à geração de minério', () => {
    // Sem isto, "recursos exclusivos por camada" seria uma tabela que ninguém consulta: o diamante
    // continuaria aparecendo onde a faixa de profundidade permite, e a camada não significaria nada.
    const sub = FONTE.find((f) => f.arquivo.endsWith('world/underground.ts'))!.texto;
    expect(/mineriroPermitidoNaProfundidade\(/.test(sub)).toBe(true);
  });

  it('a camada aparece no diagnóstico', () => {
    expect(/camadaNaProfundidade\(/.test(main)).toBe(true);
  });

  it('CRÍTICO: o perigo da camada chega ao spawner — item 497', () => {
    // `perigo` é um campo numa tabela: sem alguém passá-lo, o abismo gera hostis no mesmo ritmo da
    // superfície e a única diferença entre as camadas volta a ser o tempo de caminhada.
    expect(/perigo: camadaNaProfundidade\(/.test(main)).toBe(true);
  });

  it('CRÍTICO: o spawner sabe a altura da superfície — item 1439', () => {
    // Sem `superficieY`, `camadaEm` trata todo ponto como superfície e a mistura de espécies é a
    // mesma no abismo e no quintal. O deslocamento existiria na tabela e não no jogo.
    expect(/superficieY: \(x: number, z: number\)/.test(main)).toBe(true);
  });
});

describe('o próprio varredor é confiável', () => {
  it('encontra arquivos de verdade', () => {
    // Um teste que varre o fonte e não acha nada passaria vazio e daria falsa segurança — todos
    // os `expect` acima seriam avaliados contra uma lista vazia de arquivos.
    expect(FONTE.length).toBeGreaterThan(30);
    expect(FONTE.some((f) => f.arquivo.endsWith('main.ts'))).toBe(true);
  });

  it('acusa uma função inventada, que ninguém poderia chamar', () => {
    // Prova que a ausência de chamador é de fato detectada, e não um padrão que casa com tudo.
    expect(temChamador(/funcaoQueNaoExisteEmLugarNenhum\s*\(/, [])).toEqual([]);
  });
});

describe('multijogador — os dois jogadores no MESMO mundo', () => {
  const main = FONTE.find((f) => f.arquivo.endsWith('main.ts'))!.texto;
  const protocolo = FONTE.find((f) => f.arquivo.endsWith('net/protocol.ts'))!.texto;

  it('CRÍTICO: o mundo do convidado NÃO nasce de uma semente aleatória', () => {
    // O relato foi "o mundo não é o mesmo no multiplayer", e a causa era total: o mundo do
    // convidado era criado com `seed: Math.floor(Math.random() * 1000000)`. O terreno é gerado a
    // partir da semente, então cada jogador via um mundo inteiramente diferente.
    //
    // O `full_sync` não resolvia: ele carrega só o que foi EDITADO à mão. Sobre um terreno gerado
    // diferente, uma casa construída num morro do anfitrião aparece flutuando — ou enterrada.
    const criacaoConvidado = main.slice(
      main.indexOf('const guestWorld: WorldRecord'),
      main.indexOf('await WorldRepository.saveWorld(guestWorld)'),
    );
    expect(criacaoConvidado.length).toBeGreaterThan(50);
    expect(criacaoConvidado).not.toMatch(/seed:\s*Math\.random|seed:\s*Math\.floor\(Math\.random/);
    expect(criacaoConvidado).toMatch(/seed:\s*info\.seed/);
    expect(criacaoConvidado).toMatch(/groundHeight:\s*info\.groundHeight/);
  });

  it('CRÍTICO: o anfitrião anuncia a identidade do terreno', () => {
    expect(protocolo).toContain('WorldInfoMsg');
    expect(protocolo).toMatch(/type:\s*'world_info'/);
    // Semente E altura base: as duas entram na geração. Mandar só uma ainda daria mundos
    // diferentes, e o defeito voltaria pela metade — que é pior, porque parece quase certo.
    expect(protocolo).toMatch(/seed:\s*number/);
    expect(protocolo).toMatch(/groundHeight:\s*number/);
  });

  it('CRÍTICO: o convidado ESPERA a identidade antes de criar o mundo', () => {
    // Se criasse antes e corrigisse depois, o terreno errado já teria sido gerado e gravado.
    const espera = main.indexOf('resolverInfoDoMundo = resolve');
    const criacao = main.indexOf('const guestWorld: WorldRecord');
    expect(espera).toBeGreaterThan(-1);
    expect(espera).toBeLessThan(criacao);
  });

  it('a espera tem prazo — anfitrião de versão antiga não trava a entrada', () => {
    expect(main).toMatch(/resolverInfoDoMundo = null; resolve\(null\)/);
  });
});
