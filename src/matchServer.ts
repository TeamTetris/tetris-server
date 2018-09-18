import * as http from 'http';

import Match from './match/match';
import MatchPlayer from './player/matchPlayer';

interface Result {
  success: boolean,
  message: string
}

class MatchServer {
  private _socketServer: SocketIO.Server;

  private _runningMatches: Match[] = [];

  private static MATCH_ROOM_PREFIX: string = "match-";
  private static MATCHMAKING_ROOM: string = "matchmaking";
  private static MIN_PLAYERS: number = 1;
  private static MAX_PLAYERS: number = 40;

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
        socket.on('selfEliminated', () => {
          matchServer.flagPlayerAsSelfEliminated(socket);
        });

        socket.on('disconnect', function () {
          matchServer.removePlayerFromMatchmaking(socket); 
          matchServer.flagPlayerAsDisconnected(socket); 
        });

        socket.on('joinMatchmaking', () => {
          console.log('join matchmaking, socket.id:', socket.id);
          matchServer.addPlayerToMatchmaking(socket);
        });

        socket.on('leaveMatchmaking', () => {
          matchServer.removePlayerFromMatchmaking(socket);
        });

        socket.on('joinMatch', async (socketData, callback) => {
          const player = new MatchPlayer(socket.id);
          player.displayName = socketData.displayName || "default player";
          const result = await matchServer.addPlayerToMatch(socket, player, socketData.matchId);
          if (result["success"]) {
            matchServer.socketToPlayerMap.set(socket.id, player);
            matchServer.removePlayerFromMatchmaking(socket);
            callback({ success: true, match: matchServer.getMatchFromId(socketData.matchId).serialize() });
          } else {
            callback({ success: false, message: result.message });
          }
        });

        socket.on('leaveMatch', function () {
          matchServer.flagPlayerAsDisconnected(socket);
        });

        socket.on('matchUpdate', (socketData) => {
          matchServer
            .getMatchFromId(socketData.matchId)
            .receivePlayerUpdate({ socketId: socket.id, points: socketData.points, field: socketData.field });
        });
      });
    });
  }

  private isPlayerInMatchmakingQueue(socket: SocketIO.Socket): boolean {
    return socket.rooms && Object.keys(socket.rooms).indexOf(MatchServer.MATCHMAKING_ROOM) > -1;
  }

  private getJoinedMatchesOfPlayer(socket: SocketIO.Socket): Match[] {
    console.log('rooms: ',Object.keys(socket.rooms));
    return Object.keys(socket.rooms)
      .filter(b => b.indexOf(MatchServer.MATCH_ROOM_PREFIX) > -1)
      .map(matchId => this.getMatchFromId(Number.parseInt(matchId.substr(MatchServer.MATCH_ROOM_PREFIX.length))));
  }

  private isPlayerInMatch(socket): boolean {
    const matches = this.getJoinedMatchesOfPlayer(socket);
    console.log('player is in matches ', matches);
    if (matches.length > 1) {
      console.error("Player is in more than one match:", socket.id, Object.keys(socket.rooms));
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

  private addPlayerToMatchmaking(socket: SocketIO.Socket) {
    socket.join(MatchServer.MATCHMAKING_ROOM);
    this.runMatchmaking(socket);
  }

  private removePlayerFromMatchmaking(socket: SocketIO.Socket) {
    socket.leave(MatchServer.MATCHMAKING_ROOM);
  }

  private addPlayerToMatch(socket: SocketIO.Socket, player: MatchPlayer, matchId: number) {
    return new Promise<Result>((resolve) => {
      const match = this.getMatchFromId(matchId);
      if (!match) {
        resolve({ success: false, message: 'Match does not exist.' });
      }
      if (!match.isJoinable(player)) {
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

  private flagPlayerAsSelfEliminated(socket) {
    const player = this.getPlayerFromSocketId(socket.id);
    player.flagAsSelfEliminated();
  }

  private flagPlayerAsDisconnected(socket) {
    const player = this.getPlayerFromSocketId(socket.id);
    player.flagAsDisconnected();
    this.destroyPlayer(player);
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

  private getClientsInRoom(roomId: string): Promise<string[]> {
    return new Promise<string[]>((resolve) => {
      this._socketServer.in(MatchServer.MATCHMAKING_ROOM).clients((error, clients) => {
        resolve(clients);
      });
    });
  }

  private async runMatchmaking(triggeringSocket: SocketIO.Socket) {
    console.log('Running matchmaking.');
    const clientsInMatchmaking = await this.getClientsInRoom(MatchServer.MATCHMAKING_ROOM);
    console.log('clients in matchmaking: ', clientsInMatchmaking);
    this._socketServer.to(MatchServer.MATCHMAKING_ROOM).emit('matchmakingUpdate', { 'playersInQueue': clientsInMatchmaking.length });

    const joinableMatch = this._runningMatches.find(match => match.isJoinable(null));
    if (joinableMatch) {
      console.log('Joinable match found, notifying', triggeringSocket.id);
      this._socketServer.to(triggeringSocket.id).emit('matchReady', joinableMatch.serialize());
    } else {
      if (clientsInMatchmaking.length >= MatchServer.MIN_PLAYERS) {
        console.log('Creating a new match.');
        const match = this.createMatch();
        this._socketServer.to(MatchServer.MATCHMAKING_ROOM).emit('matchReady', match.serialize());
      } else {
        console.log('Not enough players to start a game. & No open game.');
      }
    }
  }

  private createMatch(): Match {
    const newMatch = new Match(MatchServer.MAX_PLAYERS, this.sendMatchUpdate.bind(this));
    this._runningMatches.push(newMatch);
    return newMatch;
  }

  private sendMatchUpdate(match: Match) {
    console.log('sendMatchUpdate ' + new Date());
    this._socketServer.to(this.getMatchRoomName(match.id)).emit('matchUpdate', match.serialize());
  }
}

export default MatchServer;