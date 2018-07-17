import MatchPlayer from './player/matchPlayer'

interface SerializedMatch {
  id: number;
  players: Array<MatchPlayer>;
  startTime: Date;
  joinUntil: Date;
  nextElimination: Date; 
}

export default SerializedMatch;