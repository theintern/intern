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

  download(): Promise<void> {
    return Promise.resolve();
  }

  start(): Promise<void> {
    this._state = 'running';
    return Promise.resolve();
  }

  stop() {
    this._state = 'stopped';
    return Promise.resolve(0);
  }

  sendJobState(): Promise<void> {
    return Promise.resolve();
  }
}
