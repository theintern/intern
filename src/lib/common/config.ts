import { ReporterOptions } from '../reporters/Reporter';
import { BenchmarkReporterOptions } from '../reporters/Benchmark';
import { TunnelOptions } from '@theintern/digdug/Tunnel';
import { BrowserStackOptions } from '@theintern/digdug/BrowserStackTunnel';
import { SeleniumOptions } from '@theintern/digdug/SeleniumTunnel';

/**
 * This interface describes the configuration data used by Intern. Its
 * properties can be set from the command line when running the intern bin
 * script, or via an object passed to the executor's
 * [[lib/executors/Executor.Executor.configure]] method.
 */
export interface Config extends ResourceConfig {
	/**
	 * By default, Intern will run all configured tests. Setting this option
	 * to `true` will cause Intern to stop running tests after the first failure.
	 */
	bail: boolean;

	baseline: boolean;

	/**
	 * The path to the project base. This will always end with a path separator
	 * (e.g., /).
	 */
	basePath: string;

	/**
	 * This property must be set to `true` for benchmark tests to run. If it is
	 * unset or `false`, any suites registered using the benchmark interface will
	 * be ignored.
	 */
	benchmark: boolean;

	benchmarkConfig?: BenchmarkConfig;

	browser: ResourceConfig;

	/**
	 * The global variable that will be used to store coverage data
	 */
	coverageVariable: string;

	/**
	 * When set to true, Intern will emit 'log' events for many internal
	 * operations. Reporters that register for these events, such as the Runner
	 * reporter, will display them during testing.
	 */
	debug: boolean;

	/**
	 * This is the number of milliseconds that Intern will wait for an
	 * [asynchronous test](https://github.com/theintern/intern/docs/writing_tests.md#testing-asynchronous-code)
	 * to complete before timing out. A timed out test is considered to have
	 * failed.
	 */
	defaultTimeout: number;

	/** A description for this test run */
	description: string;

	/**
	 * If true, filter external library calls and runtime calls out of error
	 * stacks.
	 */
	filterErrorStack: boolean;

	/**
	 * This property is a regular expression that is used to filter which tests
	 * are run. Grep operates on test IDs. A test ID is the concatenation of a
	 * test name with all of its parent suite names. Every test ID that matches
	 * the current grep expression will be run.
	 */
	grep: RegExp;

	/**
	 * The path to Intern. This will always end with a path separator (e.g., /).
	 */
	internPath: string;

	/** A top-level name for this configuration. */
	name: string;

	node: ResourceConfig;

	/**
	 * An identifier for this test session. By default it will have the value
	 * ''.
	 */
	sessionId: string;

	/** If true, display the resolved config and exit */
	showConfig: boolean;

	/**
	 * The default capabilities for all test environments.
	 *
	 * They will be extended for each environment by values in the
	 * [`environments`](#environments) array.
	 *
	 * Cloud testing services such as BrowserStack may have unique capabilities.
	 * It’s important to use the proper capabilities for the WebDriver server or
	 * cloud service being used to run tests.
	 *
	 * * [Selenium capabilities](https://github.com/SeleniumHQ/selenium/wiki/DesiredCapabilities)
	 * * [BrowserStack capabilities](https://www.browserstack.com/automate/capabilities)
	 * * [CrossBrowserTesting capabilities](https://help.crossbrowsertesting.com/selenium-testing/automation-capabilities)
	 * * [Sauce Labs capabilities](https://wiki.saucelabs.com/display/DOCS/Test+Configuration+Options#TestConfigurationOptions-Selenium-SpecificOptions) and [environments](https://saucelabs.com/platforms)
	 * * [TestingBot capabilities](https://testingbot.com/support/other/test-options) and [environments](https://testingbot.com/support/getting-started/browsers.html)
	 *
	 * [Chrome-specific options](https://sites.google.com/a/chromium.org/chromedriver/capabilities)
	 * may be passed using a `chromeOptions` capability.
	 *
	 * Intern will automatically provide certain capabilities to provide better
	 * feedback with cloud service dashboards:
	 *
	 * * `name` will be set to the name of the test config
	 * * `build` will be set to the commit ID from the `TRAVIS_COMMIT` and
	 *   `BUILD_TAG` environment variables, if either exists
	 */
	capabilities: {
		name?: string;
		build?: string;
		[key: string]: any;
	};

	/** Time to wait for contact from a remote server */
	connectTimeout: number;

	/**
	 * An array of file paths or globs that should be instrumented for code
	 * coverage, or false to completely disable coverage.
	 *
	 * This property should point to the actual JavaScript files that will be
	 * executed, not pre-transpiled sources (coverage results will still be
	 * mapped back to original sources). Coverage data will be collected for
	 * these files even if they’re not loaded by Intern for tests, allowing a
	 * test writer to see which files _haven’t_ been tested, as well as coverage
	 * on files that were tested.
	 *
	 * When this value is unset, Intern will still look for coverage data on a
	 * global coverage variable, and it will request coverage data from remote
	 * sessions. Explicitly setting coverage to false will prevent Intern from
	 * even checking for coverage data.
	 *
	 * > 💡This property replaces the `excludeInstrumentation` property used in
	 * previous versions of Intern, which acted as a filter rather than an
	 * inclusive list.
	 */
	coverage: false | string[];

	/**
	 * The environments that will be used to run tests.
	 *
	 * Its value can be a single browser name or an environment object, or an
	 * array of these.
	 *
	 * ```js
	 * environments: 'chrome'
	 * environments: ['chrome', 'firefox']
	 * environments: { browserName: 'chrome', version: '57.0' }
	 * environments: { browserName: 'chrome', fixSessionCapabilities: false }
	 * ```
	 *
	 * The syntax for browser names and other properties depends on where tests
	 * are being run. For example, when running tests using a local Selenium
	 * server, the browser name should be the lowercase name of a locally
	 * available browser, such as ‘chrome’ or ‘firefox’, and other properties
	 * such as the platform name will generally be ignored. When running on a
	 * cloud testing service such as [Sauce Labs](https://wiki.saucelabs.com/display/DOCS/Test+Configuration+Options#TestConfigurationOptions-RequiredSeleniumTestConfigurationSettings)
	 * or [BrowserStack](https://www.browserstack.com/automate/capabilities),
	 * browser names and other properties may have different acceptable values
	 * (e.g., ‘googlechrome’ instead of ‘chrome’, or ‘MacOS’ vs ‘OSX’).
	 *
	 * The [fixSessionCapabilities](https://theintern.io/docs.html#Leadfoot/2/api/Server/fixsessioncapabilities)
	 * property determines whether feature and defect tests will be run in the
	 * remote browser. Setting it to `false` entirely disables feature tests
	 * (assuming that all features are enabled), while setting it to
	 * `'no-detect'` will set certain already-known feature and defect flags
	 * based on the browser and platform. The current set of capabilities are
	 * available on `this.remote.session.capabilities` in functional tests.
	 *
	 * > 💡Note that 'node' is an environment. If no environments are specified,
	 * the Node executor will automatically add 'node' to the resolved config.
	 * If any environments are specified, though, unit tests will only be run in
	 * this environments.
	 */
	environments: EnvironmentSpec[];

	// Deprecated; this is only here for typing
	excludeInstrumentation: never;

	/** The base URL to use for relative addresses in functional tests */
	functionalBaseUrl?: string;

	/** Whether to collect coverage data from functional tests */
	functionalCoverage: boolean;

	/**
	 * A list of paths or glob expressions that point to functional suites.
	 *
	 * Functional suites are files that register
	 * [WebDriver tests](writing_tests.md).
	 */
	functionalSuites: string[];

	/**
	 * Default timeout values for functional tests
	 *
	 *   * **find** is the time to wait for findBy commands to find an element
	 *   * **executeAsync** is the time to wait for executeAsync calls to
	 *     complete
	 *   * **pageLoad** is the time to wait for a page to finish loading
	 *     synchronous resources
	 */
	functionalTimeouts: {
		// Deprecated; this is only here for typing
		connectTimeout?: never;

		/** Time to wait for a findBy command to find a matching element */
		find?: number;

		/** Time to wait for an executeAsync to complete */
		executeAsync?: number;

		/** Time to wait for initial page load to complete */
		pageLoad?: number;
	};

	/** How often to send a heartbeat message to a remote browser, in seconds */
	heartbeatInterval?: number;

	/**
	 * An object containing options for the
	 * [Istanbul instrumenter](https://github.com/istanbuljs/istanbuljs/blob/master/packages/istanbul-lib-instrument/api.md#instrumenter).
	 */
	instrumenterOptions: { [key: string]: any };

	/**
	 * Whether to leave the remote browser open after testing.
	 *
	 * Normally when Intern runs tests on remote browsers, it shuts the browser
	 * down when testing is finished. However, you may sometimes want to inspect
	 * the state of a remote browser after tests have run, particularly if
	 * you're trying to debug why a test is failing. Setting `leaveRemoteOpen`
	 * to true will cause Intern to leave the browser open after testing.
	 * Setting it to `'fail'` will cause Intern to leave it open only if there
	 * were test failures.
	 */
	leaveRemoteOpen: boolean | 'fail';

	/**
	 * The number of concurrent remote test sessions to run at once.
	 *
	 * The default value is Infinity, meaning Intern will try to run all of its
	 * test sessions in parallel. Note that cloud testing services often limit
	 * the number of concurrent sessions they will allow to 2 or 5.
	 */
	maxConcurrency: number;

	/**
	 * A proxy that should be used for outgoing web connections. If specified,
	 * this will be used for Intern's WebDriver client instead of the Dig Dug
	 * tunnel's proxy value.
	 */
	proxy?: string;

	/**
	 * If true, a remote will wait for reponses from Intern for any executor
	 * events.
	 */
	runInSync: boolean;

	/** If true, start Intern's static test server but do not run any tests. */
	serveOnly: boolean;

	/**
	 * The port Intern's static server will listen on during functional tests.
	 */
	serverPort: number;

	/**
	 * The URL a remote should use to access Intern's static server. By default
	 * this is http://localhost:9000, but the domain or port may be different if
	 * Intern is behind a proxy.
	 */
	serverUrl: string;

	/**
	 * The port that a remote will use to access Intern's websocket server. The
	 * hostname will be the same as for serverUrl. For example, if serverPort is
	 * set to 9001 and the default serverUrl is used (http://localhost:9000),
	 * the full websocket URL will be ws://localhost:9001.
	 */
	socketPort?: number;

	/**
	 * The Dig Dug tunnel class to use for WebDriver testing.
	 *
	 * There are several built in tunnel types, and others can be added through
	 * the Node executor’s [`registerPlugin`
	 * method](./architecture.md#extension-points).
	 *
	 * The built in tunnel classes are:
	 *
	 * * 'null'
	 * * 'selenium'
	 * * 'browserstack'
	 * * 'cbt' (CrossBrowserTesting)
	 * * 'saucelabs'
	 * * 'testingbot'
	 */
	tunnel: string;

	/**
	 * Options for the currently selected tunnel.
	 *
	 * The available options depend on the current tunnel. Common options
	 * include:
	 *
	 * ** All tunnels**
	 *
	 * | Property   | Value                                                    |
	 * | :---       | :---                                                     |
	 * | `username` | Username for the tunnel service (e.g., BrowserStack)     |
	 * | `apiKey`   | API key for the tunnel service (e.g., BrowserStack)      |
	 * | `pathname` | The path for the tunnel’s REST endpoint (e.g., `wd/hub`) |
	 *
	 * **Selenium tunnel**
	 *
	 * | Property  | Value                                                                   |
	 * | :---      | :---                                                                    |
	 * | `drivers` | A list of driver names, or objects with `name` and `options` properties |
	 * | `verbose` | If true, show tunnel debug information                                  |
	 *
	 * See also:
	 *
	 * * [[https://theintern.io/docs.html#Dig%20Dug/2/api/Tunnel/tunnelproperties|Tunnel]]
	 * * [[https://theintern.io/docs.html#Dig%20Dug/2/api/SeleniumTunnel/seleniumproperties|SeleniumTunnel]]
	 * * [[https://theintern.io/docs.html#Dig%20Dug/2/api/BrowserStackTunnel/browserstackproperties|BrowserStackTunnel]]
	 */
	tunnelOptions: TunnelOptions | BrowserStackOptions | SeleniumOptions;
}

/**
 * A descriptor object used to load a built-in reporter
 */
export interface ReporterDescriptor {
	name: string;
	options?: ReporterOptions;
}

/**
 * A descriptor object for a script. If an options value is present, the
 * descriptor is assumed to refer to a plugin, and the options will be passed to
 * the plugins initializer function.
 */
export interface PluginDescriptor {
	script: string;
	useLoader?: boolean;
	options?: any;
}

/**
 * A generic event listener
 */
export interface Listener<T> {
	(arg: T): void | Promise<void>;
}

export interface ResourceConfig {
	/**
	 * The loader used to load test suites and application modules.
	 *
	 * When passed in as part of a config object, the `loader` property can be a
	 * string with a loader name or the path to a loader script. It may also be
	 * an object with `script` and `config` properties. Intern provides built-in
	 * loader scripts for Dojo and Dojo2, which can be specified with the IDs
	 * 'dojo' and 'dojo2'.
	 *
	 * ```ts
	 * loader: 'dojo2'
	 * loader: 'tests/loader.js'
	 * loader: {
	 *     script: 'dojo',
	 *     config: {
	 *         packages: [
	 *             { name: 'app', location: './js' }
	 *         ]
	 *     }
	 * }
	 * ```
	 */
	loader: LoaderDescriptor;

	/**
	 * A list of reporter names or descriptors.
	 *
	 * Reporters specified in this list must have been previously installed
	 * using
	 * [`registerReporter`](https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/registerreporter)
	 * or
	 * [`registerPlugin`](https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/registerplugin).
	 *
	 * List entries may be reporter names or objects of the format
	 *
	 * ```js
	 * {
	 *     name: 'reporter name',
	 *     options: {
	 *         // reporter-specific options
	 *     }
	 * }
	 * ```
	 *
	 * The built-in reporters under Node are:
	 *   * benchmark - output benchmark test results
	 *   * cobertura - output coverage data in the cobertura format
	 *   * htmlcoverage - output coverage data as an HTML report
	 *   * jsoncoverage - output coverage data in a JSON format
	 *   * junit - output results in JUnit format
	 *   * lcov - output coverage results in lcov format
	 *   * pretty - draw text results in a terminal
	 *   * runner - output test results as formatted text (default Node reporter)
	 *   * simple - output test results as simple text
	 *   * teamcity - output results in TeamCity format
	 *
	 * The built-in reporters available in browsers are:
	 *   * console - output to the browser console
	 *   * dom - output results as text in the DOM
	 *   * html - output a pretty HTML report (default browser reporter)
	 */
	reporters: ReporterDescriptor[];

	/**
	 * A list of scripts or modules to load before suites are loaded.
	 */
	plugins: PluginDescriptor[];

	/**
	 * A list of paths or glob expressions that point to suite scripts.
	 *
	 * ```js
	 * {
	 *     suites: [
	 *         'tests/unit/**\/*.js',
	 *         'tests/intergration/request.js'
	 *     ]
	 * }
	 * ```
	 *
	 * Note that using globs with the browser client requires that Intern's
	 * server be used to serve the tests. The server can be run in standalone
	 * mode by setting the `serveOnly` option.
	 */
	suites: string[];

	// Deprecated; these are only here for typing
	require: never;
	requires: never;
	scripts: never;
}

export interface BenchmarkConfig extends BenchmarkReporterOptions {
	id: string;
}

export interface LoaderDescriptor {
	script: string;
	options?: { [key: string]: any };
}

export interface EnvironmentSpec {
	browserName: string;
	[key: string]: any;
}
