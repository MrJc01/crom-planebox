// Ferramentas MCP que permitem à IA modificar o FRONTEND (layout/HUD) de forma agentica,
// sempre 100% client-side (só manipula o DOM já renderizado no navegador do usuário).
import { WorldRepository } from '../storage/WorldRepository';
import { UICustomizationRecord } from '../storage/Database';

const UI_TOOL_NAMES = new Set(['modify_ui_style', 'move_hud_element', 'create_custom_panel', 'reset_ui_customizations']);

/** Remove tags/atributos perigosos de HTML gerado pela IA antes de injetar no DOM. */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

export class UIExecutors {
  private worldId: string;
  private customPanels = new Map<string, HTMLElement>();

  constructor(worldId: string) {
    this.worldId = worldId;
  }

  public setWorldId(worldId: string): void {
    this.worldId = worldId;
  }

  public static isUITool(name: string): boolean {
    return UI_TOOL_NAMES.has(name);
  }

  public async execute(name: string, args: any): Promise<{ result: any } | null> {
    switch (name) {
      case 'modify_ui_style': {
        const selector = String(args.selector || '');
        const props = args.css_properties || args.cssProperties || {};
        const elements = document.querySelectorAll<HTMLElement>(selector);
        if (elements.length === 0) return { result: `Nenhum elemento encontrado para o seletor '${selector}'.` };
        for (const el of Array.from(elements)) {
          for (const [prop, value] of Object.entries(props)) {
            (el.style as any)[prop] = String(value);
          }
        }
        await this.persist('style', { selector, cssProperties: props });
        return { result: `Estilo aplicado a ${elements.length} elemento(s) que casam com '${selector}'.` };
      }

      case 'move_hud_element': {
        const elementId = String(args.element_id || args.elementId || '');
        const x = Number(args.x);
        const y = Number(args.y);
        const el = document.getElementById(elementId);
        if (!el) return { result: `Elemento com id '${elementId}' não encontrado no HUD.` };
        el.style.position = 'absolute';
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.right = 'auto';
        el.style.bottom = 'auto';
        await this.persist('move', { elementId, x, y });
        return { result: `Elemento '${elementId}' reposicionado para (${x}, ${y}).` };
      }

      case 'create_custom_panel': {
        const html = sanitizeHtml(String(args.html || ''));
        const css = String(args.css || '');
        const position = args.position || 'top-left';
        const panelId = `ai-panel-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const posStyles: Record<string, string> = {
          'top-left': 'top:16px; left:16px;',
          'top-right': 'top:16px; right:16px;',
          'bottom-left': 'bottom:16px; left:16px;',
          'bottom-right': 'bottom:16px; right:16px;',
          'center': 'top:50%; left:50%; transform:translate(-50%,-50%);',
        };

        const panel = document.createElement('div');
        panel.id = panelId;
        panel.style.cssText = `position:absolute; z-index:50; pointer-events:auto; ${posStyles[position] || posStyles['top-left']}`;
        panel.innerHTML = html;

        if (css) {
          const styleTag = document.createElement('style');
          styleTag.textContent = `#${panelId} { ${css} }`;
          panel.prepend(styleTag);
        }

        document.body.appendChild(panel);
        this.customPanels.set(panelId, panel);
        await this.persist('panel', { panelId, html, css, position });
        return { result: `Painel customizado '${panelId}' criado em '${position}'.` };
      }

      case 'reset_ui_customizations': {
        for (const el of this.customPanels.values()) el.remove();
        this.customPanels.clear();
        await WorldRepository.clearUICustomizations(this.worldId);
        return { result: 'Todas as customizações de UI feitas pela IA foram removidas; o layout voltou ao padrão.' };
      }

      default:
        return null;
    }
  }

  private async persist(kind: UICustomizationRecord['kind'], payload: any): Promise<void> {
    await WorldRepository.saveUICustomization({
      worldId: this.worldId,
      id: `ui-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      kind,
      payload,
      createdAt: Date.now(),
    });
  }

  /** Reaplica customizações salvas ao carregar um mundo (estilos e reposicionamentos; painéis não são recriados automaticamente por simplicidade). */
  public async reapplyPersisted(): Promise<void> {
    const records = await WorldRepository.getUICustomizations(this.worldId);
    for (const rec of records) {
      if (rec.kind === 'style') {
        const elements = document.querySelectorAll<HTMLElement>(rec.payload.selector);
        for (const el of Array.from(elements)) {
          for (const [prop, value] of Object.entries(rec.payload.cssProperties || {})) {
            (el.style as any)[prop] = String(value);
          }
        }
      } else if (rec.kind === 'move') {
        const el = document.getElementById(rec.payload.elementId);
        if (el) {
          el.style.position = 'absolute';
          el.style.left = `${rec.payload.x}px`;
          el.style.top = `${rec.payload.y}px`;
        }
      }
    }
  }
}
