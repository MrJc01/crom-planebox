export interface MCPToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export const MCP_TOOLS: MCPToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'set_block',
      description: 'Coloca ou altera um único bloco no mundo 3D em uma posição (x, y, z).',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'Coordenada X em blocos' },
          y: { type: 'number', description: 'Coordenada Y em blocos' },
          z: { type: 'number', description: 'Coordenada Z em blocos' },
          block_type: {
            type: 'string',
            description: 'Nome do bloco: GRASS, DIRT, STONE, COBBLESTONE, WOOD, LEAVES, BRICK, GLASS, LAVA, WATER, SAND, GLOWSTONE, IRON_BLOCK, GOLD_BLOCK, DIAMOND_BLOCK, DARK_STONE, AIR'
          }
        },
        required: ['x', 'y', 'z', 'block_type']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'fill_box',
      description: 'Preenche um volume retangular 3D entre (x1, y1, z1) e (x2, y2, z2). OBRIGATÓRIO PARA CASAS E SALAS: Use "hollow: true" para que a construção fique OCA por dentro, criando paredes externas, telhado e espaço habitável interno, em vez de um cubo maciço de pedra!',
      parameters: {
        type: 'object',
        properties: {
          x1: { type: 'number' },
          y1: { type: 'number' },
          z1: { type: 'number' },
          x2: { type: 'number' },
          y2: { type: 'number' },
          z2: { type: 'number' },
          block_type: { type: 'string', description: 'Material: GRASS, STONE, WOOD, PLANK, STONE_BRICK, LEAVES, SAND, WATER, AIR' },
          hollow: { type: 'boolean', description: 'Se true, cria uma estrutura OCA por dentro (paredes externas), ideal para casas e salas.' }
        },
        required: ['x1', 'y1', 'z1', 'x2', 'y2', 'z2', 'block_type']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'capture_snapshot',
      description: 'Posiciona uma câmera virtual nas coordenadas (x, y, z) apontando para (targetX, targetY, targetZ), tira uma foto (screenshot) do mundo e retorna para a IA analisar visualmente a construção.',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'Posição X da câmera' },
          y: { type: 'number', description: 'Posição Y da câmera' },
          z: { type: 'number', description: 'Posição Z da câmera' },
          targetX: { type: 'number', description: 'Ponto X para onde a câmera aponta' },
          targetY: { type: 'number', description: 'Ponto Y para onde a câmera aponta' },
          targetZ: { type: 'number', description: 'Ponto Z para onde a câmera aponta' }
        },
        required: ['x', 'y', 'z', 'targetX', 'targetY', 'targetZ']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'reset_world',
      description: 'Limpa todas as construções e alterações do mundo atual, retornando ao estado superflat inicial.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'reconfigure_chunk',
      description: 'Altera os parâmetros de geração procedural do mundo em chunks.',
      parameters: {
        type: 'object',
        properties: {
          ground_height: { type: 'number', description: 'Nova altura base do solo' },
          surface_block: { type: 'string', description: 'Novo bloco da superfície' },
          sub_surface_block: { type: 'string', description: 'Novo bloco do subsolo' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_chat_and_code',
      description: 'Pesquisa no histórico de chat do mundo atual e obtém informações de contexto sobre o projeto.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Termo de busca' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'reconfigure_player',
      description: 'Altera os parâmetros de movimentação e física do jogador (velocidade, voo criativo, intangibilidade/noclip, pulo e gravidade).',
      parameters: {
        type: 'object',
        properties: {
          walk_speed: { type: 'number', description: 'Velocidade de caminhada (m/s)' },
          fly_speed: { type: 'number', description: 'Velocidade de voo no modo criativo (m/s)' },
          is_tangible: { type: 'boolean', description: 'Se false, o jogador fica intangível/noclip e atravessa superfícies' },
          is_flying: { type: 'boolean', description: 'Se true, o jogador voa livremente' },
          jump_force: { type: 'number', description: 'Força do pulo' },
          gravity: { type: 'number', description: 'Gravidade' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'query_world_area',
      description: 'Analisa o terreno, a altitude média, o bioma predominante e a distribuição de blocos em um raio ao redor das coordenadas (x, z).',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'Coordenada X central da análise' },
          z: { type: 'number', description: 'Coordenada Z central da análise' },
          radius: { type: 'number', description: 'Raio de busca em blocos (padrão 16)' }
        },
        required: ['x', 'z']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_world_summary',
      description: 'Retorna um resumo global do mundo ativo (total de modificações salvas, semente do mundo, contagem de threads e estado da engine).',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'reset_chunk_area',
      description: 'Reseta e limpa todas as modificações de blocos em uma região retangular delimitada de (x1, z1) a (x2, z2), restaurando o terreno procedural zerado original.',
      parameters: {
        type: 'object',
        properties: {
          x1: { type: 'number', description: 'Coordenada X1 do limite' },
          z1: { type: 'number', description: 'Coordenada Z1 do limite' },
          x2: { type: 'number', description: 'Coordenada X2 do limite' },
          z2: { type: 'number', description: 'Coordenada Z2 do limite' }
        },
        required: ['x1', 'z1', 'x2', 'z2']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'execute_voxel_script',
      description: 'EXECUÇÃO DE CÓDIGO DIRETA: Permite à IA escrever e executar um script em JavaScript para gerar algoritmicamente QUALQUER construção, casa tecnológica, castelo, escultura, anatomia de animal/ser 3D (via createEntity) ou terreno 3D do zero em tempo real usando laços, matemática e funções espaciais.',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Código JavaScript executável. Funções disponíveis no escopo: setBlock(x, y, z, blockType), fillBox(x1, y1, z1, x2, y2, z2, blockType, hollow), getBlock(x, y, z), getGroundY(x, z), createEntity({name, x, y, z, parts: [{offsetX, offsetY, offsetZ, sizeX, sizeY, sizeZ, color}]}), B (enum de blocos: B.GRASS, B.DIRT, B.STONE, B.WOOD, B.PLANK, B.STONE_BRICK, B.LEAVES, B.WATER, B.SAND, B.GLASS, B.IRON_BLOCK, B.GOLD_BLOCK, B.DIAMOND_BLOCK, B.GLOWSTONE, B.OBSIDIAN, B.BRICK, B.DARK_STONE, B.AIR), Math'
          }
        },
        required: ['code']
      }
    }
  }
];
