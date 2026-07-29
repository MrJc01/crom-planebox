// Registro dinâmico de comandos e geração do /ajuda real — item 1558 P2.
export interface CommandDef {
  name: string;
  description: string;
  usage?: string;
  handler: (args: string[]) => string;
}

export class CommandRegistry {
  private commands = new Map<string, CommandDef>();

  constructor() {
    this.register({
      name: 'ajuda',
      description: 'Lista todos os comandos disponíveis no jogo.',
      usage: '/ajuda',
      handler: () => this.generateHelpMessage(),
    });
  }

  public register(cmd: CommandDef): void {
    this.commands.set(cmd.name.toLowerCase(), cmd);
  }

  public execute(input: string): string {
    const parts = input.trim().replace(/^\//, '').split(/\s+/);
    const name = parts[0]?.toLowerCase();
    if (!name) return 'Comando inválido.';

    const cmd = this.commands.get(name);
    if (!cmd) return `Comando '/${name}' não encontrado. Use '/ajuda' para listar.`;

    return cmd.handler(parts.slice(1));
  }

  public generateHelpMessage(): string {
    const list: string[] = [];
    this.commands.forEach((c) => {
      list.push(`/${c.name} — ${c.description}`);
    });
    return `Comandos Disponíveis:\n` + list.join('\n');
  }

  public listCommands(): CommandDef[] {
    return Array.from(this.commands.values());
  }
}
