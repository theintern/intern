# How To...

<!-- vim-markdown-toc GFM -->
* [Run Intern in my own test page in a browser](#run-intern-in-my-own-test-page-in-a-browser)
* [Write tests in an HTML page](#write-tests-in-an-html-page)
* [Test ES modules](#test-es-modules)

<!-- vim-markdown-toc -->

## Run Intern in my own test page in a browser

Load the `browser/intern.js` bundle in a page using a script tag. This will create an `intern` global that can be used
to configure Intern and start tests.

```html
<!DOCTYPE html>
    <head>
        <script src="node_modules/intern/browser/intern.js"></script>
        <script>
            intern.config({
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
    <head>
        <script src="https://unpkg.com/intern@next/browser/intern.js"></script>
        <script>
            var registerSuite = intern.getPlugin('interface.object').registerSuite;
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
  "plugins": "node_modules/babel-register/lib/node.js"
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

To get code covereage in the browser when using Intern in WebDriver mode, enable ESM support in the instrumenter with:

```js
// intern.json
{
  "instrumenterOptions": {
    "esModules": true
  }
}
```
