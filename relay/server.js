// Relay MÍNIMO de sinalização + diretório de salas ("Crom"), referido no
// docs/CHECKLIST_EVOLUCAO.md e docs/NETWORK_PROTOCOL.md do projeto principal.
//
// O QUE ISSO FAZ: só troca handshake WebRTC (offer/answer/ICE) entre um host e seus
// peers, e mantém uma listinha em memória de "quais salas estão abertas agora"
// (nome + contagem de jogadores) para o MainMenu do cliente exibir.
//
// O QUE ISSO NÃO FAZ: não guarda blocos, inventário, chat ou qualquer dado de jogo.
// Todo o estado do mundo continua 100% nos clientes (host autoritativo). Se este
// processo cair, as sessões P2P já estabelecidas continuam funcionando normalmente
// (o relay só é necessário no momento inicial de conexão).
//
// Como rodar: `npm install` nesta pasta, depois `node server.js` (ou configure a
// variável de ambiente PORT). É opcional — sem ele, o Crom Planebox funciona 100%
// local/single-player como hoje.
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const PORT = process.env.PORT || 8787;

/** roomId -> { name, hostId, guestIds: Set<string> } */
const rooms = new Map();
/** clientId -> ws socket */
const clients = new Map();

const httpServer = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/rooms') {
    const list = Array.from(rooms.entries()).map(([roomId, r]) => ({
      roomId,
      name: r.name,
      playerCount: r.guestIds.size + 1,
    }));
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(list));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  let myId = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.op === 'hello') {
      myId = msg.clientId;
      clients.set(myId, ws);
      return;
    }

    if (msg.op === 'create-room') {
      rooms.set(msg.roomId, { name: msg.name || msg.roomId, hostId: msg.hostId, guestIds: new Set() });
      return;
    }

    if (msg.op === 'close-room') {
      rooms.delete(msg.roomId);
      return;
    }

    if (msg.op === 'join-room') {
      const room = rooms.get(msg.roomId);
      if (!room) return;
      room.guestIds.add(msg.clientId);
      const hostWs = clients.get(room.hostId);
      hostWs?.send(JSON.stringify({ op: 'peer-joined', peerId: msg.clientId }));
      return;
    }

    if (msg.op === 'signal') {
      const targetWs = clients.get(msg.to);
      targetWs?.send(JSON.stringify(msg));
      return;
    }
  });

  ws.on('close', () => {
    if (!myId) return;
    clients.delete(myId);
    for (const [roomId, room] of rooms) {
      if (room.hostId === myId) rooms.delete(roomId);
      else room.guestIds.delete(myId);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`[crom-relay] sinalização + diretório de salas ouvindo na porta ${PORT}`);
});
