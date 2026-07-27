// Manifesto de capacidades de um mod — itens 761 a 768 e 775.
//
// ## O que muda agora, e por que não fazia sentido antes
//
// Até o item 358, o script de mod rodava neste reino e alcançava o global por
// `[].constructor.constructor('return this')()`. Um invólucro de `fetch` ali seria decoração: o mod
// que quisesse contornar pegava o `fetch` de verdade pela fuga, e o invólucro só atrapalharia quem
// não estava tentando burlar nada.
//
// Com os scripts no Worker e o global de lá esvaziado, **não existe `fetch` para alcançar**. A
// única rede possível é a que atravessa a ponte, e uma checagem na ponte é uma checagem de verdade.
//
// ## Por que capacidade declarada, e não "pergunte na hora"
//
// Perguntar a cada chamada treina o jogador a dizer sim: a quinta caixa de diálogo idêntica é
// clicada sem leitura. Declarar no manifesto move a decisão para **antes** de instalar, quando o
// jogador ainda está avaliando o mod e não no meio de uma partida.
//
// E dá algo que a pergunta na hora nunca dá: a lista de hosts é **auditável**. Dá para mostrá-la
// numa tela, comparar com o que o mod diz que faz, e revogar depois.

/** Uma capacidade de rede declarada por um mod. */
export interface CapacidadeDeRede {
  /** Hosts que este mod pode alcançar. Exatos, ou `.dominio.com` para incluir subdomínios. */
  hosts: string[];
  /** Por que o mod precisa disso, em linguagem de jogador. Aparece na tela de consentimento. */
  motivo: string;
  /**
   * O mod envia dados **do mundo ou do jogador** para fora?
   *
   * Item 775. Sem isto, um mod com permissão de "ler o clima de uma API" poderia mandar o mundo
   * inteiro no corpo de um POST para o mesmo host — a permissão de falar com um endereço não é a
   * mesma coisa que a permissão de contar coisas para ele.
   */
  envia?: boolean;
}

export interface ManifestoDeCapacidades {
  /** Versão do formato. Um manifesto sem versão é tratado como inválido, não como "versão 1". */
  versao: number;
  rede?: CapacidadeDeRede;
}

/**
 * As únicas capacidades que existem. Qualquer outra chave é recusada na validação.
 *
 * ## Por que recusar em vez de ignorar — item 766
 *
 * Um mod pedindo `microfone` ou `geolocalizacao` hoje seria **ignorado em silêncio**: o script roda
 * num Worker onde `navigator` foi apagado, e não há membro de API que chegue a esses dispositivos.
 * Ignorar parece inofensivo e não é — o autor do mod (com frequência uma IA) escreveria o pedido,
 * veria o mod carregar sem erro, e concluiria que a permissão foi concedida. O mod então falharia
 * mais adiante, longe da causa.
 *
 * Recusar aqui diz a verdade no lugar certo: **esta capacidade não existe neste jogo.** Quando
 * alguma delas passar a existir, ela entra nesta lista junto com o consentimento separado que o
 * item 766 pede — e não antes.
 */
export const CAPACIDADES_CONHECIDAS = ['versao', 'rede'] as const;

export const VERSAO_DO_MANIFESTO = 1;

/**
 * Limite de bytes que uma resposta pode ter.
 *
 * Sem teto, um mod pedindo um arquivo de um gigabyte trava a aba — e o host seria um dos declarados,
 * então nenhuma outra regra o impediria. 2 MB é generoso para JSON de API e pequeno o bastante para
 * não ser uma arma.
 */
export const MAX_BYTES_DE_RESPOSTA = 2 * 1024 * 1024;

/** Segundos até desistir de uma chamada. */
export const TIMEOUT_DE_REDE = 10;

/**
 * O endereço é aceitável **em princípio**, antes de olhar a lista de hosts?
 *
 * Devolve o motivo da recusa, ou `null` se passa.
 */
export function motivoDeRecusaDeEsquema(url: URL): string | null {
  // `https` só. `http` é interceptável e alterável por qualquer um no caminho, e a resposta vira
  // entrada de um script — não há razão para um mod de navegador precisar disso em 2026.
  if (url.protocol === 'https:') return null;

  // A exceção é o desenvolvimento local: um modelo de linguagem rodando na própria máquina, ou o
  // relay de sinalização deste projeto, vivem em `http://localhost`. Recusar isso empurraria quem
  // desenvolve para desligar a checagem inteira, que é bem pior que abrir a exceção nomeada.
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  if (url.protocol === 'http:' && local) return null;

  return `só https é permitido (recebido "${url.protocol}//")`;
}

/**
 * O host casa com uma entrada da lista?
 *
 * ## As duas formas, e por que não há uma terceira
 *
 * `api.exemplo.com` casa exatamente com `api.exemplo.com`. `.exemplo.com` casa com qualquer
 * subdomínio dele **e** com ele mesmo.
 *
 * Não existe curinga no meio, nem casamento por prefixo, nem por conteúdo. A razão é um ataque
 * clássico e barato: com casamento por conteúdo, `exemplo.com` liberaria
 * `exemplo.com.servidor-do-atacante.net`, que é um host que qualquer pessoa registra em cinco
 * minutos. O ponto inicial obrigatório em `.exemplo.com` é o que impede `naoexemplo.com` de passar.
 */
export function hostCasa(host: string, entrada: string): boolean {
  const h = host.toLowerCase();
  const e = entrada.trim().toLowerCase();
  if (!e) return false;
  if (e.startsWith('.')) return h === e.slice(1) || h.endsWith(e);
  return h === e;
}

export interface ResultadoDePermissao {
  permitido: boolean;
  /** Host normalizado, para o log de auditoria e para a tela de consentimento. */
  host: string;
  motivo?: string;
}

/**
 * Este mod pode chamar este endereço?
 *
 * Recebe a lista **já filtrada pelo consentimento**: declarar não basta, o jogador precisa ter dito
 * sim. Quem cruza as duas coisas é o chamador, e isso é de propósito — este módulo não deve nem
 * conhecer onde o consentimento é guardado.
 */
export function podeChamar(endereco: string, hostsPermitidos: readonly string[]): ResultadoDePermissao {
  let url: URL;
  try {
    url = new URL(endereco);
  } catch {
    return { permitido: false, host: '', motivo: 'endereço inválido' };
  }

  const host = url.hostname.toLowerCase();
  const esquema = motivoDeRecusaDeEsquema(url);
  if (esquema) return { permitido: false, host, motivo: esquema };

  if (!hostsPermitidos.some((e) => hostCasa(host, e))) {
    return {
      permitido: false,
      host,
      // A mensagem nomeia o host, porque quem lê é o autor do mod tentando descobrir o que declarar.
      motivo: `o host "${host}" não está entre os autorizados para este mod`,
    };
  }
  return { permitido: true, host };
}

/** Verbos que não enviam conteúdo do jogo. */
const VERBOS_DE_LEITURA = new Set(['GET', 'HEAD']);

/**
 * A chamada envia dados para fora, além do endereço em si?
 *
 * ## O que esta verificação alcança, e o que ela não alcança
 *
 * Ela pega o caso que importa: corpo de requisição e verbos de escrita. Um mod sem `envia: true`
 * não consegue fazer um POST com o mundo dentro.
 *
 * **Ela não alcança a query string.** `GET https://host/?dados=<o mundo inteiro>` passa, porque
 * distinguir um parâmetro legítimo de um vazamento exigiria entender o significado do endereço. Está
 * dito aqui em vez de omitido: `envia` é uma barreira contra o caminho fácil, não uma prova de que
 * nada sai.
 */
export function enviaDados(metodo: string | undefined, corpo: unknown): boolean {
  if (corpo !== undefined && corpo !== null && corpo !== '') return true;
  return !VERBOS_DE_LEITURA.has(String(metodo ?? 'GET').toUpperCase());
}

/** Erros de um manifesto, em linguagem de quem vai corrigir. Vazio = válido. */
export function validarManifesto(m: unknown): string[] {
  const erros: string[] = [];
  if (!m || typeof m !== 'object') return ['manifesto ausente ou não é um objeto'];
  const man = m as Partial<ManifestoDeCapacidades>;

  // Sem versão é inválido, e não "versão 1 por omissão": um manifesto escrito antes de existir
  // versionamento não tem como declarar o que não sabia que existia, e tratá-lo como a versão atual
  // concederia por engano tudo o que a versão atual permite.
  if (man.versao !== VERSAO_DO_MANIFESTO) {
    erros.push(`versao precisa ser ${VERSAO_DO_MANIFESTO} (recebido: ${JSON.stringify(man.versao)})`);
  }

  for (const chave of Object.keys(m as object)) {
    if ((CAPACIDADES_CONHECIDAS as readonly string[]).includes(chave)) continue;
    erros.push(
      `capacidade "${chave}" não existe neste jogo. Conhecidas: ${CAPACIDADES_CONHECIDAS.join(', ')}`,
    );
  }

  if (man.rede !== undefined) {
    const r = man.rede;
    if (!Array.isArray(r?.hosts) || r.hosts.length === 0) {
      erros.push('rede.hosts precisa ser uma lista com ao menos um host');
    } else {
      for (const h of r.hosts) {
        if (typeof h !== 'string' || !h.trim()) { erros.push('rede.hosts tem uma entrada vazia'); continue; }
        // `*` é o pedido que mais aparece e o único que não dá para conceder: uma allowlist que
        // permite tudo é uma allowlist que não existe, e o jogador estaria consentindo com o vazio.
        if (h.includes('*')) erros.push(`curinga não é aceito em "${h}" — use o host exato ou ".dominio.com"`);
        if (h.includes('/')) erros.push(`"${h}" parece um caminho; declare só o host`);
      }
    }
    if (typeof r?.motivo !== 'string' || r.motivo.trim().length < 10) {
      // Sem motivo legível, a tela de consentimento vira "este mod quer acessar a internet: sim/não",
      // que é a pergunta que treina o jogador a clicar sim.
      erros.push('rede.motivo precisa explicar, em uma frase, para que o mod usa a rede');
    }
  }

  return erros;
}
