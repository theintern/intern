/// <reference types="@dojo/loader"/>

/**
 * A loader script for setting up the Dojo loader.
 *
 * Note that loader scripts must be simple scripts, not modules.
 */
intern.registerLoader((config, suites) => {
	config.baseUrl = config.baseUrl || intern.config.basePath;

	return intern.loadScript('node_modules/@dojo/loader/loader.js').then(() => {
		intern.log('Loaded dojo loader');

		const globalObj: any = typeof window !== 'undefined' ? window : global;
		const loader = globalObj.require;
		intern.log('Using loader', loader);

		return new Promise<void>((resolve, reject) => {
			loader.on('error', (error: Error) => {
				intern.emit('error', error);
				reject(error);
			});

			intern.log('Configuring loader with:', config);
			loader.config(config);

			intern.log('Loading suites:', suites);
			loader(suites, () => { resolve(); });
		});
	});
});
