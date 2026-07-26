import { describe, it, expect } from 'vitest';
import { BiomeId } from '../../src/world/biomes';
import {
  CELULA,
  DENSIDADE,
  REGRAS,
  RegraDeEspalhamento,
  SondaDeTerreno,
  espacamentoMinimo,
  estruturaNaCelula,
  estruturasNaRegiao,
} from '../../src/world/scatter';
import { WATER_LEVEL } from '../../src/world/worldgen';
import { getStructureTemplate } from '../../src/crafting/StructureTemplates';

/** Terreno plano e uniforme: isola o espalhamento de qualquer efeito de relevo. */
function planicie(bioma: BiomeId = 'planicie', altura = WATER_LEVEL + 30): SondaDeTerreno {
  return {
    altura: () => altura,
    bioma: () => bioma,
    rio: () => 0,
    estrada: () => 0,
  };
}

const SEMENTE = 987654;

describe('as regras são coerentes com os templates', () => {
  it('CRÍTICO: toda regra aponta para um template que existe', () => {
    // Uma regra órfã produziria um sítio que o worldgen não sabe carimbar — e o sintoma seria
    // "às vezes não nasce nada", sem erro nenhum.
    for (const r of REGRAS) {
      expect(getStructureTemplate(r.template), `template "${r.template}"`).toBeDefined();
    }
  });

  it('CRÍTICO: a célula é maior que qualquer pegada — é o que garante o espaçamento', () => {
    // Com um vencedor por célula e a pegada cabendo dentro dela, duas estruturas nunca colidem.
    // Se a pegada vazasse, o espaçamento deixaria de ser garantia e viraria sorte.
    for (const r of REGRAS) {
      expect(CELULA, r.template).toBeGreaterThan(r.pegada * 4);
    }
    expect(espacamentoMinimo()).toBeGreaterThan(0);
  });

  it('toda regra tem bioma, raridade sã e pegada positiva', () => {
    for (const r of REGRAS) {
      expect(r.biomas.length, r.template).toBeGreaterThan(0);
      expect(r.peso).toBeGreaterThan(0);
      expect(r.pegada).toBeGreaterThan(0);
      expect(r.desnivelMax).toBeGreaterThanOrEqual(0);
    }
    expect(DENSIDADE).toBeGreaterThan(0);
    expect(DENSIDADE).toBeLessThanOrEqual(1);
  });

  it('a pegada da regra cobre o template que ela coloca', () => {
    // Pegada menor que a construção mediria o desnível de uma área menor que a que vai ser
    // ocupada, e a construção assentaria numa parte do terreno que ninguém verificou.
    for (const r of REGRAS) {
      const t = getStructureTemplate(r.template)!;
      const maxDx = Math.max(...t.blocks.map((b) => Math.abs(b.dx)));
      const maxDz = Math.max(...t.blocks.map((b) => Math.abs(b.dz)));
      expect(r.pegada, `${r.template}: pegada`).toBeGreaterThanOrEqual(Math.max(maxDx, maxDz) - 1);
    }
  });
});

describe('determinismo', () => {
  it('CRÍTICO: mesma semente e mesma célula dão sempre o mesmo sítio', () => {
    const t = planicie();
    for (let gx = -5; gx < 5; gx++) {
      for (let gz = -5; gz < 5; gz++) {
        const a = estruturaNaCelula(SEMENTE, gx, gz, t);
        const b = estruturaNaCelula(SEMENTE, gx, gz, t);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      }
    }
  });

  it('sementes diferentes espalham diferente', () => {
    const t = planicie();
    const um = estruturasNaRegiao(1, 0, 0, 4000, 4000, t).map((s) => `${s.x},${s.z}`).join();
    const dois = estruturasNaRegiao(2, 0, 0, 4000, 4000, t).map((s) => `${s.x},${s.z}`).join();
    expect(um).not.toBe(dois);
  });

  it('células negativas funcionam — o mundo não começa na origem', () => {
    const t = planicie();
    const s = estruturasNaRegiao(SEMENTE, -8000, -8000, -4000, -4000, t);
    for (const e of s) {
      expect(Number.isFinite(e.x)).toBe(true);
      expect(Number.isFinite(e.z)).toBe(true);
    }
  });
});

describe('uma por célula, e a pegada não vaza', () => {
  it('CRÍTICO: a pegada inteira fica dentro da célula', () => {
    for (const regra of REGRAS) {
      const terreno = planicie(regra.biomas[0]);
      for (let gx = 0; gx < 40; gx++) {
        for (let gz = 0; gz < 40; gz++) {
          const s = estruturaNaCelula(SEMENTE, gx, gz, terreno);
          if (!s) continue;
          expect(s.x - s.pegada).toBeGreaterThanOrEqual(gx * CELULA);
          expect(s.x + s.pegada).toBeLessThanOrEqual((gx + 1) * CELULA);
          expect(s.z - s.pegada).toBeGreaterThanOrEqual(gz * CELULA);
          expect(s.z + s.pegada).toBeLessThanOrEqual((gz + 1) * CELULA);
        }
      }
    }
  });

  it('CRÍTICO: no máximo uma estrutura por célula, seja qual for a regra', () => {
    // É esta a garantia que a primeira versão do módulo NÃO tinha: uma grade por regra dava
    // espaçamento dentro de cada uma e nenhum entre elas.
    const terreno = planicie('savana'); // aceito por duas regras diferentes
    const sitios = estruturasNaRegiao(SEMENTE, 0, 0, CELULA * 20, CELULA * 20, terreno);
    const celulas = new Set(sitios.map((s) => `${Math.floor(s.x / CELULA)},${Math.floor(s.z / CELULA)}`));
    expect(celulas.size).toBe(sitios.length);
  });

  it('CRÍTICO: duas estruturas nunca ocupam o mesmo espaço', () => {
    const terreno = planicie('savana'); // bioma aceito por duas regras diferentes
    const sitios = estruturasNaRegiao(SEMENTE, 0, 0, 6000, 6000, terreno);
    expect(sitios.length).toBeGreaterThan(3); // senão o teste não prova nada
    for (let i = 0; i < sitios.length; i++) {
      for (let j = i + 1; j < sitios.length; j++) {
        const a = sitios[i], b = sitios[j];
        const separados =
          Math.abs(a.x - b.x) > a.pegada + b.pegada ||
          Math.abs(a.z - b.z) > a.pegada + b.pegada;
        expect(separados, `${a.template}@${a.x},${a.z} colide com ${b.template}@${b.x},${b.z}`).toBe(true);
      }
    }
  });

  it('num bioma com duas regras válidas, as duas aparecem ao longo do mundo', () => {
    // A disputa por peso precisa de fato sortear as duas; se uma nunca ganhasse, o peso seria
    // decoração e o bioma teria só um tipo de construção.
    const terreno = planicie('savana');
    const vistos = new Set(
      estruturasNaRegiao(SEMENTE, 0, 0, CELULA * 60, CELULA * 60, terreno).map((s) => s.template),
    );
    expect(vistos.size).toBeGreaterThan(1);
  });
});

describe('o bioma manda', () => {
  it('CRÍTICO: nada nasce em bioma fora da regra', () => {
    for (const regra of REGRAS) {
      const proibidos: BiomeId[] = (['oceano', 'praia', 'selva', 'pantano'] as BiomeId[])
        .filter((b) => !regra.biomas.includes(b));
      for (const bioma of proibidos) {
        const terreno = planicie(bioma);
        for (let gx = 0; gx < 30; gx++) {
          for (let gz = 0; gz < 30; gz++) {
            const s = estruturaNaCelula(SEMENTE, gx, gz, terreno, [regra]);
            expect(s, `${regra.template} em ${bioma}`).toBeNull();
          }
        }
      }
    }
  });

  it('a torre é do alto e do frio; a casa, do temperado', () => {
    const torre = REGRAS.find((r) => r.template === 'tower')!;
    const casa = REGRAS.find((r) => r.template === 'small_house')!;
    expect(torre.biomas).toContain('montanha');
    expect(casa.biomas).not.toContain('montanha');
    expect(casa.biomas).toContain('planicie');
  });

  it('regra sem bioma nenhum é regra desligada', () => {
    const desligada: RegraDeEspalhamento = { ...REGRAS[0], biomas: [] };
    for (let gx = 0; gx < 20; gx++) {
      expect(estruturaNaCelula(SEMENTE, gx, 0, planicie(), [desligada])).toBeNull();
    }
  });
});

describe('o terreno reprova sítios ruins', () => {
  const regra = REGRAS[0];

  it('CRÍTICO: encosta é rejeitada — construção em ladeira flutua ou afunda', () => {
    const encosta: SondaDeTerreno = {
      altura: (x) => WATER_LEVEL + 30 + x * 2, // sobe 2 voxels por voxel andado
      bioma: () => 'planicie',
      rio: () => 0,
      estrada: () => 0,
    };
    for (let gx = 0; gx < 40; gx++) {
      for (let gz = 0; gz < 40; gz++) {
        expect(estruturaNaCelula(SEMENTE, gx, gz, encosta, [regra])).toBeNull();
      }
    }
  });

  it('desnível dentro da tolerância é aceito', () => {
    let aceitos = 0;
    const suave: SondaDeTerreno = {
      altura: (x, z) => WATER_LEVEL + 30 + ((x + z) % 2), // 1 voxel de variação
      bioma: () => 'planicie',
      rio: () => 0,
      estrada: () => 0,
    };
    for (let gx = 0; gx < 40; gx++) {
      for (let gz = 0; gz < 40; gz++) {
        if (estruturaNaCelula(SEMENTE, gx, gz, suave, [regra])) aceitos++;
      }
    }
    expect(aceitos).toBeGreaterThan(0);
  });

  it('CRÍTICO: nada nasce dentro do leito do rio nem em cima da estrada', () => {
    const comRio: SondaDeTerreno = { ...planicie(), rio: () => 1 };
    const comEstrada: SondaDeTerreno = { ...planicie(), estrada: () => 1 };
    for (let gx = 0; gx < 30; gx++) {
      for (let gz = 0; gz < 30; gz++) {
        expect(estruturaNaCelula(SEMENTE, gx, gz, comRio, [regra])).toBeNull();
        expect(estruturaNaCelula(SEMENTE, gx, gz, comEstrada, [regra])).toBeNull();
      }
    }
  });

  it('CRÍTICO: nada nasce com o pé na água', () => {
    const raso = planicie('planicie', WATER_LEVEL + 1);
    for (let gx = 0; gx < 30; gx++) {
      for (let gz = 0; gz < 30; gz++) {
        expect(estruturaNaCelula(SEMENTE, gx, gz, raso, [regra])).toBeNull();
      }
    }
  });

  it('assenta no ponto mais BAIXO da pegada — o vão vira fundação, não pernas de ar', () => {
    const desnivel: SondaDeTerreno = {
      altura: (x) => WATER_LEVEL + 30 + (x % 3 === 0 ? 0 : 1),
      bioma: () => 'planicie',
      rio: () => 0,
      estrada: () => 0,
    };
    for (let gx = 0; gx < 60; gx++) {
      const s = estruturaNaCelula(SEMENTE, gx, 0, desnivel, [regra]);
      if (!s) continue;
      const p = s.pegada;
      const alturas = [
        desnivel.altura(s.x, s.z),
        desnivel.altura(s.x - p, s.z - p), desnivel.altura(s.x + p, s.z - p),
        desnivel.altura(s.x - p, s.z + p), desnivel.altura(s.x + p, s.z + p),
      ];
      expect(s.y).toBe(Math.min(...alturas));
      return;
    }
    throw new Error('nenhum sítio aceito — o teste não provou nada');
  });
});

describe('estruturasNaRegiao — a varredura', () => {
  it('encontra as mesmas estruturas independentemente de como a região é fatiada', () => {
    // É o que garante que uma estrutura na fronteira de dois chunks apareça inteira, em vez de
    // metade em cada — ou de nenhuma metade.
    const terreno = planicie();
    const inteira = estruturasNaRegiao(SEMENTE, 0, 0, 2000, 2000, terreno);
    const fatias = [
      ...estruturasNaRegiao(SEMENTE, 0, 0, 1000, 2000, terreno),
      ...estruturasNaRegiao(SEMENTE, 1000, 0, 2000, 2000, terreno),
    ];
    const chave = (s: { x: number; z: number; template: string }): string => `${s.template}@${s.x},${s.z}`;
    for (const s of inteira) {
      expect(fatias.map(chave)).toContain(chave(s));
    }
  });

  it('a raridade se traduz numa densidade plausível', () => {
    // Uma estrutura a cada dois minutos deixa de ser achado e vira mobília.
    const terreno = planicie();
    const lado = CELULA * 30;
    const achados = estruturasNaRegiao(SEMENTE, 0, 0, lado, lado, terreno);
    const celulas = 31 * 31;
    const taxa = achados.length / celulas;
    expect(taxa).toBeGreaterThan(DENSIDADE * 0.6);
    expect(taxa).toBeLessThan(DENSIDADE * 1.4);
  });

  it('região vazia devolve lista vazia, não erro', () => {
    expect(estruturasNaRegiao(SEMENTE, 0, 0, 0, 0, planicie('oceano'))).toEqual([]);
  });
});
