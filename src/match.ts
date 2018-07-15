
class Match {
  private static nextMatchId = 1000;
  public id: number;
  public players: Array<MatchPlayer>;
  public maxPlayers: number;
  public startTime: Date;
  public joinUntil: Date;
  public nextElimination: Date; 

  constructor(maxPlayers: number) {
    this.id = Match.nextMatchId++;
    this.players = [];
    this.maxPlayers = maxPlayers;
    this.startTime = new Date(Date.now() + 1000 * 60); // start match in 1 minute
    this.joinUntil = new Date(Date.now() + 1000 * 45); // join within 45 seconds
    this.nextElimination = new Date(Date.now() + 1000 * 120); // first elimination after 1 minute 
  }
}
  