# Configuration

* [Configuring Intern](#configuring-intern)
* [Displaying Config Information](#displaying-config-information)
* [Properties](#properties)

Intern (specifically the running Intern [executor](architecture.md#executors)) is configured with a standard JavaScript
object. Config properties may be set via a file, the command line, browser query args, or an environment variable. All
of these methods use the same basic syntax and provide the same capbilities.

Wherever config property values come from, the executor will validate and normalize them into a canonical format when
the testing process starts. This means that the property values on the `config` property on the executor don’t have to
be input in the canonical format. For example, several properties such as `suites` and `environments` may be specified
as a single string for convenience, but they will always be normalized to a canonical format on the executor config
object. For example, `environments=chrome` will end up as

```js
environments: [ { browserName: 'chrome' } ]
```

on the executor’s config object.

## Configuring Intern

There are several ways to configure Intern. In order of increasing precedence, they are:

  1. [Config file](#config-file)
  2. [Environment variable](#environment-variable)
  3. [Command line or query args](#command-line-or-query-args)
  4. [Programmatically](#programmatically)

Multiple configuration methods may be used during a single run of Intern. The configuration will be fully resolved
before tests are executed.

### Config File

An Intern config file is a JSON file specifying config properties, for example:

```json
{
  "environments": [
    { "browserName": "chrome" }
  ],
  "suites": [ "tests/unit/all.js" ]
}
```

By default, intern will try to load a file named `intern.json` from the project base directory. This file can be
specified by passing a `config` property to the Node or browser runners.

### Environment variable

In a Node environment, Intern may be configured using an `INTERN_ARGS` environment variable. This variable may contain
config properties in `property=value` format. Its contents will be parsed and processed in the same way as arguments
passed on the command line.

    $ export INTERN_ARGS="grep=run.* excludeInstrumentation"

### Command line

Config properties may be provided directly on the command line when starting Intern. Properties must be specified using
`propert=value` syntax. For example,

    $ node_modules/.bin/intern grep='run.*' excludeInstrumentation

Object values may be input as serialized strings (e.g., `environments='{"browserName":"chrome"}'`). Array values may be
set by repeating a property (e.g., `suites="foo.js" suites="bar.js"`).

### Query args

Query args work very similarly to command line args. They have the same format, but with URL query arg separators, and
escaping of special characters as necessary.

    $ http://localhost:8080/node_modules/intern/?grep=run.*&excludeInstrumentation

### Programmatically

When creating an executor programmatically it may be configured via its constructor, and later with a `configure`
method.

```ts
const intern = new Node({ grep: /run.*/, excludeInstrumentation: true });
// or
intern.configure({ grep: /run.*/, excludeInstrumentation: true });
```

The configure method may be called any number of times before the testing process is started.

## Displaying config information

Intern has two config properties that can be used to display configuration information: `showConfig` and `showConfigs`.

**`showConfig`**

Setting the `showConfig` property to tru will dump the resolved configuration to the current environment’s console. When
this property is true, Intern will print its resolved configuration as a JSON structure and exit.

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

**`showConfigs`**

The `showConfigs` property can be used to show information about a given config file. When true, Intern will print the
value of the current config file’s `description` property, and the list all child configs contained in the config file.
For example, with a config file containing the following data:

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

    $ node_modules/.bin/intern showConfigs
    Default test suite

    Configs:
      webdriver  (Run webdriver tests)
      ci         (Run tests on a CI server)

## Properties

All of the available configuration properties are listed in the table below.

| Property | Environment | Description |
| :--------| :---------- | :---------- |
| bail | all | When true, stop testing after the first failure |
| `basePath` | all | The project base path |
| `baseline` | node | When true, run benchmark tests in baseline mode |
| `benchmark` | all | When true, run benchmark tests (if loaded) |
| `browser` | browser | Resources (loader, plugins, reporters, suites) that only apply to browser tests |
| `capabilities` | node | Default capabilities to be used for WebDriver sessions |
| `debug` | all | If true, display runtime messages to the console |
| `defaultTimeout` | all | The time, in ms, to wait for an async test to finish |
| `description` | all | Short string describing a test config |
| [`environments`](#environments) | node | Browser + OS combinations to be tested using WebDriver |
| `excludeInstrumentation` | all | Regular expression used to filter which files are instrumented for code coverage |
| `filterErrorStack` | all | If true, filter non-application code lines out of stack traces |
| `functionalCoverage` | node | If true, include coverage statistics generated by functional tests |
| [`functionalSuites`](#suites-nodesuites-browsersuites-functionalsuites) | node | Suites to run using WebDriver |
| [`grep`](#grep) | all | Regular expression used to filter which suites and tests are run |
| `instrumenterOptions` | node | Options to pass to the code coverage instrumenter (Istanbul) |
| `internPath` | all | Relative path from project root to the Intern package |
| [`loader`](#loader) | all | An optinal loader script and options |
| `maxConcurrency` | node | When running WebDriver tests, how may sessions to run at once |
| `name` | all | A name for a test run for use by reporters |
| `node` | browser | Resources (loader, plugins, reporters, suites) that only apply to node tests |
| `plugins` | all | A list of Intern extensions to load before tests begin |
| `reporters` | all | A list of reporters to use |
| `runInSync` | node | When true, remote executors will run in sync with the local Intern |
| `serveOnly` | node | When true, Intern will start its instrumenting web server but not run tests |
| `serverPort` | node | The port the instrumenting server should listen on |
| `serverUrl` | node | A URL a remote executor can use to reach the local Intern |
| `sessionId` | node | A unique ID assigned to a remote executor |
| `showConfig` | all | When true, show the resolved configuration and exit |
| `showConfigs` | all | When true, show information about the currently loaded config file |
| `socketPort` | node | A port to use for a WebSocket connection from a remote session |
| [`suites`](#suites-nodesuites-browsersuites-functionalsuites) | all | A list of suites to load tests from |
| [`tunnel`](#tunnel) | node | The name of a tunnel class to use for WebDriver tests |
| [`tunnelOptions`](#tunnelOptions) | node | Options to use for the WebDriver tunnel |

### `bail`

**Default**: `false`

By default, Intern will run all configured tests. Setting the `bail` option to `true` will cause Intern to stop running
tests after the first failure.

### `environments`

**Default**: `[]`

The `environments` property specifies the environments that will be used to run WebDriver tests. Its value can be a
single browser name or an environment object, or an array of these.

```ts
environments: 'chrome'
environments: ['chrome', 'firefox']
environments: { browserName: 'chrome', version: '57.0' }
```

The syntax for browser names and other properties depends on where tests are being run. For example, when running tests
using a local Selenium server, the browser name should be the lowercase name of a locally available browser, such as
‘chrome’ or ‘firefox’, and other properties such as the platform name will generally be ignored. When running on a cloud
testing service such as [Sauce
Labs](https://wiki.saucelabs.com/display/DOCS/Test+Configuration+Options#TestConfigurationOptions-RequiredSeleniumTestConfigurationSettings)
or [BrowserStack](https://www.browserstack.com/automate/capabilities), browser names and other properties may have
different acceptable values (e.g., ‘googlechrome’ instead of ‘chrome’, or ‘MacOS’ vs ‘OSX’).

### `functionalSuites`

**Default**: []

Functional suites are files that register [WebDriver tests](writing_tests.md). Suites may be specified as a string path,
a glob expression, or an array of strings and/or globs.

### `grep`

**Default**: `/.*/`

The `grep` property is used to filter which tests are run. Grep operates on test IDs. A test ID is the concatenation of
a test name with all of its parent suite names.

### `loader`

**Default**: `/.*/`

The `loader` property can be a string with a loader name or the path to a [loader script](./architecture.md#loaders). It
may also be an object with `script` and `options` properties. Intern provides built-in loader scripts for Dojo, Dojo 2,
and SystemJS, accessible through the aliases ‘dojo’, ‘dojo2’, and 'systemjs'.

```ts
loader: 'dojo2'
loader: 'tests/loader.js'
loader: { script: 'dojo', options: { packages: [ { name: 'app', location: './js' } ] } }
```

### `suites`, `functionalSuites`

**Default**: []

Suites are files that register unit tests. Suites may be specified as a string path, a glob expression, or an array of
strings and/or globs.

### `tunnel`

The `tunnel` property specifies which Dig Dug tunnel class to use for WebDriver testing. There are several built in
tunnel types, and others can be added through the Node executor’s [`registerTunnel`
method](./architecture.md#extension-points).

The built in tunnel classes are:

* 'null'
* 'selenium'
* 'browserstack'
* 'cbt' (CrossBrowserTesting)
* 'saucelabs'
* 'testingbot'
