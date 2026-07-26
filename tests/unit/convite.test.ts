// Leitura do convite colado pelo jogador.
//
// O caso que dá nome a este arquivo saiu do console do jogo: o log mostrava
// `Carregando mundo ID: "guest-ws://localhost:8787"` e `Mundo "Visitante de ws://localhost:8787"
// carregado`. A URL do relay tinha virado o id de uma sala, e o jogo criou e SALVOU um mundo com
// esse nome antes de sequer tentar conectar.
//
// A causa era uma linha: `url.searchParams.get('join') || link`. O `|| link` faz qualquer texto
// virar id de sala.

import { describe, it, expect } from 'vitest';
import { idDeSala, relayDeLink } from '../../src/net/convite';

describe('idDeSala — o que é convite e o que não é', () => {
  it('CRÍTICO: a URL do relay NÃO é um id de sala', () => {
    // O caso do relato, exatamente como apareceu no console.
    expect(idDeSala('ws://localhost:8787')).toBeNull();
    expect(idDeSala('ws://localhost:8787/')).toBeNull();
  });

  it('CRÍTICO: endereço sem `join` é recusado, mesmo sendo um endereço válido', () => {
    // Colar o endereço do próprio jogo é o engano mais provável depois da URL do relay.
    expect(idDeSala('http://localhost:5173/')).toBeNull();
    expect(idDeSala('https://exemplo.com/jogo?outro=1')).toBeNull();
  });

  it('extrai o id do link de convite completo', () => {
    expect(idDeSala('http://localhost:5173/?join=room-a1b2c3')).toBe('room-a1b2c3');
    expect(
      idDeSala('http://x/?join=room-a1b2c3&relay=' + encodeURIComponent('ws://localhost:8787')),
    ).toBe('room-a1b2c3');
  });

  it('aceita o código da sala digitado à mão', () => {
    expect(idDeSala('room-a1b2c3')).toBe('room-a1b2c3');
    expect(idDeSala('  room-a1b2c3  ')).toBe('room-a1b2c3');
  });

  it('aceita `?join=` colado sozinho', () => {
    expect(idDeSala('?join=room-xyz1234')).toBe('room-xyz1234');
  });

  it('recusa entrada vazia, frase colada por engano e id curto demais', () => {
    expect(idDeSala('')).toBeNull();
    expect(idDeSala('   ')).toBeNull();
    expect(idDeSala('entra aí no meu mundo')).toBeNull();
    expect(idDeSala('ab')).toBeNull();
  });

  it('recusa um `join` vazio ou com espaço, em vez de devolver lixo', () => {
    expect(idDeSala('http://x/?join=')).toBeNull();
    expect(idDeSala('http://x/?join=' + encodeURIComponent('a b'))).toBeNull();
  });

  it('não estoura com entrada malformada', () => {
    expect(() => idDeSala('http://[')).not.toThrow();
    expect(idDeSala('http://[')).toBeNull();
    expect(idDeSala(undefined as unknown as string)).toBeNull();
  });
});

describe('relayDeLink', () => {
  it('lê o relay embutido no convite', () => {
    const link = 'http://x/?join=room-1&relay=' + encodeURIComponent('ws://exemplo:8787');
    expect(relayDeLink(link)).toBe('ws://exemplo:8787');
  });

  it('devolve nulo quando não há relay — o convite pode ser de sala local', () => {
    expect(relayDeLink('http://x/?join=room-1')).toBeNull();
    expect(relayDeLink('room-1')).toBeNull();
  });

  it('NÃO decodifica duas vezes', () => {
    // `searchParams` já decodifica. Um `decodeURIComponent` a mais — que era o que a versão
    // anterior fazia — corromperia um valor que contenha `%` legítimo.
    //
    // O original abaixo tem um `%25` literal. Codificado uma vez ele vira `%2525`; uma
    // decodificação devolve o original, e duas o transformariam em `%`.
    const original = 'ws://h/?a=100%25';
    const link = 'http://x/?relay=' + encodeURIComponent(original);

    expect(relayDeLink(link)).toBe(original);
    expect(relayDeLink(link)).not.toBe('ws://h/?a=100%');
  });
});
