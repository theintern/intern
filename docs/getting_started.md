# Getting Started

<!-- vim-markdown-toc GFM -->

* [Project structure](#project-structure)
* [Installing Intern](#installing-intern)
* [Writing tests](#writing-tests)
* [Initial configuration](#initial-configuration)
* [Running intern](#running-intern)
* [Tutorials and examples](#tutorials-and-examples)

<!-- vim-markdown-toc -->

## Project structure

Intern is very flexible, and doesn’t enforce any particular directory structure.
However, this is one we’ve found to be convenient:

```
project_root/
  intern.json    - Intern config
  build/         - Built code
  node_modules/  - Node.js dependencies (including Intern)
  src/           - Front-end source code
    app/         - Application code
    index.html   - Application entry point
  tests/         - Intern tests
    functional/  - Functional tests
    support/     - Test support code (utility functions, custom reporters, etc.)
    unit/        - Unit tests
```

The only assumptions made by Intern are that it will be run from the project
root (the default if run using `npm`) and that an `intern.json` file will exist
in the project root. Neither of these are hard requirements, but following them
will make using Intern a bit easier.

## Installing Intern

Intern is distributed as an npm package. To install, just run:

```sh
npm install intern
```

## Writing tests

Tests can be placed anywhere in the project, but Intern tests are often put in a
`tests/` directory, which cleanly separates testing resources from actual code.

A very simple [unit test](concepts.md#unit-tests) suite might look like:

```ts
// tests/unit/MyClass.ts
import MyClass from '../../src/app/MyClass';

const { describe, it } = intern.getPlugin('interface.bdd');
const { expect } = intern.getPlugin('chai');

describe('MyClass', () => {
  it('should have a name property when instantiated', () => {
    const obj = new MyClass('foo');
    expect(obj).to.have.property('name', 'foo');
  });
});
```

A simple [functional test suite](concepts.md#functional-tests) might look like:

```ts
// tests/functional/app.ts
const { describe, it } = intern.getPlugin('interface.bdd');
const { expect } = intern.getPlugin('chai');

describe('app', () => {
  it('should show a welcome heading', async test => {
    const { remote } = test;
    // Load the page
    await remote.get('index.html');
    // Search for an h1 element with the text "Welcome"
    await remote.findByXpath('//h1[.="Welcome"]');
  });
});
```

For more information about writing tests, see [Writing Tests](writing_tests.md).

## Initial configuration

Intern can be [configured](configuration.md) in several ways, but the most
common is via an `intern.json` file in the project root. A basic config for
running unit and functional tests is:

```json5
{
  suites: 'tests/unit/**/*.js',
  functionalSuites: 'tests/functional/**/*.js',
  environments: ['node', 'chrome']
}
```

This simply tells Intern to run all js files under `tests/unit/` as unit tests,
and all js files under `tests/functional/` as functional tests. Unit tests will
be run in Node and Chrome, and functional tests will be run using Chrome.

## Running intern

Run Intern by running the `intern` script:

```sh
npx intern
```

Intern will automatically look for an `intern.json` in the project root, load
it, and run the configured tests.

You can also run Intern in the browser. Start Intern’s test server using
`npx intern serveOnly`, or serve the project root using a static server such as
nginx or node-static, then browse to (assuming the project is being served at
localhost:9000/):

```
http://localhost:9000/node_modules/intern/
```

Intern will load the `intern.json` file in the project root and run the
configured tests.

## Tutorials and examples

To help users get started with Intern, we’ve created a basic
[tutorial project](https://github.com/theintern/intern-tutorial) that walks
through the steps required to install and configure Intern, and to run tests
against a simple demo application. There are also a number of
[example integrations](https://github.com/theintern/intern-examples) for popular
libraries, including Angular, Backbone, and React.

> ⚠️ Note that as frameworks change, or as new frameworks become popular, the
> examples may become outdated. We’d love it if you’d
> [submit your own examples](https://github.com/theintern/intern-examples/fork)
> to make Intern easier for new users!
