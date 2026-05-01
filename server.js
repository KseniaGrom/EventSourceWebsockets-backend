const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const users = new Map();

wss.on('connection', (ws) => {
    let userId = null;
    let userName = null;

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);

            if (message.type === 'register') {
                const requestedName = message.name;

                const nameTaken = Array.from(users.values()).some(
                    name => name.toLowerCase() === requestedName.toLowerCase()
                );

                if (nameTaken) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Nickname is already taken' }));
                    return;
                }

                userId = uuidv4();
                userName = requestedName;
                users.set(userId, userName);
                ws.userId = userId;

                ws.send(JSON.stringify({ 
                    type: 'registered', 
                    id: userId,
                    users: Array.from(users.entries()).map(([id, name]) => ({ id, name }))
                }));

                broadcastUsers();
                return;
            }

            if (message.type === 'send' && userId) {
                const payload = {
                    type: 'message',
                    message: message.message,
                    user: { id: userId, name: userName }
                };
                
                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(payload));
                    }
                });
            }
        } catch (e) {
            console.error('Error parsing message', e);
        }
    });

    ws.on('close', () => {
        if (userId && users.has(userId)) {
            users.delete(userId);
            broadcastUsers();
        }
    });

    function broadcastUsers() {
        const userList = Array.from(users.entries()).map(([id, name]) => ({ id, name }));
        const payload = JSON.stringify({ type: 'users', users: userList });

        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        });
    }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});