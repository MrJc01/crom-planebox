# Protocolo de Rede P2P (Multiplayer Online)

Documento técnico do sistema de "mundo online" pedido pelo usuário: **o jogo continua 100% client-side** — mundo, IA, física, tudo roda no navegador do dono do mundo (host). A única peça de infraestrutura externa é um **relay mínimo de sinalização** ("Crom"), que nunca vê dados de jogo — só ajuda dois navegadores a se encontrarem e trocarem a negociação inicial do WebRTC.

---

## Arquitetura: host-estrela (host-autoritativo)

```
        Peer B ───┐
                   │  RTCDataChannel (JSON)
        Peer C ───┼──────────────► HOST (dono do mundo)
                   │                 │
        Peer D ───┘                 │ guarda o World, IndexedDB, IA
                                     │ real; retransmite diffs validados
```

- O **host** é sempre quem criou/abriu o mundo. Ele guarda o estado real (blocos, entidades, jogadores) e é a única fonte de verdade.
- **Peers** (convidados) enviam *intenções* (ex.: "quero quebrar o bloco em X,Y,Z") — nunca aplicam mudanças diretamente no próprio estado sem confirmação do host.
- Se o host fecha a aba, a sessão termina para os peers (limitação inerente de não ter backend persistente — ver `docs/CHECKLIST_EVOLUCAO.md` seção 10).

## O relay de sinalização ("Crom")

Arquivo de referência: [`relay/server.js`](../relay/server.js) — um servidor Node opcional e independente do cliente (não faz parte do bundle Vite).

O relay faz **só duas coisas**:
1. **Handshake WebRTC**: repassa `offer`/`answer`/`ice-candidate` entre `clientId`s — necessário porque dois navegadores não conseguem se encontrar sozinhos na internet sem alguma forma de rendezvous.
2. **Diretório de salas**: mantém em memória `{ roomId, name, playerCount }` de mundos que estão "conectados à Crom" agora, para o `MainMenu` listar em "Mundos Online da Crom" (`GET /rooms`).

O relay **nunca** recebe blocos, inventário, chat ou qualquer `NetMessage` do protocolo abaixo — esses só trafegam depois, direto entre os clientes via `RTCDataChannel`.

Sem uma URL de relay configurada (`SignalingClient.configure(null)`, o padrão), tudo continua funcionando localmente — "conectar à Crom" é sempre uma ação opcional e explícita (no Wizard de criação, ou via `/crom conectar` no chat).

## Mensagens do DataChannel (`src/net/protocol.ts`)

Todas em JSON, campo `type` como discriminante:

| type | Direção | Descrição |
|---|---|---|
| `block_update` | host → peers | Um bloco mudou: `{x,y,z,blockType}` |
| `entity_update` | host → peers | Posição atual de uma entidade/NPC |
| `player_state` | peer ↔ host | Posição/rotação/vida/fome/modo do jogador (peer envia o próprio; host retransmite os dos outros) |
| `chat_message` | peer ↔ host | Mensagem de chat do mundo (não confundir com o chat da IA, que é local ao host) |
| `command` | peer → host | Comando de barra (`/tp`, `/gamemode`...) — o host SEMPRE valida permissão antes de aplicar |
| `full_sync` | host → peer novo | Snapshot completo (todos os diffs de blocos + lista de jogadores) enviado assim que a conexão abre |
| `player_joined` / `player_left` | host → peers | Entrada/saída de um jogador |
| `op_changed` | host → peers | Alguém ganhou/perdeu OP |
| `kick` | host → peer | Peer específico deve se desconectar |

## Fluxo de entrada de um peer

1. Peer abre a URL com `?join=<roomId>` (ou escolhe uma sala em "Mundos Online da Crom" no `MainMenu`).
2. `PeerSync.joinRoom(roomId)` conecta ao relay e anuncia a entrada.
3. O relay avisa o host (`peer-joined`); o host cria a oferta WebRTC.
4. Handshake completo → `RTCDataChannel` aberto → host envia `full_sync`.
5. O peer assume automaticamente o **Modo Aventura** (só andar) até o host promovê-lo a outro modo.

## Rodando o relay (opcional)

```bash
cd relay
npm install
npm start   # ouve em :8787 por padrão (variável de ambiente PORT)
```

No cliente, a URL do relay é configurada na aba **Multiplayer** do Pause Menu (`ws://seu-servidor:8787` ou `wss://` em produção com TLS).

---

## Codificação binária das mensagens frequentes

O canal transporta **três formatos**, distinguidos pelo primeiro byte:

| Primeiro byte | Formato |
|---|---|
| `{` (texto) | JSON — mensagens raras: chat, comando, `full_sync`, `mod_sync` |
| `0x01`–`0x03` | mensagem frequente codificada (`src/net/codec.ts`) |
| `0xc7` | fragmento de mensagem grande (`src/net/wire.ts`) |

### Por que binário nas frequentes

Os dois peers rodam o mesmo programa, logo ambos conhecem o formato das mensagens. Transmitir
`{"type":"block_update","x":...}` em texto manda nomes de campo que o outro lado já sabe. O
"dicionário compartilhado" aqui é o próprio esquema, e ele custa zero byte porque está no código.

Medido no tráfego real de uma partida (6.000 mensagens, média de 211 bytes):

| Estratégia | Ganho |
|---|---|
| JSON em texto puro (antes) | 1,0x |
| gzip por mensagem | 1,28x — o cabeçalho quase anula |
| dicionário compartilhado genérico | 7,6x |
| **binário por opcode** | **11,7x** |

### Opcodes

| Op | Mensagem | Tamanho |
|---|---|---|
| `0x01` | `block_update` | 9 bytes fixos |
| `0x02` | `block_batch` | 3 + 8×N |
| `0x03` | `player_state` | 37 bytes fixos |

### Aparência do personagem

Tem ~200 bytes e muda quase nunca, mas ia em **todo** pacote a 10 Hz — era o maior desperdício do
`player_state`. Agora o pacote binário leva só um hash de 4 bytes; quando ele muda, o remetente
manda a aparência inteira uma vez em JSON, e o receptor guarda.

### Compatibilidade

Um peer de versão anterior só fala JSON, e continua sendo entendido: a distinção por primeiro
byte não exige negociação. Um peer novo falando com um antigo apenas não recebe binário de volta.
