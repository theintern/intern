import * as util from './support/util';
import { strategies } from 'src/webdriver/lib/Locator';
import Element from 'src/webdriver/Element';
import { WebDriverCookie, Geolocation } from 'src/webdriver/interfaces';
import Session from 'src/webdriver/Session';
import { Task } from 'src/common';
import Test, { TestFunction } from 'src/core/lib/Test';
import Suite from 'src/core/lib/Suite';

declare let interns: any;

type Position = { x: number; y: number };

const strategyNames = Object.keys(strategies);

const suffixes = strategyNames.map(name => {
  return (
    name[0].toUpperCase() +
    name.slice(1).replace(/\s(\w)/g, (_, letter) => letter.toUpperCase())
  );
});

registerSuite('Session', () => {
  let session: any;
  let resetBrowserState = true;

  function createStubbedSuite(
    stubbedMethodName: keyof Session,
    testMethodName: string,
    placeholders: string[],
    firstArguments: any,
    shouldSkip?: (test: Test) => void
  ) {
    let originalMethod: Function;
    let calledWith: any;
    let extraArguments: any[] = [];
    const suite: any = {
      before() {
        originalMethod = session[stubbedMethodName];
        session[stubbedMethodName] = function() {
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
        session[stubbedMethodName] = originalMethod;
      },

      tests: <{ [name: string]: TestFunction }>{}
    };

    placeholders.forEach(function(placeholder, index) {
      const method = testMethodName.replace('_', placeholder);

      suite.tests['#' + method] = function() {
        if (shouldSkip) {
          shouldSkip(this);
        }
        assert.isFunction(session[method]);
        session[method].apply(session, extraArguments);
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

  function createStorageTests(type: string) {
    const clear = 'clear' + type + 'Storage';
    const getKeys = 'get' + type + 'StorageKeys';
    const get = 'get' + type + 'StorageItem';
    const set = 'set' + type + 'StorageItem';
    const del = 'delete' + type + 'StorageItem';
    const getLength = 'get' + type + 'StorageLength';

    return function(this: Test) {
      if (!session.capabilities.webStorageEnabled) {
        this.skip('web storage not enabled');
      }

      return session
        .get('tests/functional/webdriver/data/default.html')
        .then(function() {
          return session[set]('foo', 'foo');
        })
        .then(function() {
          return session[clear]();
        })
        .then(function() {
          return session[getLength]();
        })
        .then(function(length: number) {
          assert.strictEqual(
            length,
            0,
            'Cleared storage should contain no data'
          );
          return session[set]('foo', 'foo');
        })
        .then(function() {
          return session[set]('bar', 'bar');
        })
        .then(function() {
          return session[set]('foo', 'foofoo');
        })
        .then(function() {
          return session[getLength]();
        })
        .then(function(length: number) {
          assert.strictEqual(
            length,
            2,
            'Getting size should return the number of data items in storage'
          );
          return session[getKeys]();
        })
        .then(function(keys: string[]) {
          assert.sameMembers(
            keys,
            ['foo', 'bar'],
            'Storage should contain set keys'
          );
          return session[get]('foo');
        })
        .then(function(value: string) {
          assert.strictEqual(
            value,
            'foofoo',
            'Getting item should retrieve correct stored value'
          );
          return session[del]('not-existing');
        })
        .then(function() {
          return session[getLength]();
        })
        .then(function(length: number) {
          assert.strictEqual(
            length,
            2,
            'Deleting non-existing key should not change size of storage'
          );
          return session[del]('foo');
        })
        .then(function() {
          return session[getKeys]();
        })
        .then(function(keys: string[]) {
          assert.deepEqual(
            keys,
            ['bar'],
            'Deleting existing key should reduce size of storage'
          );
          return session[clear]();
        })
        .catch(function(error: Error) {
          return session[clear]().then(function() {
            throw error;
          });
        });
    };
  }

  function getScrollPosition(element: Element) {
    // touchScroll scrolls in device pixels; scroll position is normally in
    // reference pixels, so get the correct device pixel location to verify
    // that it worked properly
    return session.execute(
      function(element?: HTMLElement) {
        if (!element) {
          element = document.documentElement!;
          if (!element.scrollLeft && !element.scrollTop) {
            element = document.body;
          }
        }

        return {
          x: element.scrollLeft,
          y: element.scrollTop
        };
      },
      [element]
    );
  }

  return {
    before(suite: Suite) {
      return util.createSessionFromRemote(suite.remote).then(function() {
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
      '#getTimeout script'(this: Test) {
        if (!session.capabilities.supportsExecuteAsync) {
          this.skip('executeAsync not supported');
        }

        return session.getTimeout('script').then(function(value: number) {
          assert.strictEqual(
            value,
            // set to 10000 in createSessionFromRemote
            10000,
            'Async execution timeout should be default value'
          );
        });
      },

      '#getTimeout implicit'() {
        return session.getTimeout('implicit').then(function(value: number) {
          assert.strictEqual(
            value,
            // set to 0 in beforeEach
            0,
            'Implicit timeout should be default value'
          );
        });
      },

      '#getTimeout page load'() {
        return session.getTimeout('page load').then(function(value: number) {
          assert.strictEqual(
            value,
            // set to 30000 in createSessionFromRemote
            30000,
            'Page load timeout should be default value'
          );
        });
      },

      '#getTimeout convenience methods': createStubbedSuite(
        'getTimeout',
        'get_Timeout',
        ['ExecuteAsync', 'Find', 'PageLoad'],
        ['script', 'implicit', 'page load']
      ),

      '#setTimeout convenience methods': createStubbedSuite(
        'setTimeout',
        'set_Timeout',
        ['ExecuteAsync', 'Find', 'PageLoad'],
        ['script', 'implicit', 'page load']
      ),

      'window handle information (#getCurrentWindowHandle, #getAllWindowHandles)'() {
        let currentHandle: any;

        return session
          .getCurrentWindowHandle()
          .then(function(handle: string) {
            assert.isString(handle);
            currentHandle = handle;
            return session.getAllWindowHandles();
          })
          .then(function(handles: string[]) {
            assert.isArray(handles);

            // At least Selendroid 0.9.0 runs the browser inside a
            // WebView wrapper; this is not really a test failure
            if (handles[0] === 'NATIVE_APP' && handles[1]) {
              handles.shift();
            }

            // At least ios-driver 0.6.0-SNAPSHOT April 2014 runs the
            // browser inside a WebView wrapper; this is not really a
            // test failure
            if (handles[1] === 'Native') {
              handles.pop();
            }

            assert.lengthOf(handles, 1);
            assert.strictEqual(handles[0], currentHandle);
          });
      },

      '#get'() {
        return session.get('tests/functional/webdriver/data/default.html');
      },

      '#get 404'() {
        return session.get('tests/functional/webdriver/data/404.html');
      },

      '#getCurrentUrl'(this: Test) {
        const expectedUrl = util.convertPathToUrl(
          this.remote,
          'tests/functional/webdriver/data/default.html'
        );

        return session
          .get(expectedUrl)
          .then(function() {
            return session.getCurrentUrl();
          })
          .then(function(currentUrl: string) {
            assert.strictEqual(currentUrl, expectedUrl);
          });
      },

      'navigation (#goBack, #goForward, #refresh)'() {
        if (session.capabilities.brokenNavigation) {
          this.skip('navigation is broken');
        }

        const expectedUrl = util.convertPathToUrl(
          this.remote,
          'tests/functional/webdriver/data/default.html?second'
        );
        const expectedBackUrl = util.convertPathToUrl(
          this.remote,
          'tests/functional/webdriver/data/default.html?first'
        );

        return session
          .get(expectedBackUrl)
          .then(function() {
            return session.get(expectedUrl);
          })
          .then(function() {
            return session.goBack();
          })
          .then(function() {
            return session.getCurrentUrl();
          })
          .then(function(currentUrl: string) {
            assert.strictEqual(currentUrl, expectedBackUrl);
            return session.goForward();
          })
          .then(function() {
            return session.getCurrentUrl();
          })
          .then(function(currentUrl: string) {
            assert.strictEqual(currentUrl, expectedUrl);
            return session.refresh();
          })
          .then(function() {
            return session.getCurrentUrl();
          })
          .then(function(currentUrl: string) {
            assert.strictEqual(
              currentUrl,
              expectedUrl,
              'Refreshing the page should load the same URL'
            );
          });
      },

      '#execute string'() {
        return session
          .get('tests/functional/webdriver/data/scripting.html')
          .then(function() {
            return session.execute(
              'return interns[arguments[0]] + interns[arguments[1]];',
              ['ness', 'paula']
            );
          })
          .then(function(result: string) {
            assert.strictEqual(result, 'NessPaula');
          });
      },

      '#execute function'() {
        return session
          .get('tests/functional/webdriver/data/scripting.html')
          .then(function() {
            return session.execute(
              function(first: string, second: string) {
                /*global interns:false */
                return interns[first] + interns[second];
              },
              ['ness', 'paula']
            );
          })
          .then(function(result: string) {
            assert.strictEqual(result, 'NessPaula');
          });
      },

      '#execute -> element'() {
        if (session.capabilities.brokenExecuteElementReturn) {
          this.skip('execute element broken');
        }

        return session
          .get('tests/functional/webdriver/data/scripting.html')
          .then(function() {
            return session.execute(function() {
              return document.getElementById('child');
            });
          })
          .then(function(element: Element) {
            assert.property(
              element,
              'elementId',
              'Returned value should be an Element object'
            );
            return element.getAttribute('id');
          })
          .then(function(id: string) {
            assert.strictEqual(id, 'child');
          });
      },

      '#execute -> elements'() {
        if (session.capabilities.brokenExecuteElementReturn) {
          this.skip('execute element broken');
        }

        return session
          .get('tests/functional/webdriver/data/scripting.html')
          .then(function() {
            return session.execute(function() {
              return [interns.poo, document.getElementById('child')];
            });
          })
          .then(function(elements: any[]) {
            assert.isArray(elements);
            assert.strictEqual(
              elements[0],
              'Poo',
              'Non-elements should not be converted'
            );
            assert.property(
              elements[1],
              'elementId',
              'Returned elements should be Element objects'
            );
            return elements[1].getAttribute('id');
          })
          .then(function(id: string) {
            assert.strictEqual(id, 'child');
          });
      },

      '#execute -> error'() {
        return session
          .get('tests/functional/webdriver/data/scripting.html')
          .then(function() {
            return session.execute(function() {
              /*global interns:false */
              return interns();
            });
          })
          .then(
            function() {
              throw new Error('Invalid code execution should throw error');
            },
            function(error: Error) {
              assert.strictEqual(
                error.name,
                'JavaScriptError',
                'Invalid user code should throw per the spec'
              );
            }
          );
      },

      '#execute -> undefined'() {
        return session
          .get('tests/functional/webdriver/data/scripting.html')
          .then(function() {
            return Task.all([
              session.execute('return "not undefined";'),
              session.execute('return undefined;')
            ]);
          })
          .then(function(values: any[]) {
            assert.deepEqual(values, ['not undefined', null]);
          });
      },

      '#execute non-array args'() {
        assert.throws(function() {
          session.execute('return window;', <any>'oops');
        }, /Arguments passed to execute must be an array/);
      },

      '#executeAsync non-array args'() {
        if (!session.capabilities.supportsExecuteAsync) {
          this.skip('executeAsync not supported');
        }

        assert.throws(function() {
          session.executeAsync('return window;', <any>'oops');
        }, /Arguments passed to executeAsync must be an array/);
      },

      '#executeAsync': (function() {
        let originalTimeout: number;

        return {
          before(this: Test) {
            if (!session.capabilities.supportsExecuteAsync) {
              this.skip('executeAsync not supported');
            }

            return session.getTimeout('script').then(function(value: number) {
              originalTimeout = value;
              return session.setTimeout('script', 1000);
            });
          },

          after(this: Test) {
            if (!session.capabilities.supportsExecuteAsync) {
              this.skip('executeAsync not supported');
            }

            return session.setTimeout('script', originalTimeout);
          },

          tests: {
            string(this: Test) {
              if (!session.capabilities.supportsExecuteAsync) {
                this.skip('executeAsync not supported');
              }

              return session
                .get('tests/functional/webdriver/data/scripting.html')
                .then(function() {
                  /*jshint maxlen:140 */
                  return session.executeAsync(
                    'var args = arguments; setTimeout(function () { args[2](interns[args[0]] + ' +
                      'interns[args[1]]); }, 100);',
                    ['ness', 'paula']
                  );
                })
                .then(function(result: string) {
                  assert.strictEqual(result, 'NessPaula');
                });
            },

            function(this: Test) {
              if (!session.capabilities.supportsExecuteAsync) {
                this.skip('executeAsync not supported');
              }

              return session
                .get('tests/functional/webdriver/data/scripting.html')
                .then(function() {
                  return session.executeAsync(
                    function(first: string, second: string, done: Function) {
                      setTimeout(function() {
                        done(interns[first] + interns[second]);
                      }, 100);
                    },
                    ['ness', 'paula']
                  );
                })
                .then(function(result: string) {
                  assert.strictEqual(result, 'NessPaula');
                });
            },

            ' -> error'(this: Test) {
              if (!session.capabilities.supportsExecuteAsync) {
                this.skip('executeAsync not supported');
              }

              return session
                .get('tests/functional/webdriver/data/scripting.html')
                .then(function() {
                  return session.executeAsync(function(done: Function) {
                    /*global interns:false */
                    done(interns());
                  });
                })
                .then(
                  function() {
                    throw new Error(
                      'Invalid code execution should throw error'
                    );
                  },
                  function(error: Error) {
                    assert.strictEqual(
                      error.name,
                      'JavaScriptError',
                      'Invalid user code should throw an error matching the spec'
                    );
                  }
                );
            }
          }
        };
      })(),

      '#takeScreenshot'(this: Test) {
        if (!session.capabilities.takesScreenshot) {
          this.skip('screenshots not supported');
        }

        const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

        this.async(60000);

        return session.takeScreenshot().then(function(screenshot: any) {
          /*jshint node:true */
          assert.isTrue(
            Buffer.isBuffer(screenshot),
            'Screenshot should be a Buffer'
          );
          assert.deepEqual(
            screenshot.slice(0, 8).toJSON().data,
            magic,
            'Screenshot should be a PNG file'
          );
        });
      },

      // TODO: There appear to be no drivers that support IME input to
      // actually test IME commands

      'frame switching (#switchToFrame, #switchToParentFrame)'(this: Test) {
        if (session.capabilities.brokenParentFrameSwitch) {
          this.skip('switch to parent frame not supported');
        }

        return session
          .get('tests/functional/webdriver/data/window.html')
          .then(function() {
            return session.findById('child');
          })
          .then(function(child: any) {
            return child.getVisibleText();
          })
          .then(function(text: string) {
            assert.strictEqual(text, 'Main');
            return session.switchToFrame('inlineFrame');
          })
          .then(function() {
            return session.findById('child');
          })
          .then(function(child: any) {
            return child.getVisibleText();
          })
          .then(function(text: string) {
            assert.strictEqual(text, 'Frame');

            if (session.capabilities.scriptedParentFrameCrashesBrowser) {
              return session.switchToFrame(null);
            }

            return session.switchToParentFrame();
          })
          .then(function() {
            return session.findById('child');
          })
          .then(function(child: any) {
            return child.getVisibleText();
          })
          .then(function(text: string) {
            assert.strictEqual(text, 'Main');
          });
      },

      'window switching (#switchToWindow, #closeCurrentWindow)'(this: Test) {
        if (session.capabilities.brokenWindowSwitch) {
          this.skip('window switching is broken');
        }

        if (session.capabilities.brokenWindowClose) {
          this.skip('window closing is broken');
        }

        let mainHandle: string;
        let popupHandle: string;
        let allHandles: string[];

        return session
          .get('tests/functional/webdriver/data/window.html')
          .then(function() {
            return session.getAllWindowHandles();
          })
          .then(function(handles: string[]) {
            allHandles = handles;
            return session.getCurrentWindowHandle();
          })
          .then(function(handle: string) {
            mainHandle = handle;
            return session.findById('windowOpener');
          })
          .then(function(opener: Element) {
            return opener.click();
          })
          .then(function() {
            // Give the new window time to open
            return new Task(function(resolve) {
              setTimeout(resolve, 1000);
            });
          })
          .then(function() {
            return session
              .getAllWindowHandles()
              .then(function(handles: string[]) {
                assert.lengthOf(
                  handles,
                  allHandles.length + 1,
                  'New handle should have been created'
                );

                // Return the new handle
                for (let i = 0; i < handles.length; i++) {
                  if (allHandles.indexOf(handles[i]) === -1) {
                    return handles[i];
                  }
                }
              });
          })
          .then(function(newHandle: string) {
            popupHandle = newHandle;
            return session.switchToWindow(newHandle);
          })
          .then(function() {
            return session.getCurrentWindowHandle();
          })
          .then(function(handle: string) {
            assert.strictEqual(
              handle,
              popupHandle,
              'Window handle should have switched to pop-up'
            );
            return session.closeCurrentWindow();
          })
          .then(function() {
            return session.getCurrentWindowHandle().then(
              function() {
                throw new Error('Window should have closed');
              },
              function(error: Error) {
                assert.strictEqual(error.name, 'NoSuchWindow');
                return session.switchToWindow(mainHandle);
              }
            );
          })
          .then(function() {
            return session.getCurrentWindowHandle();
          })
          .then(function(handle: string) {
            assert.strictEqual(
              handle,
              mainHandle,
              'Window handle should have switched back to main window'
            );
          });
      },

      'window sizing (#getWindowSize, #setWindowSize)'(this: Test) {
        if (session.capabilities.brokenWindowSize) {
          this.skip('window size commands are broken');
        }

        type Size = { height: number; width: number };
        let originalSize: Size;
        let resizedSize: Size;
        return session.getWindowSize().then(function(size: Size) {
          assert.property(size, 'width');
          assert.property(size, 'height');
          originalSize = size;

          if (session.capabilities.dynamicViewport) {
            return session
              .setWindowSize(size.width - 20, size.height - 20)
              .then(function() {
                return session.getWindowSize();
              })
              .then((size: Size) => {
                assert.strictEqual(size.width, originalSize.width - 20);
                assert.strictEqual(size.height, originalSize.height - 20);
                resizedSize = size;

                if (!session.capabilities.brokenWindowMaximize) {
                  return session
                    .maximizeWindow()
                    .then(() => session.getWindowSize())
                    .then(function(size: Size) {
                      assert.operator(size.width, '>', resizedSize.width);
                      assert.operator(size.height, '>', resizedSize.height);
                    });
                }
              })
              .then(() =>
                session.setWindowSize(originalSize.width, originalSize.height)
              );
          }
        });
      },

      'window positioning (#getWindowPosition, #setWindowPosition)'(
        this: Test
      ) {
        if (!session.capabilities.dynamicViewport) {
          this.skip('dynamic viewport not supported');
        }
        if (session.capabilities.brokenWindowPosition) {
          this.skip('window position is broken');
        }

        let originalPosition: Position;
        let offset = 10;

        return session
          .getWindowPosition()
          .then(function(position: Position) {
            assert.notEqual(
              position.x,
              null,
              'Expected position.x to have a value'
            );
            assert.notEqual(
              position.y,
              null,
              'Expected position.y to have a value'
            );
            originalPosition = position;

            return session.setWindowPosition(
              position.x + offset,
              position.y + offset
            );
          })
          .then(() => session.getWindowPosition())
          .then((position: Position) => {
            assert.deepEqual(position, {
              x: originalPosition.x + offset,
              y: originalPosition.y + offset
            });
          });
      },

      cookie: {
        '#getCookies, #setCookie'() {
          if (session.capabilities.brokenCookies) {
            this.skip('cookies are broken');
          }

          return session
            .get('tests/functional/webdriver/data/default.html')
            .then(function() {
              return session.setCookie({ name: 'foo', value: '1=3' });
            })
            .then(function() {
              return session.getCookies();
            })
            .then(function(cookies: WebDriverCookie[]) {
              assert.lengthOf(
                cookies,
                1,
                'Clearing cookies should cause no cookies to exist'
              );
              return session.setCookie({ name: 'foo', value: '1=3' });
            })
            .then(function() {
              return session.setCookie({ name: 'bar', value: '2=4' });
            })
            .then(function() {
              return session.setCookie({ name: 'baz', value: '3=5' });
            })
            .then(function() {
              return session.getCookies();
            })
            .then(function(cookies: WebDriverCookie[]) {
              assert.lengthOf(
                cookies,
                3,
                'Setting cookies with unique names should create new cookies'
              );

              return session.setCookie({ name: 'baz', value: '4=6' });
            })
            .then(function() {
              return session.getCookies();
            })
            .then(function(cookies: WebDriverCookie[]) {
              assert.lengthOf(
                cookies,
                3,
                'Overwriting cookies should not cause new cookies to be created'
              );
            })
            .catch(function(error: Error) {
              if (!session.capabilities.brokenDeleteCookie) {
                return session.clearCookies().then(function() {
                  throw error;
                });
              }
            });
        },

        '#clearCookies, #deleteCookie'() {
          if (session.capabilities.brokenCookies) {
            this.skip('cookies are broken');
          }

          if (session.capabilities.brokenDeleteCookie) {
            this.skip('cookie deletion is broken');
          }

          return session
            .get('tests/functional/webdriver/data/default.html')
            .then(function() {
              return session.setCookie({ name: 'foo', value: '1=3' });
            })
            .then(function() {
              return session.setCookie({ name: 'bar', value: '2=4' });
            })
            .then(function() {
              return session.setCookie({ name: 'baz', value: '3=5' });
            })
            .then(function() {
              return session.getCookies();
            })
            .then(function(cookies: WebDriverCookie[]) {
              assert.lengthOf(
                cookies,
                3,
                'Overwriting cookies should not cause new cookies to be created'
              );
              return session.deleteCookie('bar');
            })
            .then(function() {
              return session.getCookies();
            })
            .then(function(cookies: WebDriverCookie[]) {
              assert.lengthOf(
                cookies,
                2,
                'Deleting a cookie should reduce the number of cookies'
              );

              // Different browsers return cookies in different orders;
              // some return the last modified cookie first, others
              // return the first created cookie first
              const fooCookie =
                cookies[0].name === 'foo' ? cookies[0] : cookies[1];
              const bazCookie =
                cookies[0].name === 'baz' ? cookies[0] : cookies[1];

              assert.strictEqual(bazCookie.name, 'baz');
              assert.strictEqual(fooCookie.name, 'foo');
              return session.clearCookies();
            })
            .then(function() {
              return session.getCookies();
            })
            .then(function(cookies: WebDriverCookie[]) {
              assert.lengthOf(cookies, 0);
              return session.clearCookies();
            })
            .catch(function(error: Error) {
              return session.clearCookies().then(function() {
                throw error;
              });
            });
        }
      },

      '#getPageSource'() {
        // Page source is serialised from the current DOM, so will not
        // match the original source on file
        return session
          .get('tests/functional/webdriver/data/default.html')
          .then(function() {
            return session.getPageSource();
          })
          .then(function(source: string) {
            assert.include(source, '<meta charset="utf-8"');
            assert.include(source, '<title>Default &amp;');
            assert.include(source, 'Are you kay-o?');
          });
      },

      '#getPageTitle'() {
        return session
          .get('tests/functional/webdriver/data/default.html')
          .then(function() {
            return session.getPageTitle();
          })
          .then(function(pageTitle: string) {
            assert.strictEqual(pageTitle, 'Default & <b>default</b>');
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

        return {
          before() {
            resetBrowserState = false;
            return session.get('tests/functional/webdriver/data/elements.html');
          },

          after() {
            resetBrowserState = true;
          },

          tests: {
            'by id'() {
              return session
                .find('id', 'a')
                .then(getId)
                .then(function(id: string) {
                  assert.strictEqual(id, 'a');
                });
            },

            'by class name'() {
              return session
                .find('class name', 'b')
                .then(getId)
                .then(function(id: string) {
                  assert.strictEqual(
                    id,
                    'b2',
                    'Returned element should be the first in the document'
                  );
                });
            },

            'by css selector'() {
              return session
                .find('css selector', '#c span.b')
                .then(getId)
                .then(function(id: string) {
                  assert.strictEqual(id, 'b3');
                });
            },

            'by name'() {
              return session
                .find('name', 'makeD')
                .then(getId)
                .then(function(id: string) {
                  assert.strictEqual(id, 'makeD');
                });
            },

            'by link text'() {
              return session
                .find('link text', 'What a cute, yellow backpack.')
                .then(getId)
                .then(function(id: string) {
                  assert.strictEqual(id, 'c');
                });
            },

            'by partial link text'() {
              return session
                .find('partial link text', 'cute, yellow')
                .then(getId)
                .then(function(id: string) {
                  assert.strictEqual(id, 'c');
                });
            },

            'by link text (hidden text)'() {
              return session
                .find('link text', 'What a cute backpack.')
                .then(getId)
                .then(function(id: string) {
                  assert.strictEqual(id, 'c3');
                });
            },

            'by partial link text (hidden text)'() {
              return session
                .find('partial link text', 'cute backpack')
                .then(getId)
                .then(function(id: string) {
                  assert.strictEqual(id, 'c3');
                });
            },

            'by tag name'() {
              return session
                .find('tag name', 'span')
                .then(getId)
                .then(function(id: string) {
                  assert.strictEqual(id, 'b3');
                });
            },

            'by xpath'() {
              return session
                .find('xpath', 'id("e")/span[1]')
                .then(getId)
                .then(function(id: string) {
                  assert.strictEqual(id, 'f');
                });
            },

            'non-existent element'() {
              return session.find('id', 'does-not-exist').then(
                function() {
                  throw new Error(
                    'Requesting non-existing element should throw error'
                  );
                },
                function(error: Error) {
                  if (error.name !== 'NoSuchElement') {
                    throw error;
                  }
                }
              );
            }
          }
        };
      })(),

      '#find (with implicit timeout)': (function() {
        let startTime: number;
        return function() {
          return session
            .get('tests/functional/webdriver/data/elements.html')
            .then(function() {
              return session.setTimeout('implicit', 2000);
            })
            .then(function() {
              startTime = Date.now();
              return session.find('id', 'd').then(
                function() {
                  throw new Error(
                    'Requesting non-existing element should throw error'
                  );
                },
                function() {
                  assert.operator(
                    Date.now() - startTime,
                    '>=',
                    2000,
                    'Driver should wait for implicit timeout before continuing'
                  );
                }
              );
            })
            .then(function() {
              return session.find('id', 'makeD');
            })
            .then(function(element: Element) {
              return element.click();
            })
            .then(function() {
              return session.setTimeout('implicit', 10000);
            })
            .then(function() {
              startTime = Date.now();
              return session.find('id', 'd');
            })
            .then(function(element: Element) {
              assert.operator(
                Date.now() - startTime,
                '<',
                10000,
                'Driver should not wait until end of implicit timeout once element is available'
              );
              assert.property(element, 'elementId');
              return element.getAttribute('id');
            })
            .then(function(id: string) {
              assert.strictEqual(id, 'd');
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
            elements.map(function(element: Element) {
              return element.getAttribute('id');
            })
          );
        }

        return {
          before() {
            resetBrowserState = false;
            return session.get('tests/functional/webdriver/data/elements.html');
          },

          after() {
            resetBrowserState = true;
          },

          tests: {
            'by id'() {
              return session
                .findAll('id', 'a')
                .then(getIds)
                .then(function(ids: string[]) {
                  assert.deepEqual(ids, ['a']);
                });
            },

            'by class name'() {
              return session
                .findAll('class name', 'b')
                .then(getIds)
                .then(function(ids: string[]) {
                  assert.deepEqual(ids, ['b2', 'b1', 'b3', 'b4']);
                });
            },

            'by css selector'() {
              return session
                .findAll('css selector', '#c span.b')
                .then(getIds)
                .then(function(ids: string[]) {
                  assert.deepEqual(ids, ['b3', 'b4']);
                });
            },

            'by name'() {
              return session
                .findAll('name', 'makeD')
                .then(getIds)
                .then(function(ids: string[]) {
                  assert.deepEqual(ids, ['makeD', 'killE']);
                });
            },

            'by link text'() {
              return session
                .findAll('link text', 'What a cute, yellow backpack.')
                .then(getIds)
                .then(function(ids: string[]) {
                  assert.deepEqual(ids, ['c', 'c2']);
                });
            },

            'by partial link text'() {
              return session
                .findAll('partial link text', 'cute, yellow')
                .then(getIds)
                .then(function(ids: string[]) {
                  assert.deepEqual(ids, ['c', 'c2']);
                });
            },

            'by link text (hidden text)'() {
              return session
                .findAll('link text', 'What a cute backpack.')
                .then(getIds)
                .then(function(ids: string[]) {
                  assert.deepEqual(ids, ['c3']);
                });
            },

            'by partial link text (hidden text)'() {
              return session
                .findAll('partial link text', 'cute backpack')
                .then(getIds)
                .then(function(ids: string[]) {
                  assert.deepEqual(ids, ['c3']);
                });
            },

            'by tag name'() {
              return session
                .findAll('tag name', 'span')
                .then(getIds)
                .then(function(ids: string[]) {
                  assert.deepEqual(ids, ['b3', 'b4', 'f', 'g']);
                });
            },

            'by xpath'() {
              return session
                .findAll('xpath', 'id("e")/span')
                .then(getIds)
                .then(function(ids: string[]) {
                  assert.deepEqual(ids, ['f', 'g']);
                });
            },

            'non-existent'() {
              return session
                .findAll('id', 'does-not-exist')
                .then(function(elements: Element[]) {
                  assert.deepEqual(elements, []);
                });
            }
          }
        };
      })(),

      '#findDisplayed'(this: Test) {
        if (session.capabilities.noElementDisplayed) {
          this.skip('Remote does not support /displayed endpoint');
        }

        if (session.capabilities.brokenElementSerialization) {
          this.skip('element serialization is broken');
        }

        return session
          .get('tests/functional/webdriver/data/visibility.html')
          .then(function() {
            return session.findDisplayed('id', 'does-not-exist').then(
              function() {
                throw new Error(
                  'findDisplayed should not find non-existing elements'
                );
              },
              function(error: Error) {
                assert.strictEqual(
                  error.name,
                  'NoSuchElement',
                  'Non-existing element should throw NoSuchElement error after timeout'
                );
              }
            );
          })
          .then(function() {
            return session.findDisplayed('id', 'noDisplay').then(
              function() {
                throw new Error(
                  'findDisplayed should not find hidden elements'
                );
              },
              function(error: Error) {
                assert.strictEqual(
                  error.name,
                  'ElementNotVisible',
                  'Existing but hidden element should throw ElementNotVisible error after timeout'
                );
              }
            );
          })
          .then(function() {
            return session.findDisplayed('class name', 'multipleVisible');
          })
          .then(function(element: Element) {
            return element.getVisibleText();
          })
          .then(function(text: string) {
            assert.strictEqual(
              text,
              'b',
              'The first visible element should be returned, even if it is not the first' +
                ' element of any visibility that matches the query'
            );

            return session.setFindTimeout(2000);
          })
          .then(function() {
            return session.findById('makeVisible');
          })
          .then(function(element: Element) {
            return element.click();
          })
          .then(function() {
            return session.findDisplayed('id', 'noDisplay');
          })
          .then(function(element: Element) {
            return element.getProperty('id');
          })
          .then(function(id: string) {
            assert.strictEqual(id, 'noDisplay');
          });
      },

      '#find convenience methods': createStubbedSuite(
        'find',
        'findBy_',
        suffixes,
        strategyNames
      ),

      '#findAll convenience methods': createStubbedSuite(
        'findAll',
        'findAllBy_',
        suffixes.filter(suffix => suffix !== 'Id'),
        strategyNames.filter(strategy => strategy !== 'id')
      ),

      '#findDisplayed convenience methods': createStubbedSuite(
        'findDisplayed',
        'findDisplayedBy_',
        suffixes,
        strategyNames,
        (test: Test) => {
          if (session.capabilities.noElementDisplayed) {
            test.skip('Remote does not support /displayed endpoint');
          }
        }
      ),

      '#waitForDeleted'() {
        let startTime: number;

        return session
          .get('tests/functional/webdriver/data/elements.html')
          .then(function() {
            // Verifies element to be deleted exists at the start of
            // the test
            return session.findById('e');
          })
          .then(function() {
            return session.setFindTimeout(5000);
          })
          .then(function() {
            return session.findById('killE');
          })
          .then(function(element: Element) {
            startTime = Date.now();
            return element.click();
          })
          .then(function() {
            return session.waitForDeleted('id', 'e');
          })
          .then(function() {
            const timeSpent = Date.now() - startTime;
            assert.operator(
              timeSpent,
              '>',
              250,
              'Waiting for deleted should wait until element is gone'
            );
            assert.operator(
              timeSpent,
              '<',
              5000,
              'Waiting for deleted should not wait until end of implicit timeout once element is gone'
            );
          });
      },

      '#waitForDeleted -> timeout'() {
        let startTime: number;

        return session
          .get('tests/functional/webdriver/data/elements.html')
          .then(function() {
            // Verifies element to be deleted exists at the start of
            // the test
            return session.findById('e');
          })
          .then(function() {
            return session.setFindTimeout(200);
          })
          .then(function() {
            startTime = Date.now();
            return session.waitForDeleted('id', 'e');
          })
          .then(
            function() {
              throw new Error(
                'Waiting for deleted element that never disappears should time out'
              );
            },
            function() {
              assert.operator(
                Date.now() - startTime,
                '>',
                200,
                'Failure should not occur until after the implicit timeout has expired'
              );
            }
          );
      },

      '#waitForDeleted convenience methods': createStubbedSuite(
        'waitForDeleted',
        'waitForDeletedBy_',
        suffixes,
        strategyNames
      ),

      '#getActiveElement'(this: Test) {
        if (session.capabilities.brokenElementSerialization) {
          this.skip('element serialization is broken');
        }

        return session
          .get('tests/functional/webdriver/data/form.html')
          .then(function() {
            return session.getActiveElement();
          })
          .then(function(element: Element) {
            return element.getTagName();
          })
          .then(function(tagName: string) {
            assert.strictEqual(tagName, 'body');
            return session.execute(function() {
              document.getElementById('input')!.focus();
            });
          })
          .then(function() {
            return session.getActiveElement();
          })
          .then(function(element: Element) {
            return element.getAttribute('id');
          })
          .then(function(id: string) {
            assert.strictEqual(id, 'input');
          });
      },

      '#pressKeys'() {
        let formElement: Element;

        // TODO: Complex characters, tabs and arrows, copy and paste
        return session
          .get('tests/functional/webdriver/data/form.html')
          .then(function() {
            return session.findById('input');
          })
          .then(function(element: Element) {
            formElement = element;
            return element.click();
          })
          .then(function() {
            return session.pressKeys('hello, world');
          })
          .then(function() {
            return formElement.getProperty('value');
          })
          .then(function(value: string) {
            assert.strictEqual(value, 'hello, world');
          });
      },

      '#getOrientation'(this: Test) {
        if (!session.capabilities.rotatable) {
          this.skip('not rotatable');
        }

        return session.getOrientation().then(function(value: string) {
          assert.include(['PORTRAIT', 'LANDSCAPE'], value);
        });
      },

      '#setOrientation'(this: Test) {
        if (!session.capabilities.rotatable) {
          this.skip('not rotatable');
        }

        return session.setOrientation('LANDSCAPE').then(function() {
          return session.setOrientation('PORTRAIT');
        });
      },

      '#getAlertText'(this: Test) {
        if (!session.capabilities.handlesAlerts) {
          this.skip('cannot handle alerts');
        }

        return session
          .get('tests/functional/webdriver/data/prompts.html')
          .then(function() {
            return session.findById('alert');
          })
          .then(function(element: Element) {
            return element.click();
          })
          .then(function() {
            return session.getAlertText();
          })
          .then(function(alertText: string) {
            assert.strictEqual(alertText, 'Oh, you thank.');
            return session.acceptAlert();
          })
          .then(function() {
            return session.execute('return result.alert;');
          })
          .then(function(result: boolean) {
            assert.isTrue(result);
          });
      },

      '#typeInPrompt'(this: Test) {
        if (!session.capabilities.handlesAlerts) {
          this.skip('cannot handle alerts');
        }

        return session
          .get('tests/functional/webdriver/data/prompts.html')
          .then(function() {
            return session.findById('prompt');
          })
          .then(function(element: Element) {
            return element.click();
          })
          .then(function() {
            return session.getAlertText();
          })
          .then(function(alertText: string) {
            assert.strictEqual(
              alertText,
              'The monkey... got charred. Is he all right?'
            );
            return session.typeInPrompt('yes');
          })
          .then(function() {
            return session.acceptAlert();
          })
          .then(function() {
            return session.execute('return result.prompt;');
          })
          .then(function(result: string) {
            assert.strictEqual(result, 'yes');
          });
      },

      '#typeInPrompt array'(this: Test) {
        if (!session.capabilities.handlesAlerts) {
          this.skip('cannot handle alerts');
        }

        return session
          .get('tests/functional/webdriver/data/prompts.html')
          .then(function() {
            return session.findById('prompt');
          })
          .then(function(element: Element) {
            return element.click();
          })
          .then(function() {
            return session.getAlertText();
          })
          .then(function(alertText: string) {
            assert.strictEqual(
              alertText,
              'The monkey... got charred. Is he all right?'
            );
            return session.typeInPrompt(['y', 'e', 's']);
          })
          .then(function() {
            return session.acceptAlert();
          })
          .then(function() {
            return session.execute('return result.prompt;');
          })
          .then(function(result: string) {
            assert.strictEqual(result, 'yes');
          });
      },

      '#acceptAlert'(this: Test) {
        if (!session.capabilities.handlesAlerts) {
          this.skip('cannot handle alerts');
        }

        return session
          .get('tests/functional/webdriver/data/prompts.html')
          .then(function() {
            return session.findById('confirm');
          })
          .then(function(element: Element) {
            return element.click();
          })
          .then(function() {
            return session.getAlertText();
          })
          .then(function(alertText: string) {
            assert.strictEqual(alertText, 'Would you like some bananas?');
            return session.acceptAlert();
          })
          .then(function() {
            return session.execute('return result.confirm;');
          })
          .then(function(result: boolean) {
            assert.isTrue(result);
          });
      },

      '#dismissAlert'(this: Test) {
        if (!session.capabilities.handlesAlerts) {
          this.skip('cannot handle alerts');
        }

        return session
          .get('tests/functional/webdriver/data/prompts.html')
          .then(function() {
            return session.findById('confirm');
          })
          .then(function(element: Element) {
            return element.click();
          })
          .then(function() {
            return session.getAlertText();
          })
          .then(function(alertText: string) {
            assert.strictEqual(alertText, 'Would you like some bananas?');
            return session.dismissAlert();
          })
          .then(function() {
            return session.execute('return result.confirm;');
          })
          .then(function(result: boolean) {
            assert.isFalse(result);
          });
      },

      '#moveMouseTo'(this: Test) {
        if (!session.capabilities.mouseEnabled) {
          this.skip('mouse not enabled');
        }

        return session
          .get('tests/functional/webdriver/data/pointer.html')
          .then(function() {
            return session.moveMouseTo(100, 12);
          })
          .then(function() {
            return session.execute(
              'return result.mousemove.a && result.mousemove.a[result.mousemove.a.length - 1];'
            );
          })
          .then(function(event: MouseEvent) {
            assert.isObject(event);
            assert.strictEqual(event.clientX, 100);
            assert.strictEqual(event.clientY, 12);
            return session.moveMouseTo(100, 41);
          })
          .then(function() {
            return session.execute(
              'return result.mousemove.b && result.mousemove.b[result.mousemove.b.length - 1];'
            );
          })
          .then(function(event: MouseEvent) {
            assert.isObject(event);
            assert.strictEqual(event.clientX, 200);
            assert.strictEqual(event.clientY, 53);
            return session.findById('c');
          })
          .then(function(element: Element) {
            return session
              .moveMouseTo(element)
              .then(function() {
                return session.execute(
                  'return result.mousemove.c && result.mousemove.c[result.mousemove.c.length - 1];'
                );
              })
              .then(function(event: MouseEvent) {
                assert.isObject(event);
                assert.closeTo(event.clientX, 450, 4);
                assert.closeTo(event.clientY, 90, 4);
                return session.moveMouseTo(element, 2, 4);
              });
          })
          .then(function() {
            return session.execute(
              'return result.mousemove.c && result.mousemove.c[result.mousemove.c.length - 1];'
            );
          })
          .then(function(event: MouseEvent) {
            assert.isObject(event);
            assert.closeTo(event.clientX, 352, 4);
            assert.closeTo(event.clientY, 80, 4);
          });
      },

      '#clickMouseButton'(this: Test) {
        if (!session.capabilities.mouseEnabled) {
          this.skip('mouse not enabled');
        }

        function click(button: number) {
          /*jshint maxlen:140 */
          return function() {
            return session
              .clickMouseButton(button)
              .then(function() {
                return session.execute(
                  'return result.click.a && result.click.a[0];'
                );
              })
              .then(function(event: any) {
                assert.strictEqual(event.button, button);
                return session
                  .execute(
                    'return result.mousedown.a && result.mousedown.a[0];'
                  )
                  .then(function(mouseDownEvent: MouseEvent) {
                    assert.closeTo(
                      event.timeStamp,
                      mouseDownEvent.timeStamp,
                      300
                    );
                    assert.operator(
                      mouseDownEvent.timeStamp,
                      '<=',
                      event.timeStamp
                    );
                    return session.execute(
                      'return result.mouseup.a && result.mouseup.a[0];'
                    );
                  })
                  .then(function(mouseUpEvent: MouseEvent) {
                    assert.closeTo(
                      event.timeStamp,
                      mouseUpEvent.timeStamp,
                      300
                    );
                    assert.operator(
                      mouseUpEvent.timeStamp,
                      '<=',
                      event.timeStamp
                    );
                  });
              });
          };
        }

        return session
          .get('tests/functional/webdriver/data/pointer.html')
          .then(function() {
            return session.findById('a');
          })
          .then(function(element: Element) {
            return session.moveMouseTo(element);
          })
          .then(click(0));

        // TODO: Right-click/middle-click are unreliable in browsers; find
        // a way to test them.
      },

      '#pressMouseButton, #releaseMouseButton'(this: Test) {
        if (!session.capabilities.mouseEnabled) {
          this.skip('mouse not enabled');
        }

        return session
          .get('tests/functional/webdriver/data/pointer.html')
          .then(function() {
            return session.findById('a');
          })
          .then(function(element: Element) {
            return session.moveMouseTo(element);
          })
          .then(function() {
            return session.pressMouseButton();
          })
          .then(function() {
            return session.findById('b');
          })
          .then(function(element: Element) {
            return session.moveMouseTo(element);
          })
          .then(function() {
            return session.releaseMouseButton();
          })
          .then(function() {
            /*jshint maxlen:140 */
            return session.execute('return result;');
          })
          .then(function(result: any) {
            assert.isUndefined(result.mouseup.a);
            assert.isUndefined(result.mousedown.b);
            assert.lengthOf(result.mousedown.a, 1);
            assert.lengthOf(result.mouseup.b, 1);
          });
      },

      '#doubleClick'(this: Test) {
        if (!session.capabilities.mouseEnabled) {
          this.skip('mouse not enabled');
        }

        return session
          .get('tests/functional/webdriver/data/pointer.html')
          .then(function() {
            return session.findById('a');
          })
          .then(function(element: Element) {
            return session.moveMouseTo(element);
          })
          .then(function() {
            return session.doubleClick();
          })
          .then(function() {
            return session.execute('return result;');
          })
          .then(function(result: any) {
            assert.isArray(result.dblclick.a, 'dblclick should have occurred');
            assert.isArray(
              result.mousedown.a,
              'mousedown should have occurred'
            );
            assert.isArray(result.mouseup.a, 'mouseup should have occurred');
            assert.isArray(result.click.a, 'click should have occurred');
            assert.lengthOf(
              result.dblclick.a,
              1,
              'One dblclick should occur on double-click'
            );
            assert.lengthOf(
              result.mousedown.a,
              2,
              'Two mousedown should occur on double-click'
            );
            assert.lengthOf(
              result.mouseup.a,
              2,
              'Two mouseup should occur on double-click'
            );
            assert.lengthOf(
              result.click.a,
              2,
              'Two click should occur on double-click'
            );

            assert.operator(
              result.mousedown.a[1].timeStamp,
              '<=',
              result.mouseup.a[1].timeStamp
            );
            assert.operator(
              result.mouseup.a[1].timeStamp,
              '<=',
              result.click.a[1].timeStamp
            );
            assert.operator(
              result.click.a[1].timeStamp,
              '<=',
              result.dblclick.a[0].timeStamp
            );
          });
      },

      '#tap'(this: Test) {
        if (!session.capabilities.touchEnabled) {
          this.skip('touch not supported');
        }

        return session
          .get('tests/functional/webdriver/data/pointer.html')
          .then(function() {
            return session.findById('a');
          })
          .then(function(element: Element) {
            return session.tap(element);
          })
          .then(function() {
            return session.execute('return result;');
          })
          .then(function(result: any) {
            assert.lengthOf(result.touchstart.a, 1);
            assert.lengthOf(result.touchend.a, 1);

            assert.operator(
              result.touchstart.a[0].timeStamp,
              '<=',
              result.touchend.a[0].timeStamp
            );
          });
      },

      '#pressFinger, #releaseFinger, #moveFinger'(this: Test) {
        if (!session.capabilities.touchEnabled) {
          this.skip('touch not supported');
        }
        if (session.capabilities.brokenMoveFinger) {
          this.skip('move finger support is broken');
        }

        return session
          .get('tests/functional/webdriver/data/pointer.html')
          .then(function() {
            return session.pressFinger(5, 5);
          })
          .then(function() {
            return session.moveFinger(200, 53);
          })
          .then(function() {
            return session.releaseFinger(200, 53);
          })
          .then(function() {
            return session.execute('return result;');
          })
          .then(function(result: any) {
            assert.isUndefined(result.touchend.a);
            assert.isUndefined(result.touchstart.b);
            assert.lengthOf(result.touchstart.a, 1);
            assert.lengthOf(result.touchend.b, 1);
          });
      },

      '#touchScroll'(this: Test) {
        if (!session.capabilities.touchEnabled) {
          this.skip('touch is not enabled');
        }

        return session
          .get('tests/functional/webdriver/data/scrollable.html')
          .then(getScrollPosition)
          .then(function(position: Position) {
            assert.deepEqual(position, { x: 0, y: 0 });
            return session.touchScroll(20, 40);
          })
          .then(getScrollPosition)
          .then(function(position: Position) {
            assert.deepEqual(position, { x: 20, y: 40 });
            return session.findById('viewport');
          })
          .then(function(viewport: any) {
            return session.touchScroll(viewport, 100, 200);
          })
          .then(getScrollPosition)
          .then(function(position: Position) {
            assert.deepEqual(position, { x: 100, y: 3232 });
          });
      },

      '#doubleTap'(this: Test) {
        if (!session.capabilities.touchEnabled) {
          this.skip('touch is not enabled');
        }

        return session
          .get('tests/functional/webdriver/data/pointer.html')
          .then(function() {
            return session.findById('a');
          })
          .then(function(element: Element) {
            return session.doubleTap(element);
          })
          .then(function() {
            return session.execute('return result;');
          })
          .then(function(result: any) {
            assert.lengthOf(result.touchstart.a, 2);
            assert.lengthOf(result.touchend.a, 2);
          });
      },

      '#longTap'(this: Test) {
        if (!session.capabilities.touchEnabled) {
          this.skip('touch is not enabled');
        }
        if (session.capabilities.brokenLongTap) {
          this.skip('long tap is broken');
        }

        return session
          .get('tests/functional/webdriver/data/pointer.html')
          .then(function() {
            return session.findById('a');
          })
          .then(function(element: Element) {
            return session.longTap(element);
          })
          .then(function() {
            return session.execute('return result;');
          })
          .then(function(result: any) {
            assert.lengthOf(result.touchstart.a, 1);
            assert.lengthOf(result.touchend.a, 1);
            assert.operator(
              result.touchend.a[0].timeStamp - result.touchstart.a[0].timeStamp,
              '>=',
              500
            );
          });
      },

      '#flickFinger (element)'(this: Test) {
        if (!session.capabilities.touchEnabled) {
          this.skip('touch is not enabled');
        }
        if (session.capabilities.brokenFlickFinger) {
          this.skip('flick finger is broken');
        }

        return session
          .get('tests/functional/webdriver/data/scrollable.html')
          .then(getScrollPosition)
          .then(function(originalPosition: Position) {
            assert.deepEqual(originalPosition, { x: 0, y: 0 });
            return session
              .findByTagName('body')
              .then(function(element: Element) {
                return session.flickFinger(element, -100, -100, 100);
              })
              .then(getScrollPosition)
              .then(function(position: Position) {
                assert.operator(originalPosition.x, '<', position.x);
                assert.operator(originalPosition.y, '<', position.y);
              });
          })
          .then(function() {
            return session.findById('viewport');
          })
          .then(function(element: Element) {
            return getScrollPosition(element).then(function(
              originalPosition: Position
            ) {
              return session
                .flickFinger(element, -100, -100, 100)
                .then(function() {
                  return getScrollPosition(element);
                })
                .then(function(position: Position) {
                  assert.operator(originalPosition.x, '<', position.x);
                  assert.operator(originalPosition.y, '<', position.y);
                });
            });
          });
      },

      '#flickFinger (no element)'(this: Test) {
        if (!session.capabilities.touchEnabled) {
          this.skip('touch is not enabled');
        }
        if (session.capabilities.brokenFlickFinger) {
          this.skip('flick finger is broken');
        }

        return session
          .get('tests/functional/webdriver/data/scrollable.html')
          .then(function() {
            return session.flickFinger(400, 400);
          })
          .then(getScrollPosition)
          .then(function(position: Position) {
            assert.operator(0, '<', position.x);
            assert.operator(0, '<', position.y);
          });
      },

      'geolocation (#getGeolocation, #setGeolocation)'(this: Test) {
        if (!session.capabilities.locationContextEnabled) {
          this.skip('location context not enabled');
        }

        return session
          .get('tests/functional/webdriver/data/default.html')
          .then(function() {
            return session.setGeolocation({
              latitude: 12.1,
              longitude: -22.33,
              altitude: 1000.2
            });
          })
          .then(function() {
            return session.getGeolocation();
          })
          .then(function(location: Geolocation) {
            assert.isObject(location);
            assert.closeTo(location.latitude!, 12.0, 0.2);
            assert.closeTo(location.longitude!, -22.33, 0.01);

            // Geolocation implementations that cannot provide altitude
            // information shall return `null`,
            // http://dev.w3.org/geo/api/spec-source.html#altitude
            if (location.altitude != null) {
              assert.closeTo(location.altitude, 1000.0, 1);
            }
          });
      },

      '#getLogsFor'() {
        return session
          .get('tests/functional/webdriver/data/default.html')
          .then(function() {
            return session.getAvailableLogTypes();
          })
          .then(function(types: any[]) {
            if (!types.length) {
              return [];
            }

            return session.getLogsFor(types[0]);
          })
          .then(function(logs: any[]) {
            assert.isArray(logs);

            if (logs.length) {
              const log = logs[0];
              assert.isObject(log);
              assert.property(log, 'timestamp');
              assert.property(log, 'level');
              assert.property(log, 'message');
              assert.isNumber(log.timestamp);
              assert.isString(log.level);
              assert.isString(log.message);
            }
          });
      },

      '#getAvailableLogTypes'() {
        return session
          .get('tests/functional/webdriver/data/default.html')
          .then(function() {
            return session.getAvailableLogTypes();
          })
          .then(function(types: any[]) {
            assert.isArray(types);
          });
      },

      '#getApplicationCacheStatus'(this: Test) {
        if (!session.capabilities.applicationCacheEnabled) {
          this.skip('application cache is not enabled');
        }

        return session
          .get('tests/functional/webdriver/data/default.html')
          .then(function() {
            return session.getApplicationCacheStatus();
          })
          .then(function(status: number) {
            assert.strictEqual(status, 0);
          });
      },

      'local storage': createStorageTests('Local'),
      'session storage': createStorageTests('Session')
    }
  };
});
