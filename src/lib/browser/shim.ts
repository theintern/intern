// Intern and its supporting libraries use Object.assign
import 'core-js/features/object/assign';

// @theintern/common requires `forEach` for typed arrays
import 'core-js/features/typed-array';

// The HTML reporter uses URLSearchParams
import 'url-search-params-polyfill';

// We can't use @theintern/common's global here because loading
// @theintern/common also loads common/Evented, which requires Map
const global = <any>window;

// Polyfill promise if no global Promise is defined. Manage polyfill
// installation manually to ensure native Promises aren't replaced
// unintentionallyo
if (typeof global.Promise === 'undefined') {
  global.Promise = require('core-js-pure/features/promise');
}

// Polyfill map if no global Map is defined.
if (typeof global.Map === 'undefined') {
  global.Map = require('core-js-pure/features/map');
}

// Polyfill Symbol if no global Symbol is defined.
if (typeof global.Symbol === 'undefined') {
  global.Symbol = require('core-js-pure/features/symbol');
}

// Polyfill Set if no global Set is defined.
if (typeof global.Set === 'undefined') {
  global.Set = require('core-js-pure/features/set');
}
