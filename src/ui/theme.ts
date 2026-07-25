// Vocabulário visual compartilhado das telas.
//
// Motivo de existir: as sete telas do jogo nasceram uma a uma, cada uma escrevendo o próprio
// `cssText` — a mesma cor de fundo aparecia com três valores levemente diferentes, e o mesmo
// botão tinha quatro variações de padding. O resultado não parecia um sistema, parecia um
// acúmulo. Aqui ficam os tokens e os construtores, e cada tela passa a descrever intenção
// ("botão primário") em vez de repetir declaração.

export const CORES = {
  fundo: '#0b1220',
  fundoElevado: '#0f172a',
  borda: '#1e293b',
  bordaForte: '#334155',
  texto: '#e2e8f0',
  textoFraco: '#94a3b8',
  textoApagado: '#64748b',
  primaria: '#2563eb',
  primariaClara: '#3b82f6',
  perigo: '#7f1d1d',
  aviso: '#fbbf24',
  sucesso: '#4ade80',
} as const;

export const FONTE = "system-ui, -apple-system, 'Segoe UI', sans-serif";
export const FONTE_MONO = "ui-monospace, 'SF Mono', Menlo, monospace";

/** Camadas de empilhamento. Concentradas aqui para não haver disputa de z-index entre telas. */
export const CAMADA = {
  hud: 10,
  dica: 40,
  flutuante: 50,
  tela: 60,
  hub: 70,
  menuInicial: 2000,
} as const;

export type VarianteBotao = 'primario' | 'secundario' | 'perigo' | 'fantasma';

export function botao(texto: string, variante: VarianteBotao = 'secundario'): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = texto;

  const fundo =
    variante === 'primario' ? CORES.primaria
    : variante === 'perigo' ? CORES.perigo
    : variante === 'fantasma' ? 'transparent'
    : CORES.borda;

  b.style.cssText = `
    background: ${fundo};
    border: 1px solid ${variante === 'fantasma' ? 'transparent' : CORES.bordaForte};
    border-radius: 9px; color: ${CORES.texto};
    padding: 9px 14px; font-size: 13px; font-family: ${FONTE};
    cursor: pointer; white-space: nowrap; transition: filter .12s, background .12s;
  `;
  // Realce por filtro em vez de cor fixa: funciona igual nas quatro variantes.
  b.addEventListener('mouseenter', () => { b.style.filter = 'brightness(1.25)'; });
  b.addEventListener('mouseleave', () => { b.style.filter = ''; });
  return b;
}

/** Título de seção — o rótulo pequeno em maiúsculas usado em todas as telas. */
export function rotulo(texto: string): HTMLDivElement {
  const d = document.createElement('div');
  d.textContent = texto;
  d.style.cssText = `
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
    color: ${CORES.textoFraco}; margin-bottom: 7px; font-family: ${FONTE};
  `;
  return d;
}

export function cartao(): HTMLDivElement {
  const d = document.createElement('div');
  d.style.cssText = `
    background: ${CORES.fundoElevado}; border: 1px solid ${CORES.borda};
    border-radius: 10px; padding: 12px 14px;
  `;
  return d;
}

export interface TelaMontada {
  raiz: HTMLDivElement;
  painel: HTMLDivElement;
  cabecalho: HTMLDivElement;
  corpo: HTMLDivElement;
  titulo: HTMLHeadingElement;
  acoes: HTMLDivElement;
}

/**
 * Esqueleto de uma tela cheia: fundo, painel, cabeçalho com título e ações, corpo rolável.
 *
 * Todas as telas de manutenção compartilham este formato — é o que faz o jogador reconhecer
 * onde está o botão de fechar sem procurar, independentemente da tela.
 */
export function montarTela(id: string, tituloTexto: string, camada: number = CAMADA.tela): TelaMontada {
  const raiz = document.createElement('div');
  raiz.id = id;
  raiz.style.cssText = `
    position: fixed; inset: 0; z-index: ${camada}; display: none;
    background: rgba(2, 6, 23, 0.94); backdrop-filter: blur(6px);
    color: ${CORES.texto}; font-family: ${FONTE};
    align-items: center; justify-content: center; padding: 22px; box-sizing: border-box;
  `;

  const painel = document.createElement('div');
  painel.style.cssText = `
    display: flex; flex-direction: column; gap: 14px;
    width: 100%; max-width: 1040px; height: 100%;
    background: ${CORES.fundo}; border: 1px solid ${CORES.borda};
    border-radius: 16px; padding: 20px; box-sizing: border-box; overflow: hidden;
  `;

  const cabecalho = document.createElement('div');
  cabecalho.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:12px;';

  const titulo = document.createElement('h2');
  titulo.textContent = tituloTexto;
  titulo.style.cssText = 'margin:0; font-size:20px; font-weight:700;';

  const acoes = document.createElement('div');
  acoes.style.cssText = 'display:flex; gap:8px; align-items:center;';

  const corpo = document.createElement('div');
  corpo.style.cssText = 'flex:1; min-height:0; overflow-y:auto;';

  cabecalho.append(titulo, acoes);
  painel.append(cabecalho, corpo);
  raiz.appendChild(painel);
  return { raiz, painel, cabecalho, corpo, titulo, acoes };
}

/** Controle deslizante rotulado, com o valor sempre visível. */
export function deslizante(
  nome: string,
  valorInicial: number,
  aoMudar: (v: number) => void,
  opcoes: { min?: number; max?: number; passo?: number; formatar?: (v: number) => string } = {},
): HTMLDivElement {
  const { min = 0, max = 1, passo = 0.05, formatar = (v: number) => `${Math.round(v * 100)}%` } = opcoes;

  const linha = document.createElement('div');
  linha.style.cssText = 'display:flex; align-items:center; gap:12px; margin-bottom:9px;';

  const rot = document.createElement('span');
  rot.textContent = nome;
  rot.style.cssText = `width:110px; font-size:13px; color:${CORES.texto};`;

  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(passo);
  input.value = String(valorInicial);
  input.style.cssText = 'flex:1; accent-color: ' + CORES.primariaClara + ';';

  const valor = document.createElement('span');
  valor.textContent = formatar(valorInicial);
  valor.style.cssText = `width:52px; text-align:right; font-size:12px; color:${CORES.textoFraco}; font-family:${FONTE_MONO};`;

  input.addEventListener('input', () => {
    const v = Number(input.value);
    valor.textContent = formatar(v);
    aoMudar(v);
  });

  linha.append(rot, input, valor);
  return linha;
}
