// A voz vem de onde a pessoa está, e dá para calar quem se quiser — itens 1414 e 1415.
//
// ## O que estava errado
//
// Cada par recebia um `<audio autoplay>` e mais nada. Todo mundo se ouvia no mesmo volume, de
// qualquer distância, de qualquer direção. Num mundo aberto isso apaga a noção de estar perto de
// alguém: quatro pessoas espalhadas por quatrocentos metros soam exatamente como quatro pessoas na
// mesma sala, e a única informação que a voz carregava — *onde você está* — se perdia inteira.
//
// E não havia como emudecer ninguém, só a si mesmo. Num mundo público isso é a diferença entre
// jogar e sair.
//
// ## Por que o elemento `<audio>` continua existindo, mudo
//
// A tentação é jogar o elemento fora e ligar o `MediaStream` direto no Web Audio. Não funciona: no
// Chrome, um stream vindo de `RTCPeerConnection` **não flui** para um `MediaStreamAudioSourceNode`
// se não estiver também ligado a um elemento de mídia. É um defeito conhecido e antigo, e o sintoma
// é o pior possível — nenhum erro, nenhum aviso, e silêncio absoluto.
//
// Então o elemento fica, com `muted = true`: ele existe para fazer o stream correr, e quem produz
// som é o grafo. Sem o `muted`, ouviríamos as duas saídas ao mesmo tempo, uma espacial e outra não.
//
// ## Por que o cálculo mora aqui e não no `AudioSystem`
//
// O `AudioSystem` toca especificações de síntese: ele cria os nós, dispara e descarta. Uma voz é o
// oposto — um grafo que vive enquanto o par estiver conectado e cujos parâmetros mudam a cada
// quadro. Misturar os dois faria o limite de vozes do mixer (24 sons simultâneos) descartar a fala
// de alguém no meio de um desmoronamento.

import { distanceGain, stereoPan } from '../audio/synth';

/**
 * Distância, em voxels, além da qual não se ouve mais ninguém.
 *
 * Bem maior que o alcance dos efeitos (32): a voz é o que permite combinar alguma coisa a distância,
 * e um alcance curto demais transformaria toda conversa em "espera, deixa eu chegar aí". Ainda
 * assim finito, porque o alcance é a mecânica — é ele que faz aproximar-se significar algo.
 */
export const ALCANCE_DA_VOZ = 96;

/**
 * Detector de silêncio para economizar transmissão quando ninguém fala — item 939 P1.
 * Devolve true se o valor RMS do buffer de áudio estiver abaixo do limiar.
 */
export function detectVoiceSilence(samples: Float32Array, threshold = 0.01): boolean {
  if (!samples || samples.length === 0) return true;
  let sumSquare = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSquare += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sumSquare / samples.length);
  return rms < threshold;
}

/**
 * Abaixo desta distância a voz sai em volume cheio e sem panorâmica.
 *
 * Sem essa zona morta, quem está ao lado do jogador tem a voz saltando de um lado para o outro a
 * cada vez que ele mexe o mouse — a panorâmica é calculada da direção do olhar, e a direção de
 * alguém a meio metro muda por completo com um giro pequeno.
 */
export const RAIO_INTIMO = 3;

export interface MisturaDeVoz {
  /** Ganho 0..1. Zero quer dizer que este par não deve ser ouvido agora. */
  ganho: number;
  /** Panorâmica -1 (esquerda) a 1 (direita). */
  pan: number;
}

/**
 * Como a voz deste par deve soar para este ouvinte.
 *
 * Função pura: não conhece Web Audio nem `RTCPeerConnection`, e por isso a regra que decide o que se
 * ouve pode ser verificada sem navegador — que é justamente onde o resto do áudio deste projeto não
 * é verificado por nada.
 */
export function misturaDaVoz(
  ouvinte: { x: number; y: number; z: number; yaw: number },
  falante: { x: number; y: number; z: number } | null,
  silenciado: boolean,
): MisturaDeVoz {
  if (silenciado) return { ganho: 0, pan: 0 };

  // Sem posição conhecida a voz sai plana e inteira. É o caso de quem acabou de entrar e ainda não
  // mandou `player_state`: emudecê-lo seria pior — a primeira coisa que alguém faz ao entrar é
  // falar, e ele seria recebido por um silêncio que ninguém consegue diagnosticar.
  if (!falante) return { ganho: 1, pan: 0 };

  const dx = falante.x - ouvinte.x;
  const dy = falante.y - ouvinte.y;
  const dz = falante.z - ouvinte.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (dist <= RAIO_INTIMO) return { ganho: 1, pan: 0 };

  return {
    ganho: distanceGain(dist, ALCANCE_DA_VOZ),
    pan: stereoPan(falante, ouvinte, ouvinte.yaw),
  };
}

/**
 * Quem o jogador escolheu não ouvir — item 1415.
 *
 * ## Por que persiste, e por que por id
 *
 * Emudecer alguém é uma decisão sobre uma **pessoa**, não sobre uma sessão. Se o silêncio caísse ao
 * reconectar, o jogador teria de refazer a escolha toda vez que a conexão oscilasse — que é
 * exatamente quando ele menos quer mexer em menu.
 *
 * Guardado por id de par, que é o que o jogo tem de estável. Guardar por nome deixaria o silêncio
 * furado por qualquer um que trocasse de apelido, e é a primeira coisa que alguém tenta.
 */
const CHAVE_DE_ARMAZENAMENTO = 'crom:voz:silenciados';

export interface ArmazenamentoDeSilencio {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export class SilenciadosDeVoz {
  private ids = new Set<string>();

  constructor(private armazem?: ArmazenamentoDeSilencio) {
    this.carregar();
  }

  private carregar(): void {
    if (!this.armazem) return;
    try {
      const bruto = this.armazem.getItem(CHAVE_DE_ARMAZENAMENTO);
      if (!bruto) return;
      const lista = JSON.parse(bruto);
      // Um armazenamento corrompido (ou escrito por outra versão) não pode derrubar a entrada num
      // mundo. Silêncio perdido é um aborrecimento; não conseguir entrar é o jogo.
      if (Array.isArray(lista)) for (const id of lista) if (typeof id === 'string') this.ids.add(id);
    } catch {
      /* ignora: ver acima */
    }
  }

  private salvar(): void {
    if (!this.armazem) return;
    try {
      this.armazem.setItem(CHAVE_DE_ARMAZENAMENTO, JSON.stringify([...this.ids]));
    } catch {
      /* cota cheia ou modo privado: o silêncio vale para esta sessão e pronto */
    }
  }

  public estaSilenciado(peerId: string): boolean {
    return this.ids.has(peerId);
  }

  /** Alterna e devolve o estado novo. */
  public alternar(peerId: string): boolean {
    if (this.ids.has(peerId)) this.ids.delete(peerId);
    else this.ids.add(peerId);
    this.salvar();
    return this.ids.has(peerId);
  }

  public silenciar(peerId: string): void {
    if (this.ids.has(peerId)) return;
    this.ids.add(peerId);
    this.salvar();
  }

  public ouvir(peerId: string): void {
    if (!this.ids.delete(peerId)) return;
    this.salvar();
  }

  public lista(): string[] {
    return [...this.ids];
  }

  public limpar(): void {
    this.ids.clear();
    this.salvar();
  }
}
