import SerializedMatchPlayer from '../player/serializedMatchPlayer'

interface SerializedMatch {
  id: number;
  players: SerializedMatchPlayer[];
  startTime: Date;
  joinUntil: Date;
  nextElimination: Date; 
}

export default SerializedMatch;