/// <reference types="systemjs"/>

/**
 * A loader script for setting up the SystemJS loader.
 *
 * Note that loader scripts must be simple scripts, not modules.
 */

intern.registerLoader(options => {
	options.baseURL = options.baseURL || intern.config.basePath;

	if (intern.environment === 'browser') {
		return intern.loadScript('node_modules/systemjs/dist/system.src.js').then(() => {
			return configAndLoad(SystemJS);
		});
	}
	else {
		const SystemJS = require('systemjs');
		return configAndLoad(SystemJS);
	}

	function configAndLoad(loader: typeof SystemJS) {
		intern.log('Using SystemJS loader');

		intern.log('Configuring SystemJS with:', options);
		loader.config(options);

		return (modules: string[]) => {
			intern.log('Loading modules with SystemJS:', modules);
			return modules.reduce((previous, suite) => {
				if (previous) {
					return previous.then(() => loader.import(suite));
				}
				return loader.import(suite);
			}, <any>null);
		};
	}
});
