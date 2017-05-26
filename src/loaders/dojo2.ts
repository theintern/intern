/// <reference types="@dojo/loader"/>

/**
 * A loader script for setting up the Dojo loader.
 *
 * Note that loader scripts must be simple scripts, not modules.
 */
intern.registerLoader(config => {
	const loaderConfig: any = config.loader.config || {};
	loaderConfig.baseUrl = loaderConfig.baseUrl || config.basePath;

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

			intern.log('Configuring loader with:', loaderConfig);
			loader.config(loaderConfig);

			intern.log('Loading suites:', config.suites);
			loader(config.suites, () => { resolve(); });
		});
	});
});
