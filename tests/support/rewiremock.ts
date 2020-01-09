const rewiremock = (typeof (global as any).__webpack_require__ == 'function'
  ? require('rewiremock/webpack')
  : require('rewiremock/node')) as typeof import('rewiremock').default;

export default rewiremock;
