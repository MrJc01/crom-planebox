import { describe, it, expect } from 'vitest';
import {
  CABECALHO_PADRAO,
  EsquemaEnv,
  MASCARA,
  descreverEnv,
  ehReferencia,
  esquemaPadrao,
  parse,
  resolverEnv,
  serializar,
  validarEsquema,
} from '../../src/mods/ModEnv';
import { emptyModPackage, stripLocalState } from '../../src/mods/ModTypes';

const ESQUEMA: EsquemaEnv = {
  chaves: [
    { nome: 'AI_KEY', descricao: 'chave da API', obrigatoria: true, sensivel: true },
    { nome: 'MODELO', descricao: 'modelo a usar', obrigatoria: false, sensivel: false, padrao: 'claude-sonnet-5' },
    { nome: 'ROUTER', descricao: 'provedor', obrigatoria: false, sensivel: false, padrao: '$AI_ROUTER' },
    { nome: 'CIDADE', descricao: 'cidade para o clima', obrigatoria: false, sensivel: false },
  ],
};

describe('validarEsquema — o que não pode existir', () => {
  it('CRÍTICO: chave sensível não pode ter valor padrão literal', () => {
    // Um padrão viaja com o esquema. Segredo com valor padrão é segredo publicado — e é o erro
    // que se comete uma vez, por conveniência, sem sintoma nenhum até vazar.
    const ruim: EsquemaEnv = {
      chaves: [{ nome: 'TOKEN', descricao: 'x', obrigatoria: true, sensivel: true, padrao: 'sk-abc123' }],
    };
    const p = validarEsquema(ruim);
    expect(p.length).toBeGreaterThan(0);
    expect(p[0].chave).toBe('TOKEN');
  });

  it('chave sensível PODE herdar de uma global — a referência não é o segredo', () => {
    const ok: EsquemaEnv = {
      chaves: [{ nome: 'TOKEN', descricao: 'x', obrigatoria: true, sensivel: true, padrao: '$AI_KEY' }],
    };
    expect(validarEsquema(ok)).toEqual([]);
  });

  it('rejeita nome inválido, duplicado e sem descrição', () => {
    expect(validarEsquema({ chaves: [{ nome: 'minuscula', descricao: 'x', obrigatoria: false, sensivel: false }] }).length).toBe(1);
    expect(validarEsquema({ chaves: [{ nome: 'A B', descricao: 'x', obrigatoria: false, sensivel: false }] }).length).toBe(1);
    expect(validarEsquema({
      chaves: [
        { nome: 'X', descricao: 'x', obrigatoria: false, sensivel: false },
        { nome: 'X', descricao: 'y', obrigatoria: false, sensivel: false },
      ],
    }).length).toBe(1);
    expect(validarEsquema({ chaves: [{ nome: 'X', descricao: '  ', obrigatoria: false, sensivel: false }] }).length).toBe(1);
  });

  it('o esquema válido não produz problema', () => {
    expect(validarEsquema(ESQUEMA)).toEqual([]);
  });

  it('CRÍTICO: o esquema padrão de todo mod novo é válido', () => {
    // Se o padrão fosse inválido, todo mod criado já nasceria em quarentena.
    expect(validarEsquema(esquemaPadrao())).toEqual([]);
  });

  it('esquema vazio ou malformado não quebra', () => {
    expect(validarEsquema({ chaves: [] })).toEqual([]);
    expect(() => validarEsquema({} as EsquemaEnv)).not.toThrow();
  });
});

describe('herança de chave global', () => {
  it('CRÍTICO: `$NOME` resolve para o valor da global', () => {
    const r = resolverEnv(ESQUEMA, { AI_KEY: 'k' }, { AI_ROUTER: 'openrouter' });
    expect(r.valores.ROUTER).toBe('openrouter');
  });

  it('CRÍTICO: referência sem global vira AUSÊNCIA, não a string literal', () => {
    // Passar "$AI_ROUTER" adiante faria o mod mandar isso como token para uma API e receber erro
    // de autenticação — sintoma longe da causa.
    const r = resolverEnv(ESQUEMA, { AI_KEY: 'k' }, {});
    expect(r.valores.ROUTER).toBeUndefined();
  });

  it('a resolução acontece na hora de usar — trocar a global muda todos os mods', () => {
    const antes = resolverEnv(ESQUEMA, {}, { AI_ROUTER: 'a' });
    const depois = resolverEnv(ESQUEMA, {}, { AI_ROUTER: 'b' });
    expect(antes.valores.ROUTER).toBe('a');
    expect(depois.valores.ROUTER).toBe('b');
  });

  it('valor local vence o padrão, e o padrão vence a ausência', () => {
    expect(resolverEnv(ESQUEMA, { MODELO: 'meu' }, {}).valores.MODELO).toBe('meu');
    expect(resolverEnv(ESQUEMA, {}, {}).valores.MODELO).toBe('claude-sonnet-5');
  });

  it('valor local também pode ser uma referência', () => {
    const r = resolverEnv(ESQUEMA, { AI_KEY: '$MINHA_CHAVE' }, { MINHA_CHAVE: 'secreto' });
    expect(r.valores.AI_KEY).toBe('secreto');
  });

  it('ehReferencia só aceita `$NOME` bem formado', () => {
    expect(ehReferencia('$AI_ROUTER')).toBe(true);
    expect(ehReferencia('$a')).toBe(false);
    expect(ehReferencia('AI_ROUTER')).toBe(false);
    expect(ehReferencia('$')).toBe(false);
    expect(ehReferencia('preço $10')).toBe(false);
  });

  it('valor vazio conta como ausente', () => {
    const r = resolverEnv(ESQUEMA, { AI_KEY: '' }, {});
    expect(r.faltando).toContain('AI_KEY');
  });
});

describe('chaves obrigatórias que faltam', () => {
  it('CRÍTICO: a lista de faltantes é o que impede o mod de carregar', () => {
    const r = resolverEnv(ESQUEMA, {}, {});
    expect(r.faltando).toEqual(['AI_KEY']);
  });

  it('chave opcional ausente não entra na lista', () => {
    const r = resolverEnv(ESQUEMA, { AI_KEY: 'k' }, {});
    expect(r.faltando).toEqual([]);
    expect(r.valores.CIDADE).toBeUndefined();
  });

  it('obrigatória satisfeita por herança não falta', () => {
    const esq: EsquemaEnv = {
      chaves: [{ nome: 'TOKEN', descricao: 'x', obrigatoria: true, sensivel: true, padrao: '$G' }],
    };
    expect(resolverEnv(esq, {}, { G: 'v' }).faltando).toEqual([]);
    expect(resolverEnv(esq, {}, {}).faltando).toEqual(['TOKEN']);
  });
});

describe('serializar / parse — o ciclo de edição', () => {
  it('CRÍTICO: o valor sensível sai mascarado', () => {
    // Este texto é o que a UI mostra e o que o AGENTE lê. Um segredo impresso ali acabaria no
    // histórico da conversa, que é gravado, e daí em qualquer exportação de sessão.
    const t = serializar(ESQUEMA, { AI_KEY: 'sk-supersecreto', MODELO: 'x' });
    expect(t).not.toContain('sk-supersecreto');
    expect(t).toContain(MASCARA);
  });

  it('o valor não sensível aparece — é configuração, não segredo', () => {
    const t = serializar(ESQUEMA, { MODELO: 'claude-opus-5' });
    expect(t).toContain('claude-opus-5');
  });

  it('a referência não é mascarada — `$AI_ROUTER` não é o segredo', () => {
    const t = serializar(ESQUEMA, { AI_KEY: '$GLOBAL' });
    expect(t).toContain('$GLOBAL');
  });

  it('CRÍTICO: salvar sem mexer NÃO apaga o segredo', () => {
    // Sem isto, abrir a tela e clicar em salvar substituiria a chave real pela máscara, e o mod
    // pararia de funcionar por uma ação que o jogador leu como "não fiz nada".
    const texto = serializar(ESQUEMA, { AI_KEY: 'sk-real', MODELO: 'm' });
    const r = parse(texto, ESQUEMA);
    expect(r.valores.AI_KEY).toBeUndefined(); // não sobrescreve
    expect(r.valores.MODELO).toBe('m');
  });

  it('trocar o valor mascarado por um novo GRAVA o novo', () => {
    const r = parse('AI_KEY=sk-novo\n', ESQUEMA);
    expect(r.valores.AI_KEY).toBe('sk-novo');
  });

  it('apagar o valor grava vazio, o que zera a chave', () => {
    const r = parse('AI_KEY=\n', ESQUEMA);
    expect(r.valores.AI_KEY).toBe('');
  });

  it('comentários e linhas em branco são ignorados', () => {
    const r = parse('# comentário\n\n   \nMODELO=x\n', ESQUEMA);
    expect(r.valores).toEqual({ MODELO: 'x' });
    expect(r.erros).toEqual([]);
  });

  it('linha malformada é reportada com o número, não engolida', () => {
    const r = parse('MODELO=x\nlixo sem igual\nCIDADE=sp\n', ESQUEMA);
    expect(r.erros.length).toBe(1);
    expect(r.erros[0].linha).toBe(2);
    // E o resto continua sendo lido: um erro de digitação não descarta o arquivo inteiro.
    expect(r.valores.MODELO).toBe('x');
    expect(r.valores.CIDADE).toBe('sp');
  });

  it('chave fora do esquema é reportada, e ainda assim lida', () => {
    const r = parse('INVENTADA=1\n', ESQUEMA);
    expect(r.desconhecidas).toEqual(['INVENTADA']);
    expect(r.valores.INVENTADA).toBe('1');
  });

  it('o cabeçalho explica a sintaxe a quem for editar', () => {
    const t = serializar(ESQUEMA, {});
    expect(t).toContain('$GLOBAL');
    expect(CABECALHO_PADRAO.toLowerCase()).toContain('literais salvos diretamente');
  });

  it('valor com `=` dentro sobrevive — tokens têm sinal de igual', () => {
    const r = parse('AI_KEY=abc=def==\n', ESQUEMA);
    expect(r.valores.AI_KEY).toBe('abc=def==');
  });

  it('texto vazio ou nulo não quebra', () => {
    expect(parse('', ESQUEMA).valores).toEqual({});
    expect(() => parse(null as any, ESQUEMA)).not.toThrow();
  });
});

describe('descreverEnv — o que o agente pode ver', () => {
  it('CRÍTICO: nunca devolve o valor, só se está preenchida', () => {
    // É esta função que o ModAPI expõe. Um mod pode perguntar "tenho a chave?" mas não pode ler
    // o segredo e mandá-lo para onde quiser.
    const resolvido = resolverEnv(ESQUEMA, { AI_KEY: 'sk-secreto' }, {});
    const d = descreverEnv(ESQUEMA, resolvido);
    const texto = JSON.stringify(d);
    expect(texto).not.toContain('sk-secreto');
    expect(d.find((c) => c.nome === 'AI_KEY')!.preenchida).toBe(true);
  });

  it('descreve toda chave do esquema, preenchida ou não', () => {
    const d = descreverEnv(ESQUEMA, resolverEnv(ESQUEMA, {}, {}));
    expect(d.length).toBe(ESQUEMA.chaves.length);
    expect(d.find((c) => c.nome === 'CIDADE')!.preenchida).toBe(false);
    expect(d.find((c) => c.nome === 'AI_KEY')!.obrigatoria).toBe(true);
  });

  it('carrega a descrição, que é o que a UI mostra ao pedir a chave', () => {
    const d = descreverEnv(ESQUEMA, resolverEnv(ESQUEMA, {}, {}));
    for (const c of d) expect(c.descricao.length).toBeGreaterThan(0);
  });
});

describe('o segredo não sai da máquina — a garantia estrutural', () => {
  it('CRÍTICO: `stripLocalState` não tem valores a remover, porque nunca esteve com eles', () => {
    // Esta é a razão de o cofre ser uma tabela separada. Se os valores morassem no ModPackage,
    // `export_mod` e `mod_sync` teriam de FILTRAR algo sensível a cada vez, e bastaria um caminho
    // novo esquecer o filtro para a chave de API do jogador sair pela rede.
    const pkg = emptyModPackage('m', 'Mod', 'desc');
    pkg.env = ESQUEMA;

    const exportado = stripLocalState(pkg);
    const texto = JSON.stringify(exportado);

    // O esquema viaja: é parte do mod, e quem instalar precisa saber o que preencher.
    expect(texto).toContain('AI_KEY');
    expect(texto).toContain('chave da API');
    // O valor não existe em lugar nenhum do pacote, com ou sem strip.
    expect(JSON.stringify(pkg)).not.toContain('sk-');
    expect(exportado.env).toEqual(ESQUEMA);
  });

  it('CRÍTICO: o pacote não tem onde guardar um valor — não é uma regra, é o formato', () => {
    const pkg = emptyModPackage('m', 'Mod');
    pkg.env = ESQUEMA;
    // Nenhuma chave do esquema carrega valor preenchido.
    for (const c of pkg.env.chaves) {
      expect(Object.keys(c)).not.toContain('valor');
      expect(Object.keys(c)).not.toContain('value');
    }
  });

  it('o esquema exportado continua válido — quem instalar consegue preencher', () => {
    const pkg = emptyModPackage('m', 'Mod');
    pkg.env = esquemaPadrao();
    expect(validarEsquema(stripLocalState(pkg).env!)).toEqual([]);
  });

  it('CRÍTICO: um padrão sensível literal seria detectado antes de exportar', () => {
    // A defesa em profundidade: mesmo que alguém escrevesse um segredo como padrão do esquema —
    // que É exportado — a validação reprova, e o mod vai para quarentena em vez de vazar.
    const pkg = emptyModPackage('m', 'Mod');
    pkg.env = { chaves: [{ nome: 'TOKEN', descricao: 'x', obrigatoria: true, sensivel: true, padrao: 'sk-vazou' }] };
    expect(validarEsquema(pkg.env).length).toBeGreaterThan(0);
  });
});

describe('globais derivadas — a ponte com a configuração do jogo', () => {
  it('CRÍTICO: o esquema padrão resolve com as globais derivadas da configuração de IA', () => {
    // É o pedido original: `AI_MOD_ROUTER=$AI_ROUTER` funciona sem o jogador colar a mesma chave
    // duas vezes. Se isto quebrasse, todo mod novo nasceria sem provedor.
    const derivadas = { AI_ROUTER: 'openrouter', AI_API_KEY: 'sk-do-jogo', AI_MODEL: 'x' };
    const r = resolverEnv(esquemaPadrao(), {}, derivadas);
    expect(r.valores.AI_MOD_ROUTER).toBe('openrouter');
    expect(r.faltando).toEqual([]);
  });

  it('a global gravada vence a derivada — dá para usar uma conta separada nos mods', () => {
    const esq: EsquemaEnv = {
      chaves: [{ nome: 'K', descricao: 'x', obrigatoria: false, sensivel: true, padrao: '$AI_API_KEY' }],
    };
    const derivadas = { AI_API_KEY: 'do-jogo' };
    const gravadas = { AI_API_KEY: 'so-dos-mods' };
    // É assim que `globaisComDerivadas` compõe: gravadas por cima das derivadas.
    expect(resolverEnv(esq, {}, { ...derivadas, ...gravadas }).valores.K).toBe('so-dos-mods');
  });

  it('sem configuração de IA, o mod não recebe lixo — recebe ausência', () => {
    const r = resolverEnv(esquemaPadrao(), {}, {});
    expect(r.valores.AI_MOD_ROUTER).toBeUndefined();
    // E como a chave padrão é opcional, o mod ainda carrega.
    expect(r.faltando).toEqual([]);
  });
});
