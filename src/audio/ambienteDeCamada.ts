// Som de ambiente por camada — item 1438.
//
// A névoa mudou de cor ao descer, a luz passou a parar de seguir o sol, e o silêncio continuou
// exatamente o mesmo em todas as profundidades. Metade do "onde estou" é sonora: uma caverna
// silenciosa não é uma caverna, é um corredor com a luz apagada.
//
// ## Por que sons esporádicos e não um drone contínuo
//
// Um zumbido de fundo contínuo seria mais fácil de descrever e pior de ouvir: o ouvido o cancela em
// menos de um minuto e o que sobra é uma perda de nitidez em tudo o mais. O que marca lugar é o som
// **isolado** — um pingo, um estalo, a rocha assentando — porque cada um chega como um evento e
// obriga a reparar de novo em onde se está.
//
// Também é o que a casa já sabe tocar: `AudioSystem.play` dispara uma especificação curta e
// descarta os nós. Um drone exigiria um grafo vivo, com todos os problemas de estado que vêm junto.
//
// ## Por que o intervalo é sorteado, e não fixo
//
// Um período fixo é reconhecível como laço em três repetições, e a partir daí o som deixa de ser
// ambiente e passa a ser um metrônomo. A faixa é larga de propósito.
//
// ## Por que a superfície é muda aqui
//
// Lá em cima quem manda é o bioma e o clima — chuva, trovão, vento. Sobrepor um som de camada
// apagaria a diferença entre o deserto e a taiga que o sistema de biomas existe para criar, que é o
// mesmo motivo pelo qual a superfície não impõe névoa própria.

import { SoundSpec } from './synth';
import { CamadaId } from '../world/camadas';

export interface AmbienteDeCamada {
  /** Sorteado a cada disparo. Mais de um para o lugar não virar um som só, repetido. */
  sons: SoundSpec[];
  /** Faixa de espera entre disparos, em segundos. */
  intervalo: [number, number];
}

/**
 * O que cada camada soa.
 *
 * O ritmo acompanha o `perigo` das camadas de propósito: no abismo os sons chegam com o dobro da
 * frequência do subsolo. Não é enfeite — é a mesma informação que o `perigo` dá ao spawner,
 * entregue ao jogador por um canal que ele não precisa abrir nenhum painel para ler.
 */
export const AMBIENTES: Partial<Record<CamadaId, AmbienteDeCamada>> = {
  subsolo: {
    intervalo: [14, 30],
    sons: [
      // Terra assentando: grave, quase todo ruído, e surdo — nada de agudo atravessa dois metros
      // de terra, e é o corte baixo do filtro que diz "isto veio de trás da parede".
      { freq: 74, freqEnd: 52, duration: 0.85, noise: 0.86, filterHz: 300, gain: 0.20, attack: 0.05 },
      { freq: 96, freqEnd: 66, duration: 0.55, noise: 0.78, filterHz: 380, gain: 0.16, attack: 0.03 },
    ],
  },
  caverna: {
    intervalo: [8, 18],
    sons: [
      // Pingo: ataque quase instantâneo e varredura para baixo. É o som mais reconhecível de
      // caverna que existe, e o único aqui que é mais tom que ruído.
      { freq: 1350, freqEnd: 520, duration: 0.16, noise: 0.12, filterHz: 5200, gain: 0.22, attack: 0.001 },
      { freq: 1080, freqEnd: 430, duration: 0.20, noise: 0.18, filterHz: 4400, gain: 0.18, attack: 0.001 },
      // Eco distante de pedra caindo — grave e longo, para o espaço parecer maior que o alcance da
      // névoa. É o som que sugere que a caverna continua depois do que se enxerga.
      { freq: 210, freqEnd: 90, duration: 1.1, noise: 0.70, filterHz: 900, gain: 0.19, attack: 0.02 },
    ],
  },
  abismo: {
    intervalo: [6, 13],
    sons: [
      // Rocha sob carga: o mais grave e o mais longo de todos. Some quase no limite do audível,
      // que é o ponto — não é para ser identificado, é para ser sentido.
      { freq: 48, freqEnd: 33, duration: 1.9, noise: 0.62, filterHz: 220, gain: 0.24, attack: 0.12 },
      { freq: 62, freqEnd: 40, duration: 1.4, noise: 0.74, filterHz: 260, gain: 0.21, attack: 0.08 },
      // Estalo seco: raro, curto, e o único evento com ataque brusco no fundo. Serve de contraste —
      // sem ele os graves longos viram uma textura, e textura não assusta.
      { freq: 640, freqEnd: 150, duration: 0.28, noise: 0.80, filterHz: 2100, gain: 0.20, attack: 0.002 },
    ],
  },
};

/**
 * Quadros muito longos não devem descontar tempo real do relógio.
 *
 * Voltar de uma aba em segundo plano entrega um `dt` de dezenas de segundos, e sem limite isso
 * dispararia o som do ambiente no instante em que a janela volta — junto com todo o resto do jogo
 * recuperando o atraso. O ambiente seria a única coisa que o jogador notaria naquele engasgo.
 */
const DT_MAXIMO = 0.25;

export interface EstadoDoAmbiente {
  /** Segundos até o próximo disparo. */
  restante: number;
  /** Em que camada o relógio atual foi armado. */
  camada: CamadaId | null;
}

export function criarEstadoDoAmbiente(): EstadoDoAmbiente {
  return { restante: 0, camada: null };
}

function sortearIntervalo(a: AmbienteDeCamada, sorteio: () => number): number {
  return a.intervalo[0] + sorteio() * (a.intervalo[1] - a.intervalo[0]);
}

/**
 * Avança o relógio e devolve o som a tocar neste quadro, ou `null`.
 *
 * ## Trocar de camada apara o relógio, e não o reinicia
 *
 * Ao cruzar uma fronteira o tempo restante é **aparado** ao intervalo da camada nova: continua
 * andando, mas nunca passa do teto dela.
 *
 * Reiniciar era a primeira versão, e tinha um buraco que passou verde: quem caminha bem em cima de
 * uma fronteira — um piso a exatamente catorze metros — troca de camada a cada quadro, e o relógio
 * reiniciado nunca chegaria a zero. O ambiente ficaria mudo exatamente onde deveria estar trocando
 * de identidade, e o sintoma seria indistinguível de "o áudio não está ligado".
 *
 * Aparar resolve os dois lados: o relógio não pode ser esticado por quem sobe e desce de propósito
 * (nunca cresce numa troca), e não pode ser congelado por quem oscila (nunca para de descer).
 *
 * `sorteio` é injetado para o teste poder fixar o resultado: um ambiente que depende de
 * `Math.random` direto só é verificável por estatística, e estatística em teste ou é lenta ou é
 * instável.
 */
export function avancarAmbiente(
  estado: EstadoDoAmbiente,
  camada: CamadaId,
  dt: number,
  sorteio: () => number = Math.random,
): SoundSpec | null {
  const ambiente = AMBIENTES[camada];
  if (!ambiente) {
    // Superfície: nenhum som de camada, e o relógio é esquecido para que voltar a descer comece
    // com uma espera inteira em vez de um disparo imediato.
    estado.camada = null;
    estado.restante = 0;
    return null;
  }

  if (estado.camada !== camada) {
    // Entrando pela superfície (`camada === null`) o relógio começa inteiro; vindo de outra camada
    // ele é aparado ao teto da nova, nunca esticado.
    //
    // O corte usa `intervalo[1]` e não um sorteio novo por dois motivos: não gasta um `Math.random`
    // por quadro para quem oscila numa fronteira, e a garantia fica mais forte — "nunca mais que a
    // maior espera desta camada" não depende de que número saiu.
    estado.restante = estado.camada === null
      ? sortearIntervalo(ambiente, sorteio)
      : Math.min(estado.restante, ambiente.intervalo[1]);
    estado.camada = camada;
  }

  // O desconto acontece **sempre**, inclusive no quadro em que a camada mudou. Descontar só no ramo
  // de "mesma camada" foi a primeira versão: quem anda em cima de uma fronteira troca de camada a
  // cada quadro e o relógio nunca descia um milissegundo. O ambiente ficava mudo exatamente onde
  // deveria estar trocando de identidade.
  estado.restante -= Math.min(Math.max(dt, 0), DT_MAXIMO);
  if (estado.restante > 0) return null;

  estado.restante = sortearIntervalo(ambiente, sorteio);
  const i = Math.min(ambiente.sons.length - 1, Math.floor(sorteio() * ambiente.sons.length));
  return ambiente.sons[i];
}
