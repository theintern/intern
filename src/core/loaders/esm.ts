import 'globals';
import Browser from '../lib/executors/Browser';

/**
 * A loader script for loading ES-module JavaScript suites in the browser.
 *
 * Note that loader scripts must be simple scripts, not modules, and must use
 * IE11 compatible code (no arrow functions).
 */
intern.registerLoader(function() {
  if (intern.environment !== 'browser') {
    throw new Error('The ESM loader only works in the browser');
  }

  intern.log('Using esm loader');

  // Declare a Browser-typed refernce to the global executor
  const internBrowser: Browser = <any>intern;

  return function(modules: string[]) {
    return internBrowser.loadScript(modules, true);
  };
});
