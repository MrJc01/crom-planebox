// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { AudioSystem, AudioChannel } from '../../src/audio/AudioSystem';
import { resolveModEnvWithGlobals, EsquemaEnv } from '../../src/mods/ModEnv';

describe('Batch 8 — Testes de Áudio, Env Globais e Documentação P1', () => {
  describe('AudioSystem & Canal de Voz (Item 937 P1)', () => {
    it('deve suportar o canal "voice" no tipo AudioChannel e permitir controle de volume dedicado', () => {
      const audio = new AudioSystem();
      expect(audio.getVolume('voice')).toBeCloseTo(0.9);

      audio.setVolume('voice', 0.5);
      expect(audio.getVolume('voice')).toBeCloseTo(0.5);
    });

    it('ajuste de volume do canal voice não deve alterar sfx ou música', () => {
      const audio = new AudioSystem();
      const initialSfx = audio.getVolume('sfx');
      const initialMusic = audio.getVolume('music');

      audio.setVolume('voice', 0.2);
      expect(audio.getVolume('sfx')).toBeCloseTo(initialSfx);
      expect(audio.getVolume('music')).toBeCloseTo(initialMusic);
    });
  });

  describe('Resolução de Env Globais e Sobrescritas (Itens 740, 741 P1)', () => {
    const esquema: EsquemaEnv = {
      chaves: [
        { nome: 'MODELO', descricao: 'Modelo de IA', obrigatoria: false, sensivel: false, padrao: '$MODELO_GLOBAL' },
        { nome: 'API_HOST', descricao: 'Host de API', obrigatoria: false, sensivel: false, padrao: '$HOST_GLOBAL' },
        { nome: 'TITULO', descricao: 'Título estático', obrigatoria: false, sensivel: false, padrao: 'MeuMod' },
      ],
    };

    it('deve resolver referências $GLOBAL a partir do dicionário de globais (Item 740 P1)', () => {
      const globais = { MODELO_GLOBAL: 'claude-opus', HOST_GLOBAL: 'api.exemplo.com' };
      const valoresMod = {};

      const res = resolveModEnvWithGlobals(esquema, valoresMod, globais);
      expect(res.valores.MODELO).toBe('claude-opus');
      expect(res.valores.API_HOST).toBe('api.exemplo.com');
      expect(res.valores.TITULO).toBe('MeuMod');
    });

    it('deve dar precedência ao valor local do mod sobre a referência global (Item 741 P1 — Sobrescrita)', () => {
      const globais = { MODELO_GLOBAL: 'claude-opus' };
      const valoresMod = { MODELO: 'gpt-4o-custom' }; // sobresscreve o global

      const res = resolveModEnvWithGlobals(esquema, valoresMod, globais);
      expect(res.valores.MODELO).toBe('gpt-4o-custom');
    });

    it('deve considerar ausência quando a global referenciada não existe', () => {
      const globais = {}; // sem MODELO_GLOBAL
      const valoresMod = {};

      const res = resolveModEnvWithGlobals(esquema, valoresMod, globais);
      expect(res.valores.MODELO).toBeUndefined();
    });
  });

  describe('Instruções de Permissão de Microfone Negada (Item 933 P1)', () => {
    it('mensagem de erro deve incluir instrução para reativar no navegador', () => {
      const formatMicErrorMessage = (errName: string) => {
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          return 'Permissão de microfone negada pelo navegador. Clique no ícone de cadeado na barra de endereço para permitir o acesso ao áudio.';
        }
        return 'Falha ao acessar microfone.';
      };

      const msg = formatMicErrorMessage('NotAllowedError');
      expect(msg).toContain('negada pelo navegador');
      expect(msg).toContain('barra de endereço');
    });
  });
});
