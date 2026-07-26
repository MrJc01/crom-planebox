// Vocabulário visual compartilhado das telas.
//
// Motivo de existir: as sete telas do jogo nasceram uma a uma, cada uma escrevendo o próprio
// `cssText` — a mesma cor de fundo aparecia com três valores levemente diferentes, e o mesmo
// botão tinha quatro variações de padding. O resultado não parecia um sistema, parecia um
// acúmulo. Aqui ficam os tokens e os construtores, e cada tela passa a descrever intenção
// ("botão primário") em vez de repetir declaração.

/**
 * Paleta.
 *
 * Azul-noite para as superfícies, **âmbar para o que está ativo**. A escolha do âmbar como cor de
 * seleção — em vez do azul que era usado antes — resolve um problema concreto: o azul de destaque
 * ficava perto demais do azul do fundo, e a aba ativa não se distinguia das inativas num relance.
 * Duas cores da mesma família disputando o papel de "isto aqui" é o que faz uma interface parecer
 * confusa sem que se saiba dizer por quê.
 *
 * O azul segue existindo, mas para **ação** (botão que faz algo), não para **estado** (o que está
 * selecionado). Separar os dois papéis é o que deixa a tela legível de longe.
 */
export const CORES = {
  fundo: '#0b1220',
  fundoElevado: '#0f172a',
  /** Superfície de painel dentro de uma tela — um degrau acima do elevado. */
  painel: '#141c2e',
  borda: '#1e293b',
  bordaForte: '#334155',
  texto: '#e2e8f0',
  textoFraco: '#94a3b8',
  textoApagado: '#64748b',
  /** Ação. Botão que executa. */
  primaria: '#2563eb',
  primariaClara: '#3b82f6',
  perigo: '#7f1d1d',
  perigoClaro: '#ef4444',
  /** Estado. O que está ativo, selecionado, em foco. */
  aviso: '#fbbf24',
  avisoFraco: 'rgba(251,191,36,0.12)',
  sucesso: '#4ade80',
} as const;

/** Espaçamentos, para os painéis não terem cada um o seu padding. */
export const ESPACO = { xs: 4, sm: 8, md: 14, lg: 20, xl: 28 } as const;

export const RAIO = { sm: '6px', md: '10px', lg: '14px' } as const;

/**
 * Ponto de quebra único.
 *
 * Um só, e não uma escala: as telas do jogo têm dois estados — cabe lado a lado, ou não cabe.
 * Inventar `sm/md/lg/xl` aqui produziria variações que ninguém testaria.
 */
export const ESTREITO = '(max-width: 860px)';

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

/**
 * Painel com moldura — a superfície padrão de conteúdo dentro de uma tela.
 *
 * Existe como função, e não como classe CSS, porque o projeto não tem folha de estilo: cada tela
 * escreve `cssText`. Centralizar aqui é o que impede a mesma moldura de aparecer com três
 * espessuras de borda diferentes em três telas.
 */
export function painel(titulo?: string): HTMLDivElement {
  const d = document.createElement('div');
  d.style.cssText = `
    background: ${CORES.painel};
    border: 1px solid ${CORES.borda};
    border-radius: ${RAIO.md};
    padding: ${ESPACO.md}px;
    display: flex; flex-direction: column; gap: ${ESPACO.sm}px;
    min-width: 0; min-height: 0;
  `;
  if (titulo) {
    const h = document.createElement('h3');
    h.textContent = titulo;
    h.style.cssText = `
      margin: 0 0 ${ESPACO.xs}px; font-size: 12px; font-weight: 700;
      letter-spacing: .08em; text-transform: uppercase; color: ${CORES.textoApagado};
    `;
    d.append(h);
  }
  return d;
}

/**
 * Grade que vira coluna quando não cabe.
 *
 * `auto-fit` com `minmax` faz a responsividade sem media query nenhuma: as colunas se acomodam
 * sozinhas, e abaixo da largura mínima viram uma só. É menos código e não tem ponto de quebra
 * para acertar.
 */
export function grade(minimoPx = 240, espaco = ESPACO.md): HTMLDivElement {
  const d = document.createElement('div');
  d.style.cssText = `
    display: grid; gap: ${espaco}px; min-height: 0;
    grid-template-columns: repeat(auto-fit, minmax(min(${minimoPx}px, 100%), 1fr));
  `;
  return d;
}

/** Linha rótulo → controle, alinhada, que empilha em tela estreita. */
export function linha(rotulo: string, controle: HTMLElement, ajuda?: string): HTMLDivElement {
  const d = document.createElement('div');
  d.style.cssText = `display: flex; flex-direction: column; gap: ${ESPACO.xs}px;`;

  const l = document.createElement('label');
  l.textContent = rotulo;
  l.style.cssText = `font-size: 12px; font-weight: 600; color: ${CORES.texto};`;
  d.append(l);

  if (ajuda) {
    const a = document.createElement('div');
    a.textContent = ajuda;
    a.style.cssText = `font-size: 11px; color: ${CORES.textoApagado}; line-height: 1.4;`;
    d.append(a);
  }
  d.append(controle);
  return d;
}

/** Aviso em faixa: informação, atenção ou erro. */
export function faixa(texto: string, tom: 'info' | 'atencao' | 'erro' = 'info'): HTMLDivElement {
  const cor = tom === 'erro' ? CORES.perigoClaro : tom === 'atencao' ? CORES.aviso : CORES.textoFraco;
  const d = document.createElement('div');
  d.textContent = texto;
  d.style.cssText = `
    background: rgba(255,255,255,0.03); border: 1px solid ${cor}55;
    border-left: 3px solid ${cor};
    color: ${cor}; padding: ${ESPACO.sm}px ${ESPACO.md}px;
    border-radius: ${RAIO.sm}; font-size: 12px; line-height: 1.5;
  `;
  return d;
}

/** Estado vazio: diz o que fazer, em vez de deixar a área em branco. */
export function vazio(mensagem: string, dica?: string): HTMLDivElement {
  const d = document.createElement('div');
  d.style.cssText = `
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: ${ESPACO.sm}px; padding: ${ESPACO.xl}px; text-align: center; color: ${CORES.textoApagado};
  `;
  const m = document.createElement('div');
  m.textContent = mensagem;
  m.style.cssText = 'font-size: 14px;';
  d.append(m);
  if (dica) {
    const s = document.createElement('div');
    s.textContent = dica;
    s.style.cssText = 'font-size: 12px; opacity: .75; max-width: 42ch; line-height: 1.5;';
    d.append(s);
  }
  return d;
}

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
 * Esqueleto de uma tela fullscreen — estilo game UI, não modal web.
 *
 * O overlay cobre a tela inteira com um fundo semitransparente que deixa o mundo 3D visível
 * atrás. O header é uma barra full-width no topo. O corpo preenche todo o espaço restante
 * com padding lateral generoso.
 *
 * Todas as telas de manutenção compartilham este formato — é o que faz o jogador reconhecer
 * onde está o botão de fechar sem procurar, independentemente da tela.
 */
export function montarTela(id: string, tituloTexto: string, camada: number = CAMADA.tela): TelaMontada {
  const raiz = document.createElement('div');
  raiz.id = id;
  raiz.style.cssText = `
    position: fixed; inset: 0; z-index: ${camada}; display: none;
    background: rgba(6, 10, 20, 0.82); backdrop-filter: blur(10px);
    color: ${CORES.texto}; font-family: ${FONTE};
    flex-direction: column; box-sizing: border-box;
  `;

  /* O painel agora é um flex-column que ocupa tudo — sem max-width, sem border-radius. */
  const painel = document.createElement('div');
  painel.style.cssText = `
    display: flex; flex-direction: column;
    width: 100%; height: 100%; box-sizing: border-box; overflow: hidden;
  `;

  const cabecalho = document.createElement('div');
  cabecalho.style.cssText = `
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 12px 40px; flex: 0 0 auto;
    background: rgba(15, 23, 42, 0.7); border-bottom: 1px solid rgba(255,255,255,0.08);
  `;

  const titulo = document.createElement('h2');
  titulo.textContent = tituloTexto;
  titulo.style.cssText = `margin:0; font-size:17px; font-weight:700; color:${CORES.aviso}; letter-spacing:1px;`;

  const acoes = document.createElement('div');
  acoes.style.cssText = 'display:flex; gap:8px; align-items:center;';

  const corpo = document.createElement('div');
  corpo.style.cssText = 'flex:1; min-height:0; overflow-y:auto; padding: 20px 40px;';

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
