import * as socketIo from 'socket.io';
import * as http from 'http';

import Match from './match';
import MatchPlayer from './player/matchPlayer';
import ConnectionStatus from './player/connectionStatus';

interface Result {
  success: boolean,
  message: string
}

class MatchServer {
  private _socketServer: SocketIO.Server;

  private _runningMatches: Match[] = [];

  private static MATCH_ROOM_PREFIX: string = "match-";
  private static MATCHMAKING_ROOM: string = "matchmaking";
  private static MIN_PLAYERS: number = 2;
  private static MAX_PLAYERS: number = 5;

  private socketToPlayerMap: Map<string, MatchPlayer> = new Map<string, MatchPlayer>();


  constructor(httpServer: http.Server, socketServer: SocketIO.Server) {
    this._socketServer = socketServer;
    this._listenSockets(httpServer, socketServer);
  }

  private _listenSockets(httpServer, socketServer: SocketIO.Server): void {
    let matchServer = this;
    httpServer.listen(process.env.PORT || 8081, function () {
      console.log('Listening on ' + httpServer.address().port);
      socketServer.on('connection', function (socket) {
        socket.on('disconnect', function () {
          if (matchServer.isPlayerInMatchmakingQueue(socket)) {
            matchServer.removePlayerFromMatchmaking(socket.id); // TODO: REDUNDANT, socket.io already has sockets leave all rooms on disconnect
          }
          if (matchServer.isPlayerInMatch(socket)) {
            matchServer.removePlayerFromMatch(socket); 
          }
        });

        socket.on('joinMatchmaking', () => {
          matchServer.addPlayerToMatchmaking(socket);
        });

        socket.on('leaveMatchmaking', () => {
          matchServer.removePlayerFromMatchmaking(socket);
        });

        socket.on('joinMatch', async (socketData, callback) => {
          const result = await matchServer.addPlayerToMatch(socket, this.getPlayerFromSocketId(socket.id), socketData.matchId);
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

        socket.on('matchUpdate', (socketData) => {
          matchServer
            .getMatchFromId(socketData.matchId)
            .receivePlayerUpdate({ socketId: socket.id, points: socketData.points, field: socketData.field });
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

  private isPlayerInMatch(socket): boolean {
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

  private addPlayerToMatch(socket: SocketIO.Socket, player: MatchPlayer, matchId: number) {
    return new Promise<Result>((resolve) => {
      const match = this.getMatchFromId(matchId);
      if (!match) {
        resolve({ success: false, message: 'Match does not exist.' });
      }
      if (!match.isJoinable) {
        resolve({ success: false, message: 'Match is not joinable anymore.' });
      }
      socket.join(this.getMatchRoomName(matchId), () => {
        const success = match.addPlayer(player);
        if (success) {
          socket.server.to(socket.id).emit('matchInfo', match.serialize());
          resolve({ success: true, message: 'Successfully joined match.' });
        } else {
          socket.leave(this.getMatchRoomName(matchId));
          resolve({ success: false, message: 'Match is not joinable anymore.' });
        }
      });
    })
  }

  private removePlayerFromMatch(socket) {
    for (let match of this.getJoinedMatchesOfPlayer(socket)) {
      const player = this.getPlayerFromSocketId(socket.id);
      player.connectionStatus = ConnectionStatus.Disconnected;
      socket.leave(this.getMatchRoomName(match)); // TODO: move this & line above into something like player.leaveMatch();
      this.destroyPlayer(player);
    }
  }
  
  private getMatchFromId(matchId: number): Match {
    return this._runningMatches.find(match => match.id == matchId);
  }

  private getPlayerFromSocketId(socketId: string): MatchPlayer {
    let player = this.socketToPlayerMap.get(socketId);
    if (!player) {
      player = new MatchPlayer(socketId);
      this.socketToPlayerMap.set(socketId, player);
    }
    return player;
  }

  private destroyPlayer(player: MatchPlayer) {
    this.socketToPlayerMap.delete(player.socketId);
  }

  private runMatchmaking(server, triggeringSocket) {
    console.log('Running matchmaking.');
    const clientsInMatchmaking = server.in(MatchServer.MATCHMAKING_ROOM).clients;
    server.to(MatchServer.MATCHMAKING_ROOM).emit('matchmakingUpdate', { 'playersInQueue': clientsInMatchmaking.length });

    const joinableMatch = this._runningMatches.find(match => match.isJoinable);
    if (joinableMatch) {
      console.log('Joinable match found, notifying', triggeringSocket.id);
      server.to(triggeringSocket.id).emit('matchReady', joinableMatch.serialize());
    } else {
      if (clientsInMatchmaking.length > MatchServer.MIN_PLAYERS) {
        console.log('Creating a new match.');
        const match = this.createMatch();
        server.to(MatchServer.MATCHMAKING_ROOM).emit('matchReady', match.serialize());
      } else {
        console.log('Not enough players to start a game. & No open game.');
      }
    }
  }

  private createMatch(): Match {
    const newMatch = new Match(MatchServer.MAX_PLAYERS, this.sendMatchUpdate);
    this._runningMatches.push(newMatch);
    return newMatch;
  }

  private sendMatchUpdate(match: Match) {
    this._socketServer.to(this.getMatchRoomName(match.id)).emit('matchUpdate', match.serialize());
  }
}

export default MatchServer;