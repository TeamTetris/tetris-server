import MatchPlayer from './player/matchPlayer'
import Elimination from './elimination';

interface SerializedMatch {
  id: number;
  players: Array<MatchPlayer>;
  maxPlayers: number;
  startTime: Date;
  joinUntil: Date;
  eliminations: Array<Elimination>; 
}

export default SerializedMatch;