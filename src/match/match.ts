import MatchPlayer from '../player/matchPlayer'
import Elimination from './elimination';
import SerializedMatch from './serializedMatch'
import SerializedMatchPlayer from '../player/serializedMatchPlayer'
import ConnectionStatus from '../player/connectionStatus';
import PlayStatus from '../player/playStatus';
import ScoreboardStatus from '../player/scoreboardStatus';
import PlayerUpdate from '../player/playerUpdate';


const partialPlayerArraySort = (array: Array<MatchPlayer>, start: number, end: number, compareFunction: (a: MatchPlayer, b: MatchPlayer) => number) => {
  const preSorted = array.slice(0, start), postSorted = array.slice(end);
  const sorted = array.slice(start, end).sort(compareFunction);
  array.length = 0;
  array.push.apply(array, preSorted.concat(sorted).concat(postSorted));
  return array;
}

const movePlayerWithinArray = (array: Array<MatchPlayer>, oldIndex: number, newIndex: number) => {
  while (oldIndex < 0) {
      oldIndex += array.length;
  }
  while (newIndex < 0) {
      newIndex += array.length;
  }
  if (newIndex >= array.length) {
      var k = newIndex - array.length + 1;
      while (k--) {
          array.push(undefined);
      }
  }
  array.splice(newIndex, 0, array.splice(oldIndex, 1)[0]);
  return array;
};

class Match {
  private static nextMatchId: number = 1000;
  private static startTimeOffset: number = 20;
  private _id: number;
  private players: MatchPlayer[];
  private maxPlayers: number;
  private startTime: Date;
  private joinUntil: Date;
  private nextElimination: Elimination;
  private _sendDataToPlayers: Function;
  private sendDataQueued: Boolean;
  private nextEliminationTimeout: number;

  public get id(): number {
    return this._id;
  }

  private static getFutureDate(secondOffset: number) {
    return new Date(Date.now() + 1000 * secondOffset);
  }

  constructor(maxPlayers: number, sendDataToPlayers: Function) {
    this._id = Match.nextMatchId++;
    this.players = [];
    this.maxPlayers = maxPlayers;
    this.sendDataQueued = false;
    this._sendDataToPlayers = sendDataToPlayers;
    this.startTime = Match.getFutureDate(Match.startTimeOffset); // start match in 1 minute
    this.joinUntil = Match.getFutureDate(Match.startTimeOffset * 0.75); // join within 45 seconds
    this.generateNextElimination(Match.startTimeOffset);
    setInterval(this.sendDataToPlayersIfQueued.bind(this), 200);
  }

  public get isActive(): boolean {
    return this.players.every(player => player.connectionStatus !== ConnectionStatus.Connected);
  }
  
  public get isJoinable() {
    return this.joinUntil > new Date() && this.players.length < this.maxPlayers;
  }

  public addPlayer(player: MatchPlayer): boolean {
    if (this.isJoinable) {
      this.players.push(player);
      player.currentMatch = this;
      this.queueSendDataToPlayers();
      return true;
    } else {
      return false;
    }
  }

  private sendDataToPlayersIfQueued() {
    if (this.sendDataQueued) {
      this.sendDataQueued = false;
      this._sendDataToPlayers(this);
    }
  }

  private queueSendDataToPlayers() {
    this.sendDataQueued = true;
  }
  
  private calculatePlacements() {
    const lowestPlayingPlayerIndex = this.players.findIndex(p => p.playStatus == PlayStatus.Eliminated);
    partialPlayerArraySort(this.players, 0, lowestPlayingPlayerIndex, (a, b) => b.points - a.points);
    let placement = 1;
    for (let player of this.players) {
      if (placement <= Math.max(lowestPlayingPlayerIndex - this.nextElimination.playerAmount, 1) || placement > lowestPlayingPlayerIndex) {
        player.scoreboardStatus = ScoreboardStatus.Regular;
      } else if (placement <= lowestPlayingPlayerIndex) {
        player.scoreboardStatus = ScoreboardStatus.Endangered;
      } 
      player.placement = placement++;
    }
  }

  public receivePlayerUpdate(playerUpdate: PlayerUpdate) {
    const player = this.players.find(p => p.socketId == playerUpdate.socketId);
    if (!player) {
      console.error('could not find player for received playerupdate. socektid:', playerUpdate.socketId);
    }
    player.points = playerUpdate.points;
    if (playerUpdate.field) {
      player.field = playerUpdate.field;
    }
    this.calculatePlacements();
    this.queueSendDataToPlayers();
  }
  
  public serialize(): SerializedMatch {
    const serializedMatchPlayers = this.players.map((p: MatchPlayer) => {
      return { 
        displayName: p.displayName,
        socketId: p.socketId,
        points: p.points,
        placement: p.placement,
        connectionStatus: p.connectionStatus,
        scoreboardStatus: p.scoreboardStatus,
        playStatus: p.playStatus,
        field: p.field 
      };
    });

    return {
      id: this.id,
      players: serializedMatchPlayers,
      startTime: this.startTime,
      joinUntil: this.joinUntil,
      nextElimination: this.nextElimination.time,
    }
  }

  public determinePlacement(player: MatchPlayer) {
    const lowestPlayingPlayerIndex = this.players.findIndex(p => p.playStatus == PlayStatus.Eliminated);
    movePlayerWithinArray(this.players, this.players.findIndex(p => p === player), lowestPlayingPlayerIndex - 1);
    this.calculatePlacements();
    this.checkForWinner();
  }

  private generateNextElimination(eliminationOffset: number = 0) {
    const firstTimer = 60;
    const lastTimer = 10;
    const remainingPlayers = this.players.filter(p => p.playStatus == PlayStatus.Playing);
    const t = 1 - remainingPlayers.length / this.maxPlayers;
    const timeUntilElimination = firstTimer * (1 - t) + lastTimer * t;
    const playerAmount = Math.max(1, remainingPlayers.length * 0.1);

    const timeUntilEliminationWithOffset = timeUntilElimination + eliminationOffset;
    this.nextElimination = { playerAmount, time: Match.getFutureDate(timeUntilEliminationWithOffset) };
    this.nextEliminationTimeout = setTimeout(this.executeElimination.bind(this), timeUntilEliminationWithOffset * 1000);

    this.queueSendDataToPlayers();
  }
  
  private checkForWinner() {
    const remainingPlayers = this.players.filter(p => p.playStatus == PlayStatus.Playing);

    if (remainingPlayers.length == 1) {
      remainingPlayers[0].playStatus = PlayStatus.Won;
      clearTimeout(this.nextEliminationTimeout);
    }
    this.queueSendDataToPlayers();
  }

  private executeElimination() {
    const remainingPlayers = this.players.filter(p => p.playStatus == PlayStatus.Playing);
    const placementCutoff = Math.max(remainingPlayers.length - this.nextElimination.playerAmount, 1);

    let lastElimination = false;
    if (placementCutoff == 1) {
      lastElimination = true;
    }

    for (let player of this.players) {
      if (player.placement < placementCutoff) {
        player.playStatus = PlayStatus.Eliminated;
        player.scoreboardStatus = ScoreboardStatus.Regular;
      }
      if (lastElimination && player.placement == 1) {
        player.playStatus = PlayStatus.Won;
      }
    }

    if (!lastElimination) {
      this.generateNextElimination();
    } else {
      this.queueSendDataToPlayers();
    }
  }
}

export default Match;