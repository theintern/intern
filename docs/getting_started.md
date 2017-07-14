# Getting Started

<!-- vim-markdown-toc GFM -->
* [Project structure](#project-structure)
* [Installing Intern](#installing-intern)
* [Initial configuration](#initial-configuration)
* [Running intern](#running-intern)
* [Tutorials and examples](#tutorials-and-examples)

<!-- vim-markdown-toc -->

## Project structure

Intern is very flexible, and doesn’t enforce any particular directory structure. However, this is one we've found to be convenient:

```
project_root/
  intern.json    - Intern config
  dist/          - Built code
  node_modules/  - Node.js dependencies (including Intern)
  src/           - Front-end source code
    app/         - Application code
    index.html   - Application entry point
  tests/         - Intern tests
    functional/  - Functional tests
    support/     - Test support code (utility functions, custom reporters, etc.)
    unit/        - Unit tests
```

The only assumptions made by Intern are that it will be run from the project root (the default if run using `npm`) and that an `intern.json` file will exist in the project root. Neither of these are hard requirements, but following them will make using Intern a bit easier.

## Installing Intern

Intern is distributed as an npm package. To install, just run:

```sh
npm install intern@next
```

## Initial configuration

Intern can be [configured](./configuration.md) in several ways, but the most common is via an `intern.json` file in the project root. A basic config for running unit and functional tests is:

```js
{
    "suites": "tests/unit/**/*.js",
    "functionalSuites": "tests/functional/**/*.js"
}
```

This simply tells Intern to run all js files under `tests/unit/` as unit tests, and all js files under `tests/functional/` as functional tests.

## Running intern

Run Intern by running the `intern` script:

```sh
node_modules/.bin/intern
```

Intern will automatically look for an `intern.json` in the project root, load it, and run the configured tests.

You can also run Intern in the browser. Serve the project root using a static server such as nginx or node-static, then browse to (assuming the project is being served at localhost:8080/):

```
http://localhost:8080/node_modules/intern/
```

Intern will load the `intern.json` file in the project root and run the configured tests.

## Tutorials and examples

To help users get started with Intern, we’ve created a basic [tutorial project](https://github.com/theintern/intern-tutorial) that walks through the steps required to install and configure Intern, and to run tests against a simple demo application. There are also a number of [example integrations](https://github.com/theintern/intern-examples) for popular libraries, including Angular, Backbone, and React.

⚠️  Note that as frameworks change, or as new frameworks become popular, the examples may become outdated. We’d love it if you’d [submit your own examples](https://github.com/theintern/intern-examples/fork) to make Intern easier for new users!
