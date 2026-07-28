// Protocolo JSON trocado entre host e peers via WebRTC DataChannel.
// Nenhuma dessas mensagens passa pelo relay de sinalização — só trafegam
// diretamente entre os clientes depois que a conexão P2P é estabelecida.
// Ver docs/NETWORK_PROTOCOL.md para a descrição completa.

import { Appearance } from '../player/Appearance';
import { ModPackage } from '../mods/ModTypes';

export interface BlockUpdateMsg {
  type: 'block_update';
  x: number; y: number; z: number; blockType: number;
}

/**
 * Lote de blocos do mesmo frame.
 *
 * Uma construção da IA ou um desmoronamento altera centenas de blocos de uma vez. Mandar uma
 * mensagem por bloco paga o cabeçalho centenas de vezes; agrupar paga uma.
 */
export interface BlockBatchMsg {
  type: 'block_batch';
  blocks: { x: number; y: number; z: number; blockType: number }[];
}

export interface EntityUpdateMsg {
  type: 'entity_update';
  id: string; x: number; y: number; z: number;
}

export interface PlayerStateMsg {
  type: 'player_state';
  playerId: string; name: string;
  x: number; y: number; z: number; yaw: number; pitch: number;
  gameMode: string; health: number; hunger: number;
  /**
   * Aparência do personagem, para os outros verem o boneco customizado em vez de um genérico.
   * Opcional: um peer de versão antiga simplesmente não manda, e cai no padrão.
   * SEMPRE passar por `sanitizeAppearance` ao receber — vem de outro cliente.
   */
  appearance?: Appearance;
  /**
   * Hash da aparência que o remetente está usando. Vai em todo pacote binário; a aparência
   * inteira só é enviada quando o hash muda. Ver `hashAppearance` em `codec.ts`.
   */
  appearanceHash?: number;
}

export interface ChatMessageMsg {
  type: 'chat_message';
  playerId: string; name: string; text: string; timestamp: number;
}

export interface CommandMsg {
  type: 'command';
  playerId: string; raw: string;
}

/**
 * Identidade do TERRENO do anfitrião. Enviada assim que um convidado conecta, antes de tudo.
 *
 * ## Por que esta mensagem precisou existir
 *
 * O relato foi "o mundo não é o mesmo no multiplayer", e a causa era simples e total: o mundo do
 * convidado era criado com `seed: Math.floor(Math.random() * 1000000)`. **Uma semente aleatória.**
 * O terreno é gerado a partir dela, então cada jogador via um mundo inteiramente diferente.
 *
 * O `full_sync` mandava blocos, jogadores e mods — ou seja, só o que foi EDITADO à mão. Sobre um
 * terreno gerado diferente, essas edições caem no vazio: uma casa construída num morro do
 * anfitrião aparece flutuando, ou enterrada, no mundo do convidado.
 *
 * A semente não podia ir no `full_sync` porque este chega tarde demais: quando ele chega, o
 * convidado já gerou terreno. Esta mensagem é a primeira coisa que o anfitrião envia, e o
 * convidado espera por ela **antes de criar o mundo**.
 */
export interface WorldInfoMsg {
  type: 'world_info';
  /** A semente do anfitrião. É o que faz os dois gerarem exatamente o mesmo terreno. */
  seed: number;
  /** Altura base do terreno — o outro parâmetro que muda a geração. */
  groundHeight: number;
  /** Nome do mundo do anfitrião, para o convidado não ficar com "Visitante de room-xyz". */
  name: string;
}

/**
 * Retrato das criaturas do anfitrião. Enviado periodicamente, só por ele.
 *
 * ## Por que um retrato inteiro, e não um evento por criatura
 *
 * Já existia `EntityUpdateMsg` (id, x, y, z) no protocolo — **definida e nunca enviada nem
 * recebida por ninguém**. Ela também não bastaria: com só posições, o convidado nunca fica
 * sabendo que uma criatura **nasceu** (não sabe o tipo) nem que **morreu** (não chega mensagem
 * nenhuma; a ausência não é um evento). Um zumbi morto pelo anfitrião ficaria parado para
 * sempre na tela do convidado.
 *
 * Um retrato resolve os três casos com uma regra só: o que está na lista existe, o que não está
 * deixou de existir. E é auto-corretivo — uma mensagem perdida some no retrato seguinte, em vez
 * de deixar estado divergente para sempre.
 *
 * O custo é enviar tudo sempre; com dezenas de criaturas e poucos envios por segundo, é
 * irrelevante perto da robustez que compra.
 */
export interface MobSyncMsg {
  type: 'mob_sync';
  mobs: { id: string; kind: string; x: number; y: number; z: number; health: number }[];
}

export interface FullSyncMsg {
  type: 'full_sync';
  blockMods: { x: number; y: number; z: number; blockType: number }[];
  players: { playerId: string; name: string; isOp: boolean }[];
  /**
   * Mods do mundo do anfitrião. Precisam chegar ANTES de `blockMods` serem aplicados: sem eles
   * o convidado recebe posições com ids de bloco que não existem no registro dele e enxerga
   * "bloco ausente" em magenta onde o anfitrião vê o bloco de verdade.
   * Ausente em anfitriões de versão antiga — tratado como lista vazia.
   */
  mods?: ModPackage[];
}

/**
 * Um mod criado ou alterado durante a partida. Enviado pelo anfitrião para os convidados
 * registrarem o bloco na hora, sem precisar de um `full_sync` inteiro.
 */
export interface ModSyncMsg {
  type: 'mod_sync';
  mod: ModPackage;
}

/**
 * Relógio do mundo, enviado pelo anfitrião.
 *
 * Sem isto, cada par contava o próprio tempo a partir do momento em que entrou: dois jogadores no
 * mesmo mundo viam horas do dia diferentes, fases da lua diferentes e — desde que o clima passou
 * a ser derivado de (semente, dia) — climas diferentes no mesmo lugar.
 *
 * É barato de propósito: dois números, mandados de tempos em tempos. O convidado **não** ajusta o
 * relógio de uma vez quando a diferença é pequena; ele corre um pouco mais rápido ou mais devagar
 * até alcançar. Saltar faria o sol pular no céu a cada mensagem.
 */
export interface WorldTimeMsg {
  type: 'world_time';
  /** Fração do dia, 0..1. */
  timeOfDay: number;
  /** Dias completos desde a criação — governa a fase da lua e a sequência do clima. */
  worldDay: number;
  /** Clima imposto pelo anfitrião, ou ausente se o mundo segue a sequência natural. */
  forcedWeather?: string | null;
}

export interface PlayerJoinedMsg { type: 'player_joined'; playerId: string; name: string; appearance?: Appearance }
export interface PlayerLeftMsg { type: 'player_left'; playerId: string }
export interface OpChangedMsg { type: 'op_changed'; playerId: string; isOp: boolean }
export interface KickMsg { type: 'kick'; playerId: string }

/**
 * Baús no mundo compartilhado — item 1522.
 *
 * ## Por que o anfitrião é o dono
 *
 * O conteúdo do baú vive no banco local de quem o abriu. Sem autoridade, dois jogadores mexendo no
 * mesmo baú escreveriam por cima um do outro, e cada um veria um conteúdo diferente do mesmo bloco
 * — a forma mais confusa possível de perder itens, porque cada um jura que guardou.
 *
 * O convidado **pede** e o anfitrião **responde**: nenhuma escrita de baú acontece no convidado.
 * É a mesma regra que já vale para o mundo e para as criaturas, e por isso não introduz um segundo
 * modelo de consistência.
 */
export interface ChestOpenMsg { type: 'chest_open'; key: string }
export interface ChestStateMsg {
  type: 'chest_state';
  key: string;
  slots: ({ block: number; count: number } | null)[];
}
/**
 * Um movimento pedido pelo convidado.
 *
 * `indice` para retirar; `block`/`count` para guardar. Uma mensagem só, e não duas, porque as duas
 * operações competem pelo mesmo estado — separá-las convidaria a tratá-las em ordens diferentes.
 */
export interface ChestMoveMsg {
  type: 'chest_move';
  key: string;
  acao: 'retirar' | 'guardar';
  indice?: number;
  block?: number;
  count?: number;
}

export type NetMessage =
  | BlockUpdateMsg
  | BlockBatchMsg
  | EntityUpdateMsg
  | PlayerStateMsg
  | ChatMessageMsg
  | CommandMsg
  | WorldInfoMsg
  | MobSyncMsg
  | FullSyncMsg
  | ModSyncMsg
  | WorldTimeMsg
  | PlayerJoinedMsg
  | PlayerLeftMsg
  | OpChangedMsg
  | KickMsg
  | ChestOpenMsg
  | ChestStateMsg
  | ChestMoveMsg;
