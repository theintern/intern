import * as nodeUtil from 'util';
import * as util from './util';
import { Tests } from 'src/core/lib/interfaces/object';

import Tunnel, { IOEvent, NormalizedEnvironment } from 'src/tunnels/Tunnel';
import { createCompositeHandle, Handle } from 'src/common';

function writeIOEvent(event: IOEvent) {
  process.stdout.write(event.data);
}

function addVerboseListeners(tunnel: Tunnel) {
  return createCompositeHandle(
    tunnel.on('stdout', writeIOEvent),
    tunnel.on(
      'stderr',
      writeIOEvent
    ) /*,
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
  return /\S+:\S+/.test(tunnel.auth!);
}

function getCleanup(tunnel: Tunnel, handle?: Handle) {
  return () => {
    if (handle) {
      handle.destroy();
    }
    return util.cleanup(tunnel);
  };
}

export function addEnvironmentTest(
  suite: Tests,
  TunnelClass: typeof Tunnel,
  checkEnvironment: Function,
  options?: any
): Tests {
  options = options || {};

  return {
    ...suite,
    getEnvironments() {
      const tunnel = new TunnelClass();

      if (options.needsAuthData && !checkCredentials(tunnel, options)) {
        this.skip('missing auth data');
      }

      let handle: Handle | undefined;
      if (intern.config.debug) {
        handle = addVerboseListeners(tunnel);
      }

      const cleanup = getCleanup(tunnel, handle);
      return tunnel
        .getEnvironments()
        .then(function(environments) {
          assert.isArray(environments);
          assert.isAbove(
            environments.length,
            0,
            'Expected at least 1 environment'
          );
          environments.forEach(function(environment) {
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
        .finally(cleanup);
    }
  };
}

export function addStartStopTest(
  suite: Tests,
  TunnelClass: typeof Tunnel,
  options?: any
): Tests {
  options = options || {};

  return {
    ...suite,

    'start and stop'() {
      const tunnel = new TunnelClass();

      if (
        options.needsAuthData !== false &&
        !checkCredentials(tunnel, options)
      ) {
        this.skip('missing auth data');
      }

      let handle: Handle | undefined;
      if (intern.config.debug) {
        handle = addVerboseListeners(tunnel);
      }

      const timeout = options.timeout || 30000;
      this.async(timeout);

      const cleanup = getCleanup(tunnel, handle);
      const cleanupTimer = setTimeout(() => {
        cleanup();
      }, timeout - 5000);

      return tunnel
        .start()!
        .then(function() {
          clearTimeout(cleanupTimer);
          return tunnel.stop();
        })
        .finally(cleanup);
    }
  };
}
