// Leitura de um convite colado pelo jogador.
//
// ## O defeito que originou este arquivo
//
// A extração do id da sala vivia dentro de `bootstrap()` em `main.ts` e era uma linha:
// `url.searchParams.get('join') || link`. O `|| link` faz **qualquer texto virar um id de sala**.
//
// Colar a URL do relay produzia a sala `ws://localhost:8787`, e o jogo criava e salvava no banco
// um mundo chamado "Visitante de ws://localhost:8787". O jogador via um mundo vazio em vez de uma
// mensagem de erro — e ganhava lixo permanente na lista de mundos a cada tentativa frustrada.
//
// Está num módulo próprio porque virou validação de verdade, com casos que merecem teste, e
// porque uma função dentro de `bootstrap()` não pode ser testada sem subir o jogo inteiro.

/** Um id de sala aceitável: sem espaço e sem barra, que é o que o distingue de uma frase ou URL. */
const ID_VALIDO = /^[\w.:-]{3,200}$/;

/** Tem esquema de protocolo? Então é endereço, e o id precisa vir de um parâmetro. */
const TEM_ESQUEMA = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Id da sala a partir do que o jogador colou. `null` quando não dá para extrair um.
 *
 * `base` existe para o caso de um caminho relativo (`?join=abc` colado sozinho) e para o teste
 * não depender de `location`.
 */
export function idDeSala(entrada: string, base = 'http://local/'): string | null {
  const bruto = (entrada ?? '').trim();
  if (!bruto) return null;

  if (TEM_ESQUEMA.test(bruto)) {
    try {
      // Só o parâmetro. Um endereço SEM `join` é recusado, porque é exatamente o caso de ter
      // colado a coisa errada — a URL do relay, a do jogo, um link qualquer.
      const v = new URL(bruto).searchParams.get('join');
      return v && ID_VALIDO.test(v) ? v : null;
    } catch {
      return null;
    }
  }

  if (bruto.includes('?')) {
    try {
      const v = new URL(bruto, base).searchParams.get('join');
      return v && ID_VALIDO.test(v) ? v : null;
    } catch {
      return null;
    }
  }

  // Texto solto: é o código da sala, digitado à mão.
  return ID_VALIDO.test(bruto) ? bruto : null;
}

/** URL do relay embutida no convite, se houver. */
export function relayDeLink(entrada: string, base = 'http://local/'): string | null {
  const bruto = (entrada ?? '').trim();
  if (!bruto) return null;
  try {
    const relay = new URL(bruto, base).searchParams.get('relay');
    if (!relay) return null;
    // `searchParams` já decodifica; decodificar de novo corromperia um valor com `%` legítimo.
    return relay.trim() || null;
  } catch {
    return null;
  }
}
