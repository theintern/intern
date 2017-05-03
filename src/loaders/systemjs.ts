/**
 * A loader script for setting up the SystemJS loader.
 *
 * Note that loader scripts must be simple scripts, not modules.
 */
intern.registerLoader(config => {
	const loaderConfig: any = config.loader.config || {};
	loaderConfig.baseURL = loaderConfig.baseURL || config.basePath;

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
		intern.log('Loaded SystemJS loader');
		intern.log('Using loader', loader);

		intern.log('Configuring loader with:', loaderConfig);
		loader.config(loaderConfig);

		intern.log('Loading suites:', config.suites);
		return config.suites.reduce((previous, suite) => {
			return previous.then(() => loader.import(suite));
		}, Promise.resolve());
	}
});
