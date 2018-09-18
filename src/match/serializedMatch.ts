import SerializedMatchPlayer from '../player/serializedMatchPlayer'

interface SerializedMatch {
  id: number;
  currentServerTime: Date;
  players: SerializedMatchPlayer[];
  startTime: Date;
  joinUntil: Date;
  nextElimination: Date;
}

export default SerializedMatch;