import { RemoteEvents } from './RemoteSuite';
import WebSocketChannel from './channels/WebSocket';
import HttpChannel from './channels/Http';
import BaseChannel, { ChannelOptions } from './channels/Base';

export { ChannelOptions };

export default class Channel {
  readonly options: ChannelOptions;

  private _channel!: BaseChannel;
  private _initialized!: Promise<void>;

  constructor(options: ChannelOptions) {
    this.options = options;
  }

  sendMessage(name: keyof RemoteEvents, data: any) {
    return this._initialize().then(() => {
      return this._channel.sendMessage(name, data);
    });
  }

  protected _initialize() {
    if (!this._initialized) {
      this._initialized = new Promise<void>(resolve => {
        if (this.options.port) {
          try {
            this._channel = new WebSocketChannel(this.options);
            this._channel.sendMessage('remoteStatus', 'ping').then(
              () => {
                resolve();
              },
              _error => {
                this._channel = new HttpChannel(this.options);
                resolve();
              }
            );
          } catch (error) {
            this._channel = new HttpChannel(this.options);
            resolve();
          }
        } else {
          this._channel = new HttpChannel(this.options);
          resolve();
        }
      });
    }

    return this._initialized;
  }
}
