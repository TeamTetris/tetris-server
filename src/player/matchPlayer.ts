import ConnectionStatus from './connectionStatus'
import ScoreboardStatus from './scoreboardStatus'
import PlayStatus from './playStatus'
import Match from '../match/match';

class MatchPlayer {
  public displayName: string;
  private _socketId: string;
  public points: number;
  public placement: number;
  public connectionStatus: ConnectionStatus;
  public scoreboardStatus: ScoreboardStatus;
  public playStatus: PlayStatus;
  public field: Object;
  public currentMatch: Match;


  public get socketId(): string {
    return this._socketId;
  }

  constructor(socketId: string) {
    this.displayName = 'player';
    this._socketId = socketId;
    this.points = 0;
    this.placement = -1;
    this.connectionStatus = ConnectionStatus.Connected; // TODO: implement connecting state?
    this.scoreboardStatus = ScoreboardStatus.Regular;
    this.playStatus = PlayStatus.Playing;
  }

  public flagAsDisconnected() {
    this.playStatus = PlayStatus.Eliminated; 
    this.connectionStatus = ConnectionStatus.Disconnected;
    this.currentMatch.determinePlacement(this);
  }

  public flagAsSelfEliminated() {
    this.playStatus = PlayStatus.Eliminated; 
    this.currentMatch.determinePlacement(this);
  }
}

export default MatchPlayer;