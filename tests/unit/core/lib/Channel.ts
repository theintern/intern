import { mockImport } from 'tests/support/mockUtil';
import { Task } from 'src/common';
import _Channel, { ChannelOptions } from 'src/core/lib/Channel';

let messages: string[];
let websocketError: 'construct' | 'send' | null;
let Channel: typeof _Channel;

registerSuite('core/lib/Channel', {
  async before() {
    ({ default: Channel } = await mockImport(
      () => import('src/core/lib/Channel'),
      replace => {
        replace(() => import('src/core/lib/channels/WebSocket')).with(
          MockWebSocket as any
        );
        replace(() => import('src/core/lib/channels/Http')).with(
          MockHttp as any
        );
      }
    ));
  },

  beforeEach() {
    messages = [];
    websocketError = null;
  },

  tests: {
    '#sendMessage': {
      http() {
        const channel = new Channel(<ChannelOptions>{});
        return channel.sendMessage('suiteStart', null).then(() => {
          assert.deepEqual(messages, [
            'constructing http',
            'sending http suiteStart'
          ]);
        });
      },

      websocket() {
        const channel = new Channel(<ChannelOptions>{ port: 1 });
        return channel.sendMessage('suiteStart', null).then(() => {
          assert.deepEqual(messages, [
            'constructing websocket',
            'sending websocket remoteStatus',
            'sending websocket suiteStart'
          ]);
        });
      },

      'http fallback': {
        'websocket error'() {
          const channel = new Channel(<ChannelOptions>{ port: 1 });
          websocketError = 'send';
          return channel.sendMessage('suiteStart', null).then(() => {
            assert.deepEqual(messages, [
              'constructing websocket',
              'sending websocket remoteStatus',
              'constructing http',
              'sending http suiteStart'
            ]);
          });
        },

        'websocket construction error'() {
          const channel = new Channel(<ChannelOptions>{ port: 1 });
          websocketError = 'construct';
          return channel.sendMessage('suiteStart', null).then(() => {
            assert.deepEqual(messages, [
              'constructing websocket',
              'constructing http',
              'sending http suiteStart'
            ]);
          });
        }
      }
    }
  }
});

class MockWebSocket {
  constructor() {
    messages.push('constructing websocket');
    if (websocketError === 'construct') {
      throw new Error('Error constructing');
    }
  }

  sendMessage(event: string) {
    messages.push(`sending websocket ${event}`);
    return websocketError === 'send' ? Task.reject() : Task.resolve();
  }
}

class MockHttp {
  constructor() {
    messages.push('constructing http');
  }

  sendMessage(event: string) {
    messages.push(`sending http ${event}`);
    return Task.resolve();
  }
}
