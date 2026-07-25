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
  // --- Sistema de Mods: criar modificações inteiras que ficam salvas no mundo ---------------
  //
  // Estas ferramentas são o caminho correto para "crie um bloco/criatura/estrutura nova".
  // Diferente de `execute_voxel_script`, o que é definido aqui é **persistido no mundo** e
  // recarregado automaticamente na próxima sessão.
  {
    type: 'function',
    function: {
      name: 'create_mod',
      description: 'Cria uma MODIFICAÇÃO (mod) nova e vazia no mundo atual — o recipiente onde você agrupa blocos, criaturas e estruturas inéditas. Use SEMPRE isto como primeiro passo quando o usuário pedir conteúdo novo ("crie um bioma de cristal", "faça um mod de dragões"). Tudo que for adicionado ao mod fica salvo no mundo e volta sozinho quando o jogo é reaberto.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome do mod, ex.: "Reino de Cristal"' },
          description: { type: 'string', description: 'O que este mod adiciona ao jogo' },
          mod_id: { type: 'string', description: 'Id opcional. Se omitido, é derivado do nome.' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'define_mod_block',
      description: 'Adiciona um BLOCO inédito a um mod. O bloco recebe um id estável, é registrado na hora (já dá para usar em set_block/fill_box) e fica salvo no mundo para sempre. Referencie-o depois como "mod_id:chave" ou pelo nome.',
      parameters: {
        type: 'object',
        properties: {
          mod_id: { type: 'string', description: 'Id do mod. Omita para editar o mod desta sessão de chat.' },
          key: { type: 'string', description: 'Chave curta única no mod, ex.: "cristal_azul"' },
          name: { type: 'string', description: 'Nome exibido no inventário, ex.: "Cristal Azul"' },
          top_color: { type: 'string', description: 'Cor do topo em hexadecimal, ex.: "#38bdf8"' },
          side_color: { type: 'string', description: 'Cor das laterais (padrão: igual ao topo)' },
          bottom_color: { type: 'string', description: 'Cor da base (padrão: igual à lateral)' },
          solid: { type: 'boolean', description: 'Colide com o jogador (padrão true)' },
          opaque: { type: 'boolean', description: 'Bloqueia a visão das faces vizinhas (padrão true; use false para vidro/cristal)' },
          decor: { type: 'boolean', description: 'Renderiza como tufo pequeno tipo capim/flor' },
          gravity: { type: 'boolean', description: 'Cai quando não há suporte embaixo, tipo areia' },
          structural: { type: 'boolean', description: 'Participa do colapso estrutural de construções' },
          min_tool_tier: { type: 'number', description: 'Tier mínimo de ferramenta para dropar (0=mão, 1=madeira, 2=pedra, 3=ferro)' },
          light_level: { type: 'number', description: 'Luz emitida, 0 a 15' },
          interactive: { type: 'boolean', description: 'Aparece na aba de blocos especiais do inventário' },
        },
        required: ['name', 'top_color'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'define_mod_entity',
      description: 'Adiciona uma ESPÉCIE de criatura/NPC a um mod, montando a anatomia 3D com caixas (partes) e um script de comportamento opcional. Isto define o molde e o salva no mundo; use spawn_mod_entity para colocar indivíduos no mapa.',
      parameters: {
        type: 'object',
        properties: {
          mod_id: { type: 'string' },
          key: { type: 'string', description: 'Chave curta única no mod, ex.: "dragao_dourado"' },
          name: { type: 'string', description: 'Nome exibido acima da criatura' },
          faction: { type: 'string' },
          role: { type: 'string' },
          health: { type: 'number' },
          parts: {
            type: 'array',
            description: 'Partes 3D da anatomia. Cada parte é uma caixa com offset relativo ao centro e cor.',
            items: {
              type: 'object',
              properties: {
                offsetX: { type: 'number' }, offsetY: { type: 'number' }, offsetZ: { type: 'number' },
                sizeX: { type: 'number' }, sizeY: { type: 'number' }, sizeZ: { type: 'number' },
                color: { type: 'string', description: 'Cor hexadecimal, ex.: "#eab308"' },
              },
            },
          },
          behavior_script: {
            type: 'string',
            description: 'JS rodado a cada frame com (dt, entity, Math, THREE) no escopo. Ex.: "entity.walkCycle += dt; entity.pos.y += Math.sin(entity.walkCycle)*dt; entity.mesh.position.copy(entity.pos);"',
          },
        },
        required: ['name', 'parts'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'define_mod_structure',
      description: 'Adiciona uma ESTRUTURA reutilizável a um mod (templo, casa, estátua), como lista de blocos relativos à origem (0,0,0). Pode usar blocos do próprio mod pela chave simbólica. Depois carimbe quantas vezes quiser com place_mod_structure.',
      parameters: {
        type: 'object',
        properties: {
          mod_id: { type: 'string' },
          key: { type: 'string', description: 'Chave curta única no mod, ex.: "templo_cristal"' },
          name: { type: 'string' },
          blocks: {
            type: 'array',
            description: 'Blocos relativos à origem. `block` aceita id numérico, nome base ("STONE") ou chave do mod ("cristal_azul" / "mod_id:cristal_azul").',
            items: {
              type: 'object',
              properties: {
                dx: { type: 'number' }, dy: { type: 'number' }, dz: { type: 'number' },
                block: { type: 'string' },
              },
            },
          },
        },
        required: ['name', 'blocks'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'spawn_mod_entity',
      description: 'Coloca no mundo um indivíduo de uma espécie definida por define_mod_entity. Diferente de spawn_entity, esta instância é SALVA no mundo e reaparece quando o jogo é recarregado.',
      parameters: {
        type: 'object',
        properties: {
          mod_id: { type: 'string' },
          entity_key: { type: 'string', description: 'Chave da espécie dentro do mod' },
          x: { type: 'number' },
          y: { type: 'number', description: 'Altura; se omitido, encaixa no chão' },
          z: { type: 'number' },
        },
        required: ['entity_key', 'x', 'z'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'place_mod_structure',
      description: 'Carimba no mundo uma estrutura definida por define_mod_structure, na origem (x, y, z). Os blocos são salvos no mundo normalmente.',
      parameters: {
        type: 'object',
        properties: {
          mod_id: { type: 'string' },
          structure_key: { type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' },
          z: { type: 'number' },
        },
        required: ['structure_key', 'x', 'y', 'z'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'attach_session_to_mod',
      description: 'Vincula ESTA sessão de chat a um mod existente, passando a editá-lo. Cada sessão de conversa corresponde a uma modificação: é isso que dá escopo às ferramentas e evita alterar o mod errado. Sem `mod_id`, a sessão volta a ser LIVRE (lê tudo, não escreve nada).',
      parameters: {
        type: 'object',
        properties: {
          mod_id: { type: 'string', description: 'Id do mod a editar nesta sessão. Omita para soltar o vínculo.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_session_context',
      description: 'Diz qual mod esta sessão está editando (ou que ela é livre) e resume o conteúdo dele. Chame no início de uma conversa para saber onde você está antes de modificar qualquer coisa.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_mod_revisions',
      description: 'Lista o histórico de versões de um mod, da mais recente para a mais antiga, com um resumo do que mudou em cada uma.',
      parameters: {
        type: 'object',
        properties: {
          mod_id: { type: 'string', description: 'Omita para usar o mod desta sessão.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rollback_mod',
      description: 'Volta um mod para uma revisão anterior, revertendo mundo e save. O estado atual é salvo como revisão antes de voltar, então dá para desfazer o rollback. Use quando o usuário disser que a última alteração piorou o mod.',
      parameters: {
        type: 'object',
        properties: {
          revision: { type: 'number', description: 'Número da revisão de destino (veja em list_mod_revisions)' },
          mod_id: { type: 'string', description: 'Omita para usar o mod desta sessão.' },
        },
        required: ['revision'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_mods',
      description: 'Lista os mods instalados neste mundo com seus blocos, espécies e estruturas. Consulte ANTES de criar conteúdo novo, para reaproveitar o que já existe em vez de duplicar.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_mod_enabled',
      description: 'Liga ou desliga um mod sem apagá-lo. Desligado, os blocos dele saem do registro mas as definições continuam salvas.',
      parameters: {
        type: 'object',
        properties: {
          mod_id: { type: 'string' },
          enabled: { type: 'boolean' },
        },
        required: ['mod_id', 'enabled'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_mod',
      description: 'Remove um mod do mundo permanentemente e limpa os blocos dele que já estavam colocados, para não deixar buracos no save. Confirme com o usuário antes de usar.',
      parameters: {
        type: 'object',
        properties: {
          mod_id: { type: 'string' },
          purge_placed_blocks: { type: 'boolean', description: 'Padrão true: apaga do mundo os blocos deste mod já colocados.' },
        },
        required: ['mod_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'export_mod',
      description: 'Devolve o JSON completo de um mod, para o usuário salvar em arquivo ou levar para outro mundo.',
      parameters: {
        type: 'object',
        properties: { mod_id: { type: 'string' } },
        required: ['mod_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'import_mod',
      description: 'Instala neste mundo um mod a partir do JSON gerado por export_mod. Os ids de bloco são realocados automaticamente para não colidir com o que já existe aqui.',
      parameters: {
        type: 'object',
        properties: {
          mod_json: { type: 'string', description: 'Conteúdo JSON do mod' },
        },
        required: ['mod_json'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'undo_last_action',
      description: 'Desfaz o último lote de blocos construído por execute_voxel_script, revertendo o mundo E o save. Use quando o usuário disser que não gostou do resultado, em vez de tentar apagar bloco a bloco.',
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
