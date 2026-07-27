// Referência da API de mods, entregue ao agente pela ferramenta `get_mod_api_reference`.
//
// Mora no código, e não num arquivo `.md` solto, por um motivo específico deste projeto: já
// aconteceu de uma capacidade existir e a IA não usá-la porque nada no prompt dizia como.
// `registerCustomBlock` ficou meses assim, e a IA seguiu gerando blocos efêmeros. Documentação
// que o agente não consegue puxar sob demanda é documentação que não existe para ele.
//
// Ao mudar `ModAPI.ts`, atualize aqui — há um teste que falha se um evento sumir da referência.

export const MOD_API_REFERENCE = {
  resumo:
    'Scripts de mod dão COMPORTAMENTO ao mod (que sozinho é só dados). O script recebe um objeto ' +
    '`api` no escopo e registra handlers com api.on(evento, fn). A superfície abaixo é FECHADA: ' +
    'não existe window, fetch, document, setTimeout nem import. O que não está aqui, o script não alcança. ' +
    'O corpo do script e os handlers podem ser `async`, e as LEITURAS do mundo devem ser escritas ' +
    'com `await` (ex.: `const b = await api.world.getBlock(x, y, z)`) — hoje elas respondem na hora, ' +
    'mas vão passar a responder por mensagem quando o script mudar de reino de execução, e um mod ' +
    'escrito com `await` desde já continuará funcionando sem uma linha alterada.',

  comoUsar: [
    '1. get_session_context — descubra qual mod esta sessão edita.',
    '2. get_mod_api_reference — esta referência (você já está aqui).',
    '3. define_mod_script — escreva o script; ele é compilado e carregado na mesma chamada.',
    '4. get_mod_script_logs — veja o que imprimiu ou o que falhou, e corrija.',
  ],

  eventos: {
    load: { quando: 'o mod termina de carregar', payload: '{}' },
    unload: { quando: 'o mod vai ser descarregado — limpe o que você criou', payload: '{}' },
    tick: { quando: 'todo frame', payload: '{ dt }  // segundos desde o frame anterior' },
    blockPlaced: { quando: 'o jogador coloca um bloco', payload: '{ x, y, z, block }' },
    blockBroken: { quando: 'o jogador quebra um bloco', payload: '{ x, y, z, block }' },
    playerDamaged: { quando: 'o jogador leva dano', payload: '{ amount, cause, health }' },
    entityDeath: { quando: 'uma criatura morre', payload: '{ id, name, x, y, z }' },
    dayPhase: { quando: 'muda a fase do dia', payload: "{ phase: 'amanhecer'|'dia'|'anoitecer'|'noite', timeOfDay }" },
    weatherChange: { quando: 'o clima muda (já traduzido pelo bioma local)', payload: "{ weather: 'limpo'|'nublado'|'chuva'|'tempestade'|'neve'|'neblina', previous }" },
  },

  funcoes: {
    'api.mod': '{ id, name, revision } — identidade do mod',
    'api.on(evento, fn)': 'registra um handler; chame no corpo do script',

    'api.world.getBlock(x,y,z)': 'id do bloco naquela posição',
    'api.world.setBlock(x,y,z,bloco)': 'coloca bloco; aceita id, chave do mod ou nome da paleta',
    'api.world.fillBox(x1,y1,z1,x2,y2,z2,bloco,oco?)': 'preenche caixa; devolve quantos colocou',
    'api.world.getGroundY(x,z)': 'altura da superfície naquela coluna',
    'api.world.findNearest(bloco, raio=16)': '{x,y,z} do mais próximo do jogador, ou null',
    'api.world.blockId(ref)': 'resolve chave/nome para id numérico',

    'api.entities.spawn(chaveDaEspecie,x,y,z)': 'instancia espécie DESTE mod; devolve id ou null',
    'api.entities.list()': 'lista as entidades ativas',
    'api.entities.damage(id, dano)': 'aplica dano',

    'api.player.position()': '{x,y,z}',
    'api.player.teleport(x,y,z)': 'move o jogador',
    'api.player.health()': 'vida atual',
    'api.player.give(bloco, quantidade=1)': 'dá item ao jogador',

    'api.time.ofDay()': 'fração do dia: 0 = meia-noite, 0.5 = meio-dia',
    'api.time.isNight()': 'true se está de noite',
    'api.time.moonPhase()': 'fase da lua: 0 = nova (noite escura), 4 = cheia (noite clara)',
    'api.time.isDarkNight()': 'true nas noites em torno da lua nova — hostis nascem quase no dobro do ritmo',

    'api.weather.current()': "{ current, next, progress, lightning, wet } — clima já traduzido pelo bioma local",
    'api.weather.isRaining()': 'true em chuva ou tempestade',
    'api.weather.isStorm()': 'true só em tempestade (tem raios)',
    'api.env.get(NOME)': "valor de uma chave do mod.env, com a herança de $GLOBAL já resolvida",
    'api.env.has(NOME)': 'a chave está preenchida? Use antes de tentar uma chamada externa',
    'api.env.missing()': 'chaves obrigatórias ainda vazias (o mod nem carrega se houver alguma)',

    'api.season.current()': '{ current, next, transition, strength, effect } — estação sob o jogador, já atenuada pelo bioma',
    'api.season.is(nome)': "true se a estação é essa: 'primavera','verao','outono','inverno'",
    'api.season.growth()': 'multiplicador de crescimento de planta agora (0 = parado, no inverno)',
    'api.season.defineProfile(bioma, perfis)': "declara como um bioma responde às estações, SEM código. Ex.: api.season.defineProfile('floresta', { inverno: { crescimento: 0.4, neve: 3 } }). Campos: folhagem, grama, temperatura, umidade, crescimento, duracaoDoDia, neve",

    'api.weather.set(clima|null)': "impõe um clima para o mundo todo; null devolve à sequência natural. Nomes: 'limpo','nublado','chuva','tempestade','neve','neblina'",

    'await api.biomes.define({id, nome, temp, moist, grama, folhagem, neblina, alcanceNeblina, saturacao, sazonal, minerios})':
      "registra um bioma novo. `temp` e `moist` são o centro dele no plano de clima, ambos entre -1 e 1 — é isso que decide ONDE ele aparece no mundo. Cores em [r,g,b] de 0 a 1. O id ganha o prefixo do mod. Só afeta o terreno ainda não gerado",
    'api.ui.toast(texto)': 'mensagem curta na tela',
    'define_mod_scatter (ferramenta MCP)': 'faz uma estrutura do mod nascer sozinha pelo mundo. No máximo UMA por célula de ~87 m — o peso disputa com as outras regras do mesmo bioma, não aumenta a densidade total',
    'await api.net.fetch(url, {metodo, cabecalhos, corpo})': "ÚNICA porta de rede. Só funciona se o mod declarar o host em capacidades.rede.hosts E o jogador autorizar. Devolve { status, ok, texto }. Enviar dados (POST, ou qualquer corpo) exige capacidades.rede.envia = true. Sem redirecionamento, sem cookies, 10 s de limite e 2 MB de resposta",
    'capacidades (no pacote do mod)': "{ versao: 1, rede: { hosts: ['api.exemplo.com' ou '.exemplo.com'], motivo: 'uma frase que o jogador leia', envia?: true } } — curinga não é aceito",
    'api.audio.play(nome, posicao?, volume?)': 'toca som do catálogo; veja api.audio.nomes',
    'api.audio.nomes': 'catálogo de sons válidos (dano, acerto, pegarItem, craftar, splash…)',
    'api.storage.get/set/has/keys': 'chave-valor do mod, isolado dos outros, dura a sessão',
    'api.console.log/warn/error': 'vai para o log do mod — leia com get_mod_script_logs',
    'api.B': 'paleta base: B.STONE, B.TORCH, B.COAL_ORE, B.GLOWSTONE, B.WATER, B.LAVA…',
    'api.Math': 'o Math padrão',
  },

  naoExiste: [
    'window, globalThis, document — sem acesso ao DOM',
    'fetch, XMLHttpRequest, WebSocket — a rede existe SÓ por api.net.fetch, com host declarado no manifesto e autorizado pelo jogador',
    'setTimeout, setInterval — use o evento tick com api.storage para acumular tempo',
    'import, require — a API injetada é tudo que há',
    'localStorage, IndexedDB — use api.storage',
  ],

  limites: {
    blocosPorChamada: '20.000 — um handler que passa disso para de escrever naquele ciclo',
    chamadasPorQuadro: '2.000 chamadas de API por mod, por quadro. Ao estourar, o resto do quadro é recusado e volta ao normal no seguinte — o script NÃO é desligado por isso',
    errosAteDesligar: '5 — o script que falhar 5 vezes é desligado sozinho, com o motivo no log',
    logs: '300 linhas por mod, as mais antigas são descartadas',
  },

  escopo:
    'A escrita é escopada ao mod da SESSÃO de chat atual, e os blocos que o script coloca ficam ' +
    'marcados como dele — é isso que permite remover o mod depois e desfazer exatamente o que ele fez.',

  exemplos: {
    tochaAutomatica: `// Acende uma tocha onde o jogador quebrar um bloco no escuro
// Handler \`async\` e leituras com \`await\`: é o formato que continua valendo quando o
// script passar a rodar em outro reino de execução e as leituras virarem mensagens.
api.on('blockBroken', async ({ x, y, z }) => {
  if (!await api.time.isNight()) return;
  api.world.setBlock(x, y + 1, z, api.B.TORCH);
  api.console.log('tocha em', x, y + 1, z);
});`,

    recompensaPorMinerar: `// Dá carvão extra ao minerar minério de ferro
api.on('blockBroken', ({ block }) => {
  if (block !== api.B.IRON_ORE) return;
  api.player.give(api.B.COAL_ORE, 1);
  api.ui.toast('Veio de carvão junto!');
});`,

    acumularTempo: `// Sem setInterval: acumule dt no tick
api.on('tick', ({ dt }) => {
  const t = (api.storage.get('acc') || 0) + dt;
  if (t < 5) { api.storage.set('acc', t); return; }
  api.storage.set('acc', 0);
  api.console.log('passaram 5 segundos');
});`,

    estruturaNoAnoitecer: `// Constrói um abrigo quando anoitece
api.on('dayPhase', async ({ phase }) => {
  if (phase !== 'anoitecer') return;
  const p = await api.player.position();
  const y = await api.world.getGroundY(Math.floor(p.x), Math.floor(p.z));
  api.world.fillBox(p.x - 3, y + 1, p.z - 3, p.x + 3, y + 4, p.z + 3, 'pedra', true);
  api.ui.toast('Abrigo levantado!');
});`,

    criaturaDoMod: `// Espécie declarada com define_mod_entity, instanciada por script
api.on('dayPhase', ({ phase }) => {
  if (phase !== 'noite') return;
  const p = api.player.position();
  api.entities.spawn('guardiao', p.x + 6, p.y, p.z);
});`,
  },

  errosComuns: [
    'Usar setTimeout — não existe; acumule dt no tick.',
    'Chamar api.entities.spawn com uma espécie que não foi criada com define_mod_entity.',
    'Escrever em laço sem limite dentro de tick — o orçamento corta, mas o resultado fica pela metade.',
    'Esquecer que blockBroken traz o bloco que ESTAVA lá, não o ar que ficou.',
  ],
} as const;
