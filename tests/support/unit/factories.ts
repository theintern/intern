/**
 * Factories are convenience functions for creating instances of normal classes
 * (not mocks).
 */
import Test from 'src/core/lib/Test';
import Suite from 'src/core/lib/Suite';
import { createMockExecutor } from './mocks';

/**
 * Create a new Suite with default required values and any given properties
 * replaced
 */
export function createSuite(properties?: { [P in keyof Suite]?: Suite[P] }) {
  let suite = new Suite({
    name: 'suite',
    executor: createMockExecutor()
  });
  if (properties) {
    suite = Object.create(suite);
    Object.assign(suite, properties || {});
  }
  return suite;
}

/**
 * Create a new Test with default required values and any given properties
 * replaced
 */
export function createTest(properties?: { [P in keyof Test]?: Test[P] }) {
  let test = new Test({
    name: 'test',
    test() {}
  });
  if (properties) {
    test = Object.create(test);
    Object.assign(test, properties || {});
  }
  return test;
}
