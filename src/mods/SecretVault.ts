// Cofre de segredos: leitura e escrita dos **valores** do `mod.env`.
//
// Fino de propósito. Toda a lógica de `mod.env` — herança, validação, mascaramento — está em
// `ModEnv.ts`, que é puro e testável. Aqui só mora o acesso ao banco, que é a parte que não dá
// para testar sem IndexedDB e que, por isso mesmo, deve conter o mínimo possível de decisão.
//
// O cache existe porque `resolverEnv` é chamado sempre que um script de mod precisa de uma chave,
// e uma ida ao IndexedDB por chamada seria assíncrona no meio de um caminho síncrono.

import { db } from '../storage/Database';
import { GlobaisEnv, ValoresEnv } from './ModEnv';

/** `modId` vazio guarda as globais do jogador — as que `$NOME` referencia. */
const GLOBAL = '';

export class SecretVault {
  private worldId = '';
  /** `modId` → valores. Preenchido por `carregar`, e só ali. */
  private cache = new Map<string, ValoresEnv>();

  public async setWorldId(worldId: string): Promise<void> {
    this.worldId = worldId;
    await this.carregar();
  }

  /**
   * Recarrega o cofre inteiro do mundo atual.
   *
   * O mundo todo de uma vez, e não por mod: são poucas dezenas de linhas no pior caso, e o
   * alternativo — carregar sob demanda — tornaria a primeira leitura de cada mod assíncrona,
   * justamente no caminho síncrono em que um script pede a chave.
   */
  public async carregar(): Promise<void> {
    this.cache.clear();
    if (!this.worldId) return;
    try {
      const linhas = await db.modSecrets.where('worldId').equals(this.worldId).toArray();
      for (const l of linhas) {
        let m = this.cache.get(l.modId);
        if (!m) { m = {}; this.cache.set(l.modId, m); }
        m[l.nome] = l.valor;
      }
      this.disponivel = true;
    } catch (err) {
      // Sem armazenamento (navegação privada, IndexedDB bloqueado, ambiente de teste) o cofre
      // fica vazio — mas o mundo carrega. Derrubar o carregamento porque não há onde guardar
      // chaves seria trocar um problema pequeno por um total.
      this.disponivel = false;
      console.warn('[SecretVault] Sem armazenamento persistente; as chaves valem só esta sessão.', err);
    }
  }

  /** O cofre consegue gravar? Falso em navegação privada ou com IndexedDB bloqueado. */
  public disponivel = true;

  /** Valores locais de um mod. Objeto vazio quando não há nenhum — nunca `undefined`. */
  public valoresDe(modId: string): ValoresEnv {
    return this.cache.get(modId) ?? {};
  }

  /** Chaves globais do jogador, que os mods referenciam com `$NOME`. */
  public globais(): GlobaisEnv {
    return this.cache.get(GLOBAL) ?? {};
  }

  public async definir(modId: string, nome: string, valor: string): Promise<void> {
    if (!this.worldId) return;
    const key = `${this.worldId}:${modId}:${nome}`;

    // O cache é atualizado ANTES de gravar, e independentemente de a gravação dar certo: sem
    // armazenamento a chave ainda deve funcionar nesta sessão. O jogador que digitou a chave
    // espera que ela sirva agora, mesmo que não sobreviva ao recarregar.
    if (valor === '') {
      const m = this.cache.get(modId);
      if (m) delete m[nome];
    } else {
      let m = this.cache.get(modId);
      if (!m) { m = {}; this.cache.set(modId, m); }
      m[nome] = valor;
    }

    try {
      if (valor === '') await db.modSecrets.delete(key);
      else await db.modSecrets.put({ key, worldId: this.worldId, modId, nome, valor, updatedAt: Date.now() });
    } catch {
      this.disponivel = false;
    }
  }

  public async definirGlobal(nome: string, valor: string): Promise<void> {
    await this.definir(GLOBAL, nome, valor);
  }

  /**
   * Globais **derivadas** da configuração do jogo, sem gravar nada.
   *
   * É a ponte que o pedido descrevia: `AI_MOD_ROUTER=$AI_ROUTER` funciona sem o jogador colar a
   * mesma chave duas vezes. Não são gravadas de propósito — copiá-las para o cofre criaria uma
   * segunda cópia da chave que envelheceria em silêncio quando ele trocasse a das configurações.
   *
   * As globais gravadas (`definirGlobal`) vencem: quem quiser uma conta separada para os mods
   * define a sua e ela sobrepõe a derivada.
   */
  public derivadas: GlobaisEnv = {};

  public globaisComDerivadas(): GlobaisEnv {
    return { ...this.derivadas, ...this.globais() };
  }

  /** Grava vários de uma vez — é o que a tela de edição do `mod.env` usa ao salvar. */
  public async definirVarios(modId: string, valores: ValoresEnv): Promise<void> {
    for (const [nome, valor] of Object.entries(valores)) {
      await this.definir(modId, nome, valor);
    }
  }

  /**
   * Apaga os segredos de um mod removido.
   *
   * Chamado ao desinstalar. Sem isto, reinstalar um mod herdaria as chaves de quem o instalou
   * antes — o que é ruim por si, e pior num mundo compartilhado.
   */
  public async apagarDoMod(modId: string): Promise<void> {
    this.cache.delete(modId);
    if (!this.worldId) return;
    try {
      const linhas = await db.modSecrets.where('[worldId+modId]').equals([this.worldId, modId]).toArray();
      await db.modSecrets.bulkDelete(linhas.map((l) => l.key));
    } catch {
      this.disponivel = false;
    }
  }
}
