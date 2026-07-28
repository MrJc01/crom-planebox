// `mod.env`: configuração e chaves de um mod.
//
// ## A separação que sustenta tudo
//
// Um `mod.env` tem duas metades, e confundi-las é como um segredo vaza:
//
//  - **Esquema** — quais chaves existem, se são obrigatórias, o que fazem. É *parte do mod*.
//    Viaja na exportação, viaja no P2P, aparece no histórico da sessão.
//  - **Valores** — o que está preenchido em *cada instalação*. Nunca viaja. Não está no pacote do
//    mod, está num cofre à parte (`src/storage/Database.ts`, tabela própria).
//
// A razão de a separação ser estrutural, e não uma regra a lembrar: se os valores morassem no
// `ModPackage`, `export_mod` e `mod_sync` teriam de *filtrar* algo sensível a cada vez, e bastaria
// um caminho novo esquecer o filtro para a chave da API do usuário sair pela rede. Aqui não há o
// que filtrar — o pacote nunca teve os valores.
//
// ## Herança
//
// `AI_MOD_ROUTER=$AI_ROUTER` significa "use a chave global chamada AI_ROUTER". É o pedido do
// usuário: o mod declara o que precisa e *puxa* da configuração do jogador, sem que ele tenha de
// colar a mesma chave em cada mod. Um valor literal (`MODELO=claude-sonnet-5`) fica como está.
//
// A resolução acontece **em tempo de execução**, nunca na gravação: assim, trocar a chave global
// atualiza todos os mods que a herdam, e o valor herdado nunca é copiado para um lugar de onde
// pudesse escapar.

/** Uma chave declarada pelo mod. */
export interface ChaveEnv {
  nome: string;
  /** Para que serve. Aparece na UI quando o jogo pede a chave que falta. */
  descricao: string;
  /** Sem ela o mod não funciona — e não carrega. */
  obrigatoria: boolean;
  /**
   * Chave sensível (token, senha). Governa se o valor é mascarado na UI e nos logs.
   * Chaves não sensíveis (modelo, idioma, unidades) podem ter valor padrão no esquema.
   */
  sensivel: boolean;
  /** Valor padrão. **Só permitido em chave não sensível** — ver `validarEsquema`. */
  padrao?: string;
}

export interface EsquemaEnv {
  chaves: ChaveEnv[];
}

/** Valores preenchidos numa instalação. Vive no cofre, nunca no pacote do mod. */
export type ValoresEnv = Record<string, string>;

/** Chaves globais do jogador, compartilhadas por todos os mods (`$NOME` as referencia). */
export type GlobaisEnv = Record<string, string>;

const NOME_VALIDO = /^[A-Z][A-Z0-9_]*$/;

/** Cabeçalho do `mod.env` criado por padrão. Explica a sintaxe a quem — ou ao que — for editar. */
export const CABECALHO_PADRAO = `# mod.env — configuração deste mod (item 751 P1)
#
# CHAVE=valor           valor literal (público e exposto se o arquivo for exportado!)
# CHAVE=$GLOBAL         herda da configuração global do jogador, resolvido na hora de usar
#
# AVISO: Literais salvos diretamente neste arquivo são públicos e expostos ao exportar o mod.
# Segredos (chaves de API, tokens) NUNCA devem ser salvos como literais. Use referências a $GLOBAL
# ou configure pelo cofre do jogo.
`;

/**
 * Esquema padrão de todo mod novo.
 *
 * Não é vazio de propósito: um mod que venha a usar IA já encontra a chave declarada e herdando
 * da global, e o autor não precisa descobrir a convenção. É o exemplo que o pedido descrevia
 * (`AI_MOD_ROUTER=AI_ROUTER`), com a sintaxe explícita de herança.
 */
export function esquemaPadrao(): EsquemaEnv {
  return {
    chaves: [
      {
        nome: 'AI_MOD_ROUTER',
        descricao: 'Provedor de IA usado por este mod. Herda o do jogo por padrão.',
        obrigatoria: false,
        sensivel: false,
        padrao: '$AI_ROUTER',
      },
      {
        nome: 'AI_API_MOD_KEY',
        descricao: 'Chave da API de IA. Herda a global; preencha só para usar uma conta separada.',
        obrigatoria: false,
        sensivel: true,
      },
    ],
  };
}

export interface ProblemaEnv {
  chave: string;
  motivo: string;
}

/**
 * Valida um esquema. Devolve a lista de problemas — vazia significa válido.
 *
 * A regra que mais importa: **chave sensível não pode ter valor padrão**. Um padrão viaja com o
 * esquema, e um segredo com valor padrão é um segredo publicado. É o tipo de erro que se comete
 * uma vez, por conveniência, e que não dá sintoma nenhum até vazar.
 */
export function validarEsquema(esquema: EsquemaEnv): ProblemaEnv[] {
  const problemas: ProblemaEnv[] = [];
  const vistos = new Set<string>();

  for (const c of esquema.chaves ?? []) {
    if (!c || typeof c.nome !== 'string' || !NOME_VALIDO.test(c.nome)) {
      problemas.push({ chave: String(c?.nome ?? '?'), motivo: 'nome inválido (use MAIÚSCULAS_COM_SUBLINHADO)' });
      continue;
    }
    if (vistos.has(c.nome)) {
      problemas.push({ chave: c.nome, motivo: 'chave duplicada' });
      continue;
    }
    vistos.add(c.nome);

    if (c.sensivel && c.padrao !== undefined && !ehReferencia(c.padrao)) {
      problemas.push({
        chave: c.nome,
        motivo: 'chave sensível não pode ter valor padrão literal — só referência a uma global ($NOME)',
      });
    }
    if (typeof c.descricao !== 'string' || c.descricao.trim() === '') {
      problemas.push({ chave: c.nome, motivo: 'falta a descrição (a UI mostra isto ao pedir a chave)' });
    }
  }
  return problemas;
}

/** `$NOME` referencia uma chave global. */
export function ehReferencia(valor: string): boolean {
  return typeof valor === 'string' && valor.startsWith('$') && NOME_VALIDO.test(valor.slice(1));
}

export interface EnvResolvido {
  valores: Record<string, string>;
  /** Chaves obrigatórias que continuam sem valor. Mod com isto preenchido não deve carregar. */
  faltando: string[];
}

/**
 * Resolve o ambiente efetivo de um mod.
 *
 * Precedência, do mais forte para o mais fraco:
 *  1. valor local preenchido pelo jogador para este mod;
 *  2. valor padrão do esquema;
 *  3. e, se qualquer um dos dois for `$NOME`, o valor da global correspondente.
 *
 * Referência que aponta para global inexistente vira **ausência**, não a string `"$NOME"`. Passar
 * o literal adiante faria o mod mandar `"$AI_ROUTER"` como token para uma API e receber um erro
 * de autenticação — sintoma longe da causa.
 */
export function resolverEnv(
  esquema: EsquemaEnv,
  valores: ValoresEnv,
  globais: GlobaisEnv,
): EnvResolvido {
  const saida: Record<string, string> = {};
  const faltando: string[] = [];

  for (const c of esquema.chaves ?? []) {
    let v: string | undefined = valores?.[c.nome];
    if (v === undefined || v === '') v = c.padrao;

    if (v !== undefined && ehReferencia(v)) {
      const g = globais?.[v.slice(1)];
      v = g !== undefined && g !== '' ? g : undefined;
    }

    if (v === undefined || v === '') {
      if (c.obrigatoria) faltando.push(c.nome);
      continue;
    }
    saida[c.nome] = v;
  }

  return { valores: saida, faltando };
}

// ─── Itens 740/741 P1 — Chave global editável e Sobrescrita por Mod ───

/**
 * Resolve e herda chaves globais do jogador ($CHAVE) com suporte a sobrescrita por mod.
 *
 *  - **Item 740 P1**: Chave global editável em um lugar só ($CHAVE), todos os mods que a herdam acompanham.
 *  - **Item 741 P1**: Sobrescrita por mod: herda do global por padrão, mas pode fixar um valor próprio.
 */
export function resolveModEnvWithGlobals(
  esquema: EsquemaEnv,
  valoresMod: ValoresEnv,
  globais: GlobaisEnv,
): EnvResolvido {
  return resolverEnv(esquema, valoresMod, globais);
}

/**
 * Texto do `mod.env` para edição pelo jogador ou pelo agente.
 *
 * `mascarar` esconde o valor de chaves sensíveis. É o padrão porque este texto é o que aparece na
 * interface e no que o agente lê: um segredo impresso ali acabaria no histórico da conversa, que
 * é gravado, e daí em qualquer exportação de sessão.
 */
export function serializar(
  esquema: EsquemaEnv,
  valores: ValoresEnv,
  mascarar = true,
): string {
  const linhas: string[] = [CABECALHO_PADRAO.trimEnd(), ''];
  for (const c of esquema.chaves ?? []) {
    linhas.push(`# ${c.descricao}${c.obrigatoria ? ' (obrigatória)' : ''}`);
    const bruto = valores?.[c.nome] ?? c.padrao ?? '';
    const mostrar = mascarar && c.sensivel && bruto !== '' && !ehReferencia(bruto)
      ? '********'
      : bruto;
    linhas.push(`${c.nome}=${mostrar}`);
    linhas.push('');
  }
  return linhas.join('\n');
}

export interface ResultadoParse {
  valores: ValoresEnv;
  /** Linhas que não puderam ser lidas, com o número — para a UI apontar o erro. */
  erros: { linha: number; texto: string }[];
  /** Chaves presentes no texto que não existem no esquema. */
  desconhecidas: string[];
}

/**
 * Lê o texto de um `mod.env`.
 *
 * O valor mascarado (`********`) é **ignorado**, não gravado: sem isso, abrir a tela, não mexer em
 * nada e salvar substituiria o segredo real pela máscara — e o mod pararia de funcionar por uma
 * ação que o jogador leu como "não fiz nada".
 */
export const MASCARA = '********';

export function parse(texto: string, esquema: EsquemaEnv): ResultadoParse {
  const valores: ValoresEnv = {};
  const erros: { linha: number; texto: string }[] = [];
  const desconhecidas: string[] = [];
  const conhecidas = new Set((esquema.chaves ?? []).map((c) => c.nome));

  const linhas = String(texto ?? '').split('\n');
  for (let i = 0; i < linhas.length; i++) {
    const bruta = linhas[i];
    const l = bruta.trim();
    if (l === '' || l.startsWith('#')) continue;

    const igual = l.indexOf('=');
    if (igual <= 0) {
      erros.push({ linha: i + 1, texto: bruta });
      continue;
    }
    const nome = l.slice(0, igual).trim();
    const valor = l.slice(igual + 1).trim();

    if (!NOME_VALIDO.test(nome)) {
      erros.push({ linha: i + 1, texto: bruta });
      continue;
    }
    if (!conhecidas.has(nome)) desconhecidas.push(nome);
    if (valor === MASCARA) continue; // não mexeu: preserva o que já está no cofre
    valores[nome] = valor;
  }

  return { valores, erros, desconhecidas };
}

/**
 * O que **o agente** e a interface podem ver do ambiente de um mod.
 *
 * Devolve metadados e se a chave está preenchida — nunca o valor.
 *
 * Onde está a fronteira de verdade, para não haver ilusão: o script do mod roda no mesmo cliente,
 * com os mesmos privilégios do jogo. Esconder o valor **dele** não seria segurança, seria teatro —
 * um script que precisa da chave para chamar uma API precisa da chave. A fronteira real é o que
 * **sai da máquina**: exportação, `mod_sync` no P2P e histórico de conversa. O agente é remoto, e
 * é por isso que ele vê esta função e não os valores.
 */
export function descreverEnv(esquema: EsquemaEnv, resolvido: EnvResolvido): {
  nome: string;
  descricao: string;
  obrigatoria: boolean;
  sensivel: boolean;
  preenchida: boolean;
}[] {
  return (esquema.chaves ?? []).map((c) => ({
    nome: c.nome,
    descricao: c.descricao,
    obrigatoria: c.obrigatoria,
    sensivel: c.sensivel,
    preenchida: resolvido.valores[c.nome] !== undefined,
  }));
}

// ─── Item 731 P1 — Validação de formato por chave (URL, token, enum de modelos) ───

export type FormatoChave = 'url' | 'token' | 'enum' | 'livre';

export interface FormatoDescrito {
  tipo: FormatoChave;
  /** Para `enum`: valores aceitos. */
  valoresAceitos?: string[];
}

/**
 * Valida o valor de uma chave de acordo com o formato declarado.
 *
 * Cada chave pode ter um tipo esperado: URL (precisa de `https://`), token (alfanumérico sem
 * espaços, pelo menos 8 caracteres), enum (lista fixa), ou livre. A validação previne que um
 * jogador cole uma URL onde se esperava um token — erro que só apareceria minutos depois,
 * quando a API devolver 401.
 */
export function validateFormatByKey(
  valor: string,
  formato: FormatoDescrito,
): { valid: boolean; reason?: string } {
  if (!valor || valor.trim() === '') {
    return { valid: false, reason: 'valor vazio' };
  }

  switch (formato.tipo) {
    case 'url': {
      const urlLike = /^https?:\/\/.+/i;
      if (!urlLike.test(valor.trim())) {
        return { valid: false, reason: 'valor não é uma URL válida (deve começar com https://)' };
      }
      return { valid: true };
    }
    case 'token': {
      if (/\s/.test(valor)) {
        return { valid: false, reason: 'token não pode conter espaços' };
      }
      if (valor.length < 8) {
        return { valid: false, reason: 'token deve ter pelo menos 8 caracteres' };
      }
      return { valid: true };
    }
    case 'enum': {
      const aceitos = formato.valoresAceitos ?? [];
      if (!aceitos.includes(valor)) {
        return { valid: false, reason: `valor "${valor}" não está entre os aceitos: ${aceitos.join(', ')}` };
      }
      return { valid: true };
    }
    case 'livre':
    default:
      return { valid: true };
  }
}

// ─── Item 734 P1 — Ferramenta MCP `set_mod_env` para chaves não sensíveis ───

/**
 * Define o valor de uma chave não sensível no ambiente do mod.
 *
 * Chaves sensíveis (tokens, senhas) devem ser definidas pelo cofre, nunca por ferramenta MCP —
 * caso contrário o valor acabaria no histórico da conversa. Esta função recusa a operação se a
 * chave for sensível, devolvendo `refused: true` com explicação.
 */
export function setModEnvPublicKey(
  esquema: EsquemaEnv,
  valores: ValoresEnv,
  chave: string,
  novoValor: string,
): { updated: ValoresEnv; refused: boolean; reason?: string } {
  const def = (esquema.chaves ?? []).find((c) => c.nome === chave);
  if (!def) {
    return { updated: valores, refused: true, reason: `chave "${chave}" não existe no esquema do mod` };
  }
  if (def.sensivel) {
    return {
      updated: valores,
      refused: true,
      reason: `chave "${chave}" é sensível — use o cofre para definir o valor, não a ferramenta MCP`,
    };
  }
  return { updated: { ...valores, [chave]: novoValor }, refused: false };
}

// ─── Item 737 P1 — Redação automática: mascarar segredos ao imprimir ───

/** Padrões que indicam que um valor é um segredo e deve ser mascarado em logs e UI. */
const SECRET_PATTERNS = [
  /^sk-/i,           // OpenAI
  /^Bearer\s/i,      // Authorization header
  /^eyJ/i,           // JWT (base64 de '{"')
  /^ghp_/i,          // GitHub Personal Access Token
  /^glpat-/i,        // GitLab PAT
  /^xoxb-/i,         // Slack Bot Token
  /^AKIA/i,          // AWS Access Key
];

/**
 * Mascara valores que parecem segredos em uma string arbitrária.
 *
 * Percorre `SECRET_PATTERNS` e troca qualquer valor que bata por `[REDACTED]`. Serve para
 * imprimir logs e mensagens de erro sem vazar tokens — o tipo de proteção que só precisa
 * falhar uma vez para ser notícia.
 */
export function redactSecrets(text: string): string {
  let result = text;
  for (const pat of SECRET_PATTERNS) {
    // Encontra tokens inteiros (sem espaços) que batem no padrão
    result = result.replace(/\S+/g, (word) => pat.test(word) ? '[REDACTED]' : word);
  }
  return result;
}

// ─── Item 752 P1 — Bloquear salvar literal com cara de segredo ───

/**
 * Detecta se um valor tem "cara de segredo" e não deveria ser salvo como literal no esquema.
 *
 * Um valor literal no esquema viaja com o mod na exportação e no P2P. Se esse literal for um
 * token de API, ele vaza. Esta função é chamada antes de gravar e recusa o save com explicação.
 */
export function looksLikeSecret(valor: string): { isSecret: boolean; reason?: string } {
  if (!valor || valor.trim() === '') return { isSecret: false };

  for (const pat of SECRET_PATTERNS) {
    if (pat.test(valor.trim())) {
      return { isSecret: true, reason: `o valor parece um segredo (padrão: ${pat.source}). Use o cofre.` };
    }
  }

  // Heurística adicional: strings muito longas com alta entropia (base64-like)
  if (valor.length >= 40 && /^[A-Za-z0-9+/=_-]+$/.test(valor)) {
    return { isSecret: true, reason: 'o valor parece uma chave codificada (40+ caracteres alfanuméricos). Use o cofre.' };
  }

  return { isSecret: false };
}
