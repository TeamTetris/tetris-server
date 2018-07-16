import ConnectionStatus from './connectionStatus'
import ScoreboardStatus from './scoreboardStatus'
import PlayStatus from './playStatus'

class MatchPlayer {
  private displayName: string;
  private _socketId: string;
  private points: number;
  private placement: number;
  private _connectionStatus: ConnectionStatus;
  private scoreboardStatus: ScoreboardStatus;
  private playStatus: PlayStatus;


  public get socketId(): string {
    return this._socketId;
  }

  public get connectionStatus(): ConnectionStatus {
    return this._connectionStatus;
  }
  
  public set connectionStatus(connectionStatus: ConnectionStatus) {
    this._connectionStatus = connectionStatus;
  }

  constructor(socketId: string) {
    this.displayName = 'player';
    this._socketId = socketId;
    this.points = 0;
    this.placement = -1;
    this._connectionStatus = ConnectionStatus.Connecting;
    this.scoreboardStatus = ScoreboardStatus.Regular;
    this.playStatus = PlayStatus.Playing;
  }
}

export default MatchPlayer;