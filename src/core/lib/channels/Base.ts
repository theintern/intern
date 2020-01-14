import { CancellablePromise } from '../../../common';
import { RemoteEvents } from '../RemoteSuite';

export default abstract class BaseChannel {
  readonly url: string;
  readonly sessionId: string;

  constructor(options: ChannelOptions) {
    this.url = options.url;
    this.sessionId = options.sessionId;
  }

  /**
   * Send a message, or schedule it to be sent. Return a promise that resolves
   * when the message has been sent.
   */
  sendMessage(name: keyof RemoteEvents, data: any) {
    if (data instanceof Error) {
      data = {
        name: data.name,
        message: data.message,
        stack: data.stack
      };
    }

    return this._sendData(name, data);
  }

  protected abstract _sendData(
    name: keyof RemoteEvents,
    data: any
  ): CancellablePromise<any>;
}

export interface ChannelOptions {
  sessionId: string;

  /** An HTTP URL that the testing host can be reached at */
  url: string;

  /** A websocket port */
  port?: number;

  /** A timeout for websocket responses */
  timeout?: number;
}

export function isChannel(value: any): value is BaseChannel {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.sendMessage === 'function'
  );
}

export interface ChannelOptions {
  sessionId: string;
  url: string;

  /** A WebSocket port */
  port?: number;

  /** A timeout for WebSocket responses */
  timeout?: number;
}

export interface Message {
  sessionId: string;
  id: string;
  name: string;
  data: any;
}
