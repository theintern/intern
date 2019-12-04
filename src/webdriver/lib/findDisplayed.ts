import { Task, CancellablePromise } from '../../common';
import statusCodes from './statusCodes';
import Element from '../Element';
import Session from '../Session';
import { Strategy } from './Locator';

/**
 * Gets the first [[Element.isDisplayed|displayed]] element inside this element
 * matching the given query. This is inherently slower than [[Element.find]],
 * so should only be used in cases where the visibility of an element cannot be
 * ensured in advance.
 */
export default function findDisplayed(
  session: Session,
  locator: Session | Element,
  strategy: Strategy,
  value: string
) {
  return session.getTimeout('implicit').then(originalTimeout => {
    const startTime = Date.now();

    function poll(): CancellablePromise<Element> {
      return locator.findAll(strategy, value).then(elements => {
        // Due to concurrency issues with at least ChromeDriver
        // 2.16, each element must be tested one at a time instead
        // of using `Promise.all`
        let i = -1;
        function checkElement(): PromiseLike<Element | void> | undefined {
          const element = elements[++i];
          if (element) {
            return element.isDisplayed().then(isDisplayed => {
              if (isDisplayed) {
                return element;
              } else {
                return checkElement();
              }
            });
          }
        }

        return Task.resolve<Element | void>(checkElement()).then(element => {
          if (element) {
            return element;
          } else if (Date.now() - startTime > originalTimeout) {
            const error: any = new Error();
            error.status = elements.length ? 11 : 7;
            error.name = (<any>statusCodes)[error.status][0];
            error.message = (<any>statusCodes)[error.status][1];
            throw error;
          } else {
            return poll();
          }
        });
      });
    }

    return poll();
  });
}
