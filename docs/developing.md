# Developing

Intern is written in TypeScript. The various build lifecycle steps (build, test, etc.) are handled through `npm`, and
are mostly implemented by scripts in the [intern-dev](https://github.com/theintern/intern-dev) package.

## Building Intern

Before you can do much else, you'll need to install Intern’s development dependencies:

    $ npm install

To build Intern, just run:

    $ npm run build

## Running Self-Tests

To run the existing unit tests, use:

    $ npm test

Intern’s self tests work by using two different builds of the current version of Intern, one in `_tests` and one in
`_build`. Both instances are generated when building Intern. The version in `_tests` is then used to run tests against
the version in `_build`.

To disable the remote tests, use:

    $ npm test environments=

## Writing Self-Tests

Tests are in the `tests` directory, and the test config is the `intern.json` file in the project root. Tests are
organized by type in `unit`, `functional`, and `benchmark` directories. The directory structure within each type should
mirror the main src directory structure. For example, unit tests for `src/lib/executors/Executor` should go in
`tests/unit/lib/executors/Executor`.

### TypeScript

As with the main Intern source, self-tests are written in TypeScript. The tests have their own `tsconfig.json` file that
inherits from the main Intern tsconfig. The key difference is that the test tsconfig file defines a path mapping for the
non-relative “src” path. This saves a bit of typing during test writing, but the main advantage is that this path can be
re-mapped at runtime to point to files in the `_build/src` directory. This process is described a bit more in the
next section.

### SystemJS

Self tests in the browser use the [SystemJS](https://github.com/systemjs/systemjs) loader so that individual Intern
modules to be loaded in the browser. The self-tests use the built-in `systemjs` loader script, with the loader config
provided by the `intern.json` file.

The benchmark.js library has issues with SystemJS in the browser, so a preload script is loaded from
`_tests/tests/pre.js` to do some environmental fixup. Specifically, benchmark.js expects that either an AMD define
function or a global Benchmark property will exist when it is running benchmarks. It doesn't actually need either of
these values; it just uses one of them as an anchor object to attach other values to. When benchmark.js is loaded by
SystemJS in the browser, neither of these properties will exist, so the preload script simply creates an empty Benchmark
global in this situation.
