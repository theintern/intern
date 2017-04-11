/**
 * A loader script for loading non-module JavaScript suites.
 *
 * Note that loader scripts must be simple scripts, not modules.
 */
intern.registerLoader(config => {
	intern.log('Using config:', config);
	return intern.loadScript(config.suites);
});
