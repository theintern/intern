# How To...

<!-- vim-markdown-toc GFM -->
* [Use Intern programmatically](#use-intern-programmatically)
* [Run code before tests start](#run-code-before-tests-start)
* [Run Intern in my own test page in a browser](#run-intern-in-my-own-test-page-in-a-browser)
* [Write tests in an HTML page](#write-tests-in-an-html-page)
* [Test ES modules](#test-es-modules)
* [Use Intern with a remote service like BrowserStack](#use-intern-with-a-remote-service-like-browserstack)
* [Test non-modular code](#test-non-modular-code)
* [Test non-CORS web APIs](#test-non-cors-web-apis)
    * [Option 1: Send all traffic except web services to Intern](#option-1-send-all-traffic-except-web-services-to-intern)
    * [Option 2: Only send JavaScript traffic to Intern](#option-2-only-send-javascript-traffic-to-intern)

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

## Test non-modular code

Browser code that doesn’t support any module system and expects to be loaded along with other dependencies in a specific order can be loaded using the `require` config option.

```js
// intern.json
{
    "browser": {
        "require": [
            "lib/jquery.js",
            "lib/plugin.jquery.js"
        ]
    }
}
```

Modules specified in a `require` array are loaded sequentially in the order specified.

## Test non-CORS web APIs

When writing unit tests with Intern, occasionally you will need to interact with a Web service. However, because the Intern serves code at `http://localhost:9000` by default, any cross-origin requests will fail. In order to test Ajax requests wihtout using CORS of JSONP, setup a reverse proxy to Intern and tell the in-browser test runner to load from that URL by setting the `serverUrl` configuration option.

### Option 1: Send all traffic except web services to Intern

1. Set Intern’s `serverUrl` config option to point to the URL of the web server
2. Set the web server to reverse proxy to `http://localhost:9000` by default
3. Add `location` directives to pass web service URLs to the web service instead

An nginx config implementing this pattern might look like:

```nginx
server {
  server_name proxy.example;

  location /web-service/ {
    # This will proxy to http://www.web-service.example/web-service/<rest of url>;
    # use `proxy_pass http://www.web-service.example/` to proxy to
    # http://www.web-service.example/<rest of url> instead
    proxy_pass http://www.web-service.example;
  }

  location / {
    proxy_pass http://localhost:9000;
  }
}
```

### Option 2: Only send JavaScript traffic to Intern

1. Set Intern’s `serverUrl` config option to point to the URL of the web server
2. Set the web server to reverse proxy to `http://localhost:9000` for the special `/__intern/` location, plus any directories containing JavaScript code


An nginx config implementing this pattern might look like:

```nginx
server {
  server_name proxy.example;
  root /var/www/;

  location /js/ {
    proxy_pass http://localhost:9000;
  }

  location /__intern/ {
    proxy_pass http://localhost:9000;
  }

  location / {
    try_files $uri $uri/ =404;
  }
}
```
