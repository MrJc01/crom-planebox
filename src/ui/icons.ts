// Ícones da interface — SVG inline, desenhados aqui.
//
// ## Por que não emoji
//
// Emoji era o que existia antes, e traz três problemas que só aparecem depois: cada sistema
// operacional desenha o seu (o mesmo menu fica com cara diferente em Windows, Linux e Mac), a cor
// é fixa e ignora o tema, e o alinhamento vertical varia por fonte — o que explica os ícones
// desencontrados nas listas.
//
// ## Por que não uma biblioteca
//
// Um pacote de ícones traria centenas de arquivos para usar dezenas, e um `<link>` para CDN não
// funciona: o jogo precisa abrir sem rede. Estes são traçados à mão, no mesmo estilo — linha de
// 1,8, cantos arredondados, grade de 24.
//
// `currentColor` no traço é o que faz o ícone herdar a cor do texto: um botão em estado
// desabilitado, realçado ou de perigo acerta o ícone sem nenhuma regra a mais.

export type NomeIcone =
  | 'inventario' | 'crafting' | 'personagem' | 'missoes' | 'mods' | 'codigo'
  | 'mundo' | 'chat' | 'engrenagem' | 'jogar' | 'voltar' | 'fechar'
  | 'mapa' | 'rede' | 'chave' | 'aviso' | 'grafico' | 'lupa'
  | 'mais' | 'lixeira' | 'download' | 'upload' | 'historico' | 'coracao' | 'gota' | 'bolha';

/** Traçados de cada ícone, no espaço 24×24. Só o miolo — o invólucro é montado por `icone()`. */
const TRACOS: Record<NomeIcone, string> = {
  inventario: '<path d="M4 8h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z"/><path d="M4 8l2-4h12l2 4"/><path d="M10 12h4"/>',
  crafting: '<path d="M14 7l3-3 3 3-3 3-3-3Z"/><path d="M12 9L4 17v3h3l8-8"/><path d="M9 12l3 3"/>',
  personagem: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  missoes: '<path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v6h6"/><path d="M9 13h6M9 17h4"/>',
  mods: '<path d="M4 6a2 2 0 0 1 2-2h5v4a2 2 0 0 0 4 0V4h3a2 2 0 0 1 2 2v3h-4a2 2 0 0 0 0 4h4v5a2 2 0 0 1-2 2h-5v-4a2 2 0 0 0-4 0v4H6a2 2 0 0 1-2-2V6Z"/>',
  codigo: '<path d="M9 8l-5 4 5 4"/><path d="M15 8l5 4-5 4"/>',
  mundo: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z"/>',
  chat: '<path d="M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9Z"/>',
  engrenagem: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
  jogar: '<path d="M7 4l13 8-13 8V4Z"/>',
  voltar: '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
  fechar: '<path d="M18 6L6 18M6 6l12 12"/>',
  mapa: '<path d="M9 4L3 7v13l6-3 6 3 6-3V4l-6 3-6-3Z"/><path d="M9 4v13M15 7v13"/>',
  rede: '<circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v4M12 11l-5 6M12 11l5 6"/>',
  chave: '<circle cx="7" cy="15" r="4"/><path d="M10 12l9-9 3 3-3 3-2-2-2 2"/>',
  aviso: '<path d="M12 3l9 17H3l9-17Z"/><path d="M12 10v4M12 17h.01"/>',
  grafico: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  lupa: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  lixeira: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/><path d="M9 7V4h6v3"/>',
  download: '<path d="M12 3v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>',
  upload: '<path d="M12 21V9"/><path d="M7 13l5-5 5 5"/><path d="M4 4h16"/>',
  historico: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v5l3 2"/>',
  coracao: '<path d="M12 20s-7-4.6-7-9.5A4 4 0 0 1 12 7a4 4 0 0 1 7 3.5C19 15.4 12 20 12 20Z"/>',
  gota: '<path d="M12 3s6 6.5 6 10.5a6 6 0 0 1-12 0C6 9.5 12 3 12 3Z"/>',
  // Bolha de ar — item 126. Círculo com um brilho, para não se confundir com a gota da fome, que
  // tem a mesma cor de família e estaria logo acima na tela.
  bolha: '<circle cx="12" cy="12" r="7.5"/><path d="M9 8.6a4.6 4.6 0 0 0-1.6 2.2"/>',
};

/**
 * Elemento SVG de um ícone.
 *
 * `aria-hidden` porque o ícone sempre acompanha um rótulo em texto — anunciá-lo faria o leitor de
 * tela dizer a mesma coisa duas vezes.
 */
export function icone(nome: NomeIcone, tamanho = 18): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(tamanho));
  svg.setAttribute('height', String(tamanho));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.flex = '0 0 auto';
  svg.innerHTML = TRACOS[nome] ?? TRACOS.aviso;
  return svg;
}

/** Versão em texto, para onde só cabe uma string (títulos de `document.title`, logs). */
export function icone_svg(nome: NomeIcone, tamanho = 18): string {
  return (
    `<svg viewBox="0 0 24 24" width="${tamanho}" height="${tamanho}" fill="none" ` +
    `stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true">${TRACOS[nome] ?? TRACOS.aviso}</svg>`
  );
}

export function existeIcone(nome: string): nome is NomeIcone {
  return nome in TRACOS;
}
