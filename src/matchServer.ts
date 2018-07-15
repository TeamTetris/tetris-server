import * as socketIo from 'socket.io';
import * as http from 'http';


interface Result {
  success: boolean,
  message: string
}

class MatchServer {
  private _socketServer: SocketIO.Server;

  private _runningMatches: Array<Match> = [];
  private _newMatchId: number = 1000;

  private static MATCH_ROOM_PREFIX: string = "match-";
  private static MATCHMAKING_ROOM: string = "matchmaking";
  private static MIN_PLAYERS: number = 2;
  private static MAX_PLAYERS: number = 5;


  constructor(httpServer: http.Server, socketServer: SocketIO.Server) {
    this._socketServer = socketServer;

    this._listenSockets(httpServer, socketServer);
  }

  private _listenSockets(httpServer, socketServer): void {
    let matchServer = this;
    httpServer.listen(process.env.PORT || 8081, function () {
      console.log('Listening on ' + httpServer.address().port);
      socketServer.on('connection', function (socket) {
        socket.on('disconnect', function () {
          if (matchServer.isPlayerInMatchmakingQueue(socket)) {
            matchServer.removePlayerFromMatchmaking(socket.id); // REDUNDANT, socket.io already has sockets leave all rooms on disconnect
          }
          if (matchServer.isPlayerInMatch(socket)) {
            matchServer.removePlayerFromMatch(socket); // REDUNDANT, socket.io already has sockets leave all rooms on disconnect
          }
        });

        socket.on('joinMatchmaking', () => {
          matchServer.addPlayerToMatchmaking(socket);
        });

        socket.on('leaveMatchmaking', () => {
          matchServer.removePlayerFromMatchmaking(socket);
        });

        socket.on('joinMatch', async (socketData, callback) => {
          const result = await matchServer.addPlayerToMatch(socket, socketData.matchId, socketData.displayName);
          if (result["success"]) {
            matchServer.removePlayerFromMatchmaking(socket);
            callback(true);
          } else {
            callback(false, result.message)
          }
        });

        socket.on('leaveMatch', function () {
          matchServer.removePlayerFromMatch(socket);
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
    this.runMatchmaking(socket.server, socket);
  }

  private removePlayerFromMatchmaking(socket) {
    socket.leave(MatchServer.MATCHMAKING_ROOM);
  }

  private addPlayerToMatch(socket, matchId, displayName) {
    return new Promise<Result>((resolve) => {
      const match = this._runningMatches.find(match => match.id == matchId);
      if (!match) {
        resolve({ success: false, message: 'Match does not exist.' });
      }
      if (!this.isMatchJoinable(match)) {
        resolve({ success: false, message: 'Match is not joinable anymore.' });
      }
      socket.join(this.getMatchRoomName(matchId), () => {
        // TODO: add player to runningMatches array
        socket.server.to(socket.id).emit('matchInfo', this._runningMatches[matchId]);
        resolve({ success: true, message: 'Successfully joined match.' });
      });
    })
  }

  private removePlayerFromMatch(socket) {
    for (let match of this.getJoinedMatchesOfPlayer(socket)) {
      socket.leave(this.getMatchRoomName(match));
      // TODO: mark player as left, update match info
    }
  }

  private isMatchJoinable(match) {
    return match.joinUntil > new Date() && match.players.length < match.maxPlayers;
  }

  private runMatchmaking(server, triggeringSocket) {
    console.log('Running matchmaking.');
    const clientsInMatchmaking = server.in(MatchServer.MATCHMAKING_ROOM).clients;
    server.to(MatchServer.MATCHMAKING_ROOM).emit('matchmakingUpdate', { 'playersInQueue': clientsInMatchmaking.length });

    const joinableMatchInfo = this._runningMatches.find(match => this.isMatchJoinable(match));
    if (joinableMatchInfo) {
      console.log('Joinable match found.');
      server.to(triggeringSocket.id).emit('matchReady', joinableMatchInfo);
    } else {
      if (clientsInMatchmaking.length > MatchServer.MIN_PLAYERS) {
        console.log('Creating a new match.');
        const matchInfo = this.createMatch();
        server.to(MatchServer.MATCHMAKING_ROOM).emit('matchReady', matchInfo);
      } else {
        console.log('Not enough players to start a game. & No open game.');
      }
    }
  }

  private createMatch(): Match {
    const newMatch = new Match(MatchServer.MAX_PLAYERS);
    this._runningMatches.push(newMatch);
    return newMatch;
  }
}

export default MatchServer;