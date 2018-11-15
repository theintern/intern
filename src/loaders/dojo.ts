/**
 * A loader script for setting up the Dojo loader.
 *
 * Note that loader scripts must be simple scripts, not modules.
 */
intern.registerLoader(options => {
  const globalObj: any = typeof window !== 'undefined' ? window : global;

  options.baseUrl = options.baseUrl || intern.config.basePath;
  if (!('async' in options)) {
    options.async = true;
  }

  options.has = {
    'dojo-timeout-api': true,
    ...options.has
  };

  intern.log('Configuring Dojo loader with:', options);
  globalObj.dojoConfig = options;

  return intern.loadScript('node_modules/dojo/dojo.js').then(() => {
    const require = globalObj.require;
    intern.log('Using Dojo loader');

    return (modules: string[]) => {
      let handle: { remove(): void };

      return new Promise((resolve, reject) => {
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
        error => {
          handle && handle.remove();
          throw error;
        }
      );
    };
  });
});
