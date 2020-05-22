// Intern and its supporting libraries use Object.assign
import 'core-js/features/object/assign';

// @theintern/common requires `forEach` for typed arrays
import 'core-js/features/typed-array';

// The HTML reporter uses URLSearchParams
import 'core-js/features/url-search-params';

// The requests module uses URL objects
import 'core-js/features/url';

// Polyfill promise if no global Promise is defined. Manage polyfill
// installation manually to ensure native Promises aren't replaced
// unintentionallyo
if (typeof window.Promise === 'undefined') {
  require('core-js/features/promise');
}

// Polyfill Map if no global Map is defined.
if (typeof window.Map === 'undefined') {
  require('core-js/features/map');
}
