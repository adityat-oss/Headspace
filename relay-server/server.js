const { WebSocketServer } = require('ws');
const http = require('http');

const PORT = 3000;
const server = http.createServer();
const wss = new WebSocketServer({ server });

const clients = new Map();

wss.on('connection', (ws) => {
  let userToken = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'AUTH') {
        userToken = data.token;
        clients.set(ws, userToken);
        console.log(`Client authenticated with token: ${userToken}`);
        return;
      }

      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
        return;
      }

      if (userToken) {
        // Broadcast to all other clients with the SAME token
        for (const [client, token] of clients.entries()) {
          if (client !== ws && token === userToken && client.readyState === 1) {
            client.send(message.toString());
          }
        }
      }
    } catch (err) {
      console.error("Failed to parse message:", err);
    }
  });

  ws.on('close', () => {
    if (userToken) {
      console.log(`Client with token ${userToken} disconnected.`);
    }
    clients.delete(ws);
  });
});

server.listen(PORT, () => {
  console.log(`Ambient Board Sync Relay Server listening on ws://localhost:${PORT}`);
});
