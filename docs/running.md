# Running Intern

<!-- vim-markdown-toc GFM -->
* [Built-in runners](#built-in-runners)
    * [Node](#node)
    * [Browser](#browser)
* [Grunt](#grunt)
* [Custom Node Script](#custom-node-script)
* [Custom HTML Page](#custom-html-page)

<!-- vim-markdown-toc -->

## Built-in runners

The Node and browser built-in runners load configuration information from the command line / query args and/or a config
file. There are no special command line flags; in both cases, command line options are [config
properties](configuration.md#properties).

### Node

The node runner is a built in script for running Node-based unit tests and WebDriver tests. Usage can be very simple:

    $ node_modules/.bin/intern

Of course, it can be called from a `package.json` file even more simply:

```js
{
    "scripts": {
        "test": "intern"
    }
}
```

By default, the runner looks for an `intern.json` config file in the project root. This can be changed by providing a
`config` property on the command line, like `config=tests/myconfig.json`. The runner will also accept any other config
properties as command line arguments. For example,

    $ node_modules/.bin/intern suites=tests/foo.js grep=feature1

would only load the suite in `tests/foo.js`, and would only run tests containing the string ‘feature1’ in their IDs.

### Browser

The browser runner is a built-in HTML page for running browser-based unit tests. To use it, serve the project root
directory using a static webserver and browse to (assuming the server is running on port 8080):

    http://localhost:8080/node_modules/intern/

Similar to the Node runner script, the browser runner will accept a config argument, or any other config properties, as
query args.

    http://localhost:8080/node_modules/intern/?suites=tests/foo.js&grep=feature1

Note that the browser runner can only be used to run unit tests, not functional (i.e., WebDriver) tests.

## Grunt

Intern includes a Grunt task that can be loaded with

```js
grunt.loadNpmTasks('intern');
```

The task may be configured using the same options as are used in an `intern.json` file. For example, consider the
following `intern.json` file:

```js
{
  "suites": "tests/unit/**/*.js",
  "plugins": "tests/pre.js",
  "loader": {
    "script": "dojo",
    "config": {
      "packages": [{"name": "app", "location": "."}]
    }
}
```

An equivalent Grunt config that used the Node executor would look like:

```js
module.exports = function (grunt) {
    grunt.initConfig({
        intern: {
            node: {
                options: {
                    suites: "tests/unit/**/*.js",
                    plugins: "tests/pre.js"
                    "loader": {
                        "script": "dojo",
                        "config": {
                            "packages": [{"name": "app", "location": "."}]
                        }
                    }
                }
            }
        }
    });

    // Loading using a local git copy
    grunt.loadNpmTasks('intern');
};
```

Note that the Grunt task runner doesn’t use the config file loading logic employed by the Node and browser runners. The
assumption is that Grunt will be used to construct the desired config.

## Custom Node Script

Intern may also be configured and run with a custom script. The basic steps this script must perform are:

1. Import/require the Node executor
2. [Construct a new instance of Node](configuration.md#programmatically) and assign it to the `intern` global. The
   config should include at least one suite and a reporter.
   ```js
   global.intern = new Node({
       suites: 'tests/unit/a.js',
       reporters: 'runner'
    });
    ```
3. Call `intern.run()`

## Custom HTML Page

Intern may be configured and run in a browser with a custom HTML page. The basic steps are:

1. Load the Browser executor (`<script src="node_modules/intern/browser/intern.js"></script>`). The `intern.js` script
   will automatically initialize a Browser executor and assign it to an `intern` global.
2. [Configure the executor](configuration.md#programmatically). Include at least one suite at a reporter.
   ```js
   intern.configure({
       suites: 'tests/unit/a.js',
       reporters: 'html'
   });
    ```
3. Call `intern.run()`
