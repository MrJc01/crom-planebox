import { EsquemaEnv } from './ModEnv';
import { ManifestoDeCapacidades } from './capacidades';
// Formato do "pacote de mod" — a unidade que a IA cria, o mundo salva e o jogo reaplica.
//
// Um mod é declarativo de propósito: são dados serializáveis (blocos, espécies de entidade,
// estruturas), não código solto. A única parte executável é o `behaviorScript` de uma entidade,
// que é compilado isoladamente e cujo erro não derruba o resto (ver EntitySystem).
//
// Regra de identidade que sustenta o save: **todo bloco de mod carrega o seu `blockId` dentro
// do pacote persistido**. É isso que faz um bloco criado hoje continuar sendo o mesmo bloco
// depois de fechar e reabrir o navegador.

/** Cor aceita nas definições: número (0xRRGGBB) ou string ('#rrggbb'). */
export type ColorInput = number | string;

export interface ModBlockDef {
  /** Chave simbólica única dentro do mod, ex.: 'rubi'. Referenciável como 'meumod:rubi'. */
  key: string;
  /** Nome exibido no inventário e nas mensagens. */
  name: string;
  /** Id numérico no array global `BLOCKS`. Atribuído na criação e **imutável** depois disso. */
  blockId: number;
  topColor: ColorInput;
  sideColor?: ColorInput;
  bottomColor?: ColorInput;
  solid?: boolean;
  opaque?: boolean;
  decor?: boolean;
  gravity?: boolean;
  structural?: boolean;
  /** Id de bloco dropado ao quebrar; por padrão o próprio bloco. */
  drops?: number;
  minToolTier?: number;
  interactive?: boolean;
  /** 0-15. Metadado para a futura propagação de luz. */
  lightLevel?: number;
}

export interface ModEntityPart {
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  color: ColorInput;
}

/** Espécie de entidade — um molde. As instâncias no mundo ficam em `ModEntityInstance`. */
export interface ModEntityDef {
  key: string;
  name: string;
  faction?: string;
  role?: string;
  health?: number;
  parts: ModEntityPart[];
  /** JS executado a cada frame com (dt, entity, Math, THREE) no escopo. Opcional. */
  behaviorScript?: string;
}

/**
 * Bloco de uma estrutura, relativo à origem (0,0,0).
 * `block` aceita id numérico **ou** referência simbólica ('meumod:rubi', 'rubi', 'STONE'),
 * resolvida na hora de carimbar — assim uma estrutura exportada continua válida mesmo que o
 * mod receba outros ids ao ser importado noutro mundo.
 */
export interface ModStructureBlock {
  dx: number;
  dy: number;
  dz: number;
  block: number | string;
}

export interface ModStructureDef {
  key: string;
  name: string;
  blocks: ModStructureBlock[];
}

/** Uma entidade de mod efetivamente colocada no mundo — isto é o que sobrevive ao reload. */
export interface ModEntityInstance {
  id: string;
  modId: string;
  entityKey: string;
  x: number;
  y: number;
  z: number;
}

/**
 * Script de um mod: o código que dá **comportamento** ao que antes eram só dados.
 *
 * Um mod pode ter vários — separar por assunto ("clima", "criaturas") mantém cada arquivo
 * legível e permite desligar um pedaço sem derrubar o mod inteiro.
 */
export interface ModScript {
  /** Chave única no mod, ex.: 'main'. Serve de nome de arquivo no editor. */
  key: string;
  name: string;
  /** Código JS. Recebe `api` no escopo; ver `src/mods/ModAPI.ts`. */
  code: string;
  enabled: boolean;
}

/**
 * Bioma declarado por um mod — item 676.
 *
 * Guardado no pacote, como os blocos: é **dado**, não comportamento. Isso é o que faz o bioma
 * sobreviver a fechar o navegador, viajar na exportação e chegar aos convidados pelo P2P — sem
 * depender de um script rodar na ordem certa.
 */
export interface ModBiomeDef {
  /** Chave curta única no mod. O id final ganha o prefixo do mod. */
  key: string;
  nome: string;
  /** Centro no plano de clima, ambos de -1 a 1. É o que decide ONDE o bioma aparece. */
  temp: number;
  moist: number;
  grama?: ColorInput;
  folhagem?: ColorInput;
  neblina?: ColorInput;
  alcanceNeblina?: number;
  saturacao?: number;
  sazonal?: boolean;
  minerios?: Partial<Record<'carvao' | 'ferro' | 'ouro' | 'diamante', number>>;
}

/**
 * Regra de espalhamento declarada por um mod — item 689.
 *
 * Aponta para uma estrutura **do próprio mod**, pela chave dela. Permitir apontar para a estrutura
 * de outro mod faria a regra parar de funcionar quando aquele outro fosse desinstalado, e o sintoma
 * seria estruturas sumindo de um mod que ninguém tocou.
 */
export interface ModScatterDef {
  /** Chave da estrutura deste mod (`ModStructureDef.key`). */
  estrutura: string;
  /** Peso relativo na disputa pela célula. */
  peso: number;
  /** Biomas onde pode nascer. Aceita nativos e os do próprio mod. */
  biomas: string[];
  /** Meia-largura da pegada, em mini-voxels. */
  pegada: number;
  /** Desnível máximo tolerado sob a pegada. */
  desnivelMax: number;
  /** Altura mínima acima do nível do mar. */
  alturaMinAcimaDoMar: number;
}

export interface ModPackage {
  /** Identificador estável, ex.: 'mod-rubi'. Único por mundo. */
  id: string;
  name: string;
  description?: string;
  version: string;
  /** Desabilitar mantém as definições salvas, só não as aplica ao mundo. */
  enabled: boolean;
  blocks: ModBlockDef[];
  entities: ModEntityDef[];
  structures: ModStructureDef[];
  /** Ausente em mods criados antes do runtime — tratado como lista vazia. */
  scripts?: ModScript[];
  /** Biomas declarados por este mod (item 676). Ausente em mods anteriores a ele. */
  biomes?: ModBiomeDef[];
  /** Regras de espalhamento de estruturas pelo mundo (item 689). */
  scatter?: ModScatterDef[];

  /**
   * **Esquema** do `mod.env`: quais chaves existem e para que servem. Parte do mod, viaja na
   * exportação e no P2P.
   *
   * Os **valores** não estão aqui, e essa ausência é estrutural, não uma regra a lembrar: se
   * estivessem, `export_mod` e `mod_sync` teriam de filtrar algo sensível a cada vez, e bastaria
   * um caminho novo esquecer o filtro para a chave da API do jogador sair pela rede. Eles vivem
   * no cofre (`modSecrets`, em `src/storage/Database.ts`).
   */
  env?: EsquemaEnv;

  /**
   * O que este mod **pede** para poder fazer — item 761.
   *
   * Viaja com o mod, como o `env`: quem recebe um mod importado ou vindo do anfitrião precisa ver o
   * que ele pede **antes** de instalar. Um pedido que só aparecesse depois seria um pedido que
   * ninguém avalia.
   *
   * Pedir não é ter: o consentimento do jogador é guardado separado, por mundo e por host
   * (`modConsents`, em `src/storage/Database.ts`), e **não** viaja com o mod. Se viajasse, importar
   * um mod traria junto a permissão que outra pessoa concedeu — que é precisamente a coisa que a
   * permissão existe para impedir.
   */
  capacidades?: ManifestoDeCapacidades;
  createdAt: number;
  updatedAt: number;

  /**
   * Sessão de chat em que este mod nasceu — só proveniência, para o histórico fazer sentido.
   *
   * O vínculo **autoritativo** mora do outro lado, em `ChatThreadRecord.modId`, porque um mod
   * pode ser continuado em várias sessões: abrir uma conversa nova para ajustar um mod antigo
   * não deveria obrigar o agente a carregar todo o histórico anterior no contexto.
   */
  originThreadId?: string;

  /** Número da revisão atual. Incrementa a cada alteração de conteúdo. */
  revision: number;

  /**
   * Quarentena: o mod falhou ao ser aplicado e foi desligado automaticamente.
   * Existe para um mod corrompido não impedir o mundo de carregar — ele é isolado e reportado,
   * e o resto do mundo segue normalmente.
   */
  quarantined?: boolean;
  quarantineReason?: string;
}

/**
 * Instantâneo de uma revisão do mod, para poder voltar atrás.
 * Guarda o pacote inteiro: são dados pequenos (dezenas de KB no pior caso) e a alternativa —
 * diffs — tornaria o rollback capaz de falhar justamente quando mais se precisa dele.
 */
export interface ModRevision {
  modId: string;
  revision: number;
  /** Pacote completo como estava nesta revisão. */
  snapshot: ModPackage;
  /** O que mudou, em uma linha, para a lista de versões ser legível. */
  summary: string;
  createdAt: number;
}

/** Formato de troca do `export_mod` / `import_mod`: um mod fora de qualquer mundo. */
export interface ExportedModPackage {
  formatVersion: number;
  exportedAt: number;
  mod: ModPackage;
}

export const MOD_FORMAT_VERSION = 1;

export function emptyModPackage(id: string, name: string, description = '', originThreadId?: string): ModPackage {
  const now = Date.now();
  return {
    id,
    name,
    description,
    version: '1.0.0',
    enabled: true,
    blocks: [],
    entities: [],
    structures: [],
    scripts: [],
    createdAt: now,
    updatedAt: now,
    originThreadId,
    revision: 1,
  };
}

/**
 * Remove do pacote tudo que é local a este mundo, deixando só a **estrutura** do mod.
 *
 * É o que o usuário quer ao exportar: o conteúdo (blocos, criaturas, estruturas), não a
 * conversa que levou até ele nem o vínculo com uma thread que não existe em outro mundo.
 * Os `blockId` também saem — quem importa realoca no mundo de destino.
 */
/**
 * Remove o que é local desta instalação antes de exportar ou enviar pela rede.
 *
 * Repare que **não há nada de `env` a remover**: o esquema deve viajar (é parte do mod) e os
 * valores nunca estiveram no pacote. Há teste fixando isso.
 */
export function stripLocalState(pkg: ModPackage): ModPackage {
  const clone: ModPackage = JSON.parse(JSON.stringify(pkg));
  delete clone.originThreadId;
  delete clone.quarantined;
  delete clone.quarantineReason;
  for (const b of clone.blocks || []) delete (b as any).blockId;
  return clone;
}
