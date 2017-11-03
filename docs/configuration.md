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
    * [showConfig](#showconfig)
    * [showConfigs](#showconfigs)
* [Environment-specific config](#environment-specific-config)
* [Properties](#properties)
    * [Suite glob expressions](#suite-glob-expressions)
    * [extends](#extends)
* [Configuration resolution](#configuration-resolution)

<!-- vim-markdown-toc -->

Intern is configured with a standard JavaScript object. This object may contain properties applicable to either environment that Intern can run in (Node or browser). Config properties may be set via a file, the command line, browser query args, or an environment variable. All of these methods use the same basic syntax and provide the same capabilities. Assuming Intern is being run with the default [Node runner](./running.md#node) or [browser runner](./running.md#browser) and without a `config` argument, Intern will attempt to load configuration informatioon from an `intern.json` file in the project root.

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
* **Node-specific resources**: resource properties ("loader", "plugins", "reporters", "suites") that apply only to Node environments.
* **Browser-specific resources**: resource properties ("loader", "plugins", "reporters", "suites") that apply only to browser environments.
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

When creating an executor programmatically it may be configured via its constructor, and/or via its `configure` method.

```js
const intern = new Node({ grep: /run.*/, suites: [] });
```
_or_

```js
intern.configure({ grep: /run.*/, suites: [] });
```

The `configure` method may be called any number of times before the testing process is started.

## Displaying config information

Intern has two config properties that can be used to display configuration information: `showConfig` and `showConfigs`.

### showConfig

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

### showConfigs

Setting the `showConfigs` property to `true` will cause Intern to show information about a given config file. Intern will print the value of the current config file’s `description` property, and then list all child configs contained in the config file. For example, with a config file containing the following data:

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

Tests can run in two basic environments: Node and browsers. By default, “resource” properties (`suites`, `plugins`, `reporters`, and `loader`) in a config file apply to both environments. This means that if the same config is used to run tests in a browser and in Node, the same resources will be loaded in both environments. In some cases this isn’t desirable because tests may load application code that depends on environment-specific properties or features, such as the DOM. Intern’s config provides `node` and `browser` properties for this use case. These properties specify resources that will only be loaded in the given environment.  The values in these properties will be [shallowly mixed into the base config](#configuration-resolution) rather than replacing it.

> ⚠️ Note that this is different than the `mode` property in Intern 3, which had values of “client” or “runner”. Intern 3’s mode indicated whether tests were being run in unit test or functional test mode, but it was sometimes used as an environment check due to the fact that functional tests always run in Node.

## Properties

A number of config properties are applicable whether Intern is running in Node or directly in a browser. Some of the more common ones are listed below.

> 💡 See [the API docs](https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/config-1) for a complete list of the available config properties.

| Property                 | Description                                                                                | Default
| :-------                 | :----------                                                                                | :------
| [bail]                   | When true, stop testing after the first failure                                            | `false`
| [baseline]               | When true, run benchmark tests in baseline mode                                            | `false`
| [benchmark]              | When true, run benchmark tests (if loaded)                                                 | `false`
| [debug]                  | If true, display runtime messages to the console                                           | `false`
| [defaultTimeout]         | The time, in ms, before an async test times out                                            | 30000
| [filterErrorStack]       | If true, filter non-application code lines out of stack traces                             | `false`
| [grep]                   | Regular expression used to filter which suites and tests are run                           | `/.*/`
| [loader]                 | An optional loader script and options                                                      | `{ script: 'default' }`
| [plugins]                | A list of Intern extensions to load before tests begin                                     | `[]`
| [reporters]              | A list of reporters to use                                                                 | `[]`
| [suites]                 | A list of suite paths or [globs](#suite-glob-expressions) to load unit tests from          | `[]`

Some properties are only meaningful for Node or WebDriver tests:

| Property                 | Description                                                                                | Default
| :-------                 | :----------                                                                                | :------
| [capabilities]           | Default capabilities to be used for WebDriver sessions                                     | `{ 'idle-timeout': 60 }`
| [coverage]               | An array of paths or globs to collect coverage data for                                    | `[]`
| [environments]           | Browser + OS combinations to be tested using WebDriver                                     | `[]`
| [functionalSuites]       | Suites to run in WebDriver mode                                                            | `[]`
| [functionalTimeouts]     | Timeouts used in functional tests                                                          | `{ connectTimeout: 30000 }`
| [leaveRemoteOpen]        | If true, leave remote browsers open after testing has finished                             | `false`
| [serveOnly]              | When true, Intern will start its instrumenting web server but not run tests                | `false`
| [serverPort]             | The port the instrumenting server should listen on                                         | `9000`
| [serverUrl]              | A URL a remote executor can use to reach the local Intern                                  | `http://localhost:9000`
| [tunnel]                 | The name of a tunnel to use for WebDriver tests                                            | `selenium`
| [tunnelOptions]          | Options to use for the WebDriver tunnel                                                    | `{ tunnelId: Date.now() }`

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
| help        | Display a help message                                             |
| showConfig  | When true, show the resolved configuration and exit                |
| showConfigs | When true, show information about the currently loaded config file |

### Suite glob expressions

Suites may be specified as file paths or using glob expressions. Globbing is handled with the [glob](https://github.com/isaacs/node-glob) Node package.

```js
{
    "suites": [
        "tests/unit/**/*.js",
        "tests/integration/foo.js"
    ]
}
```

Intern also understands glob-based exclusion using the `!` modifier:

```js
{
    "suites": [
        "tests/**/*.js",
        "!tests/functional/**"
    ]
}
```

Note that using globs with the browser client _requires_ that Intern’s own server be used to serve test suites. This is because the browser client on its own has no way to resolve file system globs; it passes the to the Intern server running on Node, which resolves them and returns list of file paths.

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

Given the config above, and assuming child config “d” is selected, the following resolution process will occur:

1. Child “c” will be mixed into child “a”
2. Child “d” will be mixed into the result of 1
3. The result of 2 will be mixed into the base config
4. The result of 3 will be the resolved config

## Configuration resolution

At runtime, the environment-specific resources and any [active child configs](#config-file) will be mixed into the resolved config. In general, properties from from more specific sources will override properties from lower precedence sources. The order of precedence, from lowest to highest, is:

1. A config being extended by the current config
2. The current config
3. An active child config in the current config

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
2. **Resource arrays in "node" or "browser" ("plugins", "reporters", "suites"), are added to the corresponding resource arrays in the base config.** For example, if the base config has:
   ```js
   "suites": [ "tests/unit/foo.js" ]
   ```
   and the "node" section has:
   ```js
   "suites": [ "tests/unit/bar.js" ]
   ```
   both sets of suites will be loaded when running on Node.
3. **Some properties can be extended (rather than replaced) by adding a '+' to the property name.** For example, if the
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
   Extendable properties are resources (**suites**, **plugins**, **reporters**), **instrumenterOptions**, **tunnelOptions**, and **capabilities**.

[bail]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/bail
[baseline]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/baseline
[benchmark]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/benchmark
[capabilities]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FNode/capabilities
[coverage]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FNode/coverage
[debug]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/debug
[defaultTimeout]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/defaulttimeout
[environments]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FNode/environments
[extends]: #extends
[filterErrorStack]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/filtererrorstack
[functionalSuites]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FNode/functionalsuites
[functionalTimeouts]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FNode/functionaltimeouts
[grep]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/grep
[leaveRemoteOpen]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FNode/leaveremoteopen
[loader]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/loader
[plugins]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/plugins
[reporters]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/reporters
[serveOnly]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FNode/serveonly
[serverPort]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FNode/serverport
[serverUrl]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FNode/serverurl
[suites]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/suites-1
[tunnel]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FNode/tunnel-1
[tunnelOptions]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FNode/tunneloptions
