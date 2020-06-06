/**
 * A loader script for loading non-module JavaScript suites.
 *
 * Note that loader scripts must be simple scripts, not modules.
 */
intern.registerLoader(_config => {
  intern.log('Using default loader');

  return (modules: string[]) => {
    return intern.loadScript(modules);
  };
});
