var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);


app.get('/', (req, res) => {
  res.send("Server is running");
});


const runningMatches = {};
const MATCH_ROOM_PREFIX = "match-";
const MATCHMAKING_ROOM = "matchmaking";

const isInMatchmakingQueue = (socket) => {
  return socket.rooms.indexOf(MATCHMAKING_ROOM) > -1;
}

const getJoinedMatches = (socket) => {
  return socket.rooms.filter(b => b.indexOf(MATCH_ROOM_PREFIX) > -1);
}

const isInMatch = (socket) => {
  const matches = getJoinedMatches(socket);
  if (matches.length > 1) {
    console.error("Player is in more than one match:", socket.id, socket.rooms);
  }
  if (matches.length == 0) {
    return false;
  } else if (matches.length == 1) {
    return true;
  }
}

const getMatchRoomName = (matchId) => {
  return MATCH_ROOM_PREFIX + matchId;
}

const addPlayerToMatchmaking = (socket) => {
  socket.join(MATCHMAKING_ROOM);
}

const removePlayerFromMatchmaking = (socket) => {
  socket.leave(MATCHMAKING_ROOM);
}

const addPlayerToMatch = (socket, matchId) => {
  socket.join(getMatchRoomName(matchId), () => {
    // TODO: send match info
  });
}

const removePlayerFromMatch = (socket) => {
  for (match of getJoinedMatches(socket)) {
    socket.leave(getMatchRoomName(match));
    // TODO: mark player as left, update match info
  }
}

server.listen(process.env.PORT || 8081, function() { 
  console.log('Listening on ' + server.address().port);
  io.on('connection', function(socket) {
    socket.on('disconnect', function() {
      if (isInMatchmakingQueue(socket)) {
        removePlayerFromMatchmaking(socket.id);
      }
      if (isInMatch(socket)) {
        removePlayerFromMatch(socket);
      }
    });

    socket.on('joinMatchmaking', function() {
      addPlayerToMatchmaking(socket);
    });
    
    socket.on('leaveMatchmaking', function() {
      removePlayerFromMatchmaking(socket);
    });
    
    socket.on('joinMatch', function(socketData) {
      removePlayerFromMatchmaking(socket);
      addPlayerToMatch(socket, socketData.matchId);
    });

    socket.on('leaveMatch', function() {
      removePlayerFromMatch(socket);
    });
    




    /*socket.broadcast.emit("playerJoined", { id: socket.id });
    io.to(socket.id).emit("currentPlayers", { players: Object.keys(fields), fields });

    //console.log('User connected. ID:', socket.id, "currentPlayers:", Object.keys(fields));

    socket.on('fieldUpdate', (socketData) => {
      // send event to everyone but the original sender
      //console.log('fieldUpdate', socket.id, Date.now());
      socket.broadcast.emit('fieldUpdate', Object.assign(socketData, { id: socket.id }));
      fields[socket.id] = socketData.fieldState;
    })*/
  });
});