import { Task } from '@theintern/common';

import Base, { isChannel } from 'src/lib/channels/Base';
import { RemoteEvents } from 'src/lib/RemoteSuite';

class TestBase extends Base {
  sent: any[] = [];
  _sendData(name: keyof RemoteEvents, data: any) {
    this.sent.push([name, data]);
    return Task.resolve();
  }
}

registerSuite('lib/channels/Base', {
  '#sendMessage': {
    data() {
      const base = new TestBase({ sessionId: 'foo', url: 'bar' });
      base.sendMessage('remoteStatus', 'foo');
      assert.deepEqual(base.sent, [['remoteStatus', 'foo']]);
    },
  },

  isChannel() {
    assert.isFalse(isChannel('foo'));
    assert.isFalse(isChannel({}));
    assert.isFalse(isChannel({ sendMessage: true }));
    assert.isTrue(isChannel({ sendMessage() {} }));
  },
});
