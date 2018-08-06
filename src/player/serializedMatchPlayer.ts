import ConnectionStatus from './connectionStatus'
import ScoreboardStatus from './scoreboardStatus'
import PlayStatus from './playStatus'

interface SerializedMatchPlayer {  
    displayName: string;
    socketId: string;
    points: number;
    placement: number;
    connectionStatus: ConnectionStatus;
    scoreboardStatus: ScoreboardStatus;
    playStatus: PlayStatus;
    field: Object;
}

export default SerializedMatchPlayer;