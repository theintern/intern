import Task from '@dojo/core/async/Task';
import Tunnel, { TunnelOptions } from './Tunnel';
import { mixin } from '@dojo/core/lang';

/**
 * A no-op tunnel.
 */
export default class NullTunnel extends Tunnel {
	constructor(options?: TunnelOptions) {
		super(
			mixin(
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

	download() {
		return Task.resolve();
	}

	start() {
		this._state = 'running';
		return Task.resolve();
	}

	stop() {
		this._state = 'stopped';
		return Promise.resolve(0);
	}

	sendJobState() {
		return Task.resolve();
	}
}
