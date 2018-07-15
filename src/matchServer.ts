import * as socketIo from 'socket.io';
import * as http from 'http';

class MatchServer {
  private _socketServer: SocketIO.Server;

  private _runningMatches = {};
  private _newMatchId: number = 1000;

  private static MATCH_ROOM_PREFIX = "match-";
  private static MATCHMAKING_ROOM = "matchmaking";


  constructor(httpServer: http.Server, socketServer: SocketIO.Server) {
    this._socketServer = socketServer;

    this._listenSockets(httpServer, socketServer);
  }

  private _listenSockets(httpServer, socketServer): void {
    httpServer.listen(process.env.PORT || 8081, function () {
      console.log('Listening on ' + httpServer.address().port);
      socketServer.on('connection', function (socket) {
        socket.on('disconnect', function () {
          if (this.isInMatchmakingQueue(socket)) {
            this.removePlayerFromMatchmaking(socket.id); // REDUNDANT, socket.io already has sockets leave all rooms on disconnect
          }
          if (this.isInMatch(socket)) {
            this.removePlayerFromMatch(socket); // REDUNDANT, socket.io already has sockets leave all rooms on disconnect
          }
        });

        socket.on('joinMatchmaking', function () {
          this.addPlayerToMatchmaking(socket);
        });

        socket.on('leaveMatchmaking', function () {
          this.removePlayerFromMatchmaking(socket);
        });

        socket.on('joinMatch', function (socketData) {
          this.removePlayerFromMatchmaking(socket);
          this.addPlayerToMatch(socket, socketData.matchId);
        });

        socket.on('leaveMatch', function () {
          this.removePlayerFromMatch(socket);
        });
      });
    });
  }


  private isPlayerInMatchmakingQueue(socket) {
    return socket.rooms.indexOf(MatchServer.MATCHMAKING_ROOM) > -1;
  }

  private getJoinedMatchesOfPlayer(socket) {
    return socket.rooms.filter(b => b.indexOf(MatchServer.MATCH_ROOM_PREFIX) > -1);
  }

  private isPlayerInMatch(socket) {
    const matches = this.getJoinedMatchesOfPlayer(socket);
    if (matches.length > 1) {
      console.error("Player is in more than one match:", socket.id, socket.rooms);
    }
    if (matches.length == 0) {
      return false;
    } else if (matches.length == 1) {
      return true;
    }
  }

  private getMatchRoomName(matchId) {
    return MatchServer.MATCH_ROOM_PREFIX + matchId;
  }

  private addPlayerToMatchmaking(socket) {
    socket.join(MatchServer.MATCHMAKING_ROOM);
    this.runMatchmaking(socket.server);
  }

  private removePlayerFromMatchmaking(socket) {
    socket.leave(MatchServer.MATCHMAKING_ROOM);
  }

  private addPlayerToMatch(socket, matchId) {
    socket.join(this.getMatchRoomName(matchId), () => {
      socket.server.to(socket.id).emit('matchInfo', this._runningMatches[matchId]);
    });
  }

  private removePlayerFromMatch(socket) {
    for (let match of this.getJoinedMatchesOfPlayer(socket)) {
      socket.leave(this.getMatchRoomName(match));
      // TODO: mark player as left, update match info
    }
  }

  private runMatchmaking(server) {
    console.log('Running matchmaking.');
    const clientsInMatchmaking = server.in(MatchServer.MATCHMAKING_ROOM).clients;
    server.to(MatchServer.MATCHMAKING_ROOM).emit('matchmakingUpdate', { 'playersInQueue': clientsInMatchmaking.length });
    if (clientsInMatchmaking.length > 2) {
      console.log('Starting a game.');
      const matchInfo = this.createMatch();
      server.to(MatchServer.MATCHMAKING_ROOM).emit('matchReady', matchInfo);
    } else {
      console.log('Not enough players to start a game.');
    }
  }

  private createMatch() {
    const matchInfo = {
      id: this._newMatchId++,
      startTime: new Date(Date.now() + 1000 * 60), // start match in 1 minute
      joinUntil: new Date(Date.now() + 1000 * 45), // join within 45 seconds
      nextElimination: new Date(Date.now() + 1000 * 120) // first elimination after 1 minute 
    };
    this._runningMatches[matchInfo.id] = {
      players: [],
      startTime: matchInfo.startTime,
      nextElimination: matchInfo.nextElimination,
    };
    return matchInfo;
  }
}

export default MatchServer;