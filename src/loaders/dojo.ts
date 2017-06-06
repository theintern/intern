/**
 * A loader script for setting up the Dojo loader.
 *
 * Note that loader scripts must be simple scripts, not modules.
 */
intern.registerLoader(config => {
	const globalObj: any = typeof window !== 'undefined' ? window : global;

	config.baseUrl = config.baseUrl || intern.config.basePath;
	if (!('async' in config)) {
		config.async = true;
	}

	intern.log('Configuring Dojo loader with:', config);
	globalObj.dojoConfig = config;

	return intern.loadScript('node_modules/dojo/dojo.js').then(() => {
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
				require(modules, () => { resolve(); });
			}).then(
				() => { handle.remove(); },
				error => {
					handle && handle.remove();
					throw error;
				}
			);
		};
	});
});
