import { Task, CancellablePromise, global } from '@theintern/common';

import BaseChannel, { ChannelOptions, Message } from './Base';
import { parseUrl } from '../browser/util';

export default class WebSocketChannel extends BaseChannel {
  /** Time to wait for response before rejecting a send */
  timeout!: number;

  protected _socket: WebSocket;
  protected _sendQueue: {
    [key: string]:
      | { resolve: (value: any) => void; reject: (error: Error) => void }
      | undefined;
  };
  protected _ready: CancellablePromise<any>;
  protected _sequence: number;

  constructor(options: ChannelOptions) {
    super(options);
    this.timeout = 10000;
    if (options.timeout !== undefined) {
      this.timeout = options.timeout;
    }

    if (!options.port) {
      throw new Error('A port is required for a WebSocket channel');
    }

    const url = parseUrl(options.url);
    const host = url!.hostname;
    const protocol = url!.protocol === 'https' ? 'wss' : 'ws';
    this._socket = new global.WebSocket(
      `${protocol}://${host}:${options.port}`
    );

    this._ready = new Task((resolve, reject) => {
      this._socket.addEventListener('open', resolve);
      this._socket.addEventListener('error', reject);
    });

    this._socket.addEventListener('message', event => {
      this._handleMessage(JSON.parse(event.data));
    });

    this._socket.addEventListener('error', _event => {
      this._handleError(new Error('WebSocket error'));
    });

    this._sendQueue = Object.create(null);
    this._sequence = 1;
  }

  protected _sendData(name: string, data: any) {
    return this._ready.then(
      () =>
        new Task<void>((resolve, reject) => {
          const id = String(this._sequence++);
          const sessionId = this.sessionId;
          const message: Message = { id, sessionId, name, data };

          this._socket.send(JSON.stringify(message));

          const timer = setTimeout(() => {
            reject(new Error('Send timed out'));
          }, this.timeout);

          this._sendQueue[id] = {
            resolve(data: any) {
              clearTimeout(timer);
              resolve(data);
            },
            reject(error: Error) {
              reject(error);
            }
          };
        })
    );
  }

  protected _handleMessage(message: any) {
    const id = message.id;
    this._sendQueue[id]!.resolve(message);
    this._sendQueue[id] = undefined;
  }

  protected _handleError(error: Error) {
    // Make the _ready task a reject to reject future _sendData calls
    this._ready = Task.reject(error);

    // Reject any open sends
    Object.keys(this._sendQueue)
      .filter(id => this._sendQueue[id] != null)
      .forEach(id => {
        this._sendQueue[id]!.reject(error);
        this._sendQueue[id] = undefined;
      });
  }
}
