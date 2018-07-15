var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);


app.get('/', (req, res) => {
  res.send("Server is running");
});
/** runningMatches DATA STRUCTURE

  runningMatches[matchId] = {
    players: [
      {
        displayName: 'coolboy68',
        userId: 'PZDoMHjiu8PYfRiKAAAF',
        points: 5000,
        placement: 13,
        connectionStatus: ['connected', 'disconnected'],
        scoreboardStatus: ['regular', 'endangered', 'spotlighted'],
        playStatus: ['playing', 'finished']
      }
    ],
    startTime: Date,    
    nextElimination: Date,
  };
 */
const runningMatches = {};
let newMatchId = 1000;
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
  runMatchmaking(socket.server);
}

const removePlayerFromMatchmaking = (socket) => {
  socket.leave(MATCHMAKING_ROOM);
}

const addPlayerToMatch = (socket, matchId) => {
  socket.join(getMatchRoomName(matchId), () => {
    socket.server.to(socket.id).emit('matchInfo', runningMatches[matchId]);
  });
}

const removePlayerFromMatch = (socket) => {
  for (match of getJoinedMatches(socket)) {
    socket.leave(getMatchRoomName(match));
    
    // TODO: mark player as left, update match info
  }
}

const runMatchmaking = (server) => {
  console.log('Running matchmaking.');
  const clientsInMatchmaking = server.in(MATCHMAKING_ROOM).clients;
  server.to(MATCHMAKING_ROOM).emit('matchmakingUpdate', { 'playersInQueue': clientsInMatchmaking.length });
  if (clientsInMatchmaking.length > 2) {
    console.log('Starting a game.');
    const matchInfo = createMatch();
    server.to(MATCHMAKING_ROOM).emit('matchReady', matchInfo);
  } else {
    console.log('Not enough players to start a game.');
  }
}

const createMatch = () => {
  const matchInfo = { 
    id: newMatchId++, 
    startTime: new Date(Date.now() + 1000 * 60), // start match in 1 minute
    joinUntil: new Date(Date.now() + 1000 * 45), // join within 45 seconds
    nextElimination: new Date(Date.now() + 1000 * 120) // first elimination after 1 minute 
  };
  runningMatches[matchInfo.id] = {
    players: [],
    startTime: matchInfo.startTime,    
    nextElimination: matchInfo.nextElimination,
  };
  return matchInfo;
}

server.listen(process.env.PORT || 8081, function() { 
  console.log('Listening on ' + server.address().port);
  io.on('connection', function(socket) {
    socket.on('disconnect', function() {
      if (isInMatchmakingQueue(socket)) {
        removePlayerFromMatchmaking(socket.id); // REDUNDANT, socket.io already has sockets leave all rooms on disconnect
      }
      if (isInMatch(socket)) {
        removePlayerFromMatch(socket); // REDUNDANT, socket.io already has sockets leave all rooms on disconnect
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