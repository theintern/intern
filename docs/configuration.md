# Configuration

<!-- vim-markdown-toc GFM -->
* [Config structure](#config-structure)
* [Sources of configuration information](#sources-of-configuration-information)
    * [Config File](#config-file)
    * [Environment variable](#environment-variable)
    * [Command line](#command-line)
    * [Query args](#query-args)
    * [Programmatically](#programmatically)
* [Displaying config information](#displaying-config-information)
    * [`showConfig`](#showconfig)
    * [`showConfigs`](#showconfigs)
* [Environment-specific config](#environment-specific-config)
* [Properties](#properties)
    * [bail](#bail)
    * [benchmark](#benchmark)
    * [capabilities](#capabilities)
    * [coverage](#coverage)
    * [debug](#debug)
    * [defaultTimeout](#defaulttimeout)
    * [environments](#environments)
    * [extends](#extends)
    * [functionalSuites](#functionalsuites)
    * [grep](#grep)
    * [leaveRemoteOpen](#leaveremoteopen)
    * [loader](#loader)
    * [reporters](#reporters)
    * [suites](#suites)
    * [tunnel](#tunnel)
    * [tunnelOptions](#tunneloptions)
        * [All tunnels](#all-tunnels)
        * [Selenium tunnel](#selenium-tunnel)
* [Configuration resolution](#configuration-resolution)

<!-- vim-markdown-toc -->

Intern is configured with a standard JavaScript object. This object may contain properties applicable to either environment that Intern can run in (Node or browser). Config properties may be set via a file, the command line, browser query args, or an environment variable. All of these methods use the same basic syntax and provide the same capabilities. Assuming Intern is being run with the default [Node runner](./running.md#node) or [browser runner](./running.md#browser) and without a `config` argument, configuration informatioon will be read from an `intern.json` file in the project root.

Wherever config property values come from, the executor will validate and normalize them into a canonical format ("resolve" them) when the testing process starts. This allows the executor’s constructor or `configure` method to be flexible in what data it accepts. For example, the canonical form of the `environments` property is an array of objects:

```js
environments: [{ browserName: 'chrome' }]
```

However, Intern will accept a simple string for the `environments` property and will expand it into an array of a single object where the `browserName` property is the given string.

## Config structure

The config structure is a simple JSON object, so all of its property values must be serializable (RegExp objects are serialized to strings).

```js
{
    // General properties
    "bail": false,
    "baseline": false,
    "suites": [ "tests/unit/*.js" ],

    // Browser and node specific resources
    "browser": {
        "suites": [ "tests/unit/dom_stuff.js" ]
    },
    "node": {
        "suites": [ "tests/unit/dom_stuff.js" ]
    },

    "configs": {
        // Child configs have the same structure as the main config
        "ci": {
            "bail": true,
            "suites+": [ "tests/unit/other.js" ]
        }
    }
}
```

There are four general sections to a config:

* **General properties**: this includes everything but "browser", "configs", and "node"
* **Node-specific resources**: resource properties ("loader", "plugins", "reporters", "require', "suites") that apply only to Node environments.
* **Browser-specific resources**: resource properties ("loader", "plugins", "reporters", "require", "suites") that apply only to browser environments.
* **Child configs**: named configs in the "configs" object; each of these can have any config properties except "configs" (i.e., general properties, Node resources, and browser resources).

## Sources of configuration information

Intern takes in configuration data from several sources. In order of increasing precedence, they are:

  1. [Config file](#config-file)
  2. [Environment variable](#environment-variable)
  3. [Command line or query args](#command-line-or-query-args)
  4. [Programmatically](#programmatically)

Multiple configuration methods may be used during a single run of Intern. The configuration will be fully resolved before tests are executed.

### Config File

An Intern config file is a JSON file specifying config properties, for example:

```js
{
    "environments": [
        { "browserName": "chrome" }
    ],
    "suites": [ "tests/unit/all.js" ]
}
```

By default, intern will try to load a file named `intern.json` from the project root directory. A different config file can be specified by passing a `config` property to the Node or browser runners.

A child config can be selected by adding `@<child>` to the config file name. For example, to load a child config named “ci” from the default config file, you could run:

```sh
$ node_modules/.bin/intern config=@ci
```

To load a config named “remote” from a config file named “intern-local.json”, run:

```sh
$ node_modules/.bin/intern config=intern-local.json@remote
```

### Environment variable

In a Node environment, Intern may be configured using an `INTERN_ARGS` environment variable. This variable is treated just like a string of command line arguments. For example, these two executions of Intern are equivalent:

```sh
$ node_modules/.bin/intern grep='run.*' suites=
```

```sh
export INTERN_ARGS="grep=run.* suites="
$ node_modules/.bin/intern
```

### Command line

Config properties may be provided directly on the command line when starting Intern. Properties must be specified using `property=value` syntax. For example,

```sh
$ node_modules/.bin/intern grep='run.*' suites=
```

Object values may be input as serialized strings (e.g., `environments='{"browserName":"chrome"}'`). Array values may be set by repeating a property (e.g., `suites="foo.js" suites="bar.js"`).

### Query args

Query args work very similarly to command line args. They have the same format, but with URL query arg separators, and escaping of special characters as necessary.

```
http://localhost:8080/node_modules/intern/?grep=run.*&suites=
```

### Programmatically

When creating an executor programmatically it may be configured via its constructor, and later with a `configure` method.

```js
const intern = new Node({ grep: /run.*/, suites: [] });
```
_or_

```js
intern.configure({ grep: /run.*/, suites: [] });
```

The configure method may be called any number of times before the testing process is started.

## Displaying config information

Intern has two config properties that can be used to display configuration information: `showConfig` and `showConfigs`.

### `showConfig`

Setting the `showConfig` property to `true` will cause Intern to dump the resolved configuration to the current environment’s console.

```
$ node_modules/.bin/intern showConfig
{
    "bail": false,
    "baseline": false,
    "benchmark": false,
    "reporters": [
        {
            "name": "console"
        }
    ]
}
```

### `showConfigs`

The `showConfigs` property can be used to show information about a given config file. When true, Intern will print the value of the current config file’s `description` property, and the list all child configs contained in the config file. For example, with a config file containing the following data:

```js
{
    "description": "Default test suite",
    "configs": {
        "webdriver": {
            "description": "Run webdriver tests"
        },
        "ci": {
            "description": "Run tests on a CI server"
        }
    }
}
```

running Intern with the `showConfigs` property set would display the following text:

```
$ node_modules/.bin/intern showConfigs
Default test suite

Configs:
  webdriver  (Run webdriver tests)
  ci         (Run tests on a CI server)
```

## Environment-specific config

Tests can run in two basic environments: Node and browsers. By default, “resource” properties (`suites`, `plugins`, `reporters`, `loader`, and `require`) in a config file apply to both environments. This means that if the same config is used to run tests in a browser and in Node, the same resources will be loaded in both environments. In some cases this isn’t desirable because tests may load application code that depends on environment-specific properties or features, such as the DOM. Intern’s config provides `node` and `browser` properties for this use case. Not surprisingly, these properties specify resources that will only be loaded in the given environment.  The values in these properties will be [shallowly mixed into the base config](#configuration-resolution) rather than replacing it.

⚠️ Note that this is different than the `mode` property in Intern 3, which had values of “client” or “runner”. Intern 3’s mode indicated whether tests were being run in unit test or functional test mode, but it was sometimes used as an environment check due to the fact that functional tests always run in Node.

## Properties

A number of config properties are applicable whether Intern is running in Node or directly in a broswer:

| Property                 | Description                                                                                | Default
| :-------                 | :----------                                                                                | :------
| bail                     | When true, stop testing after the first failure                                            | `false`
| basePath                 | The absolute project base path                                                             | `/`&nbsp;(browser)<br>`process.cwd()`&nbsp;(Node)
| baseline                 | When true, run benchmark tests in baseline mode                                            | `false`
| [benchmark]              | When true, run benchmark tests (if loaded)                                                 | `false`
| benchmarkConfig          | An object containing benchmarking options                                                  |
| [debug]                  | If true, display runtime messages to the console                                           | `false`
| [defaultTimeout]         | The time, in ms, before an async test times out                                            | 30000
| filterErrorStack         | If true, filter non-application code lines out of stack traces                             | `false`
| [grep]                   | Regular expression used to filter which suites and tests are run                           | `/.*/`
| internPath               | Relative path from project root to the Intern package                                      | `'node_modules/intern'`
| [loader]                 | An optinal loader script and options                                                       | `{ script: 'default' }`
| name                     | A name for a test run for use by reporters                                                 |
| plugins                  | A list of Intern extensions to load before tests begin                                     | `[]`
| [reporters]              | A list of reporters to use                                                                 | `[]`
| require                  | A list of scripts or modules to load before anything else                                  | `[]`
| suites                   | A list of suites to load unit tests from                                                   | `[]`

Some properties are only meaningful for Node or WebDriver tests:

| Property                 | Description                                                                                | Default
| :-------                 | :----------                                                                                | :------
| [capabilities]           | Default capabilities to be used for WebDriver sessions                                     | `{ 'idle-timeout': 60 }`
| connectTimeout           | When running WebDriver tests, how long (in ms) to wait for a remote browser to connect     | 30000
| [coverage]               | An array of paths or globs to collect coverage data for                                    | `[]`
| [environments]           | Browser + OS combinations to be tested using WebDriver                                     | `[]`
| functionalCoverage       | If true, include coverage statistics generated by functional tests                         | `true`
| [functionalSuites]       | Suites to run in WebDriver mode                                                            | `[]`
| instrumenterOptions      | Options to pass to the code coverage instrumenter (Istanbul)                               | `{}`
| [leaveRemoteOpen]        | If true, leave remote browsers open after testing has finished                             | `false`
| maxConcurrency           | When running WebDriver tests, how may sessions to run at once                              | `Infinity`
| runInSync                | When true, remote executors will run in sync with the local Intern                         | `false`
| serveOnly                | When true, Intern will start its instrumenting web server but not run tests                | `false`
| serverPort               | The port the instrumenting server should listen on                                         | `9000`
| serverUrl                | A URL a remote executor can use to reach the local Intern                                  | `http://localhost:9000`
| sessionId                | A unique ID assigned to a remote executor                                                  |
| socketPort               | A port to use for a WebSocket connection from a remote session                             | `9001`
| tunnel                   | The name of a tunnel to use for WebDriver tests                                            | `selenium`
| tunnelOptions            | Options to use for the WebDriver tunnel                                                    | `{ tunnelId: Date.now() }`

The environment-specific properties come into play when Intern is running in that environment:

| Property                 | Description                                                                                | Default
| :-------                 | :----------                                                                                | :------
| browser                  | Resources (loader, plugins, reporters, require, suites) that only apply to browser tests   | `{}`
| node                     | Resources (loader, plugins, reporters, require, suites) that only apply to Node tests      | `{}`

There are also several properties that are handled by the config file processing system system aren’t directly involved in the testing process. These properties are ignored if set programmatically.

| Property    | Description                                                        |
| :-------    | :----------                                                        |
| description | A short string describing a test config                            |
| [extends]   | Another config or config file that the config extends              |
| showConfig  | When true, show the resolved configuration and exit                |
| showConfigs | When true, show information about the currently loaded config file |

### bail

By default, Intern will run all configured tests. Setting the `bail` option to `true` will cause Intern to stop running tests after the first failure.

### benchmark

This property must be set to true for benchmark tests to run. If it is unset or false, any suites registered using the [benchmark interface](./writing_tests.md#benchmark) will be ignored.

### capabilities

These are the default capabilities for all test environments. They will be extended for each environment by values in the [`environments`](#environments) array.

Cloud testing services such as BrowserStack may have unique capabilities. It’s important to use the proper capabilities for the WebDriver server or cloud service being used to run tests.

* [Selenium capabilities](https://github.com/SeleniumHQ/selenium/wiki/DesiredCapabilities)
* [BrowserStack capabilities](https://www.browserstack.com/automate/capabilities)
* [CrossBrowserTesting capabilities](https://help.crossbrowsertesting.com/selenium-testing/automation-capabilities)
* [Sauce Labs capabilities](https://wiki.saucelabs.com/display/DOCS/Test+Configuration+Options#TestConfigurationOptions-Selenium-SpecificOptions) and [environments](https://saucelabs.com/platforms)
* [TestingBot capabilities](https://testingbot.com/support/other/test-options) and [environments](https://testingbot.com/support/getting-started/browsers.html)

[Chrome-specific options](https://sites.google.com/a/chromium.org/chromedriver/capabilities) may be passed using a `chromeOptions` capability.

Intern will automatically provide certain capabilities to provide better feedback with cloud service dashboards:

* `name` will be set to the name of the test config
* `build` will be set to the commit ID from the `TRAVIS_COMMIT` and `BUILD_TAG` environment variables, if either exists

### coverage

This property specifies an array of file paths or globs that should be instrumented for code coverage. This property should point to the actual JavaScript files that will be executed, not pre-transpiled sources (coverage results will still be mapped back to original sources). Coverage data will be collected for these files even if they’re not loaded by Intern for tests, allowing a test writer to see which files _haven’t_ been tested, as well as coverage on files that were tested.

💡This property replaces the `excludeInstrumentation` property used in previous versions of Intern, which acted as a filter rather than an inclusive list. `excludeInstrumentation` will still work for now, but we encourage users to switch to `coverage`.

### debug

When set to true, Intern will emit [`log`](./api.md#logarg) events for many internal operations. Reporters that register for these events, such as the Runner reporter, will display them during testing.

### defaultTimeout

This is the number of milliseconds that Intern will wait for an [asynchronous test](./writing_tests.md#testing-asynchronous-code) to complete before timing out. A timed out test is considered to have failed.

### environments

The `environments` property specifies the environments that will be used to run WebDriver tests. Its value can be a single browser name or an environment object, or an array of these.

```ts
environments: 'chrome'
environments: ['chrome', 'firefox']
environments: { browserName: 'chrome', version: '57.0' }
```

The syntax for browser names and other properties depends on where tests are being run. For example, when running tests using a local Selenium server, the browser name should be the lowercase name of a locally available browser, such as ‘chrome’ or ‘firefox’, and other properties such as the platform name will generally be ignored. When running on a cloud testing service such as [Sauce Labs](https://wiki.saucelabs.com/display/DOCS/Test+Configuration+Options#TestConfigurationOptions-RequiredSeleniumTestConfigurationSettings) or [BrowserStack](https://www.browserstack.com/automate/capabilities), browser names and other properties may have different acceptable values (e.g., ‘googlechrome’ instead of ‘chrome’, or ‘MacOS’ vs ‘OSX’).

### extends

If the `extends` property is set in a base config, it must be the path to a different config file. At run time, the properties from the config file with the `extends` value will be mixed into the properties from the config file being extended.

If the `extends` property is set in a child config, it must be the name of a different child config within the same config file, or an array of such names. When a child config extends multiple other child configs, properties from the right-most config being extended will override properties from configs to the left.

```js
{
    "configs": {
        "a": { /* ... */ },
        "b": { /* ... */ },
        "c": { /* ... */ },
        "d": {
            "extends": ["a", "c"],
            /* ... */
        }
    }
}
```

In the scenario above, the following process will occur:

1. Child “c” will be mixed into child “a”
2. Child “d” will be mixed into the result of 1
3. The result of 2 will be mixed into the base config
4. The result of 3 will be the resolved config

### functionalSuites

Functional suites are files that register [WebDriver tests](writing_tests.md). Suites may be specified as a string path, a glob expression, or an array of strings and/or globs.

### grep

The `grep` property is used to filter which tests are run. Grep operates on test IDs. A test ID is the concatenation of a test name with all of its parent suite names. Every test ID that matches the current grep expression will be run.

### leaveRemoteOpen

Normally when Intern runs tests on remote browsers, it shuts the browser down when testing is finished. However, you may sometimes want to inspect the state of a remote browser after tests have run, particularly if you're trying to debug why a test is failing. Setting `leaveRemoteOpen` to true will cause Intern to leave the browser open after testing. Setting it to `'fail'` will cause Intern to leave it open only if there were test failures.

### loader

The `loader` property can be a string with a loader name or the path to a [loader script](./architecture.md#loaders). It may also be an object with `script` and `options` properties. Intern provides built-in loader scripts for Dojo, Dojo 2, and SystemJS, accessible through the aliases ‘dojo’, ‘dojo2’, and 'systemjs'.

```ts
loader: 'dojo2'
loader: 'tests/loader.js'
loader: {
    script: 'dojo',
    options: {
        packages: [ { name: 'app', location: './js' } ]
    }
}
```

### reporters

This option is a list of reporters to use during the testing process. Reporters specified in this list must have been previously installed using [`registerReporter`](./api.md#registerreportername-reporter) or [`registerPlugin`](./api.md#registerpluginid-callback). List entries may be reporter names or objects of the format

```js
{
    name: 'reporter name',
    options: {
        /* reporter-specific options */
    }
}
```

### suites

Suites are files that register unit tests. Suites may be specified as a string path, a glob expression, or an array of strings and/or globs.

### tunnel

The `tunnel` property specifies which Dig Dug tunnel class to use for WebDriver testing. There are several built in tunnel types, and others can be added through the Node executor’s [`registerPlugin` method](./architecture.md#extension-points).

The built in tunnel classes are:

* 'null'
* 'selenium'
* 'browserstack'
* 'cbt' (CrossBrowserTesting)
* 'saucelabs'
* 'testingbot'

### tunnelOptions

This property specifies options for the currently selected tunnel. The available options depend on the current tunnel.

#### All tunnels

| Property | Value |
| :--- | :--- |
| `username` | Username for the tunnel service (e.g., BrowserStack) |
| `apiKey` | API key for the tunnel service (e.g., BrowserStack) |
| `pathname` | The path for the tunnel’s REST endpoint (e.g., `wd/hub`) |

#### Selenium tunnel

| Property | Value |
| :--- | :--- |
| `drivers` | A list of driver names, or objects with `name` and `options` properties |
| `verbose` | If true, show tunnel debug information |

## Configuration resolution

At runtime, the environment-specific resources and any [active child configs](#config-file) will be mixed into the resolved config. In general, properties from from more specific sources will override properties from lower precedence sources. The order of precedence, from lowest to highest, is:

1. A config being extended by the base config
2. The base config
3. The active child config in the base config

There are a few exceptions:

1. **The "node" and "browser" properties in a child config are shallowly mixed into "node" and "browser" in the base
   config.** For example, if "node" in the base config looks like:
   ```js
   "node": {
       "suites": [ "tests/unit/foo.js" ],
       "plugins": [ "tests/plugins/bar.js" ]
   }
   ```
   and "node" in a child config looks like:
   ```js
   "node": {
       "suites": [ "tests/unit/baz.js" ],
   }
   ```
   then the value of node in the resolved config (assuming the child config is active) will be:
   ```js
   "node": {
       // node.suites from the child overrides node.suites from the base config
       "suites": [ "tests/unit/baz.js" ],
       // node.plugins from the base config remains
       "plugins": [ "tests/plugins/bar.js" ]
   }
   ```
2. **Resource arrays in "node" or "browser" ("plugins", "reporters", "require", "suites"), are added to the corresponding resource arrays in the base config.** For example, if the base config has:
   ```js
   "suites": [ "tests/unit/foo.js" ]
   ```
   and the "node" section has:
   ```js
   "suites": [ "tests/unit/bar.js" ]
   ```
   both sets of suites will be loaded when running on Node.
3. **Resource arrays can be extended (rather than replaced) by adding a '+' to the property name.** For example, if the
   base config has:
   ```js
   "suites": [ "tests/unit/foo.js" ]
   ```
   and a child config has:
   ```js
   "suites+": [ "tests/unit/bar.js" ]
   ```
   the resolved value of suites will be:
   ```js
   "suites": [ "tests/unit/foo.js", "tests/unit/bar.js" ]
   ```


[benchmark]: #benchmark
[capabilities]: #capabilities
[coverage]: #coverage
[debug]: #debug
[defaultTimeout]: #defaulttimeout
[environments]: #environments
[extends]: #extends
[functionalSuites]: #suites-nodesuites-browsersuites-functionalsuites
[grep]: #grep
[leaveRemoteOpen]: #leaveremoteopen
[loader]: #loader
[reporters]: #reporters
[suites]: #suites-nodesuites-browsersuites-functionalsuites
[tunnelOptions]: #tunneloptions
[tunnel]: #tunnel
