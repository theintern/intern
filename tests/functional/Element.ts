import * as util from './support/util';
import { strategies } from '../../src/lib/Locator';
import Element from '../../src/Element';
import Session from '../../src/Session';
import { isSafari, isFirefox } from '../../src/Server';
import { Task } from '@theintern/common';
import Test, { TestFunction } from 'intern/lib/Test';
import { ObjectSuiteDescriptor } from 'intern/lib/interfaces/object';

const strategyNames = Object.keys(strategies);

const suffixes = strategyNames.map(name => {
  return (
    name[0].toUpperCase() +
    name.slice(1).replace(/\s(\w)/g, (_, letter) => letter.toUpperCase())
  );
});

function createStubbedSuite(
  stubbedMethodName: string,
  testMethodName: string,
  placeholders: string[],
  firstArguments: any[],
  shouldSkip?: (test: Test) => void
) {
  let originalMethod: Function;
  let calledWith: any;
  let extraArguments: any[] = [];
  let element = new Element('test', <Session>{});
  const suite = {
    before() {
      originalMethod = (<any>element)[stubbedMethodName];
      (<any>element)[stubbedMethodName] = function() {
        calledWith = arguments;
      };

      for (let i = 0, j = originalMethod.length - 1; i < j; ++i) {
        extraArguments.push('ok' + (i + 2));
      }
    },

    beforeEach() {
      calledWith = null;
    },

    after() {
      (<any>element)[stubbedMethodName] = originalMethod;
    },

    tests: <{ [name: string]: TestFunction }>{}
  };

  placeholders.forEach(function(placeholder: string, index: number) {
    const method = testMethodName.replace('_', placeholder);

    suite.tests['#' + method] = function() {
      if (shouldSkip) {
        shouldSkip(this);
      }
      assert.isFunction((<any>element)[method]);
      (<any>element)[method].apply(element, extraArguments);
      assert.ok(calledWith);
      assert.strictEqual(calledWith[0], firstArguments[index]);
      assert.deepEqual(
        Array.prototype.slice.call(calledWith, 1),
        extraArguments
      );
    };
  });

  return suite;
}

registerSuite('Element', () => {
  let session: Session;
  let resetBrowserState = true;

  return {
    before() {
      const remote = this.remote;
      return util.createSessionFromRemote(remote).then(function() {
        session = arguments[0];
      });
    },

    beforeEach() {
      if (resetBrowserState) {
        return session.get('about:blank').then(function() {
          return session.setTimeout('implicit', 0);
        });
      }
    },

    tests: {
      '#toJSON'() {
        const element = new Element('test', <Session>{});
        assert.deepEqual(element.toJSON(), {
          ELEMENT: 'test',
          'element-6066-11e4-a52e-4f735466cecf': 'test'
        });
      },

      '#find': (function() {
        function getId(element: Element) {
          assert.property(
            element,
            'elementId',
            'Returned object should look like an element object'
          );
          return element.getAttribute('id');
        }

        let element: Element;

        return {
          before() {
            resetBrowserState = false;
            return session
              .get('tests/functional/data/elements.html')
              .then(function() {
                return session.find('id', 'h');
              })
              .then(function(_element) {
                element = _element;
              });
          },

          after() {
            resetBrowserState = true;
          },

          tests: {
            'by class name'() {
              return element
                .find('class name', 'i')
                .then(getId)
                .then(function(id) {
                  assert.strictEqual(
                    id,
                    'i2',
                    'Returned element should be the first in the document'
                  );
                });
            },

            'by css selector'() {
              return element
                .find('css selector', '#j b.i')
                .then(getId)
                .then(function(id) {
                  assert.strictEqual(id, 'i2');
                });
            },

            'by name'() {
              return element
                .find('name', 'nothing')
                .then(getId)
                .then(function(id) {
                  assert.strictEqual(id, 'nothing1');
                });
            },

            'by link text'() {
              return element
                .find('link text', 'What a cute, red cap.')
                .then(getId)
                .then(function(id) {
                  assert.strictEqual(id, 'j');
                });
            },

            'by partial link text'() {
              return element
                .find('partial link text', 'cute, red')
                .then(getId)
                .then(function(id) {
                  assert.strictEqual(id, 'j');
                });
            },

            'by link text (hidden text)'() {
              return element
                .find('link text', 'What a cap.')
                .then(getId)
                .then(function(id) {
                  assert.strictEqual(id, 'k');
                });
            },

            'by partial link text (hidden text)'() {
              return element
                .find('partial link text', 'a cap')
                .then(getId)
                .then(function(id) {
                  assert.strictEqual(id, 'k');
                });
            },

            'by tag name'() {
              return element
                .find('tag name', 'b')
                .then(getId)
                .then(function(id) {
                  assert.strictEqual(id, 'i2');
                });
            },

            'by xpath'() {
              return element
                .find('xpath', 'id("h")/a[2]')
                .then(getId)
                .then(function(id) {
                  assert.strictEqual(id, 'i1');
                });
            },

            'non-existent'() {
              return element.find('id', 'does-not-exist').then(
                function() {
                  throw new Error(
                    'Requesting non-existing element should throw error'
                  );
                },
                function(error) {
                  if (error.detail && error.detail.error) {
                    assert.strictEqual(error.detail.error, 'no such element');
                  } else {
                    assert.strictEqual(error.name, 'NoSuchElement');
                  }
                }
              );
            }
          }
        };
      })(),

      '#find (with implicit timeout)': (function() {
        let startTime: number;
        return () => {
          return session
            .get('tests/functional/data/elements.html')
            .then(() => session.setTimeout('implicit', 2000))
            .then(() => session.getTimeout('implicit'))
            .then(timeout => {
              assert.equal(timeout, 2000);
            })
            .then(() => session.find('id', 'h'))
            .then(element => {
              startTime = Date.now();
              return element
                .find('id', 'd')
                .then(
                  () => {
                    throw new Error(
                      'Requesting non-existing element should throw error'
                    );
                  },
                  () => {
                    assert.operator(
                      Date.now() - startTime,
                      '>=',
                      2000,
                      'Driver should wait for implicit timeout before continuing'
                    );
                    return session.find('id', 'makeD');
                  }
                )
                .then(makeElement => makeElement.click())
                .then(() => session.setTimeout('implicit', 10000))
                .then(() => {
                  startTime = Date.now();
                  return element.find('id', 'd');
                })
                .then(child => {
                  assert.operator(
                    Date.now() - startTime,
                    '<',
                    9000,
                    'Driver should not wait until end of implicit timeout once element is available'
                  );
                  assert.property(child, 'elementId');
                  return child.getAttribute('id');
                })
                .then(id => {
                  assert.strictEqual(id, 'd');
                });
            });
        };
      })(),

      '#findAll': (function() {
        function getIds(elements: Element[]) {
          elements.forEach(function(element, index) {
            assert.property(
              element,
              'elementId',
              'Returned object ' + index + ' should look like an element object'
            );
          });

          return Task.all(
            elements.map(function(element) {
              return element.getAttribute('id');
            })
          );
        }

        let element: Element;

        return {
          before() {
            resetBrowserState = false;
            return session
              .get('tests/functional/data/elements.html')
              .then(function() {
                return session.find('id', 'h');
              })
              .then(function(_element) {
                element = _element;
              });
          },

          after() {
            resetBrowserState = true;
          },

          tests: {
            'by id'() {
              return element
                .findAll('id', 'j')
                .then(getIds)
                .then(function(ids) {
                  assert.deepEqual(ids, ['j']);
                });
            },

            'by class name'() {
              return element
                .findAll('class name', 'i')
                .then(getIds)
                .then(function(ids) {
                  assert.deepEqual(ids, ['i2', 'i3', 'i1']);
                });
            },

            'by css selector'() {
              return element
                .findAll('css selector', '#j b.i')
                .then(getIds)
                .then(function(ids) {
                  assert.deepEqual(ids, ['i2', 'i3']);
                });
            },

            'by name'() {
              return element
                .findAll('name', 'nothing')
                .then(getIds)
                .then(function(ids) {
                  assert.deepEqual(ids, ['nothing1', 'nothing2']);
                });
            },

            'by link text'() {
              return element
                .findAll('link text', 'What a cute, red cap.')
                .then(getIds)
                .then(function(ids) {
                  assert.deepEqual(ids, ['j', 'i1']);
                });
            },

            'by partial link text'() {
              return element
                .findAll('partial link text', 'cute, red')
                .then(getIds)
                .then(function(ids) {
                  assert.deepEqual(ids, ['j', 'i1']);
                });
            },

            'by link text (hidden text)'() {
              return element
                .findAll('link text', 'What a cap.')
                .then(getIds)
                .then(function(ids) {
                  assert.deepEqual(ids, ['k']);
                });
            },

            'by partial link text (hidden text)'() {
              return element
                .findAll('partial link text', 'a cap')
                .then(getIds)
                .then(function(ids) {
                  assert.deepEqual(ids, ['k']);
                });
            },

            'by tag name'() {
              return element
                .findAll('tag name', 'b')
                .then(getIds)
                .then(function(ids) {
                  assert.deepEqual(ids, ['i2', 'i3', 'l']);
                });
            },

            'by xpath'() {
              return element
                .findAll('xpath', 'id("j")/b')
                .then(getIds)
                .then(function(ids) {
                  assert.deepEqual(ids, ['i2', 'i3']);
                });
            },

            'non-existent'() {
              return element
                .findAll('id', 'does-not-exist')
                .then(function(elements) {
                  assert.deepEqual(elements, []);
                });
            }
          }
        };
      })(),

      '#find convenience methods': createStubbedSuite(
        'find',
        'findBy_',
        suffixes,
        strategyNames
      ),

      '#findAll convenience methods': createStubbedSuite(
        'findAll',
        'findAllBy_',
        suffixes.filter(function(suffix) {
          return suffix !== 'Id';
        }),
        strategyNames.filter(function(strategy) {
          return strategy !== 'id';
        })
      ),

      '#findDisplayed convenience methods': createStubbedSuite(
        'findDisplayed',
        'findDisplayedBy_',
        suffixes.filter(function(suffix) {
          return suffix !== 'Id';
        }),
        strategyNames.filter(function(strategy) {
          return strategy !== 'id';
        }),
        (test: Test) => {
          if (session.capabilities.noElementDisplayed) {
            test.skip('Remote does not support /displayed endpoint');
          }
        }
      ),

      // TODO: findDisplayed
      // TODO: waitForDeleted

      '#waitForDeleted convenience methods': createStubbedSuite(
        'waitForDeleted',
        'waitForDeletedBy_',
        suffixes,
        strategyNames
      ),

      '#click'(this: Test) {
        if (!session.capabilities.mouseEnabled) {
          this.skip('mouse not enabled');
        }

        return session
          .get('tests/functional/data/pointer.html')
          .then(function() {
            return session.findById('a');
          })
          .then(function(element) {
            return element.click();
          })
          .then(function() {
            return session.execute<any>('return result;');
          })
          .then(function(result) {
            assert.isArray(result.mousedown.a);
            assert.isArray(result.mouseup.a);
            assert.isArray(result.click.a);
            assert.lengthOf(result.mousedown.a, 1);
            assert.lengthOf(result.mouseup.a, 1);
            assert.lengthOf(result.click.a, 1);
          });
      },

      '#submit (submit button)'() {
        return session
          .get('tests/functional/data/form.html')
          .then(function() {
            return session.getCurrentUrl();
          })
          .then(function(expectedUrl) {
            return session
              .findById('input')
              .then(element => element.type('hello'))
              .then(() => session.findById('submit2'))
              .then(element => element.submit())
              .then(
                // Give the browser time to update the URL
                // after the submit (this is necessary for at
                // least Firefox 59)
                () => new Promise(resolve => setTimeout(resolve, 500))
              )
              .then(() => session.getCurrentUrl())
              .then(url => {
                const expected = expectedUrl + '?a=hello&go=submit2';
                assert.strictEqual(url, expected);
              });
          });
      },

      '#submit (form)'() {
        return session
          .get('tests/functional/data/form.html')
          .then(function() {
            return session.getCurrentUrl();
          })
          .then(function(expectedUrl) {
            return session
              .findById('input')
              .then(element => element.type('hello'))
              .then(() => session.findById('form'))
              .then(element => element.submit())
              .then(
                // Give the browser time to update the URL
                // after the submit (this is necessary for at
                // least Firefox 59)
                () => new Promise(resolve => setTimeout(resolve, 500))
              )
              .then(() => session.getCurrentUrl())
              .then(url => {
                const expected = expectedUrl + '?a=hello';
                assert.strictEqual(url, expected);
              });
          });
      },

      '#getVisibleText'() {
        return session
          .get('tests/functional/data/elements.html')
          .then(function() {
            return session.findById('c3');
          })
          .then(function(element) {
            return element.getVisibleText();
          })
          .then(function(text) {
            assert.strictEqual(text, 'What a cute backpack.');
          });
      },

      '#getVisibleText (multi-line)'() {
        return session
          .get('tests/functional/data/elements.html')
          .then(function() {
            return session.findById('i4');
          })
          .then(function(element) {
            return element.getVisibleText();
          })
          .then(function(text) {
            const expectedText = [
              "I've come up with another wacky invention that I think has real potential.",
              "Maybe you won't, but anyway...",
              "it's called the \u201cGourmet Yogurt Machine.\u201d",
              'It makes many different flavors of yogurt.',
              'The only problem is, right now, it can only make trout-flavored yogurt...',
              "So, I'm having the machine delivered to you via Escargo Express.",
              "It's coming \u201cNeglected Class.\u201d"
            ].join('\n');
            assert.strictEqual(text, expectedText);
          });
      },

      '#type'() {
        // TODO: Complex characters, tabs and arrows, copy and paste
        return session
          .get('tests/functional/data/form.html')
          .then(function() {
            return session.findById('input');
          })
          .then(function(element) {
            return element.type('hello, world').then(function() {
              return element.getProperty('value');
            });
          })
          .then(function(value) {
            assert.strictEqual(value, 'hello, world');
          });
      },

      '#type -> file upload'(this: Test) {
        // See https://github.com/mozilla/geckodriver/issues/858; in theory
        // this was fixed with FF 55 and geckodriver 0.18.0, but it still seems
        // to be broken as of at least FF 64 and geckodriver 0.21.0.
        if (isFirefox(session.capabilities, 55, 66)) {
          this.skip('File uploading is broken in Firefox 55+');
        }

        if (isSafari(session.capabilities, 12, 13)) {
          this.skip('File uploading is broken in Safari 12');
        }

        if (
          !session.capabilities.remoteFiles ||
          session.capabilities.brokenFileSendKeys
        ) {
          this.skip('Remote file uploads not supported by server');
        }

        return session
          .get('tests/functional/data/upload.html')
          .then(function() {
            return session.findById('file');
          })
          .then(function(element) {
            return element.type('tests/functional/data/upload.txt');
          })
          .then(function() {
            return session.execute(function() {
              const file = (<any>document.getElementById('file')).files[0];
              return { name: file.name, size: file.size };
            });
          })
          .then(function(file) {
            assert.deepEqual(file, {
              name: 'upload.txt',
              size: 18
            });
          });
      },

      '#getTagName'() {
        return session
          .get('tests/functional/data/default.html')
          .then(function() {
            return session.findByTagName('body');
          })
          .then(function(element) {
            return element.getTagName();
          })
          .then(function(tagName) {
            assert.strictEqual(tagName, 'body');
          });
      },

      '#clearValue'() {
        return session
          .get('tests/functional/data/form.html')
          .then(function() {
            return session.findById('input2');
          })
          .then(function(element) {
            return element
              .getProperty('value')
              .then(function(value) {
                assert.strictEqual(value, 'default');
                return element.clearValue();
              })
              .then(function() {
                return element.getProperty('value');
              });
          })
          .then(function(value) {
            assert.strictEqual(value, '');
          });
      },

      '#isSelected (radio button)'() {
        return session
          .get('tests/functional/data/form.html')
          .then(function() {
            return session.findById('radio1');
          })
          .then(function(element) {
            return element.isSelected().then(function(isSelected) {
              assert.isTrue(
                isSelected,
                'Default checked element should be selected'
              );
              return session.findById('radio2').then(function(element2) {
                return element2
                  .isSelected()
                  .then(function(isSelected) {
                    assert.isFalse(
                      isSelected,
                      'Default unchecked element should not be selected'
                    );
                    return element2.click();
                  })
                  .then(function() {
                    return element.isSelected();
                  })
                  .then(function(isSelected) {
                    assert.isFalse(
                      isSelected,
                      'Newly unchecked element should not be selected'
                    );
                    return element2.isSelected();
                  })
                  .then(function(isSelected) {
                    assert.isTrue(
                      isSelected,
                      'Newly checked element should be selected'
                    );
                  });
              });
            });
          });
      },

      '#isSelected (checkbox)': {
        before() {
          resetBrowserState = false;
          return session.get('tests/functional/data/form.html');
        },

        after() {
          resetBrowserState = true;
        },

        tests: {
          'initial selection'() {
            return session
              .findById('checkbox')
              .then(function(element) {
                return element.isSelected();
              })
              .then(function(isSelected) {
                assert.isFalse(
                  isSelected,
                  'Default unchecked element should not be selected'
                );
              });
          },

          'change selection'() {
            return session.findById('checkbox').then(function(element) {
              return element
                .click()
                .then(function() {
                  return element.isSelected();
                })
                .then(function(isSelected) {
                  assert.isTrue(
                    isSelected,
                    'Newly checked element should be selected'
                  );
                  return element.click();
                })
                .then(function() {
                  return element.isSelected();
                })
                .then(function(isSelected) {
                  assert.isFalse(
                    isSelected,
                    'Newly unchecked element should not be selected'
                  );
                });
            });
          }
        }
      },

      '#isSelected (drop-down)': {
        before() {
          resetBrowserState = false;
          return session.get('tests/functional/data/form.html');
        },

        after() {
          resetBrowserState = true;
        },

        tests: {
          'initial selection'() {
            return session
              .findById('option2')
              .then(function(element) {
                return element.isSelected();
              })
              .then(function(isSelected) {
                assert.isTrue(
                  isSelected,
                  'Default selected element should be selected'
                );
              })
              .then(function() {
                return session.findById('option1');
              })
              .then(function(element) {
                return element.isSelected();
              })
              .then(function(isSelected) {
                assert.isFalse(
                  isSelected,
                  'Default unselected element should not be selected'
                );
              });
          },

          'change selection'(this: Test) {
            if (session.capabilities.brokenOptionSelect) {
              this.skip('broken option select');
            }

            return session
              .findById('select')
              .then(function(select) {
                return select.click();
              })
              .then(function() {
                return session.findById('option1');
              })
              .then(function(element) {
                return element
                  .click()
                  .then(function() {
                    return element.isSelected();
                  })
                  .then(function(isSelected) {
                    assert.isTrue(
                      isSelected,
                      'Newly selected element should be selected'
                    );
                  });
              })
              .then(function() {
                return session.findById('option2');
              })
              .then(function(element) {
                return element.isSelected();
              })
              .then(function(isSelected) {
                assert.isFalse(
                  isSelected,
                  'Newly unselected element should not be selected'
                );
              });
          }
        }
      },

      '#isEnabled'() {
        return session
          .get('tests/functional/data/form.html')
          .then(function() {
            return session.findById('input');
          })
          .then(function(element) {
            return element.isEnabled();
          })
          .then(function(isEnabled) {
            assert.isTrue(isEnabled);
            return session.findById('disabled');
          })
          .then(function(element) {
            return element.isEnabled();
          })
          .then(function(isEnabled) {
            assert.isFalse(isEnabled);
          });
      },

      '#getSpecAttribute'() {
        // If the element/<id>/property endpoint is available, the remote is
        // using W3C semantics, and getSpecAttribute likely won't work as
        // expected
        if (!session.capabilities.brokenElementProperty) {
          this.skip('Not supported when W3C support is available');
        }

        /*jshint maxlen:140 */
        return session
          .get('tests/functional/data/form.html')
          .then(function() {
            return session.findById('input2');
          })
          .then(function(element) {
            return element
              .getSpecAttribute('value')
              .then(function(value) {
                assert.strictEqual(
                  value,
                  'default',
                  'Default value of input should be returned when value is unchanged'
                );
                return element.type('foo');
              })
              .then(function() {
                return element.getSpecAttribute('value');
              })
              .then(function(value) {
                assert.match(
                  value!,
                  /foo$/,
                  'Current value of input should be returned'
                );
                return element.getSpecAttribute('defaultValue');
              })
              .then(function(defaultValue) {
                assert.strictEqual(
                  defaultValue,
                  'default',
                  'Default value should be returned'
                );
                return element.getSpecAttribute('data-html5');
              })
              .then(function(value) {
                assert.strictEqual(
                  value,
                  'true',
                  'Value of custom attributes should be returned'
                );
                return element.getSpecAttribute('nonexisting');
              })
              .then(function(value) {
                assert.isNull(
                  value,
                  'Non-existing attributes should not return a value'
                );
              });
          })
          .then(function() {
            return session.findById('disabled');
          })
          .then(function(element) {
            return element.getSpecAttribute('disabled');
          })
          .then(function(isDisabled) {
            assert.strictEqual(
              isDisabled,
              'true',
              'True boolean attributes must return string value per the spec'
            );
            return session.get('tests/functional/data/elements.html');
          })
          .then(function() {
            return session.findById('c');
          })
          .then(function(element) {
            return element.getSpecAttribute('href');
          })
          .then(function(href) {
            return session.getCurrentUrl().then(function(baseUrl) {
              const expected =
                baseUrl.slice(0, baseUrl.lastIndexOf('/') + 1) + 'default.html';
              assert.strictEqual(
                href,
                expected,
                'Link href value should be absolute'
              );
            });
          });
      },

      '#getAttribute'() {
        return session
          .get('tests/functional/data/form.html')
          .then(function() {
            return session.findById('form');
          })
          .then(function(element) {
            return element.getAttribute('action');
          })
          .then(function(action) {
            // At least Firefox 64 will return an absolute URL for the action
            // attribute.
            assert.match(action!, /(.*\/)?form.html/);
            return session.findById('disabled');
          })
          .then(function(element) {
            return Task.all({
              'non-existing': element.getAttribute('non-existing'),
              disabled: element.getAttribute('disabled')
            });
          })
          .then(function(result: any) {
            assert.isNotNull(result.disabled);
            assert.isNull(result['non-existing']);
          });
      },

      '#getProperty'() {
        return session
          .get('tests/functional/data/form.html')
          .then(function() {
            return session.findById('form');
          })
          .then(function(element) {
            return element.getProperty<string>('action');
          })
          .then(function(action) {
            assert.operator(action.indexOf('http'), '===', 0);
            return session.findById('disabled');
          })
          .then(function(element) {
            return Task.all({
              'non-existing': element.getProperty('non-existing'),
              disabled: element.getProperty('disabled')
            });
          })
          .then(function(result: any) {
            assert.isTrue(result.disabled);
            assert.isNull(result['non-existing']);
          });
      },

      '#equals'() {
        return session
          .get('tests/functional/data/elements.html')
          .then(function() {
            return session.findById('a');
          })
          .then(function(element) {
            return session
              .findById('z')
              .then(function(element2) {
                return element
                  .equals(element2)
                  .then(function(isEqual) {
                    assert.isFalse(isEqual);
                    return element2.equals(element);
                  })
                  .then(function(isEqual) {
                    assert.isFalse(isEqual);
                  });
              })
              .then(function() {
                return session.findById('a');
              })
              .then(function(element2) {
                return element
                  .equals(element2)
                  .then(function(isEqual) {
                    assert.isTrue(isEqual);
                    return element2.equals(element);
                  })
                  .then(function(isEqual) {
                    assert.isTrue(isEqual);
                  });
              });
          });
      },

      '#isDisplayed': (function() {
        const visibilities = {
          normal: true,
          empty: false,
          invisible: false,
          visibleChild: true,
          noDisplay: false,
          noOpacity: false,
          offscreen: false,
          scrolledAway: true
        };

        const suite = {
          before() {
            resetBrowserState = false;
            return session.get('tests/functional/data/visibility.html');
          },
          after() {
            resetBrowserState = true;
          },
          tests: <{ [name: string]: TestFunction }>{}
        };

        for (let id in visibilities) {
          (function(id, expected) {
            suite.tests[id] = function() {
              if (session.capabilities.noElementDisplayed) {
                this.skip('Remote does not support /displayed endpoint');
              }
              return session
                .findById(id)
                .then(function(element) {
                  return element.isDisplayed();
                })
                .then(function(isDisplayed) {
                  assert.strictEqual(isDisplayed, expected);
                });
            };
          })(id, (<any>visibilities)[id]);
        }

        return suite;
      })(),

      '#getPosition': (function() {
        // TODO: Inside scrolled viewport
        // TODO: Fix transforms for platforms without transforms

        const positions: any = {};
        positions.a = { x: 0, y: 2000 };
        positions.b = { x: 100, y: 2322 };
        positions.c = { x: 20, y: positions.b.y + 130 };
        positions.d = { x: positions.c.x + 350, y: positions.c.y + 80 };
        positions.e = { x: 13, y: 2445 };
        positions.f = { x: 0, y: 2472 };

        const suite = {
          before() {
            resetBrowserState = false;
            return session.get('tests/functional/data/dimensions.html');
          },
          after() {
            resetBrowserState = true;
          },
          tests: <{ [name: string]: TestFunction }>{}
        };

        for (let id in positions) {
          (function(id: string, expected: any) {
            suite.tests[id] = function() {
              return session
                .findById(id)
                .then(function(element) {
                  return element.getPosition();
                })
                .then(function(position) {
                  assert.deepEqual(position, expected);
                });
            };
          })(id, positions[id]);
        }

        return suite;
      })(),

      '#getSize': (function() {
        let documentWidth: number;
        let dimensions: any = {};
        dimensions.a = { width: 222, height: 222 };
        dimensions.b = { width: 10, height: 10 };
        dimensions.c = { width: -1, height: 0 };
        dimensions.d = { width: 80, height: 40 };
        dimensions.e = { width: 20, height: 20 };
        dimensions.f = { width: -1, height: 0 };

        const suite = {
          before() {
            resetBrowserState = false;
            return session
              .get('tests/functional/data/dimensions.html')
              .then(function() {
                return session.execute<number>(
                  'return document.body.offsetWidth;'
                );
              })
              .then(width => {
                documentWidth = width;
              });
          },
          after() {
            resetBrowserState = true;
          },
          tests: <{ [name: string]: TestFunction }>{}
        };

        for (let id in dimensions) {
          (function(id, expected) {
            suite.tests[id] = function() {
              return session
                .findById(id)
                .then(function(element) {
                  return element.getSize();
                })
                .then(function(dimensions) {
                  if (expected.width === -1) {
                    expected.width = documentWidth;
                  } else if (
                    id === 'e' &&
                    !session.capabilities.supportsCssTransforms
                  ) {
                    expected.width = expected.height = 40;
                  }

                  assert.deepEqual(dimensions, expected);
                });
            };
          })(id, dimensions[id]);
        }

        return suite;
      })(),

      '#getComputedStyle'() {
        /*jshint maxlen:140 */

        // TODO: Spec: pseudo-elements?
        return session
          .get('tests/functional/data/dimensions.html')
          .then(function() {
            return session.findById('a');
          })
          .then(function(element) {
            return element
              .getComputedStyle('background-color')
              .then(function(style) {
                assert.strictEqual(
                  style,
                  'rgba(128, 0, 128, 1)',
                  'Background colour should be rgba'
                );
                return element.getComputedStyle('border-left-width');
              })
              .then(function(style) {
                assert.strictEqual(
                  style,
                  '1px',
                  'Left border width should be in pixels'
                );
                return element.getComputedStyle('display');
              })
              .then(function(style) {
                assert.strictEqual(
                  style,
                  'block',
                  'Display mode should be the correct non-overridden style'
                );
                return element.getComputedStyle('not-a-property');
              })
              .then(function(style) {
                // Empty string is used by necessity since this is what FirefoxDriver returns and we cannot
                // list all possible invalid style names
                assert.strictEqual(
                  style,
                  '',
                  'Non-existing style should not return any value'
                );
              });

            // TODO: Firefox thinks these are inapplicable; see
            // https://bugzilla.mozilla.org/show_bug.cgi?id=889091
            /*
						return element.getComputedStyle('borderWidth');
					}).then(function (style) {
						assert.strictEqual(style, '1px', 'Border width should be in pixels');
						return element.getComputedStyle('border');
					}).then(function (style) {
						assert.strictEqual(
							style,
							'1px solid rgba(0, 0, 0, 1)',
							'Composite border should be in order size, style, colour'
						);
					});
					*/
          });
      }
    }
  } as ObjectSuiteDescriptor;
});
