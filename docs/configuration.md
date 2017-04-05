# Configuration

Configuring Intern means passing some configuration information to the currently running executor. Each executor can be
configured by passing an object of configuration properties to the executor’s `initialize` static method, its
constructor, or to its `config` method. Any config property may also be specified as a command line or query arg using
the format `property=value`. Simply serialize the value to a string (e.g., `environments='{"browserName":"chrome"}'`).

The executor will validate and normalize any supplied config properties. This means that the property values on the
`config` property on the executor may not correspond exactly to the values provided via a config file or config object.
For example, several properties such as `suites` and `environments` may be specified as a single string for convenience,
but they will always be normalized to a canonical format on the executor config object. For example,
`environments=chrome` will end up as

```js
environments: [ { browserName: 'chrome' } ]
```

on the executor’s config object.

## Config File

The runner scripts (browser or Node-based) understand a `config` property, which specifies a JSON config file. When this
property is specified, the runner will load the config file and initialize the executor with it. If the `config`
property is not specified, each runner will look for an `intern.json` file in the project root.

The config file is simply a JSON file specifying config properties, for example:

```js
{
  "environments": [
    { "browserName": "chrome" }
  ],
  suites: [ "tests/unit/all.js" ]
}
```

## Properties

These are some of the most often used configuration properties:

* bail
* baseline
* benchmark
* debug
* [environments](#environments)
* excludeInstrumentation
* filterErrorStack
* [grep](#grep)
* [loader](#loader)
* [preload](#preload)
* reporters
* [suites](#suites-nodesuites-browsersuites-functionalsuites)
* [nodeSuites](#suites-nodesuites-browsersuites-functionalsuites)
* [browserSuites](#suites-nodesuites-browsersuites-functionalsuites)
* [functionalSuites](#suites-nodesuites-browsersuites-functionalsuites)

#### `environments`

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

### `grep`

The `grep` property is used to filter which tests are run. Grep operates on test IDs. A test ID is the concatenation

#### `loader`

The `loader` property can be a string with a loader name or the path to a [loader script](./architecture.md#loaders). It
may also be an object with `script` and `config` properties. Intern provides built-in loader scripts for Dojo and Dojo2,
which can be specified with the IDs ‘dojo’ and ‘dojo2’.

```ts
loader: 'dojo2'
loader: 'tests/loader.js'
loader: { script: 'dojo', config: { packages: [ { name: 'app', location: './js' } ] } }
```

#### `preload`

The `preload` property can be a single string or an array of strings, where each string is the path to a [preload
script](./architecture.md#preload-scripts) file.

#### `suites`, `nodeSuites`, `browserSuites`, `functionalSuites`

There are several properties that specify suites. Which properties are used depends on the executor:

* Node
  * `suites` + `nodeSuites`
* Browser
  * `suites` + `browserSuites`
* WebDriver
  * `suites` + `browserSuites` (in remote browsers)
  * `functionalSuites` (locally)

In each case, the property value may be given as a single string or an array of strings, where each string is the path
to a script file.

Note that executors themselves don’t load suites; this is handled by a loader script (either one of Intern’s built-in
scripts or a user-supplied one).
