// A única porta de rede que um mod tem — itens 763, 764, 767 e 768.
//
// ## Onde ela fica, e por que aqui
//
// O script roda num Worker sem `fetch` (item 358). A única forma de ele alcançar a rede é pedindo à
// ponte, e a ponte chega aqui. Não há segundo caminho — não por disciplina, mas porque o outro reino
// não tem nada com que abrir um.
//
// ## As quatro perguntas, nesta ordem
//
// 1. **O manifesto declara este host?** Se não, para aqui — o autor do mod precisa declarar.
// 2. **O jogador consentiu com este host?** Declarar não é ter.
// 3. **A chamada envia dados, e o mod tem permissão para isso?** (item 775)
// 4. **Cabe nos tetos?** Tamanho e tempo.
//
// A ordem importa: a pergunta ao jogador é a mais cara (interrompe a partida) e vem **depois** da
// checagem barata do manifesto. Um mod pedindo um host não declarado nunca deve gerar uma caixa de
// diálogo — isso seria ensinar ao jogador que o manifesto não significa nada.

import {
  MAX_BYTES_DE_RESPOSTA,
  ManifestoDeCapacidades,
  TIMEOUT_DE_REDE,
  enviaDados,
  podeChamar,
} from './capacidades';

export interface OpcoesDeChamada {
  metodo?: string;
  cabecalhos?: Record<string, string>;
  corpo?: string;
}

export interface RespostaDeMod {
  status: number;
  ok: boolean;
  texto: string;
}

/** Uma linha do log de auditoria, antes de ir para o banco. */
export interface RegistroDeChamada {
  modId: string;
  host: string;
  caminho: string;
  metodo: string;
  quando: number;
  status: number;
  bytes: number;
  recusa?: string;
}

export interface DependenciasDeRede {
  /** O manifesto do mod, ou `undefined` se ele não declarou nada. */
  manifestoDe(modId: string): ManifestoDeCapacidades | undefined;
  /** Hosts que o jogador já autorizou para este mod, neste mundo. */
  hostsConsentidos(modId: string): readonly string[];
  /** Pergunta ao jogador. Resolve `true` se ele autorizar. */
  pedirConsentimento(modId: string, host: string, motivo: string, envia: boolean): Promise<boolean>;
  /** Grava a linha de auditoria. */
  registrar(linha: RegistroDeChamada): void;
  /** Injetável para teste. Em produção é o `fetch` do navegador. */
  buscar?: typeof fetch;
  agora?: () => number;
}

export class RedeDeMods {
  /** Modo offline global: quando ativo, desliga toda integração externa de mods instantaneamente — item 774 P1. */
  private modoOffline = false;

  constructor(private deps: DependenciasDeRede) {}

  public setModoOffline(offline: boolean): void {
    this.modoOffline = offline;
  }

  public isModoOffline(): boolean {
    return this.modoOffline;
  }

  /**
   * Consentimentos sendo perguntados agora, por `modId|host`.
   *
   * Um mod que faz três chamadas ao mesmo host no mesmo quadro geraria três caixas de diálogo
   * idênticas empilhadas — e a segunda e a terceira seriam clicadas sem leitura, que é exatamente o
   * hábito que a permissão declarada existe para evitar. Todas esperam a mesma resposta.
   */
  private perguntando = new Map<string, Promise<boolean>>();

  /**
   * Wrapper com degradação graciosa: se a chamada falhar ou estiver offline, devolve status 0 sem lançar erro — item 773 P1.
   */
  async chamarComDegradacao(modId: string, endereco: string, opcoes: OpcoesDeChamada = {}): Promise<RespostaDeMod> {
    try {
      return await this.chamar(modId, endereco, opcoes);
    } catch (err: any) {
      return {
        status: 0,
        ok: false,
        texto: err?.message || 'falha de rede com degradação offline',
      };
    }
  }

  async chamar(modId: string, endereco: string, opcoes: OpcoesDeChamada = {}): Promise<RespostaDeMod> {
    const quando = (this.deps.agora ?? Date.now)();
    const metodo = String(opcoes.metodo ?? 'GET').toUpperCase();
    const manifesto = this.deps.manifestoDe(modId);
    const declarados = manifesto?.rede?.hosts ?? [];

    const recusar = (host: string, caminho: string, motivo: string): never => {
      this.deps.registrar({ modId, host, caminho, metodo, quando, status: 0, bytes: 0, recusa: motivo });
      throw new Error(motivo);
    };

    const permissao = podeChamar(endereco, declarados);
    const caminho = caminhoDe(endereco);

    if (this.modoOffline) {
      recusar(permissao.host, caminho, 'modo offline global ativo — chamadas externas bloqueadas');
    }

    if (!permissao.permitido) recusar(permissao.host, caminho, permissao.motivo ?? 'recusado');

    if (enviaDados(metodo, opcoes.corpo) && !manifesto?.rede?.envia) {
      // A permissão de falar com um endereço não é a permissão de contar coisas para ele. Um mod
      // que declarou "ler o clima" não deveria conseguir mandar o mundo no corpo de um POST.
      recusar(permissao.host, caminho, 'este mod não declarou que envia dados (rede.envia)');
    }

    if (!this.deps.hostsConsentidos(modId).some((h) => h === permissao.host)) {
      const ok = await this.perguntarUmaVez(modId, permissao.host, manifesto?.rede?.motivo ?? '', !!manifesto?.rede?.envia);
      if (!ok) recusar(permissao.host, caminho, 'o jogador não autorizou este host');
    }

    return this.executar(modId, endereco, metodo, opcoes, permissao.host, caminho, quando);
  }

  private perguntarUmaVez(modId: string, host: string, motivo: string, envia: boolean): Promise<boolean> {
    const chave = `${modId}|${host}`;
    let pendente = this.perguntando.get(chave);
    if (!pendente) {
      pendente = this.deps.pedirConsentimento(modId, host, motivo, envia)
        .finally(() => this.perguntando.delete(chave));
      this.perguntando.set(chave, pendente);
    }
    return pendente;
  }

  private async executar(
    modId: string, endereco: string, metodo: string, opcoes: OpcoesDeChamada,
    host: string, caminho: string, quando: number,
  ): Promise<RespostaDeMod> {
    const buscar = this.deps.buscar ?? fetch;
    const abortar = new AbortController();
    const relogio = setTimeout(() => abortar.abort(), TIMEOUT_DE_REDE * 1000);

    try {
      const resp = await buscar(endereco, {
        method: metodo,
        headers: opcoes.cabecalhos,
        body: opcoes.corpo,
        signal: abortar.signal,
        // `redirect: 'error'` é a linha que mais importa deste arquivo depois da allowlist. Com
        // `follow`, um host autorizado poderia redirecionar para um host **não** autorizado, e o
        // conteúdo dele voltaria para o mod como se fosse do host permitido — a allowlist seria
        // contornável por quem controla o servidor que ela autoriza.
        redirect: 'error',
        // Sem cookies nem credenciais: a chamada é do mod, não do jogador, e mandar credenciais de
        // sessão junto faria o mod agir em nome dele em qualquer serviço onde ele esteja logado.
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });

      const texto = await resp.text();
      if (texto.length > MAX_BYTES_DE_RESPOSTA) {
        this.deps.registrar({
          modId, host, caminho, metodo, quando, status: resp.status,
          bytes: texto.length, recusa: 'resposta maior que o limite',
        });
        throw new Error(`resposta maior que o limite de ${MAX_BYTES_DE_RESPOSTA} bytes`);
      }

      this.deps.registrar({ modId, host, caminho, metodo, quando, status: resp.status, bytes: texto.length });
      return { status: resp.status, ok: resp.ok, texto };
    } catch (err: any) {
      // Um `abort` do relógio chega aqui como erro genérico. Nomeá-lo é o que separa "a API está
      // fora do ar" de "a API demorou demais", que exigem correções diferentes do autor do mod.
      const motivo = abortar.signal.aborted
        ? `a chamada passou de ${TIMEOUT_DE_REDE}s e foi cancelada`
        : (err?.message || 'falha de rede');
      this.deps.registrar({ modId, host, caminho, metodo, quando, status: 0, bytes: 0, recusa: motivo });
      throw new Error(motivo);
    } finally {
      clearTimeout(relogio);
    }
  }
}

/**
 * Caminho do endereço, **sem a query**.
 *
 * A query pode conter exatamente o que o mod está mandando para fora, e o log de auditoria não é
 * lugar de guardar isso: ele existe para o jogador ver com quem o mod falou, não para virar uma
 * segunda cópia dos dados que saíram.
 */
export function caminhoDe(endereco: string): string {
  try { return new URL(endereco).pathname; } catch { return ''; }
}
