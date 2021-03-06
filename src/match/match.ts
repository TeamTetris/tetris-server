import MatchPlayer from '../player/matchPlayer'
import Elimination from './elimination';
import SerializedMatch from './serializedMatch'
import ConnectionStatus from '../player/connectionStatus';
import PlayStatus from '../player/playStatus';
import ScoreboardStatus from '../player/scoreboardStatus';
import PlayerUpdate from '../player/playerUpdate';

class Match {
  private static nextMatchId: number = 1000;
  private static startTimeOffset: number = 30;
  private _id: number;
  private allPlayers: MatchPlayer[];
  private playingPlayers: MatchPlayer[];
  private maxPlayers: number;
  private startTime: Date;
  private joinUntil: Date;
  private nextElimination: Elimination;
  private _sendDataToPlayers: Function;
  private sendDataQueued: Boolean;
  private nextEliminationTimeout: number;
  private nextPlacement: number;

  public get id(): number {
    return this._id;
  }

  private static getFutureDate(secondOffset: number) {
    return new Date(Date.now() + 1000 * secondOffset);
  }

  constructor(maxPlayers: number, sendDataToPlayers: Function, startTimeOffset: number = null) {
    this._id = Match.nextMatchId++;
    this.allPlayers = [];
    this.playingPlayers = [];
    this.maxPlayers = maxPlayers;
    this.sendDataQueued = false;
    this._sendDataToPlayers = sendDataToPlayers;
    this.setRemainingPreGameTime(startTimeOffset || Match.startTimeOffset)
    setInterval(this.sendDataToPlayersIfQueued.bind(this), 200);
  }

  public get isActive(): boolean {
    return this.allPlayers.every(player => player.connectionStatus !== ConnectionStatus.Connected);
  }
  
  public isJoinable(): boolean {
    return this.joinUntil > new Date() && this.allPlayers.length < this.maxPlayers;
  }

  private removePlayer(player: MatchPlayer): void {
    this.allPlayers.splice(this.allPlayers.findIndex(p => p == player), 1);
    this.playingPlayers.splice(this.playingPlayers.findIndex(p => p == player), 1);
    this.queueSendDataToPlayers();
  }

  public addPlayer(player: MatchPlayer): boolean {
    if (this.isJoinable()) {
      const identicalPlayers = this.allPlayers.filter(p => p.socketId == player.socketId);
      identicalPlayers.forEach(this.removePlayer.bind(this));
      this.allPlayers.push(player);
      this.playingPlayers.push(player);
      this.calculatePlacements();
      player.currentMatch = this;
      this.queueSendDataToPlayers();
      return true;
    } else {
      return false;
    }
  }

  public setRemainingPreGameTime(time: number) {
    clearTimeout(this.nextEliminationTimeout);
    this.startTime = Match.getFutureDate(time); 
    this.joinUntil = Match.getFutureDate(time * 0.8);
    this.nextEliminationTimeout = setTimeout(this.generateNextElimination.bind(this), time * 1000);
    setTimeout(this.calculatePlacements.bind(this), time * 1000 + 100);
    this.queueSendDataToPlayers();
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
  
  private filterPlayingPlayers() {
    this.playingPlayers = this.playingPlayers.filter(p => p.playStatus === PlayStatus.Playing);
  }

  private calculatePlacements() {
    this.filterPlayingPlayers();
    this.playingPlayers.sort((a, b) => (b.points - a.points) + 0.0001 * a.displayName.localeCompare(b.displayName));
    for (let i = 0; i < this.playingPlayers.length; i++) {
      this.playingPlayers[i].placement = i + 1;
      if (this.nextElimination && this.nextElimination.time > new Date() && this.playingPlayers[i].placement > this.playingPlayers.length - this.nextElimination.playerAmount) {
        this.playingPlayers[i].scoreboardStatus = ScoreboardStatus.Endangered;
      } else {
        this.playingPlayers[i].scoreboardStatus = ScoreboardStatus.Regular;
      }
    }
    this.allPlayers.sort((a, b) => a.placement - b.placement);
  }

  public receivePlayerUpdate(playerUpdate: PlayerUpdate) {
    const player = this.allPlayers.find(p => p.socketId == playerUpdate.socketId);
    if (!player) {
      console.error('could not find player for received playerupdate. socketId:', playerUpdate.socketId);
      return;
    }
    const pointsChanged = player.points !== playerUpdate.points;
    player.points = playerUpdate.points;
    if (playerUpdate.field) {
      player.field = playerUpdate.field;
    }
    if (pointsChanged) {
      this.calculatePlacements();
    }
    this.queueSendDataToPlayers();
  }
  
  public serialize(): SerializedMatch {
    const serializedMatchPlayers = this.allPlayers.map((p: MatchPlayer) => {
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
      currentServerTime: new Date(),
      players: serializedMatchPlayers,
      startTime: this.startTime,
      joinUntil: this.joinUntil,
      nextElimination: this.nextElimination ? this.nextElimination.time : null,
    }
  }

  public determinePlacement(player: MatchPlayer, playStatus: PlayStatus) {
    if (this.startTime > new Date()) {
      this.removePlayer(player);
      this.calculatePlacements();
      return;
    }
    if (player.playStatus === PlayStatus.Playing) {
      if (!this.nextPlacement) {
        this.nextPlacement = this.playingPlayers.length;
      }
      player.placement = this.nextPlacement--;
      this.playingPlayers.splice(this.playingPlayers.findIndex(p => p == player), 1);
      player.playStatus = playStatus;
    }
    this.calculatePlacements();
    this.checkForWinner();
  }

  private generateNextElimination(eliminationOffset: number = 0) {
    const remainingPlayers = this.allPlayers.filter(p => p.playStatus == PlayStatus.Playing);
    const timeUntilElimination = 30;
    const playerAmount = Math.max(1, Math.floor(remainingPlayers.length * 0.1));

    const timeUntilEliminationWithOffset = timeUntilElimination + eliminationOffset;
    this.nextElimination = { playerAmount, time: Match.getFutureDate(timeUntilEliminationWithOffset) };
    this.nextEliminationTimeout = setTimeout(this.executeElimination.bind(this), timeUntilEliminationWithOffset * 1000);

    this.queueSendDataToPlayers();
  }
  
  private checkForWinner() {
    if (this.playingPlayers.length == 1) {
      this.playingPlayers[0].playStatus = PlayStatus.Won;
      this.playingPlayers[0].scoreboardStatus = ScoreboardStatus.Regular;
      clearTimeout(this.nextEliminationTimeout);
      this.queueSendDataToPlayers();
    }
  }

  private executeElimination() {
    const remainingPlayers = this.allPlayers.filter(p => p.playStatus == PlayStatus.Playing);
    const placementCutoff = Math.max(remainingPlayers.length - this.nextElimination.playerAmount, 1);

    let lastElimination = false;
    if (placementCutoff == 1) {
      lastElimination = true;
    }

    for (let player of this.allPlayers) {
      if (player.placement > placementCutoff) {
        player.scoreboardStatus = ScoreboardStatus.Regular;
        this.determinePlacement(player, PlayStatus.Eliminated);
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