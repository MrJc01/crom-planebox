// Gerador de ícones 2D/3D isométricos para blocos do inventário a partir das 3 cores reais — item 083.
import { BLOCKS } from '../world/blocks';

export class BlockIconGenerator {
  /**
   * Desenha um bloco 3D isométrico num canvas 2D utilizando as 3 cores reais (topo, lateral, base) da paleta do bloco.
   */
  public static renderIcon(blockId: number, size = 32): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const def = BLOCKS[blockId];
    if (!def || !def.colors) return canvas;

    const [topRGB, sideRGB, baseRGB] = def.colors;

    const toHex = (rgb: number[]) => {
      const r = Math.round(rgb[0] * 255);
      const g = Math.round(rgb[1] * 255);
      const b = Math.round(rgb[2] * 255);
      return `rgb(${r}, ${g}, ${b})`;
    };

    const topColor = toHex(topRGB);
    const sideColor = toHex(sideRGB);
    const baseColor = toHex(baseRGB || sideRGB);

    const cx = size / 2;
    const cy = size / 2;
    const w = size * 0.4;
    const h = size * 0.22;

    // Face Superior (Top Diamond)
    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.moveTo(cx, cy - h * 1.8);
    ctx.lineTo(cx + w, cy - h * 0.9);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx - w, cy - h * 0.9);
    ctx.closePath();
    ctx.fill();

    // Face Esquerda (Side Left)
    ctx.fillStyle = sideColor;
    ctx.beginPath();
    ctx.moveTo(cx - w, cy - h * 0.9);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + h * 1.8);
    ctx.lineTo(cx - w, cy + h * 0.9);
    ctx.closePath();
    ctx.fill();

    // Face Direita (Base/Right Face)
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + w, cy - h * 0.9);
    ctx.lineTo(cx + w, cy + h * 0.9);
    ctx.lineTo(cx, cy + h * 1.8);
    ctx.closePath();
    ctx.fill();

    return canvas;
  }
}
