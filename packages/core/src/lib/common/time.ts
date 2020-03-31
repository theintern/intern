// Take a copy of the original timer functions so that they can be safely
// stubbed in test code and not affect core functionality
const _setTimeout = setTimeout;
const _clearTimeout = clearTimeout;
const _setInterval = setInterval;
const _clearInterval = clearInterval;

// eslint-disable-next-line @typescript-eslint/unbound-method
const now = Date.now;

export {
  _setTimeout as setTimeout,
  _clearTimeout as clearTimeout,
  _setInterval as setInterval,
  _clearInterval as clearInterval,
  now
};
