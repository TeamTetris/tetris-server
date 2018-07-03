var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);

const fields = {};

server.listen(8081, function() { 
    console.log('Listening on ' + server.address().port);
    io.on('connection', function(socket) {
      // notify other players of joined player
      socket.broadcast.emit("playerJoined", { id: socket.id });

      console.log('User connected. ID:', socket.id);

      socket.on('disconnect', function() {
        socket.broadcast.emit("playerLeft", { id: socket.id });
        console.log('User disconnected. ID:', socket.id);
        delete fields[socket.id];
      });

      socket.on('fieldUpdate', (args) => {
        console.log('fieldUpdate', socket.id, Date.now());
        fields[socket.id] = args.fieldState;
        // send event to everyone but the original sender
        socket.broadcast.emit('fieldUpdate', Object.assign(args, { id: socket.id }));
      })
    });
});