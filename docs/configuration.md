# Configuration

<!-- vim-markdown-toc GFM -->
* [Common configuration](#common-configuration)
	* [bail](#bail)
	* [baseline](#baseline)
	* [basePath](#basepath)
	* [benchmark](#benchmark)
	* [benchmarkConfig](#benchmarkconfig)
	* [benchmarkSuites](#benchmarksuites)
	* [coverageVariable](#coveragevariable)
	* [defaultTimeout](#defaulttimeout)
	* [excludeInstrumentation](#excludeinstrumentation)
	* [filterErrorStack](#filtererrorstack)
	* [grep](#grep)
	* [loaderOptions](#loaderoptions)
	* [loaders](#loaders)
	* [reporters](#reporters)
	* [setup](#setup)
	* [suites](#suites)
	* [teardown](#teardown)
* [Client configuration](#client-configuration)
* [Test runner configuration](#test-runner-configuration)
	* [capabilities](#capabilities)
	* [environments](#environments)
	* [environmentRetries](#environmentretries)
	* [functionalSuites](#functionalsuites)
	* [leaveRemoteOpen](#leaveremoteopen)
	* [maxConcurrency](#maxconcurrency)
	* [proxyOnly](#proxyonly)
	* [proxyPort](#proxyport)
	* [proxyUrl](#proxyurl)
	* [runnerClientReporter](#runnerclientreporter)
	* [tunnel](#tunnel)
	* [tunnelOptions](#tunneloptions)

<!-- vim-markdown-toc -->

## Common configuration

Intern’s configuration files are actually [standard AMD modules](http://dojotoolkit.org/documentation/tutorials/1.10/modules/) that export a configuration object. This allows simple inheritance of parent configurations and enables test configurations to be generated programmatically at runtime.

The configuration file is specified using the [config argument](./running.md) on the command-line (for Node.js) or the config argument in the URL query-string (for browsers).

Take a look at the [example configuration file](https://github.com/theintern/intern/blob/3.4/tests/example.intern.js) that comes with Intern to learn what a valid configuration looks like.

The following configuration options are common to [all execution modes](./running.md) in Intern:

| Option                                            | Type                                                                                                           | Default                                                          |
| ------                                            | ----                                                                                                           | -------                                                          |
| [bail](#bail)                                     | If this value is set to `true`, a failing test will cause all following tests in all suites to be skipped.     | `false`                                                          |
| [baseline](#baseline)                             | If true, and if <code>benchmark</code> is also true, benchmarking will run in &quot;baseline&quot; mode.       | `false`                                                          |
| [basePath](#basepath)                             | The common base path for all files that need to be loaded during testing.                                      | `process.cwd` (Node) <br> `node_modules/intern/../../` (browser) |
| [benchmark](#benchmark)                           | If true, enable benchmarking mode.                                                                             | `false`                                                          |
| [benchmarkConfig](#benchmarkconfig)               | An object containing options for the benchmarking system.                                                      | `undefined`                                                      |
| [benchmarkSuites](#benchmarksuites)               | An array of benchmark test module IDs to load. These may include glob patterns.                                | `[]`                                                             |
| [coverageVariable](#coveragevariable)             | The name of the global variable used to store and retrieve code coverage data.                                 | `'__internCoverage'`                                             |
| [defaultTimeout](#defaulttimeout)                 | The amount of time, in milliseconds, an asynchronous test can take before it is considered timed out.          | `30000`                                                          |
| [excludeInstrumentation](#excludeinstrumentation) | A boolean  or regular expression matching paths to exclude from code coverage.                                 | `null`                                                           |
| [filterErrorStack](#filtererrorstack)             | If this value is set to `true`, stack trace lines for non-application code will be pruned from error messages. | `false`                                                          |
| [grep](#grep)                                     | A regular expression that filters which tests should run.                                                      | `/.*/`                                                           |
| [loaderOptions](#loaderoptions)                   | Configuration options for the AMD loader.                                                                      | `{ … }`                                                          |
| [loaders](#loaders)                               | An alternative module loader to use in place of the built-in AMD loader.                                       | `{}`                                                             |
| [reporters](#reporters)                           | An array of reporters to use to report test results.                                                           | `['Runner']` (runner)<br/> `['Console']` (client)                |
| [setup](#setup)                                   | A function that will be run before the testing process starts.                                                 | `undefined`                                                      |
| [suites](#suites)                                 | An array of unit test module IDs to load. These may include glob patterns.                                     | `[]`                                                             |
| [teardown](#teardown)                             | A function that will be run after the testing process ends.                                                    | `undefined`                                                      |

### bail

*Type: boolean*

The `bail` option controls Intern's “fail fast” behavior. When `bail` is set to `true` and a test fails, all remaining tests, both unit and functional, will be skipped. Other than the cleanup methods for the failing test and its containing suite, no other test or suite lifecycle methods (`setup/before`, `beforeEach`, `afterEach`, `teardown/after`) will be run.

### baseline

*Type: boolean*

If this value is true, and if Intern is running in benchmarking mode, it will record baseline data rather than evaluating benchmarks against existing baseline data. Intern will automatically run in baseline mode if no benchmark data exists when a benchmarking run is started.

### basePath

*Type: string*

The common base path for all files that need to be loaded during testing. If `basePath` is specified using a relative path, that path is resolved differently depending upon where Intern is executing:

-   In Node.js, `basePath` is resolved relative to `process.cwd()`
-   In a browser with an [`initialBaseUrl`](#baseurl) argument in the query-string, `basePath` is resolved relative to `initialBaseUrl`
-   In a browser with no `initialBaseUrl` argument, `basePath` is resolved relative to two directories above the Intern directory (i.e. `node_modules/intern/../../`)

If `basePath` is not explicitly provided, it is set to `.` and is resolved according to the rules above.

`basePath` is the directory that is served by the test runner’s instrumenting proxy HTTP server. If it is not set properly for your application, the test runner will not work correctly.

### benchmark

*Type: boolean*

If this value is true, Intern will run in benchmarking mode. In this mode, only suites in the `benchmarkSuites` will be executed. By default, benchmarking mode will compare benchmark results against previously recorded results and flag deviations. Set the `baseline` option to `true` to record new baseline results.

### benchmarkConfig

*Type: Object*

This value contains options for the Benchmark reporter. The default values are:

```js
benchmarkConfig: {
  filename: 'baseline.json',
  thresholds: {
	warn: { rme: 5, mean: 3 },
	fail: { rme: 6, mean: 10 }
  },
  verbosity: 0
}
```

### benchmarkSuites

*Type: string[]*

An array of benchmark test module IDs to load. See [suites](#suites) for supported syntax.

### coverageVariable

*Type: string*

The name of the global variable used to store and retrieve code coverage data. Change this only if you have code that is pre-instrumented by a compatible version of Istanbul with a different global variable name.

### defaultTimeout

*Type: number*

The amount of time, in milliseconds, an asynchronous test can run before it is considered timed out. By default this value is 30 seconds.

Timeouts can be set for an individual test by setting the `timeout` property of the test, or for all tests within a test suite by setting the `timeout` property of the suite.

### excludeInstrumentation

*Type: RegExp | boolean*

The `excludeInstrumentation` option can be either a regular expression or the boolean value `true`.

As a boolean `true`, completely disables code instrumentation.

As a regular expression, a regular expression matching paths to exclude from code coverage. The regular expression matches the path-part of URLs (starting from the end of [proxyUrl](#proxyurl), excluding any trailing slash) or paths (starting from the end of `process.cwd()`) that should not be instrumented for code coverage during testing in browsers and the Node.js client.

This option should be used when you want to exclude dependencies from being reported in your code coverage results. (Intern code—that is, anything that loads from {{proxyUrl}}/\_\_intern/—is always excluded from code coverage results.) For example, to exclude tests and Node.js dependencies from being reported in your application’s code coverage analysis:

```js
{
  excludeInstrumentation: /^(?:tests|node_modules)\//
}
```

If you are running Intern 2 on Windows, you will need to use `[\\/]` instead of `\/` to match the path separator used by that OS. In Intern 3, forward-slashes should always be used regardless of platform.

### filterErrorStack

*Type: boolean*

The `filterErrorStack` option tells Intern to clean up error stack traces by removing non-application code. For example, by default a stack trace for a WebDriver test error might look like this:

```
UnknownError: [GET http://localhost:4444/.../text] Element reference not seen before: %5Bobject%20Object%5D
  at runRequest  <node_modules/leadfoot/Session.js:88:40>
  at <node_modules/leadfoot/Session.js:109:39>
  at new Promise  <node_modules/dojo/Promise.ts:411:3>
  at ProxiedSession._get  <node_modules/leadfoot/Session.js:63:10>
  at Element._get  <node_modules/leadfoot/Element.js:23:31>
  at Element.getVisibleText  <node_modules/leadfoot/Element.js:199:21>
  at Command.<anonymous>  <node_modules/leadfoot/Command.js:680:19>
  at <node_modules/dojo/Promise.ts:393:15>
  at run  <node_modules/dojo/Promise.ts:237:7>
  at <node_modules/dojo/nextTick.ts:44:3>
  at Command.target.(anonymous function) [as getVisibleText]  <node_modules/leadfoot/Command.js:674:11>
  at Test.check contents [as test]  <tests/functional/hello.js:21:6>
  at <node_modules/intern/lib/Test.js:191:24>
  at <node_modules/intern/browser_modules/dojo/Promise.ts:393:15>
  at runCallbacks  <node_modules/intern/browser_modules/dojo/Promise.ts:11:11>
  at <node_modules/intern/browser_modules/dojo/Promise.ts:317:4>
  at run  <node_modules/intern/browser_modules/dojo/Promise.ts:237:7>
  at <node_modules/intern/browser_modules/dojo/nextTick.ts:44:3>
  at _combinedTickCallback  <internal/process/next_tick.js:67:7>
```

With `filterErrorStack` set to true, it would look like this:

```
UnknownError: [GET http://localhost:4444/.../text] Element reference not seen before: %5Bobject%20Object%5D
  at Test.check contents [as test]  <tests/functional/hello.js:21:6>
```

### grep

*Type: RegExp*

A regular expression that filters which tests should run. `grep` should be used whenever you want to run only a subset of all available tests.

When using `grep`, its value is matched against the ID of each registered test, and tests that don’t match are skipped with a skip message of “grep”.

The ID of a test is a concatenation of the test’s name, plus the names of its parent suites, separated by `' - '`. In other words, a test registered like this:

```js
tdd.suite('FooComponent', function () {
  tdd.test('startup', function () {
    // …
  });
});
```

…would have the ID `'FooComponent - startup'`. In this case, all of the following `grep` values would match and cause this test to run:

-   `/FooComponent/`
-   `/startup/`
-   `/FooComponent - startup/`
-   `/foocomponent/i`
-   `/start/`

The following `grep` values would *not* match and cause this test to be skipped:

-   `/BarComponent/` – “BarComponent” is not in the full name of the test
-   `/foocomponent/` – this regular expression is case sensitive
-   `/^startup/` – the full ID of the test is matched, not just the name part

### loaderOptions

*Type: Object*

Configuration options for the module loader. Any [configuration options](https://github.com/amdjs/amdjs-api/blob/master/CommonConfig.md) that are supported by the active loader can be used here. By default, the [Dojo 2](https://github.com/dojo/dojo2) AMD loader is used; this can be changed to another loader that provides an AMD-compatible API with [`loaders`](#loaders).

AMD configuration options supported by the built-in loader are [`map`](https://github.com/amdjs/amdjs-api/blob/master/CommonConfig.md#map-), [`packages`](https://github.com/amdjs/amdjs-api/blob/master/CommonConfig.md#packages-), and [`paths`](https://github.com/amdjs/amdjs-api/blob/master/CommonConfig.md#paths-).

 If [`baseUrl`](https://github.com/amdjs/amdjs-api/blob/master/CommonConfig.md#baseurl-) is not explicitly defined, it is automatically set to be equivalent to the [`basePath`](#basepath). Relative `baseUrl`s are relative to `basePath`.

When following the [recommended directory structure](./getting-started.md#recommended-directory-structure), no extra loader configuration is needed.

If you are testing an AMD application and need to use stub modules for testing, the `map` configuration option is the correct way to do this:

```js
{
  loaderOptions: {
	map: {
	  app: {
		// When any module inside 'app' tries to load 'app/foo',
		// it will receive 'tests/stubs/app/foo' instead
		'app/foo': 'tests/stubs/app/foo'
	  }
	}
  }
}
```

### loaders

*Type: Object*

An alternative module loader to use in place of the built-in AMD loader. When `loaders` is specified, Intern will swap out the built-in loader with the loader you’ve specified before loading reporters and test modules.

The alternative loader you use must implement the AMD API and must support the `baseUrl`, `map`, and `packages` configuration options.

There are two different keys that may be specified so that the correct path to the loader can be provided in each environment:

-   `host-node` specifies the loader to use in Node.js. This should be a Node.js module ID.
-   `host-browser` specifies the loader to use in browsers. This should be a path or URL to a script file.

In Intern 2, loader paths are relative to the directory where Intern is installed. In Intern 3, loader paths are relative to [`basePath`](#basepath).

For example, to use a copy of RequireJS installed to the same project as Intern:

```js
loaders: {
  'host-node': 'requirejs',
  'host-browser': 'node_modules/requirejs/require.js'
}
```

When using RequireJS in Node.js, you *must* use `'requirejs'`, which actually loads `r.js`. The file `require.js` is for Web browsers *only* and will not work.

### reporters 

*Type: (Object | string)[]*

An array of reporters to use to report test results. Reporters in this list can either be [built-in reporter names](./reporters.md#test-results-reporters) (like `'Console'` or `'JUnit'`), or absolute AMD module IDs (like `'tests/support/customReporter'`) when using [custom reporters](./customisation.md#custom-reporters).

 Reporters can also be configured by passing an object with extra configuration options valid for the given reporter. In this case, the ID of the reporter should be given by the `id` key of the reporter configuration:

```
{
  reporters: [
	{ id: 'JUnit', filename: 'report.xml' }
  ]
}
```

If reporters are not specified in the configuration, Intern will pick defaults that are most suitable for the current execution mode.

In Intern 2, reporter IDs are all lowercase. In Intern 3, reporter IDs are UpperCamelCase (because they are now constructors).

### setup

*Type: Function*

A function that will be run before the testing process starts. If this function returns a Promise, Intern will wait for the Promise to resolve before continuing. If the function throws an exception or rejects a returned Promise, the testing process will terminate with an error. This can be a good place to initialize testing resources needed by all tests, such as database connections.

### suites

*Type: string[]*

An array of unit test module IDs to load. For example:

```js
{
  suites: [
	'tests/unit/foo',
	'tests/unit/bar'
  ]
}
```

Suite specifiers may also include glob patterns using syntax supported by [node-glob](https://github.com/isaacs/node-glob#glob-primer):

```js
{
  suites: [
	'tests/unit/foo/*',
	'tests/unit/{bar,baz}/*'
  ]
}
```

Like simple suite specifiers, specifiers with glob patterns refer to module IDs, not file paths. Glob patterns must resolve to individual test modules, not packages. For example, given the following project structure, `'tests/u*'` would not be a valid glob, but `'tests/unit/f*'` would be:

```
project_root/
  tests/
	unit/
	  foo.js
	  bar.js
	intern.js
```

Glob expressions aren’t evaluated in module IDs involving loader plugins, so the following won’t work: 'dojo/node!cjsmodules/\*'.

When running tests with `client.html`, tests must be served by the Intern proxy to use globbing.

`suites` can be set to `null` to skip loading the unit testing system when in runner mode. From the command line, this is done by passing the argument `suites=`.

### teardown

*Type: Function*

A function that will be run after the testing process completes. If this function returns a Promise, Intern will wait for the Promise to resolve before continuing. If the function throws an exception or rejects a returned Promise, the testing process will terminate with an error. This is generally where resources opened in [`config.setup`](#setup) should be cleaned up.

## Client configuration

There are currently no options that only apply when running in client mode.

## Test runner configuration

Certain configuration options only apply when in runner mode. These options are ignored when running in client mode.

| Option                                           | Type                                                                                   | Default                                           |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------- |
| [capabilities](#capabilities)                    | Default capabilities for all test environments.                                        | `{ name: configModuleId,  'idle-timeout': 60 }`   |
| [environments](#environments)                    | An array of capabilities objects, one for each desired test environment.               | `[]`                                              |
| [environmentRetries](#environmentretries)        | The number of times to retry creating a session for a remote environment.              | `3`                                               |
| [functionalSuites](#functionalsuites)            | An array of functional test module IDs to load. These may include glob patterns.       | `[]`                                              |
| [leaveRemoteOpen](#leaveremoteopen)              | Leaves the remote environment running at the end of the test run.                      | `false`                                           |
| [maxConcurrency](#maxconcurrency)                | The maximum number of environments to test simultaneously.                             | `3`                                               |
| [proxyOnly](#proxyonly)                          | Starts Intern’s instrumenting HTTP proxy but performs no other work.                   | `false`                                           |
| [proxyPort](#proxyport)                          | The port where the Intern HTTP server will listen for requests.                        | `9000`                                            |
| [proxyUrl](#proxyurl)                            | The external URL to the Intern HTTP server.                                            | `'http://localhost:9000/'`                        |
| [runnerClientReporter](#runnerclientreporter)    | The reporter used to send data from the unit testing system back to the test runner.   | `{ id: 'WebDriver' }`                             |
| [tunnel](#tunnel)                                | The tunnel to use to establish a WebDriver server for testing.                         | `'NullTunnel'`                                    |
| [tunnelOptions](#tunneloptions)                  | Options to pass to the WebDriver server tunnel.                                        | `{}`                                              |

### capabilities

*Type: Object*

Default capabilities for all test environments. These baseline capabilities are extended for each environment by the [`environments`](#environments) array.

Different services like BrowserStack and Sauce Labs may have different sets of available capabilities. In order for Intern to work correctly, it’s important that you use the appropriate capabilities for WebDriver server you are interacting with:

-   [Selenium capabilities](https://github.com/SeleniumHQ/selenium/wiki/DesiredCapabilities)
-   [BrowserStack capabilities](https://www.browserstack.com/automate/capabilities)
-   [CrossBrowserTesting capabilities](https://help.crossbrowsertesting.com/selenium-testing/automation-capabilities)
-   [Sauce Labs capabilities](https://wiki.saucelabs.com/display/DOCS/Test+Configuration+Options#TestConfigurationOptions-Selenium-SpecificOptions) and [environments](https://saucelabs.com/platforms)
-   [TestingBot capabilities](https://testingbot.com/support/other/test-options) and [environments](https://testingbot.com/support/getting-started/browsers.html)

Extra [options for ChromeDriver](https://sites.google.com/a/chromium.org/chromedriver/capabilities) are specified on the `chromeOptions` capability.

Intern will automatically fill certain capabilities fields in order to provide better feedback within cloud service dashboards:

-   `name` will be set to the ID of the configuration file being used
-   `build` will be set to the commit ID from the `TRAVIS_COMMIT` and `BUILD_TAG` environment variables, if either exists

### environments

*Type: Object[]*

An array of capabilities objects, one for each desired test environment. The same options from [capabilities](#capabilities) are used for each environment specified in the array. To delete an option from the default capabilities, explicitly set its value to `undefined`.

If arrays are provided for `browserName`, `version`, `platform`, or `platformVersion`, all possible option permutations will be generated. For example:

```js
{
  environments: [
	{
	  browserName: 'chrome',
	  version: [ '23', '24' ],
	  platform: [ 'Linux', 'Mac OS 10.8' ]
	}
  ]
}
```

This configuration will generate 4 environments: Chrome 23 on Linux, Chrome 23 on Mac OS 10.8, Chrome 24 on Linux, and Chrome 24 on Mac OS 10.8.

All other capabilities are not permuted, but are simply passed as-is to the WebDriver server.

 When using one of the supported cloud services (BrowserStack, CrossBrowserTesting, Sauce Labs, or TestingBot), the browser version may also use *range* expressions and the *“latest” alias*. A range expression consists of two versions separated by “..”. Intern will request a list of all supported platform + browser + version combinations from the service and will expand the range using the versions available from the service. The range is inclusive, so for the range expression “23..26”, Intern will include versions 23 and 26 in the expanded version list.

```js
{
  environments: [
	{ browserName: 'chrome', version: '23..26', platform: 'Linux' }
  ]
}
```

The “latest” alias represents the most recent version of a browser (the most recent verison available on the relevant cloud service). An integer may be subtracted from the latest value, like “latest-1”; this represents the next-to-latest version. The “latest” alias, including the subtraction form, may be used in version ranges or by itself.

```js
{
  environments: [
	{ browserName: 'firefox', version: 'latest', platform: 'Linux' },
	{ browserName: 'chrome', version: '24..latest-1', platform: 'Linux' }
  ]
}
```

Different cloud testing services use different capability values when specifying environment capabilities. For example, Sauce Labs uses 'Windows XP' to specify the Windows XP platform while BrowserStack uses 'XP'. Check [the list above](#capabilities) to find the right capabilities for your chosen platform.

### environmentRetries

*Type: number*

The number of times to retry creating a session for a remote environment. Occasionally, hosted VM services will experience temporary failures when creating a new session; specifying `environmentRetries` avoids false positives caused by transient session creation failures.

### functionalSuites

*Type: string[]*

An array of functional test module IDs to load. [Functional tests](./functional-testing.md) are different from unit tests because they are executed on the local (Node.js) side, not the remote (browser) side, so they are specified separately from the list of unit test modules.

```js
{
  functionalSuites: [
	'tests/functional/foo',
	'tests/functional/bar'
  ]
}
```

As with `suites`, functional suite specifiers may also include [glob patterns](#suites).

### leaveRemoteOpen

*Type: boolean | string*

Leaves the remote environment running at the end of the test run. This makes it easier to investigate a browser’s state when debugging failing tests. This can also be set to `fail` to only keep the remote environment running when a test failure has occurred.

In Intern 2, this option is available, but only as a command-line flag.

### maxConcurrency

*Type: number*

The maximum number of environments to test simultaneously. Set this to `Infinity` to run tests against all environments at once. You may want to reduce this if you have a limited number of test machines available, or are using a shared hosted account.

### proxyOnly

*Type: boolean*

Starts Intern’s instrumenting HTTP proxy but performs no other work. [`basePath`](#basepath) will be served as the root of the server. This can be useful when you want to run the [browser client](./running.md#the-browser-client) manually and get access to code coverage information, which is not available when running the browser client directly from a normal HTTP server. The browser client is available from [{proxyUrl}](#proxyurl)/\_\_intern/client.html.

In Intern 2, this option is available, but only as a command-line flag.

### proxyPort

*Type: number*

The port where the Intern HTTP server will listen for requests. Intern’s HTTP server performs two critical tasks:

-   Automatically adds instrumentation to your JavaScript code so that it can be analysed for completeness by the code coverage reporter
-   Provides a communication conduit for the unit testing system to provide live test results in runner mode

Any JavaScript code that you want to evaluate for code coverage must either pass through the code coverage proxy or be pre-instrumented for Intern. The HTTP server must also be accessible to the environment (browser) being tested in runner mode in order for unit testing results to be transmitted back to the test runner successfully.

### proxyUrl

*Type: string*

The external URL to the Intern HTTP server. You will need to change this value only if you are running Intern’s HTTP server through a reverse proxy, or if Intern’s HTTP server needs to be reached through a public interface that your Selenium servers can access directly.

### runnerClientReporter

*Type: string | Object*

The reporter used to send data from the unit testing system back to the test runner. The default reporter is the built-in WebDriver reporter, which can be configured by setting `runnerClientReporter` to an object with one or more properties:

| Option        | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Default |
|---------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------|
| waitForRunner | Whether or not events transmitted from the unit testing system to the test runner should cause the unit testing system to pause until a response is received from the test runner. This is necessary if you expect to be able to do things like take screenshots of the browser before/after each unit test executes from a custom reporter. This property can be set to `true` to always wait for the test runner after each event from the test system, or `'fail'` to only wait if the event was a test failure or other error. | `false` |
| writeHtml     | Whether or not test status should be written to the screen during the test run. This is useful for debugging test hangs when running on a cloud provider, but can also interfere with tests that rely on scrolling/positioning or code which indiscriminately destroys the content of the DOM.                                                                                                                                                                                                                                     | `true`  |

You can swap out the client reporter with a completely different reporter if you want by specifying its ID, but doing so will break the test runner if you don’t know what you are doing.

### tunnel

*Type: string*

The tunnel to use to establish a WebDriver server for testing. The tunnel can either be a [built-in tunnel name](https://theintern.github.io/digdug/) (like `'NullTunnel'` or `'BrowserStackTunnel'`), or an absolute AMD module ID (like `'tests/support/CustomTunnel'`) when using a custom tunnel.

The following tunnels are built in to Intern:

-   [BrowserStackTunnel](https://theintern.github.io/digdug/module-digdug_BrowserStackTunnel.html) – For use with [BrowserStack](https://browserstack.com/)
-   [CrossBrowserTestingTunnel](https://theintern.github.io/digdug/module-digdug_CrossBrowserTestingTunnel.html) – For use with [CrossBrowserTesting](https://crossbrowsertesting.com/)
-   [NullTunnel](https://theintern.github.io/digdug/module-digdug_NullTunnel.html) – For use with any other WebDriver server
-   [SauceLabsTunnel](https://theintern.github.io/digdug/module-digdug_SauceLabsTunnel.html) – For use with [Sauce Labs](https://saucelabs.com/)
-   [SeleniumTunnel](https://theintern.github.io/digdug/module-digdug_SeleniumTunnel.html) – For loading and managing a local standalone Selenium server
-   [TestingBotTunnel](https://theintern.github.io/digdug/module-digdug_TestingBotTunnel.html) – For use with [TestingBot](https://testingbot.com/)

When you are using [your own Selenium server](./webdriver-server.md#local-selenium) or [your own Selenium grid](./webdriver-server.md#selenium-grid), you will typically use the `'NullTunnel'` tunnel and specify the `host`, `port`, and/or `path` to the Selenium server in [tunnelOptions](#tunneloptions).

### tunnelOptions

*Type: Object*

Options to pass to the WebDriver server tunnel. Valid options for each of the built-in tunnels can be found in the [Dig Dug documentation](https://theintern.github.io/digdug/).
