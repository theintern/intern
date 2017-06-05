/**
 * A loader script for setting up the Dojo loader.
 *
 * Note that loader scripts must be simple scripts, not modules.
 */
intern.registerLoader((config, suites) => {
	config.baseUrl = config.baseUrl || intern.config.basePath;
	if (!('async' in config)) {
		config.async = true;
	}

	const globalObj: any = typeof window !== 'undefined' ? window : global;
	intern.log('Configuring loader with:', config);
	globalObj.dojoConfig = config;

	return intern.loadScript('node_modules/dojo/dojo.js').then(() => {
		intern.log('Loaded dojo loader');

		const loader = globalObj.require;
		intern.log('Using loader', loader);

		return new Promise<void>((resolve, reject) => {
			loader.on('error', (error: Error) => {
				reject(new Error(`Dojo loader error: ${error.message}`));
			});

			intern.log('Loading suites:', suites);
			loader(suites, () => { resolve(); });
		});
	});
});
