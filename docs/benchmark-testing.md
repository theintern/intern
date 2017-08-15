# Benchmark testing

Intern's benchmark testing mode is used to evaluate the performance of code. Test functions will be run many times in a loop, and Intern will record how long each test function takes to run on average. This information can be saved and used during later test runs to see if performance has deviated from acceptable values.

The benchmarking functionality is driven by [Benchmark.js](https://benchmarkjs.com/).

## Writing a benchmark test

Tests are created using the [benchmark interface](./interfaces.md#the-benchmark-interface), which is very much like the unit test [object interface](./interfaces.md#the-object-interface), and follow a similar lifecycle. The main differences are in how `before/afterEach` behave and the requirement to use `async` and `skip` wrappers rather than `this.async()` and `this.skip()`.

## The benchmark test lifecycle

The benchmark test lifcycle is very similar to standard tests.

-   For *each registered root suite*:
    -   The [setup](./internals.md#the-suite-object) method of the suite is called, if it exists
    -   For *each test* within the suite:
        -   The [beforeEach](./internals.md#the-suite-object) method of the suite is called, if it exists
        -   The benchmark is started. This involves calling the test function itself many times in a "test loop". For each execution of the test loop, the following steps take place:
            -   The [beforeEachLoop](./internals.md#the-suite-object) method of the suite is called, if it exists
            -   The test function is called at least once
            -   The [afterEachLoop](./internals.md#the-suite-object) method of the suite is called, if it exists
        -   The [afterEach](./internals.md#the-suite-object) method of the suite is called, if it exists
    -   The [teardown](./internals.md#the-suite-object) method of the suite is called, if it exists
