import ConnectionStatus from './connectionStatus'
import ScoreboardStatus from './scoreboardStatus'
import PlayStatus from './playStatus'

class MatchPlayer {
  public displayName: string;
  private _socketId: string;
  public points: number;
  public placement: number;
  public connectionStatus: ConnectionStatus;
  public scoreboardStatus: ScoreboardStatus;
  public playStatus: PlayStatus;


  public get socketId(): string {
    return this._socketId;
  }

  constructor(socketId: string) {
    this.displayName = 'player';
    this._socketId = socketId;
    this.points = 0;
    this.placement = -1;
    this.connectionStatus = ConnectionStatus.Connecting;
    this.scoreboardStatus = ScoreboardStatus.Regular;
    this.playStatus = PlayStatus.Playing;
  }
}

export default MatchPlayer;