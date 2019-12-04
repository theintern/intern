import Command from 'src/webdriver/Command';
import pollUntil from 'src/webdriver/helpers/pollUntil';
import { createSessionFromRemote } from '../support/util';
import { ObjectSuiteDescriptor } from 'src/core/lib/interfaces/object';

registerSuite('leadfoot/helpers/pollUntil', () => {
  let command: Command<any>;

  return {
    before() {
      const remote = this.remote;
      return createSessionFromRemote(remote).then(session => {
        command = new Command<void>(session);
      });
    },

    tests: {
      'basic test'() {
        return command
          .get('tests/functional/data/elements.html')
          .findById('makeD')
          .click()
          .then(pollUntil('return document.getElementById("d");', [], 1000))
          .then(function(result: any) {
            assert.property(
              result,
              'elementId',
              'Returned value should be an element'
            );
          });
      },

      'with args'() {
        return command
          .get('tests/functional/data/elements.html')
          .findById('makeD')
          .click()
          .then(
            pollUntil(
              id => {
                return document.getElementById(id);
              },
              ['d'],
              1000
            )
          )
          .then(function(result: any) {
            assert.property(
              result,
              'elementId',
              'Returned value should be an element'
            );
          });
      },

      'without args'() {
        return command
          .get('tests/functional/data/elements.html')
          .findById('makeD')
          .click()
          .then(pollUntil('return document.getElementById("d");', 1000))
          .then(function(result: any) {
            assert.property(
              result,
              'elementId',
              'Returned value should be an element'
            );
          });
      },

      'early timeout'() {
        return command
          .get('tests/functional/data/elements.html')
          .findById('makeDSlowly')
          .click()
          .then(pollUntil('return document.getElementById("d");', [], 100, 25))
          .then(
            function() {
              throw new Error('Polling should fail after a timeout');
            },
            function(error: Error) {
              assert.strictEqual(error.name, 'ScriptTimeout');
            }
          );
      },

      'iteration check'() {
        return command
          .get('tests/functional/data/default.html')
          .then(
            pollUntil<number | never>(
              function() {
                const anyWindow = <any>window;
                if (!anyWindow.counter) {
                  anyWindow.counter = 0;
                }

                if (++anyWindow.counter === 4) {
                  return anyWindow.counter;
                }
              },
              [],
              1000,
              25
            )
          )
          .then(function(counter) {
            assert.strictEqual(counter, 4);
          });
      }
    }
  } as ObjectSuiteDescriptor;
});
