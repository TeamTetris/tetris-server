import MatchPlayer from './player/matchPlayer'
import Elimination from './elimination';
import SerializedMatch from './serializedMatch'
import ConnectionStatus from './player/connectionStatus';
import PlayStatus from './player/playStatus';
import ScoreboardStatus from './player/scoreboardStatus';
import PlayerUpdate from './player/playerUpdate';

class Match {
  private static nextMatchId: number = 1000;
  private static startTimeOffset: number = 60;
  private _id: number;
  private players: MatchPlayer[];
  private maxPlayers: number;
  private startTime: Date;
  private joinUntil: Date;
  private nextElimination: Elimination;
  private _sendDataToPlayers: Function;

  public get id(): number {
    return this._id;
  }

  private static getFutureDate(secondOffset: number) {
    return new Date(Date.now() + 1000 * secondOffset)
  }

  constructor(maxPlayers: number, sendDataToPlayers: Function) {
    this._id = Match.nextMatchId++;
    this.players = [];
    this.maxPlayers = maxPlayers;
    this._sendDataToPlayers = sendDataToPlayers;
    this.startTime = Match.getFutureDate(Match.startTimeOffset); // start match in 1 minute
    this.joinUntil = Match.getFutureDate(Match.startTimeOffset * 0.75); // join within 45 seconds
    this.generateNextElimination(Match.startTimeOffset);
    setInterval(this.sendDataToPlayers.bind(this), 2500);
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
      this.sendDataToPlayers();
      return true;
    } else {
      return false;
    }
  }

  private sendDataToPlayers() {
    this._sendDataToPlayers(this);
  }

  private calculatePlacements() {
    // TODO: mark Spotlighted & Endangered
    this.players.sort((a, b) => {
      return b.points - a.points; // descending sort
    });
    let index = 1;
    for (let player of this.players) {
      player.placement = index++;
    }
  }

  public receivePlayerUpdate(playerUpdate: PlayerUpdate) {
    const player = this.players.find(p => p.socketId == playerUpdate.socketId);
    player.points = playerUpdate.points;
    if (playerUpdate.field) {
      player.field = playerUpdate.field;
    }
    this.calculatePlacements();
  }

  public serialize(): SerializedMatch {
    return {
      id: this.id,
      players: this.players,
      startTime: this.startTime,
      joinUntil: this.joinUntil,
      nextElimination: this.nextElimination.time,
    }
  }

  private generateNextElimination(eliminationOffset: number = 0) {
    const firstTime = 60;
    const lastTime = 10;
    const remainingPlayers = this.players.filter(p => p.playStatus == PlayStatus.Playing);
    const t = 1 - remainingPlayers.length / this.maxPlayers;
    const timeUntilElimination = firstTime * (1 - t) + lastTime * t;
    const playerAmount = Math.max(1, remainingPlayers.length * 0.1);

    const timeUntilEliminationWithOffset = timeUntilElimination + eliminationOffset;
    this.nextElimination = { playerAmount, time: Match.getFutureDate(timeUntilEliminationWithOffset) };

    // if (!doNotUpdatePlayers) {
    //   this.sendDataToPlayers();
    // }

    setTimeout(this.executeElimination.bind(this), timeUntilEliminationWithOffset * 1000);
  }
  
  private executeElimination() {
    const remainingPlayers = this.players.filter(p => p.playStatus == PlayStatus.Playing);
    const placementCutoff = remainingPlayers.length - this.nextElimination.playerAmount;

    let lastElimination = false;
    if (placementCutoff == 1) {
      lastElimination = true;
    }

    for (let player of this.players) {
      if (player.placement < placementCutoff) {
        player.playStatus = PlayStatus.Finished;
        player.scoreboardStatus = ScoreboardStatus.Regular;
      }
      if (lastElimination && player.placement == 1) {
        player.playStatus = PlayStatus.Finished;
      }
    }

    if (!lastElimination) {
      this.generateNextElimination();
    } else {
      // this.sendDataToPlayers();
    }
  }
}

export default Match;