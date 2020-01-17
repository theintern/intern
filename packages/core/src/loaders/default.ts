/**
 * A loader script for loading non-module JavaScript suites.
 *
 * Note that loader scripts must be simple scripts, not modules, and must use
 * IE11 compatible code (no arrow functions).
 */
intern.registerLoader(function () {
  intern.log('Using default loader');

  return function (modules: string[]) {
    return intern.loadScript(modules);
  };
});
