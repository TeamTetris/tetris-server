import * as socketIo from 'socket.io';
import * as express from 'express';
import * as http from 'http';
import MatchServer from './matchServer';

class Server {
  private _expressApp;
  private _httpServer: http.Server;
  private _socketServer: SocketIO.Server;
  private _matchServer: MatchServer;

  constructor () {
    this._expressApp = express();
    this._httpServer = new http.Server(this._expressApp);
    this._socketServer = socketIo.listen(this._httpServer);
    this._matchServer = new MatchServer(this._httpServer, this._socketServer);

    this._mountRoutes()
  }

  private _mountRoutes (): void {
    this._expressApp.get('/', (req, res) => {
      res.send("Server is running");
    });

    this._expressApp.get('/longgame', (req, res) => {
      this._matchServer.createMatch(300);
      res.send('success');
    });

    this._expressApp.get('/startall', (req, res) => {
      this._matchServer.startAllMatches();
      res.send('success');
    })
  }
}

new Server();