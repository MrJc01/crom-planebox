// Modal de Gestão e Revogação de Permissões de Mods — item 1399 P1.
import { CAMADA, CORES, FONTE, vazio } from './theme';
import { UIScreen } from './UIManager';
import { ModService } from '../mods/ModService';

export class PermissionsModal implements UIScreen {
  readonly id = 'permissions-modal';
  public isOpen = false;

  private root: HTMLDivElement;
  private container: HTMLDivElement;
  private revokedPermissions = new Map<string, Set<string>>();

  public get raiz(): HTMLElement { return this.root; }

  constructor(private modService: ModService) {
    this.root = document.createElement('div');
    this.root.id = 'permissions-modal-overlay';
    this.root.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(11, 18, 32, 0.85); backdrop-filter: blur(12px);
      z-index: ${CAMADA.tela}; display: flex; align-items: center; justify-content: center;
      opacity: 0; pointer-events: none; transition: opacity 0.2s ease;
    `;

    this.container = document.createElement('div');
    this.container.style.cssText = `
      width: 640px; height: 480px; max-width: 90vw; max-height: 90vh;
      background: ${CORES.fundoElevado}; border: 1px solid ${CORES.bordaForte};
      border-radius: 16px; display: flex; flex-direction: column; overflow: hidden;
      padding: 20px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
      font-family: ${FONTE}; color: ${CORES.texto}; gap: 16px;
    `;
    this.root.appendChild(this.container);
  }

  public isPermissionRevoked(modId: string, permission: string): boolean {
    return this.revokedPermissions.get(modId)?.has(permission) ?? false;
  }

  public revokePermission(modId: string, permission: string): void {
    if (!this.revokedPermissions.has(modId)) {
      this.revokedPermissions.set(modId, new Set());
    }
    this.revokedPermissions.get(modId)!.add(permission);
    this.render();
  }

  public grantPermission(modId: string, permission: string): void {
    this.revokedPermissions.get(modId)?.delete(permission);
    this.render();
  }

  public render(): void {
    this.container.innerHTML = '';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid ' + CORES.borda + '; padding-bottom:12px;';
    header.innerHTML = `
      <div>
        <h3 style="margin:0; font-size:16px; color:${CORES.primariaClara};">Capacidades & Permissões dos Mods</h3>
        <span style="font-size:12px; color:${CORES.textoFraco};">Revogue permissões ativas para proteger seu ambiente.</span>
      </div>
    `;
    this.container.appendChild(header);

    const modsList = document.createElement('div');
    modsList.style.cssText = 'flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:12px;';

    const mods = this.modService.getMods();
    if (mods.length === 0) {
      modsList.appendChild(vazio('Nenhum mod instalado no momento.'));
    } else {
      for (const mod of mods) {
        const card = document.createElement('div');
        card.style.cssText = `
          background: rgba(15, 23, 42, 0.6); border: 1px solid ${CORES.borda};
          border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px;
        `;
        const permissions = (mod as any).permissions ?? ['storage', 'custom_blocks', 'mcp_execution'];

        let permsHtml = '';
        for (const p of permissions) {
          const isRevoked = this.isPermissionRevoked(mod.id, p);
          permsHtml += `
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">
              <span><code>${p}</code></span>
              <button data-mod="${mod.id}" data-perm="${p}" data-revoked="${isRevoked}" style="
                background: ${isRevoked ? '#ef4444' : '#10b981'}; border: none; border-radius: 6px;
                color: white; padding: 4px 10px; font-weight: 600; cursor: pointer; font-size: 11px;
              ">
                ${isRevoked ? 'Revogada (Ativar)' : 'Ativa (Revogar)'}
              </button>
            </div>
          `;
        }

        card.innerHTML = `
          <div style="font-weight:700; font-size:13px; color:${CORES.texto};">${mod.name}</div>
          <div style="display:flex; flex-direction:column; gap:6px;">${permsHtml}</div>
        `;

        card.querySelectorAll('button').forEach((btn) => {
          btn.onclick = () => {
            const mId = btn.dataset.mod!;
            const pName = btn.dataset.perm!;
            if (btn.dataset.revoked === 'true') {
              this.grantPermission(mId, pName);
            } else {
              this.revokePermission(mId, pName);
            }
          };
        });

        modsList.appendChild(card);
      }
    }

    this.container.appendChild(modsList);
  }

  public open(): void {
    this.isOpen = true;
    this.render();
    this.root.style.opacity = '1';
    this.root.style.pointerEvents = 'auto';
  }

  public close(): void {
    this.isOpen = false;
    this.root.style.opacity = '0';
    this.root.style.pointerEvents = 'none';
  }

  public toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }
}
