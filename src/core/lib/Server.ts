import { json, urlencoded } from 'body-parser';
import express from 'express';
import { Server as HttpServer } from 'http';
import { Socket } from 'net';
import WebSocket from 'ws';

import { Handle } from '../../common';
import { pullFromArray } from './common/util';
import { isErrnoException } from './node/util';
import Node from './executors/Node';
import { Message } from './channels/Base';

import instrument from './middleware/instrument';
import unhandled from './middleware/unhandled';
import finalError from './middleware/finalError';
import resolveSuites from './middleware/resolveSuites';
import post from './middleware/post';
import filterUrl from './middleware/filterUrl';

export interface Context {
  readonly stopped: boolean;
  readonly basePath: string;
  readonly executor: Node;
  handleMessage(message: Message): Promise<any>;
}

export default class Server implements ServerProperties {
  /** Executor managing this Server */
  readonly executor!: Node;

  /** Base path to resolve file requests against */
  basePath!: string;

  /** Port to use for HTTP connections */
  port!: number;

  /**
   * If true, wait for emit handlers to complete before responding to a
   * message
   */
  runInSync!: boolean;

  /** Port to use for WebSocket connections */
  socketPort!: number;

  get stopped() {
    return !this._httpServer;
  }

  protected _app: express.Express | undefined;
  protected _httpServer: HttpServer | undefined;
  protected _sessions:
    | { [id: string]: { listeners: ServerListener[] } }
    | undefined;
  protected _wsServer: WebSocket.Server | undefined;

  constructor(options: ServerOptions) {
    Object.assign(
      this,
      {
        basePath: '.',
        runInSync: false
      },
      options
    );
  }

  start() {
    let startupError: Error;
    let wsServer: WebSocket.Server;
    let httpServer: HttpServer;

    return new Promise<void>((resolve, reject) => {
      const app = (this._app = express());
      this._sessions = {};

      this.executor.log(
        'Listening for WebSocket connections on port',
        this.socketPort
      );

      wsServer = new WebSocket.Server({ port: this.socketPort });
      wsServer.on('connection', client => {
        this.executor.log('WebSocket connection opened:', client);
        this._handleWebSocket(client);
      });
      wsServer.on('error', error => {
        if (isErrnoException(error) && error.code === 'EADDRINUSE') {
          const err: NodeJS.ErrnoException = new Error(
            `Something is already listening on the websocket server port (${this.socketPort})`
          );
          err.code = error.code;
          err.errno = error.errno;
          reject(err);
        } else if (!this._wsServer) {
          reject(error);
        } else {
          this.executor.emit('error', error);
        }
      });

      const context = Object.create(null, {
        stopped: {
          enumerable: true,
          get: () => this.stopped
        },
        basePath: {
          enumerable: true,
          get: () => this.basePath
        },
        executor: {
          enumerable: true,
          get: () => this.executor
        },
        handleMessage: {
          enumerable: false,
          writable: false,
          configurable: false,
          value: (message: Message) => this._handleMessage(message)
        }
      });

      // Add "intern" object to both request and response objects
      Object.defineProperty(app.request, 'intern', {
        enumerable: true,
        get: () => context
      });
      Object.defineProperty(app.response, 'intern', {
        enumerable: true,
        get: () => context
      });

      app.use(filterUrl());

      // Handle JSON and form-encoded request bodies
      app.use(json({ limit: '1mb' }), urlencoded({ extended: true }));

      // Log all requests
      app.use((request, _response, next) => {
        this.executor.log(`${request.method} request for ${request.url}`);
        return next();
      });

      const internPath = this.executor.config.internPath;

      // Allow resolution using both __intern and node_modules/intern.
      // Note that internPath will always end with a '/'.
      app.use(
        [`/${internPath}__resolveSuites__`, '/__intern/__resolveSuites__'],
        resolveSuites(context)
      );

      // Map __intern to config.internPath
      app.use('/__intern', express.static(internPath, { fallthrough: false }));

      // TODO: Allow user to add middleware here

      app.use(
        instrument(context),
        express.static(this.basePath),
        post(context),
        unhandled(),
        finalError()
      );

      httpServer = app.listen(this.port, resolve);
      httpServer.on('error', error => {
        if (isErrnoException(error) && error.code === 'EADDRINUSE') {
          const err: NodeJS.ErrnoException = new Error(
            `Something is already listening on the server port (${this.port})`
          );
          err.code = error.code;
          err.errno = error.errno;
          reject(err);
        } else if (!this._httpServer) {
          reject(error);
        } else {
          this.executor.emit('error', error);
        }
      });

      const sockets: Socket[] = [];

      // If sockets are not manually destroyed then Node.js will keep
      // itself running until they all expire
      httpServer.on('close', () => {
        let socket: Socket | undefined;
        while ((socket = sockets.pop())) {
          socket.destroy();
        }
      });

      httpServer.on('connection', socket => {
        sockets.push(socket);
        this.executor.log(
          'HTTP connection opened,',
          sockets.length,
          'open connections'
        );

        socket.on('close', () => {
          let index = sockets.indexOf(socket);
          index !== -1 && sockets.splice(index, 1);
          this.executor.log(
            'HTTP connection closed,',
            sockets.length,
            'open connections'
          );
        });
      });
    })
      .then(() => {
        this._wsServer = wsServer;
        this._httpServer = httpServer;
      })
      .catch(error => {
        startupError = error;
        try {
          wsServer.close();
        } catch (_error) {}
        try {
          httpServer.close();
        } catch (_error) {}
      })
      .then(() => {
        if (startupError) {
          throw startupError;
        }
      });
  }

  stop() {
    this.executor.log('Stopping server...');
    const promises: Promise<any>[] = [];

    if (this._app && this._httpServer) {
      promises.push(
        new Promise(resolve => {
          this._httpServer!.close(resolve);
        }).then(() => {
          this.executor.log('Stopped http server');
          this._app = this._httpServer = undefined;
        })
      );
    }

    if (this._wsServer) {
      promises.push(
        new Promise(resolve => {
          this._wsServer!.close(resolve);
        }).then(() => {
          this.executor.log('Stopped ws server');
          this._wsServer = undefined;
        })
      );
    }

    return Promise.all(promises);
  }

  /**
   * Listen for all events for a specific session
   */
  subscribe(sessionId: string, listener: ServerListener): Handle {
    const listeners = this._getSession(sessionId).listeners;
    listeners.push(listener);
    return {
      destroy: function(this: any) {
        this.destroy = function() {};
        pullFromArray(listeners, listener);
      }
    };
  }

  private _getSession(sessionId: string) {
    let session = this._sessions![sessionId];
    if (!session) {
      session = this._sessions![sessionId] = { listeners: [] };
    }
    return session;
  }

  private _handleMessage(message: Message): Promise<any> {
    this.executor.log(
      'Processing message [',
      message.id,
      '] for ',
      message.sessionId,
      ': ',
      message.name
    );

    const promise = this._publish(message);
    if (getShouldWait(this.runInSync, message)) {
      return promise;
    }

    // If we're not returning the promise, catch any errors to avoid
    // unhandled rejections
    promise.catch(error => {
      this.executor.emit('error', error);
    });

    return resolvedPromise;
  }

  private _handleWebSocket(client: WebSocket) {
    client.on('message', data => {
      this.executor.log('Received WebSocket message');
      const message: Message = JSON.parse(data.toString());
      this._handleMessage(message)
        .catch(error => this.executor.emit('error', error))
        .then(() => {
          this.executor.log('Sending ack for [', message.id, ']');
          client.send(JSON.stringify({ id: message.id }), error => {
            if (error) {
              this.executor.emit(
                'error',
                new Error(
                  `Error sending ack for [ ${message.id} ]: ${error.message}`
                )
              );
            }
          });
        });
    });

    client.on('error', error => {
      this.executor.log('WebSocket client error:', error);
      this.executor.emit('error', error);
    });
  }

  private _publish(message: Message) {
    const listeners = this._getSession(message.sessionId).listeners;
    return Promise.all(
      listeners.map(listener => listener(message.name, message.data))
    );
  }
}

export interface ServerProperties {
  basePath: string;
  executor: Node;
  port: number;
  runInSync: boolean;
  socketPort: number;
}

export interface ServerListener {
  (name: string, data?: any): void;
}

export type ServerOptions = Partial<ServerProperties> & { executor: Node };

const resolvedPromise = Promise.resolve();

/**
 * Indicate whether Server should wait for an event to process before sending an
 * acknowlegement.
 */
function getShouldWait(waitMode: string | boolean, message: Message) {
  let eventName = message.name;

  // never wait for runEnd
  if (eventName === 'runEnd') {
    return false;
  }

  let shouldWait = false;

  if (waitMode === 'fail') {
    if (
      (eventName === 'testEnd' && message.data.error) ||
      (eventName === 'suiteEnd' && message.data.error) ||
      eventName === 'error'
    ) {
      shouldWait = true;
    }
  } else if (waitMode === true) {
    shouldWait = true;
  } else if (Array.isArray(waitMode) && waitMode.indexOf(eventName) !== -1) {
    shouldWait = true;
  }

  return shouldWait;
}
