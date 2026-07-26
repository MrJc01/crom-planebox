// Migração versionada de save (itens 276-278 do checklist).
//
// O schema do IndexedDB foi de v2 a v6 em poucos dias — mods, perfil de personagem, revisões.
// O Dexie cuida da estrutura das tabelas, mas **não** dos dados dentro delas: um mundo criado
// antes do sistema de mods não tem `revision` nos pacotes, não tem `timeOfDay`, e mods antigos
// não sabem a qual sessão pertencem. Sem um passo explícito, cada mudança de formato deixa
// mundos antigos em estado inconsistente, e o sintoma aparece longe da causa.
//
// Regras que orientam este arquivo:
//
//  1. **Idempotente.** Rodar duas vezes não pode mudar o resultado — a migração roda a cada
//     carregamento, e um mundo já migrado precisa passar incólume.
//  2. **Só preenche o que falta.** Nunca sobrescreve valor existente; a ausência é o gatilho.
//  3. **Falha de um mundo não contamina outro.** Cada etapa é protegida.
//
// A versão fica em `WorldRecord.saveVersion`. Mundos sem o campo são tratados como versão 1.

import { CURRENT_SAVE_VERSION, WorldRecord, db } from './Database';
import { ModPackage } from '../mods/ModTypes';

/** Versão para a qual este arquivo sabe migrar. Incremente ao adicionar um passo. */
export const TARGET_SAVE_VERSION = 4;

export interface MigrationReport {
  worldId: string;
  from: number;
  to: number;
  steps: string[];
  /** Passos que falharam. O mundo ainda abre; o problema é relatado em vez de silenciado. */
  failures: string[];
}

/** Um passo de migração leva o save da versão `from` para `from + 1`. */
interface MigrationStep {
  from: number;
  description: string;
  run(worldId: string, world: WorldRecord): Promise<string | null>;
}

const STEPS: MigrationStep[] = [
  {
    from: 1,
    description: 'hora do mundo e modo de jogo padrão',
    async run(_worldId, world) {
      const mudou: string[] = [];
      // Mundos anteriores ao ciclo dia/noite não têm hora: nasciam sempre às 8h por acidente
      // do valor padrão em memória, e a hora nunca era gravada.
      if (typeof world.timeOfDay !== 'number') {
        world.timeOfDay = 0.35;
        mudou.push('timeOfDay');
      }
      if (!world.defaultGameMode) {
        world.defaultGameMode = 'classic';
        mudou.push('defaultGameMode');
      }
      return mudou.length > 0 ? `preenchido: ${mudou.join(', ')}` : null;
    },
  },
  {
    from: 2,
    description: 'revisão e proveniência dos mods',
    async run(worldId) {
      const registros = await db.mods.where('worldId').equals(worldId).toArray();
      let ajustados = 0;

      for (const registro of registros) {
        const pkg = registro.pkg as ModPackage;
        let mudou = false;

        // Sem `revision`, `snapshot()` gravaria sempre a revisão `undefined` e o rollback
        // não teria para onde voltar.
        if (typeof pkg.revision !== 'number') {
          pkg.revision = 1;
          mudou = true;
        }
        // Campos de quarentena passam a existir explicitamente, para a checagem
        // `!mod.quarantined` não depender de `undefined`.
        if (pkg.quarantined === undefined) {
          pkg.quarantined = false;
          mudou = true;
        }
        if (!Array.isArray(pkg.blocks)) { pkg.blocks = []; mudou = true; }
        if (!Array.isArray(pkg.entities)) { pkg.entities = []; mudou = true; }
        if (!Array.isArray(pkg.structures)) { pkg.structures = []; mudou = true; }

        if (mudou) {
          await db.mods.put({ ...registro, pkg, updatedAt: Date.now() });
          ajustados++;
        }
      }

      return ajustados > 0 ? `${ajustados} mod(s) normalizados` : null;
    },
  },
  {
    from: 3,
    description: 'vínculo entre sessões de chat e mods',
    async run(worldId) {
      // Mods criados antes do modelo de sessões guardavam `threadId` no próprio pacote.
      // O vínculo autoritativo passou para `ChatThreadRecord.modId`; este passo transfere.
      const registros = await db.mods.where('worldId').equals(worldId).toArray();
      let vinculados = 0;

      for (const registro of registros) {
        const pkg = registro.pkg as ModPackage & { threadId?: string };
        const antigo = pkg.threadId;
        if (!antigo) continue;

        const thread = await db.chatThreads.get(antigo);
        if (thread && !thread.modId) {
          thread.modId = pkg.id;
          await db.chatThreads.put(thread);
          vinculados++;
        }

        // Preserva a proveniência no campo novo e remove o antigo.
        if (!pkg.originThreadId) pkg.originThreadId = antigo;
        delete pkg.threadId;
        await db.mods.put({ ...registro, pkg, updatedAt: Date.now() });
      }

      return vinculados > 0 ? `${vinculados} sessão(ões) revinculadas` : null;
    },
  },
];

/**
 * Migra um mundo até `TARGET_SAVE_VERSION`. Seguro para chamar sempre: um mundo já atualizado
 * sai imediatamente sem tocar em nada.
 */
export async function migrateWorld(worldId: string): Promise<MigrationReport | null> {
  const world = await db.worlds.get(worldId);
  if (!world) return null;

  const inicial = world.saveVersion ?? 1;
  if (inicial >= TARGET_SAVE_VERSION) return null;

  const report: MigrationReport = { worldId, from: inicial, to: inicial, steps: [], failures: [] };

  for (const step of STEPS) {
    if (step.from < report.to) continue;
    if (step.from >= TARGET_SAVE_VERSION) break;

    try {
      const resultado = await step.run(worldId, world);
      report.steps.push(`v${step.from}→v${step.from + 1}: ${step.description}${resultado ? ` (${resultado})` : ' (nada a fazer)'}`);
      report.to = step.from + 1;
    } catch (err: any) {
      // Um passo que falha interrompe a subida de versão, mas não impede o mundo de abrir.
      // Parar aqui é proposital: aplicar o passo seguinte sobre um estado meio migrado é
      // como uma corrupção difícil de diagnosticar nasce.
      report.failures.push(`v${step.from}: ${err?.message || String(err)}`);
      break;
    }
  }

  world.saveVersion = report.to;
  world.updatedAt = Date.now();
  await db.worlds.put(world);

  console.log(
    `[SaveMigration] Mundo "${worldId}" migrado de v${report.from} para v${report.to}:\n  ` +
      report.steps.join('\n  ') +
      (report.failures.length > 0 ? `\n  falhas: ${report.failures.join('; ')}` : ''),
  );
  return report;
}

/**
 * Cópia de segurança do mundo antes de migrar, gravada no `localStorage`.
 *
 * Guarda só o registro do mundo e os mods — o volume de blocos é grande demais e é o dado que
 * as migrações não tocam. O objetivo é poder restaurar a configuração se um passo estragá-la.
 */
export async function backupBeforeMigration(worldId: string): Promise<boolean> {
  try {
    const world = await db.worlds.get(worldId);
    if (!world) return false;
    const mods = await db.mods.where('worldId').equals(worldId).toArray();

    const payload = JSON.stringify({
      savedAt: Date.now(),
      version: world.saveVersion ?? 1,
      world,
      mods: mods.map((m) => m.pkg),
    });

    // Backup grande não vale o risco de estourar a cota e derrubar o carregamento.
    if (payload.length > 2_000_000) {
      console.warn(`[SaveMigration] Backup de "${worldId}" grande demais (${payload.length} bytes) — pulado.`);
      return false;
    }

    localStorage.setItem(`crom:backup:${worldId}`, payload);
    return true;
  } catch (err) {
    console.warn('[SaveMigration] Não foi possível gravar o backup:', err);
    return false;
  }
}

/** Migra com backup. É o ponto de entrada usado ao carregar um mundo. */
export async function prepareWorld(worldId: string): Promise<MigrationReport | null> {
  const world = await db.worlds.get(worldId);
  if (!world) return null;
  if ((world.saveVersion ?? 1) >= TARGET_SAVE_VERSION) return null;

  await backupBeforeMigration(worldId);
  return await migrateWorld(worldId);
}

/** Mundos que ainda não estão na versão atual. Útil para diagnóstico e para a UI avisar. */
export async function findOutdatedWorlds(): Promise<{ id: string; name: string; version: number }[]> {
  const worlds = await db.worlds.toArray();
  return worlds
    .filter((w) => (w.saveVersion ?? 1) < TARGET_SAVE_VERSION)
    .map((w) => ({ id: w.id, name: w.name, version: w.saveVersion ?? 1 }));
}

export { CURRENT_SAVE_VERSION };
