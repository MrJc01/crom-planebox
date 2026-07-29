// Aparência do personagem — proporções e paleta, sem nada de Three.js.
//
// Direção de arte: silhueta estilo Hytale, não Minecraft. A diferença prática está nas
// proporções: cabeça grande e arredondada em relação ao corpo (~1.6 larguras de torso),
// membros mais finos, e peças destacadas (cabelo, viseira do rosto, cinto, botas) em vez de
// um boneco de 6 caixas iguais. Continua tudo em caixas alinhadas ao grid, para casar com o
// mundo voxel e com o mesmo material Lambert dos blocos.
//
// A escala é em metros do mundo: o jogador tem 1.8m, que na régua de mini-voxels do projeto
// (3 por metro) dá os ~5.4 mini-voxels citados no prompt do sistema da IA.

/**
 * Altura do jogador na régua interna das peças, em metros.
 *
 * **Isto não é a unidade do mundo.** As peças são descritas em metros por serem legíveis assim
 * (uma cabeça de 0,52 m se entende; uma de 1,53 mini-voxels, não), e convertidas na hora de
 * desenhar por `ESCALA_MODELO`.
 */
export const PLAYER_HEIGHT = 1.8;

/**
 * Altura do jogador em **unidades de mundo** (mini-voxels), igual à do corpo de colisão em
 * `src/player/controller.ts`.
 *
 * ## O defeito que esta constante corrige
 *
 * O relato foi "a skin está ficando dentro da terra e não respeita as proporções". A causa era
 * uma **incompatibilidade de unidade**, e nada no código a denunciava: a física trabalha em
 * mini-voxels (jogador com 5,3 de altura) e o modelo era construído em metros (1,8) — sem
 * nenhuma conversão entre os dois. O boneco saía com **um terço** do tamanho do próprio corpo de
 * colisão, afundado no chão em relação à câmera, que fica a 4,9 de altura.
 *
 * Os dois números eram certos cada um na sua régua. Nenhum teste podia perceber, porque não
 * havia nada errado com nenhum deles isoladamente — o erro estava no espaço entre os dois.
 */
export const ALTURA_MUNDO = 5.3;

/** Metros → unidades de mundo. É a ponte que faltava. */
export const ESCALA_MODELO = ALTURA_MUNDO / PLAYER_HEIGHT;

/**
 * Proporções verticais, em metros, somando exatamente `PLAYER_HEIGHT`.
 *
 * Cabeça generosa e torso curto: é a leitura da referência de arte voxel, e o que separa a
 * silhueta de um boneco de seis caixas iguais. A soma é verificada em teste — mudar um valor sem
 * compensar outro deixaria o modelo mais alto ou mais baixo que o corpo de colisão, e o sintoma
 * seria de novo o pé afundado ou flutuando.
 */
export const PROPORCOES = {
  bota: 0.10,
  perna: 0.66,
  torso: 0.52,
  cabeca: 0.52,
} as const;

/**
 * Altura das articulações a partir dos pés, **derivada** das proporções.
 *
 * Estavam cravadas no `PlayerModel` (ombro 1,34; quadril 0,80; pescoço 1,40), casando com uma
 * versão anterior das proporções. Mexer numa altura sem lembrar de mexer aqui giraria os membros
 * em torno de um ponto que não é mais a articulação — o braço sairia do ombro. Derivando, isso
 * deixa de ser possível.
 */
export const PIVOS = {
  quadril: PROPORCOES.bota + PROPORCOES.perna,
  ombro: PROPORCOES.bota + PROPORCOES.perna + PROPORCOES.torso - 0.06,
  pescoco: PROPORCOES.bota + PROPORCOES.perna + PROPORCOES.torso,
} as const;

/** Cada peça é uma caixa com tamanho, deslocamento a partir dos pés e uma cor da paleta. */
export interface BodyPartSpec {
  id: string;
  label: string;
  /** Qual cor da paleta pinta esta peça. */
  slot: ColorSlot;
  size: [number, number, number];
  offset: [number, number, number];
  /** Peças que animam junto de um membro; usado pelo `PlayerModel` para o ciclo de caminhada. */
  limb?: 'armLeft' | 'armRight' | 'legLeft' | 'legRight' | 'head';
}

export type ColorSlot = 'skin' | 'hair' | 'shirt' | 'pants' | 'boots' | 'accent' | 'eyes';

export type CharacterRace = 'humano' | 'elfo' | 'anão' | 'orc';

export interface Appearance {
  name: string;
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  boots: string;
  accent: string;
  eyes: string;
  /** Variação de cabelo: 'curto', 'longo', 'moicano' ou 'careca'. */
  hairStyle: HairStyle;
  /** Altura relativa (0.9 a 1.1) — dá variedade de silhueta sem quebrar a colisão. */
  build: number;
  /** Raça do personagem, alterando silhueta e atributos de base — item 1571 P1. */
  race?: CharacterRace;
  /** Dicionário extensível por código para atributos de personagem — item 1572 P1. */
  customAttributes?: Record<string, unknown>;
}

export type HairStyle = 'curto' | 'longo' | 'moicano' | 'careca';

export const HAIR_STYLES: HairStyle[] = ['curto', 'longo', 'moicano', 'careca'];

/** Slots pintáveis na tela de customização, na ordem em que aparecem. */
export const COLOR_SLOTS: { slot: ColorSlot; label: string }[] = [
  { slot: 'skin', label: 'Pele' },
  { slot: 'hair', label: 'Cabelo' },
  { slot: 'eyes', label: 'Olhos' },
  { slot: 'shirt', label: 'Blusa' },
  { slot: 'pants', label: 'Calça' },
  { slot: 'boots', label: 'Botas' },
  { slot: 'accent', label: 'Detalhe' },
];

/**
 * Paleta sugerida. Não é uma trava — a tela de customização também tem seletor livre — mas
 * dá um ponto de partida coerente com os tons sóbrios dos blocos do mundo.
 */
export const SUGGESTED_PALETTE: Record<ColorSlot, string[]> = {
  skin: ['#f5d0b0', '#e8b48c', '#c68642', '#8d5524', '#5c3317', '#9ad1c4'],
  hair: ['#2b1b17', '#5a3825', '#a86b32', '#d9c07a', '#c0c0c0', '#6d28d9'],
  eyes: ['#1e293b', '#0284c7', '#15803d', '#a16207', '#7f1d1d', '#7c3aed'],
  shirt: ['#3b82f6', '#dc2626', '#15803d', '#f59e0b', '#7c3aed', '#e2e8f0'],
  pants: ['#1e293b', '#374151', '#4c1d95', '#7f1d1d', '#065f46', '#78350f'],
  boots: ['#292524', '#57534e', '#7f1d1d', '#1e3a8a', '#365314', '#d6d3d1'],
  accent: ['#fbbf24', '#38bdf8', '#f472b6', '#4ade80', '#f87171', '#e2e8f0'],
};

export const DEFAULT_APPEARANCE: Appearance = {
  name: 'Aventureiro',
  skin: '#e8b48c',
  hair: '#5a3825',
  eyes: '#1e293b',
  shirt: '#3b82f6',
  pants: '#1e293b',
  boots: '#292524',
  accent: '#fbbf24',
  hairStyle: 'curto',
  build: 1,
};

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Higieniza uma aparência vinda do save ou **da rede**. Um convidado mal-comportado pode mandar
 * qualquer coisa no campo de aparência; nada disso pode virar cor ou escala inválida na cena
 * de quem recebe, então tudo que não for hexadecimal reconhecido cai no padrão.
 */
export function sanitizeAppearance(raw: Partial<Appearance> | null | undefined): Appearance {
  const out: Appearance = { ...DEFAULT_APPEARANCE };
  if (!raw || typeof raw !== 'object') return out;

  for (const { slot } of COLOR_SLOTS) {
    const value = (raw as any)[slot];
    if (typeof value === 'string' && HEX.test(value.trim())) out[slot] = value.trim().toLowerCase();
  }

  if (typeof raw.name === 'string' && raw.name.trim()) out.name = raw.name.trim().slice(0, 24);
  if (raw.hairStyle && HAIR_STYLES.includes(raw.hairStyle)) out.hairStyle = raw.hairStyle;

  // Exige número de verdade: `Number(null)` é 0, que passaria por "finito" e viraria o porte
  // mínimo em vez de ser tratado como campo ausente.
  const build = raw.build;
  out.build = typeof build === 'number' && Number.isFinite(build)
    ? Math.min(1.1, Math.max(0.9, build))
    : DEFAULT_APPEARANCE.build;

  return out;
}

export function hexToInt(hex: string): number {
  const parsed = parseInt(String(hex).replace('#', ''), 16);
  return Number.isFinite(parsed) ? parsed : 0xffffff;
}

/**
 * Anatomia do boneco, de baixo para cima. Os offsets são o **centro** de cada caixa medido a
 * partir dos pés, para o modelo poder ser posicionado direto na coordenada do jogador.
 *
 * Proporções (em metros, num total de 1.8):
 *   botas 0.12 · pernas 0.68 · torso 0.60 · cabeça 0.40
 */
export function buildBodyParts(appearance: Appearance): BodyPartSpec[] {
  const a = appearance;
  const parts: BodyPartSpec[] = [];

  const { bota: bootH, perna: legH, torso: torsoH, cabeca: headH } = PROPORCOES;
  const legY = bootH + legH / 2;
  const torsoY = bootH + legH + torsoH / 2;
  const headY = bootH + legH + torsoH + headH / 2;

  // Larguras, seguindo a referência de arte voxel: ombros ESTREITOS — mais estreitos que a
  // cabeça — braços e pernas finos. É a diferença entre a silhueta da referência e um boneco de
  // caixas iguais, e o que faz a cabeça grande ler como estilo em vez de erro de escala.
  const larguraTorso = 0.40;
  const larguraBraco = 0.12;
  const larguraPerna = 0.16;
  const larguraCabeca = 0.46;
  const xBraco = larguraTorso / 2 + larguraBraco / 2;   // encostado no torso, sem afundar nele
  const xPerna = larguraPerna / 2 + 0.01;               // folga de 1 cm entre as pernas
  const bracoH = 0.50;
  const maoH = 0.10;

  parts.push(
    { id: 'bootLeft', label: 'Bota esquerda', slot: 'boots', size: [larguraPerna + 0.02, bootH, 0.22], offset: [-xPerna, bootH / 2, 0.01], limb: 'legLeft' },
    { id: 'bootRight', label: 'Bota direita', slot: 'boots', size: [larguraPerna + 0.02, bootH, 0.22], offset: [xPerna, bootH / 2, 0.01], limb: 'legRight' },
    { id: 'legLeft', label: 'Perna esquerda', slot: 'pants', size: [larguraPerna, legH, 0.18], offset: [-xPerna, legY, 0], limb: 'legLeft' },
    { id: 'legRight', label: 'Perna direita', slot: 'pants', size: [larguraPerna, legH, 0.18], offset: [xPerna, legY, 0], limb: 'legRight' },
    { id: 'torso', label: 'Torso', slot: 'shirt', size: [larguraTorso, torsoH, 0.24], offset: [0, torsoY, 0] },
    { id: 'belt', label: 'Cinto', slot: 'accent', size: [larguraTorso + 0.02, 0.07, 0.26], offset: [0, PIVOS.quadril + 0.035, 0] },
    // O braço pende do OMBRO: o centro fica meio comprimento abaixo dele. Escrever assim, e não
    // como um número solto, é o que mantém o ombro no lugar quando as proporções mudam.
    { id: 'armLeft', label: 'Braço esquerdo', slot: 'shirt', size: [larguraBraco, bracoH, 0.14], offset: [-xBraco, PIVOS.ombro - bracoH / 2, 0], limb: 'armLeft' },
    { id: 'armRight', label: 'Braço direito', slot: 'shirt', size: [larguraBraco, bracoH, 0.14], offset: [xBraco, PIVOS.ombro - bracoH / 2, 0], limb: 'armRight' },
    { id: 'handLeft', label: 'Mão esquerda', slot: 'skin', size: [larguraBraco + 0.02, maoH, 0.15], offset: [-xBraco, PIVOS.ombro - bracoH - maoH / 2, 0], limb: 'armLeft' },
    { id: 'handRight', label: 'Mão direita', slot: 'skin', size: [larguraBraco + 0.02, maoH, 0.15], offset: [xBraco, PIVOS.ombro - bracoH - maoH / 2, 0], limb: 'armRight' },
    // Cabeça generosa e quase cúbica: é a marca da silhueta da referência.
    { id: 'head', label: 'Cabeça', slot: 'skin', size: [larguraCabeca, headH, 0.44], offset: [0, headY, 0], limb: 'head' },
    { id: 'eyeLeft', label: 'Olho esquerdo', slot: 'eyes', size: [0.09, 0.07, 0.02], offset: [-0.11, headY + 0.03, -0.22], limb: 'head' },
    { id: 'eyeRight', label: 'Olho direito', slot: 'eyes', size: [0.09, 0.07, 0.02], offset: [0.11, headY + 0.03, -0.22], limb: 'head' },
  );

  // Cabelo: peças extras por estilo, sempre coladas ao volume da cabeça.
  if (a.hairStyle === 'curto') {
    parts.push({ id: 'hairTop', label: 'Cabelo', slot: 'hair', size: [0.44, 0.1, 0.42], offset: [0, headY + headH / 2 - 0.03, 0], limb: 'head' });
    parts.push({ id: 'hairBack', label: 'Cabelo (nuca)', slot: 'hair', size: [0.44, 0.24, 0.06], offset: [0, headY, 0.19], limb: 'head' });
  } else if (a.hairStyle === 'longo') {
    parts.push({ id: 'hairTop', label: 'Cabelo', slot: 'hair', size: [0.44, 0.12, 0.42], offset: [0, headY + headH / 2 - 0.02, 0], limb: 'head' });
    parts.push({ id: 'hairBack', label: 'Cabelo (comprido)', slot: 'hair', size: [0.44, 0.5, 0.08], offset: [0, headY - 0.14, 0.21], limb: 'head' });
    parts.push({ id: 'hairSideL', label: 'Mecha esquerda', slot: 'hair', size: [0.06, 0.3, 0.4], offset: [-0.22, headY - 0.02, 0], limb: 'head' });
    parts.push({ id: 'hairSideR', label: 'Mecha direita', slot: 'hair', size: [0.06, 0.3, 0.4], offset: [0.22, headY - 0.02, 0], limb: 'head' });
  } else if (a.hairStyle === 'moicano') {
    parts.push({ id: 'hairMohawk', label: 'Moicano', slot: 'hair', size: [0.1, 0.22, 0.42], offset: [0, headY + headH / 2 + 0.06, 0], limb: 'head' });
  }
  // 'careca' não adiciona nada.

  return parts;
}
