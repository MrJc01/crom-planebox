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
            description: 'Nome do bloco: GRASS, DIRT, STONE, COBBLE, WOOD (ou LOG), PLANK, LEAVES, BRICK, STONE_BRICK, GLASS, LAVA, WATER, SAND, GRAVEL, PATH, SNOW, GLOWSTONE, IRON_BLOCK, GOLD_BLOCK, DIAMOND_BLOCK, OBSIDIAN, DARK_STONE, AIR'
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
          block_type: { type: 'string', description: 'Material: GRASS, STONE, COBBLE, WOOD (ou LOG), PLANK, STONE_BRICK, LEAVES, GLASS, SAND, GRAVEL, WATER, LAVA, GLOWSTONE, OBSIDIAN, DARK_STONE, AIR' },
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
      name: 'spawn_entity',
      description: 'Gera um NPC/criatura decorativa pré-formatada (humano, orc, goblin, animal, herói) em uma posição do mundo. Para anatomias customizadas do zero, prefira execute_voxel_script com createEntity(...).',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Tipo da entidade: human, orc, goblin, animal, hero' },
          name: { type: 'string', description: 'Nome exibido acima da entidade' },
          x: { type: 'number' },
          z: { type: 'number' },
          faction: { type: 'string', description: 'Facção/reino da entidade' },
          role: { type: 'string', description: 'Papel/profissão da entidade' }
        },
        required: ['x', 'z']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_entities',
      description: 'Lista todas as entidades/NPCs atualmente ativas no mundo, com posição, vida, facção e papel. Use antes de mover ou possuir uma entidade.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'control_entity',
      description: 'Envia uma entidade existente para caminhar até (targetX, targetZ), opcionalmente trocando seu papel/role.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ID da entidade retornado por list_entities/spawn_entity' },
          targetX: { type: 'number' },
          targetZ: { type: 'number' },
          newRole: { type: 'string' }
        },
        required: ['id', 'targetX', 'targetZ']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'possess_entity',
      description: 'Caminho alternativo a spawn_entity: em vez de criar um NPC decorativo, TRANSFORMA o próprio jogador nessa entidade — teleporta o jogador até a posição dela e remove o NPC. Use quando o pedido for "vire-se em X" / "eu quero ser X", em vez de "crie um X".',
      parameters: {
        type: 'object',
        properties: {
          entity_id: { type: 'string', description: 'ID de uma entidade já existente (de list_entities/spawn_entity/createEntity)' }
        },
        required: ['entity_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'trigger_world_event',
      description: 'Desencadeia um evento de mundo em larga escala (vulcão, raio, terremoto, bênção divina, meteoro) centrado em (x, z).',
      parameters: {
        type: 'object',
        properties: {
          event_type: { type: 'string', description: 'volcano, lightning, earthquake, blessing ou meteor' },
          x: { type: 'number' },
          z: { type: 'number' }
        },
        required: ['event_type', 'x', 'z']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'capture_multi_angle',
      description: 'Tira automaticamente 4 fotos (frente, direita, trás, esquerda) ao redor de um ponto central para validar visualmente uma construção de uma vez só, em vez de chamar capture_snapshot repetidamente de ângulos diferentes.',
      parameters: {
        type: 'object',
        properties: {
          targetX: { type: 'number' },
          targetY: { type: 'number' },
          targetZ: { type: 'number' },
          distance: { type: 'number', description: 'Distância horizontal da câmera até o alvo (padrão 18)' },
          height: { type: 'number', description: 'Altura da câmera acima do alvo (padrão 12)' }
        },
        required: ['targetX', 'targetY', 'targetZ']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_recent_errors',
      description: 'Retorna os últimos erros ocorridos durante execuções de execute_voxel_script nesta sessão, para autocorreção sem depender do usuário colar o erro manualmente.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'stamp_structure',
      description: 'Carimba uma estrutura pronta inteira (árvore, casa pequena, torre ou muro) de uma vez no mundo, na base (x, y, z) indicada — mais rápido e confiável do que reconstruir bloco a bloco via execute_voxel_script para esses casos comuns.',
      parameters: {
        type: 'object',
        properties: {
          template_id: { type: 'string', description: "Um de: 'tree' (árvore), 'small_house' (casa pequena), 'tower' (torre), 'wall' (muro)" },
          x: { type: 'number', description: 'Coordenada X da base da estrutura' },
          y: { type: 'number', description: 'Coordenada Y da base (normalmente o nível do chão)' },
          z: { type: 'number', description: 'Coordenada Z da base da estrutura' },
        },
        required: ['template_id', 'x', 'y', 'z'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'modify_ui_style',
      description: 'Modifica agenticamente o CSS de elementos existentes do frontend/HUD (nunca backend — só o DOM do navegador). Use para reestilizar HUD, cores, tamanhos, etc.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'Seletor CSS dos elementos a modificar (ex.: "#hud-hotbar", ".chat-bubble")' },
          css_properties: { type: 'object', description: 'Mapa de propriedades CSS em camelCase e seus valores (ex.: {"background": "red", "borderRadius": "20px"})' },
        },
        required: ['selector', 'css_properties'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'move_hud_element',
      description: 'Reposiciona um elemento do HUD (hotbar, chat, etc.) para coordenadas absolutas de tela (x, y em pixels).',
      parameters: {
        type: 'object',
        properties: {
          element_id: { type: 'string', description: 'ID do elemento HTML (ex.: "hud-hotbar", "chat-overlay")' },
          x: { type: 'number' },
          y: { type: 'number' },
        },
        required: ['element_id', 'x', 'y'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_custom_panel',
      description: 'Cria um painel HTML/CSS totalmente novo sobre a interface (ex.: um placar, um minimapa simples), inteiramente no frontend do navegador.',
      parameters: {
        type: 'object',
        properties: {
          html: { type: 'string', description: 'Conteúdo HTML do painel (scripts e handlers inline são removidos por segurança)' },
          css: { type: 'string', description: 'CSS aplicado ao painel' },
          position: { type: 'string', description: 'top-left, top-right, bottom-left, bottom-right ou center' },
        },
        required: ['html'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reset_ui_customizations',
      description: 'Remove todas as customizações de UI feitas pela IA neste mundo e volta o layout ao padrão original.',
      parameters: { type: 'object', properties: {} },
    },
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
            description: 'Código JavaScript executável. Funções disponíveis no escopo: setBlock(x, y, z, blockType), fillBox(x1, y1, z1, x2, y2, z2, blockType, hollow), getBlock(x, y, z), getGroundY(x, z), createEntity({name, x, y, z, parts: [{offsetX, offsetY, offsetZ, sizeX, sizeY, sizeZ, color}]}), B (enum de blocos: B.GRASS, B.DIRT, B.STONE, B.WOOD/B.LOG, B.PLANK, B.STONE_BRICK, B.LEAVES, B.WATER, B.LAVA, B.SAND, B.GRAVEL, B.PATH, B.SNOW, B.TALL_GRASS, B.FLOWER_RED, B.FLOWER_YELLOW, B.PINE_LOG, B.PINE_LEAVES, B.REED, B.COBBLE, B.GLASS, B.IRON_BLOCK, B.GOLD_BLOCK, B.DIAMOND_BLOCK, B.GLOWSTONE, B.OBSIDIAN, B.BRICK, B.DARK_STONE, B.AIR), Math'
          }
        },
        required: ['code']
      }
    }
  }
];
