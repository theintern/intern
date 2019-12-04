/// <reference path="globals.d.ts"/>

/**
 * A loader script for loading ES-module JavaScript suites in the browser.
 */
intern.registerLoader(_config => {
  if (intern.environment !== 'browser') {
    throw new Error('The ESM loader only works in the browser');
  }

  intern.log('Using esm loader');

  // Declare a Browser-typed refernce to the global executor
  const internBrowser: Browser = <any>intern;

  return (modules: string[]) => {
    return internBrowser.loadScript(modules, true);
  };
});
