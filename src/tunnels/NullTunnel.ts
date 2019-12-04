import { Task, CancellablePromise } from '../common';
import Tunnel, { TunnelProperties } from './Tunnel';

/**
 * A no-op tunnel.
 */
export default class NullTunnel extends Tunnel {
  constructor(options?: Partial<TunnelProperties>) {
    super(
      Object.assign(
        {
          auth: ''
        },
        options || {}
      )
    );
  }

  get isDownloaded() {
    return true;
  }

  download(): CancellablePromise<void> {
    return Task.resolve();
  }

  start(): CancellablePromise<void> {
    this._state = 'running';
    return Task.resolve();
  }

  stop() {
    this._state = 'stopped';
    return Promise.resolve(0);
  }

  sendJobState(): CancellablePromise<void> {
    return Task.resolve();
  }
}
