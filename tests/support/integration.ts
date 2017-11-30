import * as intern from 'intern';
import * as assert from 'intern/chai!assert';
import * as nodeUtil from 'util';
import * as util from './util';
import Test = require('intern/lib/Test');

import Tunnel, { IOEvent, NormalizedEnvironment } from 'src/Tunnel';
import { createCompositeHandle } from '@dojo/core/lang';
import { Handle } from '@dojo/core/interfaces';

function writeIOEvent(event: IOEvent) {
	process.stdout.write(event.data);
}

function addVerboseListeners(tunnel: Tunnel) {
	return createCompositeHandle(
		tunnel.on('stdout', writeIOEvent),
		tunnel.on('stderr', writeIOEvent)/*,
		TODO: enable when we figure out progress events
		tunnel.on('downloadprogress', function (info) {
			process.stdout.write('.');
			if (info.loaded >= info.total) {
				process.stdout.write('\n');
			}
		})*/
	);
}

function assertNormalizedProperties(environment: NormalizedEnvironment) {
	const message = ' undefined for ' + nodeUtil.inspect(environment.descriptor);
	assert.isDefined(environment.browserName, 'browserName' + message);
	assert.isDefined(environment.version, 'version' + message);
	assert.isDefined(environment.platform, 'platform' + message);
}

function checkCredentials(tunnel: Tunnel, options: any) {
	if (options.checkCredentials) {
		return options.checkCredentials(tunnel);
	}
	return (/\S+:\S+/).test(tunnel.auth);
}

function getCleanup(tunnel: Tunnel, handle?: Handle) {
	return function () {
		if (handle) {
			handle.destroy();
		}
		return util.cleanup(tunnel);
	};
}

export function addEnvironmentTest(suite: any, TunnelClass: typeof Tunnel, checkEnvironment: Function, options?: any) {
	options = options || {};

	suite.getEnvironments = function (this: Test) {
		const tunnel = new TunnelClass();

		if (options.needsAuthData && !checkCredentials(tunnel, options)) {
			this.skip('missing auth data');
		}

		let handle: Handle | undefined;
		if (intern.args.verbose) {
			handle = addVerboseListeners(tunnel);
		}

		const cleanup = getCleanup(tunnel, handle);
		return tunnel.getEnvironments().then(function (environments) {
				assert.isArray(environments);
				assert.isAbove(environments.length, 0, 'Expected at least 1 environment');
				environments.forEach(function (environment) {
					assertNormalizedProperties(environment);
					assert.property(environment, 'descriptor');
					checkEnvironment(environment.descriptor);
				});
			})
			.then(cleanup)
			.catch(reason => {
				return cleanup().then(() => {
					throw reason;
				});
			})
			.finally(cleanup)
		;
	};
}

export function addStartStopTest(suite: any, TunnelClass: typeof Tunnel, options?: any) {
	options = options || {};

	suite['start and stop'] = function (this: Test) {
		const tunnel = new TunnelClass();

		if (options.needsAuthData !== false && !checkCredentials(tunnel, options)) {
			this.skip('missing auth data');
		}

		let handle: Handle | undefined;
		if (intern.args.verbose) {
			handle = addVerboseListeners(tunnel);
		}

		if (options.timeout) {
			this.async(options.timeout);
		}

		const cleanup = getCleanup(tunnel, handle);
		return tunnel.start()!.then(function () {
				return tunnel.stop();
			})
			.then(cleanup)
			.catch(reason => {
				return cleanup().then(() => {
					throw reason;
				});
			})
			.finally(cleanup)
		;
	};
}
