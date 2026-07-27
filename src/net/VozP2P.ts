// Voz entre quem está no mesmo mundo — itens 927 a 932.
//
// ## Onde ela mora, e por que não precisa de servidor
//
// A `RTCPeerConnection` já existe: é por ela que os blocos e as criaturas viajam. Voz é uma trilha
// de mídia na **mesma** conexão. Não há servidor de voz, não há upload, não há terceiro no caminho —
// o áudio vai do navegador de um jogador para o do outro, como o resto.
//
// ## As três regras que governam tudo aqui
//
// **Desligado por padrão, sem exceção.** O microfone é a capacidade mais invasiva que um jogo de
// navegador pode pedir. Nada aqui o liga sozinho — nem ao entrar no mundo, nem ao conectar, nem ao
// restaurar uma preferência salva. Ligar é sempre um clique consciente.
//
// **`getUserMedia` só no clique.** Pedir no boot faria o navegador mostrar o pedido de permissão
// antes de o jogador ter qualquer contexto do porquê — e a resposta a um pedido sem contexto é
// "não", ou pior, um "sim" que ele não entendeu. O pedido acontece no momento em que ele acabou de
// clicar num botão de microfone, que é quando a pergunta faz sentido sozinha.
//
// **Nunca captar sem sinal na tela.** Se há uma trilha viva, existe indicador. Não como cortesia:
// um jogo que capta áudio sem mostrar é indistinguível de um que grava escondido, e a única forma
// de o jogador confiar é a informação estar sempre lá.
//
// ## Por que o microfone "armado" é diferente de "transmitindo"
//
// Push-to-talk exige que a trilha exista **antes** da tecla ser apertada: pedir o dispositivo a cada
// aperto custaria centenas de milissegundos, e a primeira sílaba se perderia sempre.
//
// Então há dois estados. **Armado** é ter o dispositivo e a trilha na conexão. **Transmitindo** é a
// trilha estar `enabled`. Desarmar encerra as trilhas de verdade — é o que apaga o indicador de
// gravação do sistema operacional, e deixá-lo aceso com a trilha muda seria mentir para o jogador
// pelo caminho mais cruel: ele acha que desligou.

export type ModoDeVoz = 'apertar' | 'alternar';

/** O que a camada de voz precisa do mundo. Injetável para teste — jsdom não tem WebRTC nem mídia. */
export interface DependenciasDeVoz {
  /** `navigator.mediaDevices.getUserMedia`, ou um duplo. */
  pedirMicrofone(): Promise<MediaStream>;
  /** Põe a trilha nas conexões abertas; devolve quantos pares receberam. */
  publicar(trilha: MediaStreamTrack, stream: MediaStream): number;
  /** Tira a trilha das conexões. */
  despublicar(): void;
  /** Estamos numa partida com outras pessoas? */
  temPares(): boolean;
}

export interface EstadoDaVoz {
  armado: boolean;
  transmitindo: boolean;
  modo: ModoDeVoz;
  paresAlcancados: number;
}

export class VozP2P {
  private stream: MediaStream | null = null;
  private modo: ModoDeVoz = 'apertar';
  private transmitindo = false;
  private paresAlcancados = 0;
  /** A tecla de push-to-talk está pressionada agora? */
  private teclaEmBaixo = false;

  /** Avisado a cada mudança de estado — é o que mantém o indicador da tela sempre certo. */
  public aoMudar: (estado: EstadoDaVoz) => void = () => {};
  /** Erro ao pedir o microfone (permissão negada, sem dispositivo). */
  public aoFalhar: (motivo: string) => void = () => {};

  constructor(private deps: DependenciasDeVoz) {}

  get estado(): EstadoDaVoz {
    return {
      armado: this.stream !== null,
      transmitindo: this.transmitindo,
      modo: this.modo,
      paresAlcancados: this.paresAlcancados,
    };
  }

  /**
   * Liga ou desliga o microfone. **Só isto** pede o dispositivo.
   *
   * Devolve o estado resultante. Um `false` em `armado` depois de pedir para ligar significa que o
   * jogador negou a permissão ou não há dispositivo — e `aoFalhar` já explicou qual dos dois.
   */
  async alternarMicrofone(): Promise<EstadoDaVoz> {
    if (this.stream) { this.desarmar(); return this.estado; }

    try {
      const stream = await this.deps.pedirMicrofone();
      const trilha = stream.getAudioTracks()[0];
      if (!trilha) {
        // Um stream sem trilha de áudio é um dispositivo que respondeu e não entregou nada. Tratar
        // como sucesso deixaria o indicador aceso sobre um microfone que não capta.
        stream.getTracks().forEach((t) => t.stop());
        this.aoFalhar('nenhum microfone disponível');
        return this.estado;
      }

      this.stream = stream;
      // No modo apertar, a trilha nasce **muda**: armar não é falar. Nascer transmitindo faria o
      // jogador ser ouvido no instante em que ligou o microfone, antes de apertar nada.
      this.transmitindo = this.modo === 'alternar';
      trilha.enabled = this.transmitindo;
      this.paresAlcancados = this.deps.publicar(trilha, stream);
    } catch (err: any) {
      this.aoFalhar(motivoLegivel(err));
    }
    this.aoMudar(this.estado);
    return this.estado;
  }

  /** Troca entre push-to-talk e alternado, sem soltar o dispositivo. */
  definirModo(modo: ModoDeVoz): void {
    if (modo === this.modo) return;
    this.modo = modo;
    // Trocar para "apertar" com o microfone aberto emudece na hora: quem escolheu apertar não
    // espera continuar sendo ouvido só porque estava no outro modo um segundo atrás.
    this.aplicarTransmissao(modo === 'alternar' ? this.transmitindo : this.teclaEmBaixo);
    this.aoMudar(this.estado);
  }

  /** A tecla de push-to-talk desceu ou subiu. Ignorada no modo alternado. */
  definirTecla(pressionada: boolean): void {
    this.teclaEmBaixo = pressionada;
    if (this.modo !== 'apertar') return;
    this.aplicarTransmissao(pressionada);
  }

  /**
   * Solta o dispositivo e tira a trilha das conexões.
   *
   * `stop()` em cada trilha é o que apaga o indicador de gravação do sistema. Só marcar
   * `enabled = false` deixaria o navegador mostrando "esta aba está usando o microfone" para
   * sempre — e um jogador que clicou em desligar e continua vendo o indicador conclui, com razão,
   * que o botão mente.
   */
  desarmar(): void {
    if (!this.stream) return;
    this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.transmitindo = false;
    this.paresAlcancados = 0;
    this.deps.despublicar();
    this.aoMudar(this.estado);
  }

  private aplicarTransmissao(ligado: boolean): void {
    const trilha = this.stream?.getAudioTracks()[0];
    if (!trilha) return;
    if (this.transmitindo === ligado) return;
    this.transmitindo = ligado;
    // `enabled`, e não `stop()`: alternar o dispositivo a cada aperto de tecla custaria centenas de
    // milissegundos e perderia a primeira sílaba de toda frase.
    trilha.enabled = ligado;
    this.aoMudar(this.estado);
  }
}

/** Transforma o erro do navegador em algo que o jogador consiga agir. */
export function motivoLegivel(err: unknown): string {
  const nome = (err as { name?: string })?.name ?? '';
  if (nome === 'NotAllowedError' || nome === 'SecurityError') {
    return 'permissão de microfone negada — libere nas configurações do navegador';
  }
  if (nome === 'NotFoundError' || nome === 'DevicesNotFoundError') {
    return 'nenhum microfone encontrado';
  }
  if (nome === 'NotReadableError') return 'o microfone está em uso por outro programa';
  return (err as { message?: string })?.message || 'não foi possível abrir o microfone';
}
