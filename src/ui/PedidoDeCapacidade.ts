// A pergunta que decide se um mod fala com um endereço — item 763.
//
// ## Por que não é um `confirm()`
//
// O `confirm()` do navegador não mostra o **motivo** declarado pelo mod, não distingue "ler" de
// "enviar", e a frase dele é sempre a mesma para qualquer pergunta. Uma permissão que se apresenta
// igual para "buscar a previsão do tempo" e para "mandar o seu mundo para um servidor" está pedindo
// para ser clicada sem leitura.
//
// ## O que esta tela mostra, e por que cada pedaço está aqui
//
// O **host**, em destaque: é o dado que o jogador consegue julgar. "Este mod usa a internet" não é
// julgável; `api.previsao-do-tempo.com` é.
//
// O **motivo declarado pelo autor**, em linguagem de jogador — é o que a validação do manifesto
// exige que exista (`rede.motivo`), e é a única parte que explica *para quê*.
//
// E o aviso de **envio**, separado, quando o mod declarou `envia`. Ler de um endereço e mandar
// coisas para ele são permissões diferentes, e juntá-las numa frase só apagaria a mais séria das
// duas.

import { CAMADA } from './theme';

export interface PedidoDeCapacidade {
  nomeDoMod: string;
  host: string;
  motivo: string;
  envia: boolean;
}

/**
 * Mostra o pedido e resolve com a decisão do jogador.
 *
 * O padrão de fechar sem escolher é **não**. Recusar por omissão é a única opção honesta: o jogador
 * que fecha a caixa não disse sim, e tratar silêncio como consentimento é o oposto do que a
 * permissão existe para garantir.
 */
export function pedirCapacidade(pedido: PedidoDeCapacidade): Promise<boolean> {
  return new Promise((resolver) => {
    const fundo = document.createElement('div');
    fundo.style.cssText = `
      position: fixed; inset: 0; background: rgba(6,10,20,0.82); backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center;
      z-index: ${CAMADA.aviso}; font-family: 'Segoe UI', system-ui, sans-serif;
    `;

    const caixa = document.createElement('div');
    caixa.style.cssText = `
      width: min(460px, 92vw); background: #0f172a; color: #e2e8f0;
      border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; padding: 22px 24px;
      box-shadow: 0 18px 50px rgba(0,0,0,0.5);
    `;

    const aviso = pedido.envia
      ? `<div style="margin-top:14px; padding:10px 12px; border-radius:9px;
                     background:rgba(239,68,68,0.10); border:1px solid rgba(239,68,68,0.35);
                     color:#fca5a5; font-size:12px; line-height:1.5;">
           Este mod também <strong>envia dados</strong> para esse endereço, além de ler.
         </div>`
      : '';

    caixa.innerHTML = `
      <div style="font-size:11px; letter-spacing:0.09em; text-transform:uppercase; color:#64748b;">
        Permissão de rede
      </div>
      <div style="font-size:17px; font-weight:700; color:#f8fafc; margin-top:6px;">
        "${escapar(pedido.nomeDoMod)}" quer falar com:
      </div>
      <div style="font-family:monospace; font-size:15px; color:#38bdf8; margin-top:10px;
                  padding:9px 12px; background:rgba(56,189,248,0.08);
                  border:1px solid rgba(56,189,248,0.28); border-radius:9px; word-break:break-all;">
        ${escapar(pedido.host)}
      </div>
      <div style="font-size:13px; color:#94a3b8; margin-top:12px; line-height:1.6;">
        <strong style="color:#cbd5e1;">Motivo declarado:</strong> ${escapar(pedido.motivo)}
      </div>
      ${aviso}
      <div style="font-size:11px; color:#64748b; margin-top:14px; line-height:1.5;">
        Nada é enviado até você permitir, e você pode revogar depois em Mods › Capacidades.
      </div>
    `;

    const linha = document.createElement('div');
    linha.style.cssText = 'display:flex; gap:10px; justify-content:flex-end; margin-top:18px;';

    const decidir = (valor: boolean) => {
      fundo.remove();
      document.removeEventListener('keydown', aoTeclar, true);
      resolver(valor);
    };

    // Escape recusa. É o reflexo de quem quer sair da caixa, e o reflexo precisa cair no lado
    // seguro — não no lado que concede.
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      decidir(false);
    };
    document.addEventListener('keydown', aoTeclar, true);
    fundo.onclick = (e) => { if (e.target === fundo) decidir(false); };

    const negar = document.createElement('button');
    negar.textContent = 'Não permitir';
    negar.style.cssText = 'background:transparent; border:1px solid rgba(255,255,255,0.18); color:#cbd5e1; padding:9px 16px; border-radius:9px; cursor:pointer; font-size:13px;';
    negar.onclick = () => decidir(false);

    const permitir = document.createElement('button');
    permitir.textContent = 'Permitir este endereço';
    permitir.style.cssText = 'background:#0284c7; border:none; color:white; padding:9px 18px; border-radius:9px; cursor:pointer; font-weight:700; font-size:13px;';
    permitir.onclick = () => decidir(true);

    // "Não permitir" primeiro na ordem do DOM: é ele que recebe o foco inicial, e um Enter
    // distraído não deve conceder acesso à rede.
    linha.append(negar, permitir);
    caixa.appendChild(linha);
    fundo.appendChild(caixa);
    document.body.appendChild(fundo);
    negar.focus();
  });
}

/** O nome do mod e o motivo vêm de um pacote que pode ter sido escrito por qualquer um. */
function escapar(texto: string): string {
  const d = document.createElement('div');
  d.textContent = String(texto);
  return d.innerHTML;
}
