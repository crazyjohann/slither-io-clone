const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Host the files in the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Store room data (who is in which room)
const rooms = {};

io.on('connection', (socket) => {
    console.log('🟢 A player connected:', socket.id);
    let currentRoom = null;

    // When a player joins a room
    socket.on('joinRoom', (data) => {
        const { roomCode, playerState } = data;
        socket.join(roomCode);
        currentRoom = roomCode;

        if (!rooms[roomCode]) {
            rooms[roomCode] = { players: {} };
        }

        // Add player to the server's room list
        rooms[roomCode].players[socket.id] = playerState;

        // Send the new player the current room state (other players)
        socket.emit('roomState', rooms[roomCode]);

        // Tell everyone else in the room that a new player joined
        socket.to(roomCode).emit('playerJoined', { id: socket.id, ...playerState });
    });

    // When a player moves
    socket.on('updatePosition', (playerState) => {
        if (currentRoom && rooms[currentRoom] && rooms[currentRoom].players[socket.id]) {
            rooms[currentRoom].players[socket.id] = playerState;
            // Broadcast their new position to everyone else in the room
            socket.to(currentRoom).emit('playerMoved', { id: socket.id, ...playerState });
        }
    });

    // When a player gets eaten
    socket.on('playerDied', () => {
        if (currentRoom && rooms[currentRoom]) {
            delete rooms[currentRoom].players[socket.id];
            socket.to(currentRoom).emit('playerDied', socket.id);
        }
    });

    // When a player closes the tab or leaves the game
    socket.on('disconnect', () => {
        console.log('🔴 Player disconnected:', socket.id);
        if (currentRoom && rooms[currentRoom]) {
            delete rooms[currentRoom].players[socket.id];
            socket.to(currentRoom).emit('playerLeft', socket.id);
            
            // Clean up empty rooms to save computer memory
            if (Object.keys(rooms[currentRoom].players).length === 0) {
                delete rooms[currentRoom];
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Multiplayer Game Server is running!`);
    console.log(`👉 Open your browser and go to: http://localhost:${PORT}`);
});
