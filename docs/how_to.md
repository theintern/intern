# How To...

<!-- vim-markdown-toc GFM -->
* [Use Intern programmatically](#use-intern-programmatically)
* [Run code before tests start](#run-code-before-tests-start)
* [Run Intern in my own test page in a browser](#run-intern-in-my-own-test-page-in-a-browser)
* [Write tests in an HTML page](#write-tests-in-an-html-page)
* [Test ES modules](#test-es-modules)
* [Use Intern with a remote service like BrowserStack](#use-intern-with-a-remote-service-like-browserstack)

<!-- vim-markdown-toc -->

## Use Intern programmatically

1. Load Intern
   * In node:
     ```js
     import intern from 'intern';
     ```
   * In the browser, load the 'browser/intern.js' script
     ```html
     <script src="node_modules/intern/browser/intern.js"></script>
     ```
2. Configure Intern
   ```js
   intern.configure({
       suites: [
           'tests/unit/a.js',
           'tests/unit/b.js'
       ],
       reporters: 'runner'
   });
   ```
3. Run Intern
   ```js
   intern.run();
   ```

## Run code before tests start

There several ways to accomplish this:

* If you just need to run some self-contained, synchronous setup code before testing starts, use a `require` script.
  ```js
  // setup.js
  intern.config.suites.push('./some/other/suite.js')
  ```
  ```js
  // intern.json
  {
      "require": "setup.js"
  }
  ```
* If your setup code is still self-contained but needs to do something asynchronous, you can still load it as a `require` script, but use a `beforeRun` callback to handle the async code:
  ```js
  // setup.js
  intern.on('beforeRun', function () {
      return new Promise(function (resolve) {
          // async code
      });
  });
  ```
* If your startup code needs to load modules using your test loader (one configured with the [`loader`](./configuration.md#loder) option), register it as a plugin. These can run async initialization code in the [`registerPlugin`](./api.md#registerpluginid-callback) method, and also have access to any module loader configured for the tests.
   ```js
   // setup.js
   const bar = require('./bar');
   intern.registerPlugin('foo', function () {
       return bar.getSomething().then(function (something) {
           // more async code
       });
   });
   ```
   ```js
   // intern.json
   {
       "plugins": "setup.js"
   }
   ```

## Run Intern in my own test page in a browser

Load the `browser/intern.js` bundle in a page using a script tag. This will create an `intern` global that can be used
to configure Intern and start tests.

```html
<!DOCTYPE html>
<html>
    <head>
        <script src="node_modules/intern/browser/intern.js"></script>
        <script>
            intern.configure({
                suites: [
                    'tests/unit/a.js',
                    'tests/unit/b.js'
                ],
                reporters: 'html'
            });
            intern.run();
        </script>
    </head>
    <body>
    </body>
</html>
```

If you’d rather not install Intern, you can load the package from a CDN, like:

```html
<script src="https://unpkg.com/intern@next/browser/intern.js"></script>
```

## Write tests in an HTML page

```html
<!DOCTYPE html>
<html>
    <head>
        <script src="https://unpkg.com/intern@next/browser/intern.js"></script>
        <script>
            var registerSuite = intern.getInterface('object').registerSuite;
            registerSuite('app/module', {
                test1: function () {
                    // ...
                },
                test2: function () {
                    // ...
                },
                // ...
            });
            intern.config({ reporters: 'html' });
            intern.run();
        </script>
    </head>
    <body>
    </body>
</html>
```

## Test ES modules

To work with ES modules in Node, install babel-register and load it as a plugin:

```js
// intern.json
{
    "node": {
        "require": "node_modules/babel-register/lib/node.js"
    }
}
```

To work with ES modules in the browser, you’ll need to setup a loader. One option is to use SystemJS configured with babel support:

```js
// intern.json
{
    "browser": {
        "loader": {
            "script": "systemjs",
            "options": {
                "map": {
                    "plugin-babel": "node_modules/systemjs-plugin-babel/plugin-babel.js",
                    "systemjs-babel-build": "node_modules/systemjs-plugin-babel/systemjs-babel-browser.js"
                },
                "transpiler": "plugin-babel"
            }
        }
    }
}
```

To get code coverage in the browser when using Intern in WebDriver mode, enable ESM support in the instrumenter with:

```js
// intern.json
{
    "instrumenterOptions": {
        "esModules": true
    }
}
```

## Use Intern with a remote service like BrowserStack

1. Write some unit and/or functional test suites and add them to your `intern.json`
   ```js
   // intern.json
   {
       "suites": "tests/unit/*.js",
       "functionalSuites": "tests/functional/*.js"
   }
   ```
2. Select the desired [tunnel](configuration.md#tunnel) in your `intern.json`
   ```js
   // intern.json
   {
       "tunnel": "browserstack"
   }
   ```
3. Provide your auth credentials using environment variables or in your `intern.json`
   ```
   $ export BROWSERSTACK_USERNAME=someone@somedomain.com
   $ export BROWSERSTACK_ACCESS_KEY=123-456-789
   ```
   _or_
   ```js
   // intern.json
   {
       "tunnelOptions": {
           "username": "someone@somedomain.com",
           "accessKey": "123-456-789"
       }
   }
   ```
4. Run Intern
   ```
   $ node_modules/.bin/intern
   ```
