var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);

const fields = {};

app.get('/', (req, res) => {
  res.send("Server is running");
});

server.listen(process.env.PORT || 8081, function() { 
    console.log('Listening on ' + server.address().port);
    io.on('connection', function(socket) {
      // notify other players of joined player
      socket.broadcast.emit("playerJoined", { id: socket.id });
      io.to(socket.id).emit("currentPlayers", { players: Object.keys(fields), fields });

      //console.log('User connected. ID:', socket.id, "currentPlayers:", Object.keys(fields));

      socket.on('disconnect', function() {
        socket.broadcast.emit("playerLeft", { id: socket.id });
        //console.log('User disconnected. ID:', socket.id);
        delete fields[socket.id];
      });

      socket.on('fieldUpdate', (args) => {
        // send event to everyone but the original sender
        //console.log('fieldUpdate', socket.id, Date.now());
        socket.broadcast.emit('fieldUpdate', Object.assign(args, { id: socket.id }));
        fields[socket.id] = args.fieldState;
      })
    });
});