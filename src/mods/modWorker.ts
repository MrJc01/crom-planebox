// O reino isolado onde os scripts de mod rodam — item 358.
//
// ## Por que este arquivo é tão curto
//
// Ele faz duas coisas, e as duas precisam acontecer **antes** de qualquer script existir: apagar os
// globais e amarrar o núcleo ao `self`. Toda a lógica está em `nucleoDoWorker.ts`, que recebe uma
// porta e pode ser testado sem navegador — `vitest` com jsdom não tem `Worker`.
//
// ## O que muda de verdade ao sair do thread principal
//
// O sandbox de `sandbox.ts` nega o alcance ao global por `with` + `Proxy`, e sempre foi honesto
// sobre o próprio limite: `[].constructor.constructor('return this')()` continua funcionando,
// porque `Function` cria a função no escopo global **do reino em que roda**.
//
// Aqui essa fuga continua funcionando — e passa a não servir para nada. O global que ela devolve é
// o do worker, e o worker não tem `fetch`, não tem `indexedDB`, não tem `document`, e não tem a
// mesma origem à mão para pedir nada. A defesa deixa de ser "eu lembrei de bloquear esse nome" e
// passa a ser "não existe nada para alcançar".
//
// É a diferença entre uma tranca melhor e um cofre vazio.
//
// ## Por que apagar globais, se o worker já tem poucos
//
// `fetch` e `indexedDB` existem em Worker. `indexedDB` é o mais grave: é onde moram os mundos
// salvos e o cofre de chaves, na mesma origem. Apagá-los é o passo que transforma "outro thread"
// em "outro reino sem nada dentro".
//
// `delete` num global de worker funciona porque `self` é um objeto comum; onde a propriedade não
// for configurável, a atribuição para `undefined` cobre o resto. As duas coisas são tentadas.

import { GLOBAIS_A_APAGAR } from './protocoloDeMods';
import { instalarNucleo } from './nucleoDoWorker';

declare const self: any;

/**
 * Apaga os globais perigosos.
 *
 * Roda no topo do módulo, antes de qualquer `postMessage` ser atendido — ou seja, antes de existir
 * um único script de mod carregado. A ordem importa: apagar depois seria apagar com alguém dentro.
 */
function esvaziarOReino(): void {
  // `postMessage` precisa sobreviver como referência ANTES de ser apagado do global: é o único
  // canal de volta, e o núcleo o usa pela porta, não pelo nome global. Apagar o nome impede o
  // script de falar diretamente com o host; guardar a função mantém o canal legítimo de pé.
  for (const nome of GLOBAIS_A_APAGAR) {
    try { delete self[nome]; } catch { /* não configurável: cai na atribuição abaixo */ }
    try { if (self[nome] !== undefined) self[nome] = undefined; } catch { /* congelado: nada a fazer */ }
  }
}

const responder = self.postMessage.bind(self);
esvaziarOReino();

const porta = {
  postMessage: (msg: unknown) => responder(msg),
  onmessage: null as ((ev: { data: unknown }) => void) | null,
};

instalarNucleo(porta);
self.onmessage = (ev: MessageEvent) => porta.onmessage?.({ data: ev.data });
