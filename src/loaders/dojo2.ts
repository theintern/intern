/// <reference types="@dojo/loader/interfaces"/>

/**
 * A loader script for setting up the Dojo loader.
 *
 * Note that loader scripts must be simple scripts, not modules.
 */
intern.registerLoader(options => {
  const globalObj: any = typeof window !== 'undefined' ? window : global;
  const {
    internLoaderPath = 'node_modules/@dojo/loader/loader.js',
    ...loaderConfig
  } = options;

  return intern.loadScript(internLoaderPath).then(() => {
    const require: DojoLoader.RootRequire = globalObj.require;
    intern.log('Using Dojo 2 loader');

    loaderConfig.baseUrl = loaderConfig.baseUrl || intern.config.basePath;
    intern.log('Configuring loader with:', loaderConfig);
    require.config(loaderConfig);

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
