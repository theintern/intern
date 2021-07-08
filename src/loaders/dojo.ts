/**
 * A loader script for setting up the Dojo loader.
 *
 * Note that loader scripts must be simple scripts, not modules.
 */
intern.registerLoader((options) => {
  const globalObj: any = typeof window !== 'undefined' ? window : global;
  const { internLoaderPath = 'node_modules/dojo/dojo.js', ...loaderConfig } =
    options;

  loaderConfig.baseUrl = loaderConfig.baseUrl || intern.config.basePath;
  if (!('async' in loaderConfig)) {
    loaderConfig.async = true;
  }

  loaderConfig.has = {
    'dojo-timeout-api': true,
    ...loaderConfig.has,
  };

  intern.log('Configuring Dojo loader with:', loaderConfig);
  globalObj.dojoConfig = loaderConfig;

  return intern.loadScript(internLoaderPath).then(() => {
    const require = globalObj.require;
    intern.log('Using Dojo loader');

    return (modules: string[]) => {
      let handle: { remove(): void };

      return new Promise<void>((resolve, reject) => {
        handle = require.on('error', (error: Error) => {
          intern.emit('error', error);
          reject(new Error(`Dojo loader error: ${error.message}`));
        });

        intern.log('Loading modules:', modules);
        require(modules, () => {
          resolve();
        });
      }).then<void>(
        () => {
          handle.remove();
        },
        (error) => {
          handle && handle.remove();
          throw error;
        }
      );
    };
  });
});
