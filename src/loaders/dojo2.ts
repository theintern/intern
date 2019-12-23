/// <reference types="@dojo/loader/interfaces"/>

/**
 * A loader script for setting up the Dojo loader.
 *
 * Note that loader scripts must be simple scripts, not modules.
 */
intern.registerLoader(options => {
  const globalObj: any = typeof window !== 'undefined' ? window : global;
  return intern.loadScript('node_modules/@dojo/loader/loader.js').then(() => {
    const require: DojoLoader.RootRequire = globalObj.require;
    intern.log('Using Dojo 2 loader');

    options.baseUrl = options.baseUrl || intern.config.basePath;
    intern.log('Configuring loader with:', options);
    require.config(options);

    return (modules: string[]) => {
      let handle: { remove(): void };

      return new Promise((resolve, reject) => {
        handle = require.on('error', (error: Error) => {
          intern.emit('error', error);
          reject(error);
        });

        intern.log('Loading modules:', modules);
        require(modules, () => {
          resolve();
        });
      }).then<void>(
        () => {
          handle.remove();
        },
        error => {
          handle && handle.remove();
          throw error;
        }
      );
    };
  });
});
