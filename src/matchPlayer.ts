enum ConnectionStatus {
  Connected,
  Disconnected
}

enum ScoreboardStatus {
  Regular,
  Endangered,
  Spotlighted
}

enum PlayStatus {
  Playing,
  Finished
}

class MatchPlayer {
  public displayName: string;
  public userId: string;
  public points: number;
  public placement: number;
  public connectionStatus: ConnectionStatus;
  public scoreboardStatus: ScoreboardStatus;
  public playStatus: PlayStatus;

  constructor() {

  }
}
