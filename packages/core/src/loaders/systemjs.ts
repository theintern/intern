/// <reference types="systemjs"/>

/**
 * A loader script for setting up the SystemJS loader.
 *
 * Note that loader scripts must be simple scripts, not modules, and must use
 * IE11 compatible code (no arrow functions).
 */

intern.registerLoader(function (options) {
  options.baseURL = options.baseURL || intern.config.basePath;
  const globalObj: any = typeof window !== 'undefined' ? window : global;

  if (intern.environment === 'browser') {
    return intern
      .loadScript('node_modules/systemjs/dist/system.src.js')
      .then(function () {
        return configAndLoad(globalObj.SystemJS);
      });
  } else {
    // Use globalObj to get to require to improve testability
    const SystemJS = globalObj.require('systemjs');
    return configAndLoad(SystemJS);
  }

  function configAndLoad(loader: typeof SystemJS) {
    intern.log('Using SystemJS loader');

    intern.log('Configuring SystemJS with:', options);
    loader.config(options);

    return function (modules: string[]) {
      intern.log('Loading modules with SystemJS:', modules);
      return modules.reduce(function (previous, suite) {
        if (previous) {
          return previous.then(function () {
            return loader.import(suite);
          });
        }
        return loader.import(suite);
      }, <any>null);
    };
  }
});
