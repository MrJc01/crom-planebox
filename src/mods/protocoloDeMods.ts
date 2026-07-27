// O contrato entre o thread principal e o reino onde os scripts de mod rodam — item 358.
//
// ## Por que existe um protocolo, e não só chamadas
//
// O script de mod é escrito por uma IA a pedido do jogador e roda no navegador dele, na mesma
// origem que guarda os mundos salvos e o cofre de chaves de API. O sandbox atual (`sandbox.ts`)
// nega o alcance ao global por `with` + `Proxy`, e é honesto sobre o próprio limite: continua
// havendo saída por `[].constructor.constructor('return this')()`, porque a função criada assim é
// avaliada no escopo global **deste** reino.
//
// A correção não é uma lista melhor de nomes negados. É o script passar a viver num reino cujo
// global **não tem nada**: num Web Worker com `fetch`, `importScripts`, `indexedDB` e
// `XMLHttpRequest` apagados, a mesma fuga devolve um objeto vazio. Deixa de ser uma corrida entre
// o que eu lembrei de bloquear e o que o navegador vai ganhar amanhã.
//
// Um Worker só conversa por `postMessage`, e é isso que este arquivo descreve.
//
// ## A decisão que molda tudo: escrita não espera
//
// `setBlock` devolve se conseguiu, e quase nenhum mod olha. Se cada escrita esperasse a resposta,
// uma construção de 20.000 blocos viraria 20.000 idas e voltas — o mod ficaria mil vezes mais lento
// por uma informação que ninguém lê.
//
// Então escritas são **mão única**: vão e não voltam, e devolvem otimisticamente. Leituras esperam,
// e é por isso que o item 1251 (corpo `async`) precisou vir antes.
//
// `fillBox` é o caso que prova a regra: ele *é* uma escrita, mas devolve uma contagem que só o lado
// do mundo sabe. Fazê-lo no worker chamando `setBlock` N vezes seria N mensagens; ele vira uma
// leitura só, calculada inteira do lado de cá.

/** Como um membro da API atravessa (ou não) a fronteira. */
export type EstiloDeChamada =
  /** Vai e volta: o script precisa do valor. Custa uma ida e volta. */
  | 'leitura'
  /** Vai e não volta. Devolve otimisticamente, sem esperar. */
  | 'escrita';

/**
 * Todo membro chamável da API que precisa do estado vivo do jogo, e como ele atravessa.
 *
 * A chave é o caminho dentro de `api`. O que **não** está aqui vive inteiro dentro do worker:
 *
 * - `api.on` — registro de handler é local; sair seria ida e volta para guardar uma função que só
 *   o worker vai chamar.
 * - `api.storage` — estado por mod, sem nenhum leitor deste lado. Cada `get` seria uma viagem por
 *   nada, e o mod usa `storage` dentro de `tick`, ou seja, sessenta vezes por segundo.
 * - `api.mod`, `api.B`, `api.Math`, `api.audio.nomes` — constantes, enviadas uma vez na carga. É o
 *   que faz `api.B.STONE` continuar valendo um número, e não uma promessa.
 */
export const MEMBROS_DA_API: Readonly<Record<string, EstiloDeChamada>> = {
  'world.getBlock': 'leitura',
  'world.setBlock': 'escrita',
  // Escrita por natureza, leitura por contrato: devolve quantos blocos colocou, e essa contagem só
  // existe do lado do mundo. Uma mensagem, não N.
  'world.fillBox': 'leitura',
  'world.getGroundY': 'leitura',
  'world.findNearest': 'leitura',
  'world.blockId': 'leitura',

  'entities.spawn': 'leitura', // devolve o id da criatura criada
  'entities.list': 'leitura',
  'entities.damage': 'escrita',

  'player.position': 'leitura',
  'player.teleport': 'escrita',
  'player.health': 'leitura',
  'player.give': 'escrita',

  'ui.toast': 'escrita',
  // Leitura: o script precisa saber se o bioma entrou. Registrar e não conferir faria o mod seguir
  // construindo em cima de um bioma que não existe.
  'biomes.define': 'leitura',
  // Leitura: o mod precisa da resposta. É a chamada mais cara da fronteira e a única que pode
  // demorar segundos — daí o `await` obrigatório e o timeout do lado de cá.
  'net.fetch': 'leitura',
  'audio.play': 'escrita',

  'time.ofDay': 'leitura',
  'time.isNight': 'leitura',
  'time.moonPhase': 'leitura',
  'time.isDarkNight': 'leitura',

  'weather.current': 'leitura',
  'weather.isRaining': 'leitura',
  'weather.isStorm': 'leitura',
  'weather.set': 'escrita',

  'season.current': 'leitura',
  'season.is': 'leitura',
  'season.growth': 'leitura',
  'season.defineProfile': 'escrita',

  'env.get': 'leitura',
  'env.has': 'leitura',
  'env.missing': 'leitura',

  // Unidirecional de propósito. E a redação de segredos (seção 52) acontece do lado de cá, ao
  // gravar: o worker não deve nem saber quais valores são segredo, e o log precisa sair mascarado
  // mesmo que o script imprima a chave de propósito.
  'console.log': 'escrita',
  'console.warn': 'escrita',
  'console.error': 'escrita',
};

/** Os globais apagados no primeiro instante de vida do worker. */
export const GLOBAIS_A_APAGAR: readonly string[] = [
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts',
  'indexedDB', 'caches', 'navigator', 'BroadcastChannel', 'Worker',
  'createImageBitmap', 'crypto', 'performance', 'postMessage',
];

// --- Mensagens do host para o worker -----------------------------------------

export interface MsgCarregar {
  t: 'carregar';
  modId: string;
  /** Constantes que o script vê sem atravessar nada: `mod`, `B`, `audio.nomes`. */
  constantes: Record<string, unknown>;
  scripts: Array<{ key: string; code: string }>;
}

export interface MsgEvento {
  t: 'evento';
  modId: string;
  evento: string;
  payload: unknown;
}

export interface MsgDescarregar { t: 'descarregar'; modId: string }

/**
 * Recompila **um** script de um mod já carregado, sem tocar nos outros.
 *
 * É o que o editor de código faz a cada salvamento. Recarregar o mod inteiro seria mais simples e
 * estaria errado: apagaria o `api.storage` dos outros scripts e dispararia o `load` deles de novo —
 * o autor mexe numa linha de um script e vê o mod inteiro reiniciar.
 */
export interface MsgRecarregar {
  t: 'recarregar';
  modId: string;
  scriptKey: string;
  code: string;
  constantes: Record<string, unknown>;
}

/** Resposta a uma leitura. `ok: false` leva o erro para dentro do `await` do script. */
export interface MsgResposta {
  t: 'resposta';
  id: number;
  ok: boolean;
  valor?: unknown;
  erro?: string;
}

export type ParaOWorker = MsgCarregar | MsgEvento | MsgDescarregar | MsgResposta | MsgRecarregar;

// --- Mensagens do worker para o host -----------------------------------------

export interface MsgChamada {
  t: 'chamada';
  /** Ausente em escrita: sem id não há resposta a casar, e é o que a torna mão única. */
  id?: number;
  modId: string;
  metodo: string;
  args: unknown[];
}

export interface MsgCarregado {
  t: 'carregado';
  modId: string;
  resultados: Array<{ scriptKey: string; ok: boolean; error?: string }>;
  /**
   * Quantos handlers cada evento ganhou, **na mesma mensagem** do resultado da carga.
   *
   * Vinha numa mensagem própria logo depois, e isso era uma corrida: quem chama `loadMod` resolve a
   * promessa quando o resultado chega, e nesse instante a contagem ainda estava em trânsito. O
   * painel de diagnóstico leria zero handlers para um mod recém-carregado — e "carregou mas não tem
   * handler nenhum" é exatamente como um mod quebrado se parece.
   *
   * Duas informações produzidas pelo mesmo ato não devem viajar separadas: quem precisa das duas
   * fica obrigado a sincronizar o que o remetente já sabia junto.
   */
  handlers: Record<string, number>;
}

/** Erro de um handler já em execução — o que decide desligar o script. */
export interface MsgFalha {
  t: 'falha';
  modId: string;
  scriptKey: string;
  erro: string;
}

/**
 * Quantos handlers cada evento tem, quando a contagem muda **fora** da carga.
 *
 * Um handler registrado dentro de outro handler — legítimo, e o motivo de `dispatchTo` copiar a
 * lista antes de percorrer — muda a contagem sem que nenhuma carga tenha acontecido.
 */
export interface MsgHandlers {
  t: 'handlers';
  modId: string;
  contagem: Record<string, number>;
}

/**
 * O worker terminou de descarregar um mod.
 *
 * Existe por um motivo de ordem, não de cortesia. O handler de `unload` costuma **apagar do mundo o
 * que o mod construiu** — é literalmente o que a referência manda fazer nele. As escritas dele
 * chegam como mensagens, e o host precisa saber quando parou de haver mensagens daquele mod para
 * fazer a última drenagem e só então esquecê-lo.
 *
 * Como as mensagens são ordenadas, tudo o que o `unload` escreveu de forma síncrona já está na fila
 * **antes** desta confirmação. Sem ela, a alternativa seria esperar um número arbitrário de quadros
 * — que ou descarta escritas legítimas ou segura contexto morto para sempre.
 */
export interface MsgDescarregado { t: 'descarregado'; modId: string }

export type ParaOHost = MsgChamada | MsgCarregado | MsgFalha | MsgHandlers | MsgDescarregado;

/** As duas pontas só precisam disto — o que permite testar com um duplo em vez de um Worker. */
export interface Porta {
  postMessage(msg: unknown): void;
  onmessage: ((ev: { data: unknown }) => void) | null;
  /**
   * O reino morreu (erro fatal lá dentro, ou o navegador o encerrou).
   *
   * Opcional porque o duplo dos testes não morre. Num `Worker` de verdade é a **única** notificação
   * que existe: sem ela, todos os mods simplesmente param de responder, e nada na tela diz por quê.
   */
  onerror?: ((ev: unknown) => void) | null;
  /** Encerra o reino. Só o `Worker` tem; o duplo ignora. */
  terminate?: () => void;
}
