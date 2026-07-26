// Chuva e neve: partículas com orçamento fixo, presas à câmera.
//
// ## Três decisões
//
//  1. **Orçamento fixo.** O número de partículas nunca cresce: o vetor é alocado uma vez no
//     tamanho máximo e a intensidade do clima decide quantas estão *ativas*. Alocar por
//     intensidade faria a tempestade — o momento de maior carga de tudo — ser também o momento de
//     alocar memória.
//  2. **Caixa que segue a câmera**, com as coordenadas embrulhadas. A partícula que sai por um
//     lado reentra pelo outro, então andar não deixa um rastro de chuva para trás nem uma frente
//     seca à direita.
//  3. **A chuva para no primeiro bloco sólido abaixo.** É daí que sai, de graça, o "não chove
//     dentro de casa" — não é preciso testar se a coluna vê o céu, porque o telhado é justamente
//     o primeiro bloco sólido. Uma varanda funciona sem nenhum caso especial.

import * as THREE from 'three';

/** Teto de partículas. Uma tempestade usa todas; chuva fina usa um terço. */
const MAX_PARTICULAS = 1400;
/** Meia-largura da caixa que segue a câmera, em voxels. */
const RAIO = 26;
/** Altura da caixa acima da câmera. */
const ALTURA = 22;

export interface ConsultaSolido {
  (x: number, y: number, z: number): boolean;
}

export class Precipitation {
  readonly pontos: THREE.Points;
  private material: THREE.PointsMaterial;
  private posicoes: Float32Array;
  private velocidades: Float32Array;
  /** Deriva lateral por partícula — neve não cai reta. */
  private deriva: Float32Array;
  /** Onde cada partícula deve parar. Recalculado só ao renascer, não a cada quadro. */
  private chao: Float32Array;
  private ativas = 0;
  private neve = false;
  private semente = 1;

  constructor() {
    this.posicoes = new Float32Array(MAX_PARTICULAS * 3);
    this.velocidades = new Float32Array(MAX_PARTICULAS);
    this.deriva = new Float32Array(MAX_PARTICULAS * 2);
    this.chao = new Float32Array(MAX_PARTICULAS);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.posicoes, 3));
    // Sem esfera de corte: as partículas se movem todo quadro e o cálculo automático seria
    // refeito à toa. A caixa acompanha a câmera, então nunca está fora de vista.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), RAIO * 2);

    this.material = new THREE.PointsMaterial({
      color: 0xaecbe4,
      size: 0.22,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      fog: true,
    });
    this.pontos = new THREE.Points(geo, this.material);
    this.pontos.frustumCulled = false;
    this.pontos.visible = false;
  }

  private rnd(): number {
    this.semente ^= this.semente << 13;
    this.semente ^= this.semente >>> 17;
    this.semente ^= this.semente << 5;
    this.semente >>>= 0;
    return this.semente / 4294967296;
  }

  /**
   * Coloca uma partícula no topo da caixa, numa coluna sorteada, e descobre onde ela vai parar.
   *
   * A varredura para baixo acontece **aqui**, uma vez por vida da partícula (~1–2 s), e não a
   * cada quadro. Com 1.400 partículas isso são algumas centenas de varreduras por segundo, contra
   * 84.000 se fosse por quadro.
   */
  private renascer(i: number, camX: number, camY: number, camZ: number, solido: ConsultaSolido): void {
    const x = camX + (this.rnd() * 2 - 1) * RAIO;
    const z = camZ + (this.rnd() * 2 - 1) * RAIO;
    const y = camY + ALTURA * (0.5 + this.rnd() * 0.5);

    this.posicoes[i * 3] = x;
    this.posicoes[i * 3 + 1] = y;
    this.posicoes[i * 3 + 2] = z;

    this.velocidades[i] = this.neve ? 1.4 + this.rnd() * 0.9 : 15 + this.rnd() * 7;
    this.deriva[i * 2] = this.neve ? (this.rnd() * 2 - 1) * 0.7 : (this.rnd() * 2 - 1) * 0.15;
    this.deriva[i * 2 + 1] = this.neve ? (this.rnd() * 2 - 1) * 0.7 : (this.rnd() * 2 - 1) * 0.15;

    // Primeiro sólido abaixo. O limite existe para que uma coluna vazia — sobre o mar, ou num
    // buraco fundo — não vire uma varredura de 128 voxels por partícula.
    const fundo = Math.floor(y) - (ALTURA + RAIO);
    let parada = fundo;
    const xi = Math.floor(x), zi = Math.floor(z);
    for (let yy = Math.floor(y); yy > fundo; yy--) {
      if (solido(xi, yy, zi)) { parada = yy + 1; break; }
    }
    this.chao[i] = parada;
  }

  /**
   * @param intensidade partículas por segundo do clima; 0 desliga tudo
   * @param neve muda queda, deriva, cor e tamanho
   */
  public update(
    dt: number,
    cam: THREE.Vector3,
    intensidade: number,
    neve: boolean,
    solido: ConsultaSolido,
  ): void {
    const alvo = Math.max(0, Math.min(MAX_PARTICULAS, Math.round(intensidade * 0.78)));

    if (alvo === 0) {
      if (this.ativas !== 0) {
        this.ativas = 0;
        this.pontos.visible = false;
      }
      return;
    }

    if (neve !== this.neve) {
      this.neve = neve;
      this.material.color.setHex(neve ? 0xf2f6fb : 0xaecbe4);
      this.material.size = neve ? 0.34 : 0.2;
      this.material.opacity = neve ? 0.8 : 0.5;
      // Toda partícula viva ainda tem velocidade do clima anterior: força o renascimento.
      this.ativas = 0;
    }

    // Cresce e encolhe aos poucos: um corte seco no meio de uma transição de clima apareceria
    // como a chuva sumindo de um quadro para o outro.
    const passo = Math.max(1, Math.ceil(MAX_PARTICULAS * dt));
    if (this.ativas < alvo) this.ativas = Math.min(alvo, this.ativas + passo);
    else if (this.ativas > alvo) this.ativas = Math.max(alvo, this.ativas - passo);

    this.pontos.visible = true;

    for (let i = 0; i < this.ativas; i++) {
      const o = i * 3;
      let y = this.posicoes[o + 1];

      // Fora da caixa (o jogador andou, ou a partícula acabou de entrar na conta ativa).
      const dx = this.posicoes[o] - cam.x;
      const dz = this.posicoes[o + 2] - cam.z;
      if (y <= this.chao[i] || y < cam.y - ALTURA || Math.abs(dx) > RAIO || Math.abs(dz) > RAIO) {
        this.renascer(i, cam.x, cam.y, cam.z, solido);
        continue;
      }

      y -= this.velocidades[i] * dt;
      this.posicoes[o + 1] = y;
      this.posicoes[o] += this.deriva[i * 2] * dt;
      this.posicoes[o + 2] += this.deriva[i * 2 + 1] * dt;
    }

    // As partículas além do ativo ficam onde estão; escondê-las custaria um segundo vetor de
    // atributos. Em vez disso, elas são empurradas para longe uma única vez ao sair da conta.
    for (let i = this.ativas; i < MAX_PARTICULAS; i++) {
      if (this.posicoes[i * 3 + 1] !== 1e6) {
        this.posicoes[i * 3] = 0;
        this.posicoes[i * 3 + 1] = 1e6;
        this.posicoes[i * 3 + 2] = 0;
      }
    }

    (this.pontos.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  public dispose(): void {
    this.pontos.geometry.dispose();
    this.material.dispose();
  }
}

/**
 * Relâmpago: decide quando cai, e o atraso do trovão.
 *
 * Puro e testável de propósito — o clarão é fácil de acertar por tentativa, mas "o trovão vem
 * depois, e mais tarde quanto mais longe" é uma regra que dá para errar em silêncio.
 */
export class Relampago {
  private ate = 0;
  /** Trovões agendados: instante (s) e ganho. */
  private pendentes: { em: number; ganho: number }[] = [];
  private t = 0;

  /** Velocidade do som, em voxels por segundo. Escala de jogo, não de física. */
  public static readonly VELOCIDADE_SOM = 110;

  /**
   * @param intensidade 0..1 — probabilidade por segundo de um raio
   * @returns brilho extra do clarão neste quadro, 0..1
   */
  public update(dt: number, intensidade: number, rng: () => number = Math.random): number {
    this.t += dt;

    if (intensidade > 0 && this.t > this.ate && rng() < intensidade * dt) {
      this.ate = this.t + 0.18;
      // A distância decide tudo: o atraso do trovão e o quanto ele soa.
      const distancia = 40 + rng() * 420;
      this.pendentes.push({
        em: this.t + distancia / Relampago.VELOCIDADE_SOM,
        ganho: Math.max(0.15, 1 - distancia / 520),
      });
    }

    // Clarão: sobe instantâneo e cai rápido. Um clarão que some devagar parece um holofote.
    const restante = this.ate - this.t;
    return restante > 0 ? Math.min(1, restante / 0.18) : 0;
  }

  /** Trovões que devem tocar agora. Consome a lista. */
  public trovoesProntos(): number[] {
    if (this.pendentes.length === 0) return [];
    const prontos: number[] = [];
    this.pendentes = this.pendentes.filter((p) => {
      if (p.em <= this.t) { prontos.push(p.ganho); return false; }
      return true;
    });
    return prontos;
  }

  public reset(): void {
    this.pendentes.length = 0;
    this.ate = 0;
    this.t = 0;
  }
}
