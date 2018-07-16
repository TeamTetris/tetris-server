import MatchPlayer from './player/player'
import Elimination from './elimination';
import SerializedMatch from './serializedMatch'
import ConnectionStatus from './player/connectionStatus';

class Match {
  private static nextMatchId: number = 1000;
  private _id: number;
  private players: Array<MatchPlayer>;
  private maxPlayers: number;
  private startTime: Date;
  private joinUntil: Date;
  private eliminations: Array<Elimination>; 

  public get id(): number {
    return this._id;
  }

  private static generateEliminations(playerAmount: number): Array<Elimination> {
    const result = [];
    const firstTime = 60;
    const lastTime = 10;
    for (let i = 0; i < playerAmount - 1; i++) {
      const t = i / (playerAmount - 2);
      const time = firstTime * (1 - t) + lastTime * t;
      const timeRounded = Math.round(time / 5) * 5;
      result.push({ playerAmount: 1, timeInSeconds: timeRounded });
    }
    return result;
  }

  private static getFutureDate(minuteOffset: number) {
    return new Date(Date.now() + 1000 * 60 * minuteOffset)
  }

  constructor(maxPlayers: number) {
    this._id = Match.nextMatchId++;
    this.players = [];
    this.maxPlayers = maxPlayers;
    this.startTime = Match.getFutureDate(1); // start match in 1 minute
    this.joinUntil = Match.getFutureDate(0.75); // join within 45 seconds
    this.eliminations = Match.generateEliminations(maxPlayers);
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
      return true;
    } else {
      return false;
    }
  }

  public serialize(): SerializedMatch {
    return {
      id: this.id,
      players: this.players,
      maxPlayers: this.maxPlayers,
      startTime: this.startTime,
      joinUntil: this.joinUntil,
      eliminations: this.eliminations,
    }
  }
}

export default Match;