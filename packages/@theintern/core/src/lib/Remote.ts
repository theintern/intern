import { Command } from '@theintern/leadfoot';
import Environment from './Environment';

export default interface Remote extends Command<any> {
  environmentType?: Environment;
  requestedEnvironment?: Environment;
  setHeartbeatInterval(delay: number): Command<any>;
}
