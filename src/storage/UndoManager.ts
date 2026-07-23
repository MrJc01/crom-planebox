import { World } from '../world/world';

export interface BlockChange {
  x: number;
  y: number;
  z: number;
  oldBlock: number;
  newBlock: number;
}

export class UndoManager {
  private undoStack: BlockChange[][] = [];
  private redoStack: BlockChange[][] = [];
  private maxHistory = 50;
  public onToast: (msg: string) => void = () => {};

  constructor(private world: World) {}

  public recordBatch(changes: BlockChange[]): void {
    if (!changes || changes.length === 0) return;
    this.undoStack.push(changes);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Limpa histórico de refazer ao realizar nova ação
  }

  public undo(): boolean {
    const batch = this.undoStack.pop();
    if (!batch || batch.length === 0) {
      this.onToast('⚠️ Nada para desfazer (Ctrl+Z)');
      return false;
    }

    const redoBatch: BlockChange[] = [];
    for (let i = batch.length - 1; i >= 0; i--) {
      const c = batch[i];
      const current = this.world.getBlock(c.x, c.y, c.z);
      redoBatch.push({ x: c.x, y: c.y, z: c.z, oldBlock: current, newBlock: c.oldBlock });
      this.world.setBlock(c.x, c.y, c.z, c.oldBlock);
    }

    this.redoStack.push(redoBatch);
    this.onToast(`↺ Desfeito lote de ${batch.length} blocos! (Ctrl+Z)`);
    console.log(`↺ [UndoManager] Desfeito lote de ${batch.length} blocos!`);
    return true;
  }

  public redo(): boolean {
    const batch = this.redoStack.pop();
    if (!batch || batch.length === 0) {
      this.onToast('⚠️ Nada para refazer (Ctrl+Y)');
      return false;
    }

    const undoBatch: BlockChange[] = [];
    for (let i = batch.length - 1; i >= 0; i--) {
      const c = batch[i];
      const current = this.world.getBlock(c.x, c.y, c.z);
      undoBatch.push({ x: c.x, y: c.y, z: c.z, oldBlock: current, newBlock: c.newBlock });
      this.world.setBlock(c.x, c.y, c.z, c.newBlock);
    }

    this.undoStack.push(undoBatch);
    this.onToast(`↻ Refeito lote de ${batch.length} blocos! (Ctrl+Y)`);
    console.log(`↻ [UndoManager] Refeito lote de ${batch.length} blocos!`);
    return true;
  }
}
