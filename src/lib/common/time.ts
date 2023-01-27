import { global } from '@theintern/common';

// Take a copy of the original timer functions so that they can be safely
// stubbed in test code and not affect core functionality
const _setTimeout = global.setTimeout;
const _clearTimeout = global.clearTimeout;
const _setInterval = global.setInterval;
const _clearInterval = global.clearInterval;

// eslint-disable-next-line @typescript-eslint/unbound-method
const now = Date.now;

/**
 * Create a proxy function that will call a given function with a given context
 */
function createProxy<F extends (...args: any[]) => any>(func: F, context: any) {
  return (...args: Parameters<F>) => {
    return func.call(context, ...args);
  };
}

const proxySetTimeout = createProxy(_setTimeout, global);
const proxySetInterval = createProxy(_setInterval, global);
const proxyClearTimeout = createProxy(_clearTimeout, global);
const proxyClearInterval = createProxy(_clearInterval, global);
const proxyNow = createProxy(now, Date);

export {
  proxySetTimeout as setTimeout,
  proxyClearTimeout as clearTimeout,
  proxySetInterval as setInterval,
  proxyClearInterval as clearInterval,
  proxyNow as now,
};
