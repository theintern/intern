# Configuration

<details>
<summary><strong>Table of Contents</strong></summary>

<!-- vim-markdown-toc GFM -->
* [Config structure](#config-structure)
* [Configuration resolution](#configuration-resolution)
* [Sources of configuration information](#sources-of-configuration-information)
    * [Config File](#config-file)
    * [Environment variable](#environment-variable)
    * [Command line](#command-line)
    * [Query args](#query-args)
    * [Programmatically](#programmatically)
* [Displaying config information](#displaying-config-information)
* [Properties](#properties)
    * [`bail`](#bail)
    * [`coverageSources`](#coveragesources)
    * [`environments`](#environments)
    * [`excludeInstrumentation`](#excludeinstrumentation)
    * [`extends`](#extends)
    * [`functionalSuites`](#functionalsuites)
    * [`grep`](#grep)
    * [`leaveRemoteOpen`](#leaveremoteopen)
    * [`loader`](#loader)
    * [`suites`](#suites)
    * [`tunnel`](#tunnel)

<!-- vim-markdown-toc -->
</details>

Intern (specifically the running Intern [executor](architecture.md#executors)) is configured with a standard JavaScript object. This object may contain properties applicable to either environment that Intern can run in (Node or browser). Config properties may be set via a file, the command line, browser query args, or an environment variable. All of these methods use the same basic syntax and provide the same capabilities.

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
* **Child configs**: named configs in the "configs" object; each of these can have any config properties but "configs" (i.e., general properties, Node resources, and browser resources).

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

By default, intern will try to load a file named `intern.json` from the project base directory. This file can be specified by passing a `config` property to the Node or browser runners.

A child config can be selected by adding `@<child>` to the config file name. For example, to load a child config named “ci” from the default config file, you could run:

    $ node_modules/.bin/intern config=@ci

To load a config named “remote” from a config file named “intern-local.json”, run:

    $ node_modules/.bin/intern config=intern-local.json@remote

### Environment variable

In a Node environment, Intern may be configured using an `INTERN_ARGS` environment variable. This variable may contain config properties in `property=value` format. Its contents will be parsed and processed in the same way as arguments passed on the command line.

    $ export INTERN_ARGS="grep=run.* excludeInstrumentation"

### Command line

Config properties may be provided directly on the command line when starting Intern. Properties must be specified using `property=value` syntax. For example,

    $ node_modules/.bin/intern grep='run.*' excludeInstrumentation

Object values may be input as serialized strings (e.g., `environments='{"browserName":"chrome"}'`). Array values may be set by repeating a property (e.g., `suites="foo.js" suites="bar.js"`).

### Query args

Query args work very similarly to command line args. They have the same format, but with URL query arg separators, and escaping of special characters as necessary.

    $ http://localhost:8080/node_modules/intern/?grep=run.*&excludeInstrumentation

### Programmatically

When creating an executor programmatically it may be configured via its constructor, and later with a `configure` method.

```ts
const intern = new Node({ grep: /run.*/, excludeInstrumentation: true });
```
_or_

```ts
intern.configure({ grep: /run.*/, excludeInstrumentation: true });
```

The configure method may be called any number of times before the testing process is started.

## Displaying config information

Intern has two config properties that can be used to display configuration information: `showConfig` and `showConfigs`.

**`showConfig`**

Setting the `showConfig` property to tru will dump the resolved configuration to the current environment’s console. When this property is true, Intern will print its resolved configuration as a JSON structure and exit.

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
| `browser` | browser | Resources (loader, plugins, reporters, require, suites) that only apply to browser tests |
| `capabilities` | node | Default capabilities to be used for WebDriver sessions |
| `connectTimeout` | node | When running WebDriver tests, how long (in ms) to wait for a remote browser to connect |
| [`coverageSources`](#coveragesources) | node | An array of paths or globs that should be included in coverage reports |
| `debug` | all | If true, display runtime messages to the console |
| `defaultTimeout` | all | The time, in ms, to wait for an async test to finish |
| `description` | all | Short string describing a test config |
| [`environments`](#environments) | node | Browser + OS combinations to be tested using WebDriver |
| [`excludeInstrumentation`](#excludeinstrumentation) | all | Regular expression used to filter which files are instrumented for code coverage |
| `filterErrorStack` | all | If true, filter non-application code lines out of stack traces |
| `functionalCoverage` | node | If true, include coverage statistics generated by functional tests |
| [`functionalSuites`](#suites-nodesuites-browsersuites-functionalsuites) | node | Suites to run using WebDriver |
| [`grep`](#grep) | all | Regular expression used to filter which suites and tests are run |
| `instrumenterOptions` | node | Options to pass to the code coverage instrumenter (Istanbul) |
| `internPath` | all | Relative path from project root to the Intern package |
| [`leaveRemoteOpen`](#leaveremoteopen) | node | If true, leave remote browsers open after testing has finished |
| [`loader`](#loader) | all | An optinal loader script and options |
| `maxConcurrency` | node | When running WebDriver tests, how may sessions to run at once |
| `name` | all | A name for a test run for use by reporters |
| `node` | browser | Resources (loader, plugins, reporters, require, suites) that only apply to node tests |
| `plugins` | all | A list of Intern extensions to load before tests begin |
| `reporters` | all | A list of reporters to use |
| `require` | all | A list of scripts or momdules to load before anything else |
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

There are also several properties that are handled by the config system aren’t directly involved in the testing process:

| Property | Description |
| :--------| :---------- |
| `description` | Short string describing a test config |
| [`extends`](#extends) | Indicates that the current config extends a config file |
| `showConfig` | When true, show the resolved configuration and exit |
| `showConfigs` | When true, show information about the currently loaded config file |

These properties are used to affect the configuration process or to display information about Intern’s configuration.

### `bail`

**Default**: `false`

By default, Intern will run all configured tests. Setting the `bail` option to `true` will cause Intern to stop running tests after the first failure.

### `coverageSources`

**Default**: `[]`

This property specifies an array of file paths or globs that should be included in coverage reports. Coverage data will automatically be gathered for all files loaded by Intern tests. Setting `coverageSources` will let Intern report on application files, even ones that weren’t loaded for tests. This allows a test writer to see which files _haven’t_ been tested, as well as coverage on files that were tested.

### `environments`

**Default**: `[]`

The `environments` property specifies the environments that will be used to run WebDriver tests. Its value can be a single browser name or an environment object, or an array of these.

```ts
environments: 'chrome'
environments: ['chrome', 'firefox']
environments: { browserName: 'chrome', version: '57.0' }
```

The syntax for browser names and other properties depends on where tests are being run. For example, when running tests using a local Selenium server, the browser name should be the lowercase name of a locally available browser, such as ‘chrome’ or ‘firefox’, and other properties such as the platform name will generally be ignored. When running on a cloud testing service such as [Sauce Labs](https://wiki.saucelabs.com/display/DOCS/Test+Configuration+Options#TestConfigurationOptions-RequiredSeleniumTestConfigurationSettings) or [BrowserStack](https://www.browserstack.com/automate/capabilities), browser names and other properties may have different acceptable values (e.g., ‘googlechrome’ instead of ‘chrome’, or ‘MacOS’ vs ‘OSX’).

### `excludeInstrumentation`

**Default**: `/(?:node_modules|browser|tests)\//`

This property may be assigned a regular expression or the value `true`. If assigned a regular expression, every module loaded by Intern, or served by its testing server, is tested against the expression. Files that match are not [instrumented](concepts.md#code-coverage), while files that do not match are instrumented. If `excludeInstrumentation` is set to `true`, code coverage support is disabled entirely.

### `extends`

**Default**: `undefined`

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

### `functionalSuites`

**Default**: `[]`

Functional suites are files that register [WebDriver tests](writing_tests.md). Suites may be specified as a string path, a glob expression, or an array of strings and/or globs.

### `grep`

**Default**: `/.*/`

The `grep` property is used to filter which tests are run. Grep operates on test IDs. A test ID is the concatenation of a test name with all of its parent suite names.

### `leaveRemoteOpen`

**Default**: `false`

Normally when Intern runs tests on remote browsers, it shuts them down when testing is finished. However, you may sometimes want to inspect the state of a remote browser after tests have run, particularly if you're trying to debug why a test is failing. Setting `leaveRemoteOpen` to true will cause Intern to leave the browser open after testing. Setting it to `'fail'` will cause Intern to leave it open only if there were test failures.

### `loader`

**Default**: `/.*/`

The `loader` property can be a string with a loader name or the path to a [loader script](./architecture.md#loaders). It may also be an object with `script` and `options` properties. Intern provides built-in loader scripts for Dojo, Dojo 2, and SystemJS, accessible through the aliases ‘dojo’, ‘dojo2’, and 'systemjs'.

```ts
loader: 'dojo2'
loader: 'tests/loader.js'
loader: { script: 'dojo', options: { packages: [ { name: 'app', location: './js' } ] } }
```

### `suites`

**Default**: `[]`

Suites are files that register unit tests. Suites may be specified as a string path, a glob expression, or an array of strings and/or globs.

### `tunnel`

**Defautl**: `'selenium'`

The `tunnel` property specifies which Dig Dug tunnel class to use for WebDriver testing. There are several built in tunnel types, and others can be added through the Node executor’s [`registerPlugin` method](./architecture.md#extension-points).

The built in tunnel classes are:

* 'null'
* 'selenium'
* 'browserstack'
* 'cbt' (CrossBrowserTesting)
* 'saucelabs'
* 'testingbot'
