var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);

const fields = {};

server.listen(8081, function() { 
    console.log('Listening on ' + server.address().port);
    io.on('connection', function(socket) {
      console.log('User connected. ID:', socket.id);
      socket.on('disconnect', function() {
        socket.broadcast.emit("playerLeft", { socketId: socket.id });
        console.log('User disconnected. ID:', socket.id);
        delete fields[socket.id];
      });
      
      // send current fields to user
      socket.to(socket.id).emit("currentFields", { fields });
      // notify other players of joined player
      socket.broadcast.emit("playerJoined", { socketId: socket.id });

      socket.on('fieldUpdate', (args) => {
        console.log('fieldUpdate', socket.id, args);
        fields[socket.id] = args.fieldState;
        // send event to everyone but the original sender
        socket.broadcast.emit('fieldUpdate', args);
      })
    });
});