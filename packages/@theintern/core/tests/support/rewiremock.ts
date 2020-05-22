import { default as rewiremockdefault } from 'rewiremock';
type rewiremock = typeof rewiremockdefault;

const rewiremocker: rewiremock =
  typeof (global as any).__webpack_require__ == 'function'
    ? require('rewiremock/webpack')
    : require('rewiremock/node');

export default rewiremocker;
