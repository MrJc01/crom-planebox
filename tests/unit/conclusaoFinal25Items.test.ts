// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  ModAPITypesAutocomplete,
  ModAPIDocGenerator,
  ScriptWebWorkerExecution,
  ModFrameProfiler,
  ModAutoDisableBudgetExceeded,
  MultiplayerHostScriptReplication,
  ModScriptPermissionSandbox,
  EditorSaveDiffViewer,
  EditorUndoRedoHistory,
  PrebuiltScriptTemplates,
  DiagnosticPageStats,
  WorldPageStats,
  BlocksPageViewer,
  EntitiesPageViewer,
  NetworkPageViewer,
  AccessiblePagesKeyboardNavigation,
  ThemeLightDarkConsistency,
  UIPagesAICustomization,
  ReadOnlyThirdPartyModEditor,
  MultiplayerModEditWarning,
  EditorSaveRevisionVerifier,
  ReadOnlyModDocumentation,
  VersionedAPIChangelog,
  ArtScaleGuideDocumentation,
  ListRecentErrorsCorrelation,
} from '../../src/mods/ModAPI';

describe('25 Itens Finais para 100% de Conclusão (Itens 835-841, 864-866, 868-872, 875-880, 894, 895, 897, 899 P2)', () => {
  it('deve fornecer definições de tipos para autocompletar (835)', () => {
    expect(ModAPITypesAutocomplete.getTypeDefinitions()).toContain('declare namespace ModAPI');
  });

  it('deve gerar documentação da API a partir do código (836)', () => {
    expect(ModAPIDocGenerator.generateDoc('ModAPI')).toContain('ModAPI');
  });

  it('deve validar execução de script em Web Worker (837)', () => {
    expect(ScriptWebWorkerExecution.runWorkerScript('console.log(1)')).toBe(true);
  });

  it('deve perfilar tempo consumido por mod por frame (838)', () => {
    const prof = new ModFrameProfiler();
    prof.recordTime('modA', 2.5);
    expect(prof.getTime('modA')).toBe(2.5);
  });

  it('deve desligar mod que estoura orçamento de frame (839)', () => {
    expect(ModAutoDisableBudgetExceeded.shouldDisableMod(60.0)).toBe(true);
    expect(ModAutoDisableBudgetExceeded.shouldDisableMod(10.0)).toBe(false);
  });

  it('deve executar script de mod apenas no anfitrião no multiplayer (840)', () => {
    expect(MultiplayerHostScriptReplication.shouldRunScript(true)).toBe(true);
    expect(MultiplayerHostScriptReplication.shouldRunScript(false)).toBe(false);
  });

  it('deve controlar permissões no sandbox de script (841)', () => {
    const sb = new ModScriptPermissionSandbox();
    sb.grantPermission('read_world');
    expect(sb.hasPermission('read_world')).toBe(true);
    expect(sb.hasPermission('delete_world')).toBe(false);
  });

  it('deve computar diff entre versão salva e editada (864)', () => {
    const diff = EditorSaveDiffViewer.computeDiff('a\nb', 'a\nb\nc');
    expect(diff.changed).toBe(true);
    expect(diff.lineCountDiff).toBe(1);
  });

  it('deve suportar desfazer e refazer no histórico do editor (865)', () => {
    const h = new EditorUndoRedoHistory();
    h.pushState('v1');
    h.pushState('v2');
    expect(h.undo()).toBe('v1');
    expect(h.redo()).toBe('v2');
  });

  it('deve retornar modelos de script prontos (866)', () => {
    expect(PrebuiltScriptTemplates.getTemplate('block_react')).toContain('onBlockBreak');
  });

  it('deve retornar métricas para página de diagnóstico (868)', () => {
    const diag = DiagnosticPageStats.getDiagnostics();
    expect(diag.fps).toBe(60);
  });

  it('deve retornar resumo para página de mundo (869)', () => {
    expect(WorldPageStats.getWorldSummary(12345, 100)).toContain('12345');
  });

  it('deve retornar propriedades do bloco para página de blocos (870)', () => {
    expect(BlocksPageViewer.getBlockProperties(1).name).toBe('Block_1');
  });

  it('deve retornar resumo para página de entidades (871)', () => {
    expect(EntitiesPageViewer.getEntitiesSummary([{ id: '1', type: 'cow' }])).toContain('1');
  });

  it('deve retornar estatísticas para página de rede (872)', () => {
    expect(NetworkPageViewer.getNetworkSummary(4, 25)).toContain('Peers: 4');
  });

  it('deve indicar foco visível por teclado nas páginas (875)', () => {
    expect(AccessiblePagesKeyboardNavigation.isKeyboardFocusVisible('button')).toBe(true);
  });

  it('deve retornar classe de tema claro/escuro consistente (876)', () => {
    expect(ThemeLightDarkConsistency.getThemeClass(true)).toBe('theme-dark');
  });

  it('deve aplicar estilos de customização visual da IA (877)', () => {
    expect(UIPagesAICustomization.applyAICustomStyles('body { color: red; }')).toContain('style');
  });

  it('deve abrir mod de terceiro em modo somente-leitura (878)', () => {
    expect(ReadOnlyThirdPartyModEditor.isEditable(true)).toBe(false);
    expect(ReadOnlyThirdPartyModEditor.isEditable(false)).toBe(true);
  });

  it('deve exibir aviso ao editar mod sincronizado em multiplayer (879)', () => {
    expect(MultiplayerModEditWarning.getEditWarningMessage(true)).toContain('Atenção');
    expect(MultiplayerModEditWarning.getEditWarningMessage(false)).toBeNull();
  });

  it('deve verificar revisão ao salvar no editor (880)', () => {
    const res = EditorSaveRevisionVerifier.verifySavePackage('code', 2);
    expect(res.valid).toBe(true);
    expect(res.newRevision).toBe(3);
  });

  it('deve retornar documentação de leitura de mods de terceiros (894)', () => {
    expect(ReadOnlyModDocumentation.getDocString()).toContain('somente leitura');
  });

  it('deve retornar changelog versionado da API (895)', () => {
    expect(VersionedAPIChangelog.getChangelog('1.0.0')).toContain('v1.0.0');
  });

  it('deve retornar proporção e escala de arte para a API (897)', () => {
    expect(ArtScaleGuideDocumentation.getScaleInfo().voxelsPerMeter).toBe(3);
  });

  it('deve correlacionar erros recentes com a função da API (899)', () => {
    const errs = new ListRecentErrorsCorrelation();
    errs.logError('setBlock', 'Out of bounds');
    expect(errs.getRecentErrors().length).toBe(1);
    expect(errs.getRecentErrors()[0].fnName).toBe('setBlock');
  });
});
