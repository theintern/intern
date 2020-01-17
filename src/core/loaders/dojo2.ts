/// <reference types="@dojo/loader/interfaces"/>

/**
 * A loader script for setting up the Dojo loader.
 *
 * Note that loader scripts must be simple scripts, not modules, and must use
 * IE11 compatible code (no arrow functions).
 */
intern.registerLoader(function(options) {
  const globalObj: any = typeof window !== 'undefined' ? window : global;
  return intern
    .loadScript('node_modules/@dojo/loader/loader.js')
    .then(function() {
      const require: DojoLoader.RootRequire = globalObj.require;
      intern.log('Using Dojo 2 loader');

      options.baseUrl = options.baseUrl || intern.config.basePath;
      intern.log('Configuring loader with:', options);
      require.config(options);

      return function(modules: string[]) {
        let handle: { remove(): void };

        return new Promise(function(resolve, reject) {
          handle = require.on('error', function(error: Error) {
            intern.emit('error', error);
            reject(error);
          });

          intern.log('Loading modules:', modules);
          require(modules, function() {
            resolve();
          });
        }).then<void>(
          function() {
            handle.remove();
          },
          function(error) {
            handle && handle.remove();
            throw error;
          }
        );
      };
    });
});
