import { Task } from 'src/common';

import Base, { isChannel } from 'src/core/lib/channels/Base';
import { RemoteEvents } from 'src/core/lib/RemoteSuite';

class TestBase extends Base {
  sent: any[] = [];
  _sendData(name: keyof RemoteEvents, data: any) {
    this.sent.push([name, data]);
    return Task.resolve();
  }
}

registerSuite('core/lib/channels/Base', {
  '#sendMessage': {
    data() {
      const base = new TestBase({ sessionId: 'foo', url: 'bar' });
      base.sendMessage('remoteStatus', 'foo');
      assert.deepEqual(base.sent, [['remoteStatus', 'foo']]);
    },

    error() {
      const base = new TestBase({ sessionId: 'foo', url: 'bar' });
      base.sendMessage('error', new Error('bad'));
      assert.lengthOf(base.sent, 1);
      const message = base.sent[0];
      assert.propertyVal(message[1], 'name', 'Error');
      assert.property(message[1], 'message');
      assert.match(message[1].message, /bad/);
      assert.property(message[1], 'stack');
    }
  },

  isChannel() {
    assert.isFalse(isChannel('foo'));
    assert.isFalse(isChannel({}));
    assert.isFalse(isChannel({ sendMessage: true }));
    assert.isTrue(isChannel({ sendMessage() {} }));
  }
});
