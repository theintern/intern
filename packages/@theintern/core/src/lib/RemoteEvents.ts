import { Events } from './executors/Executor';

export default interface RemoteEvents extends Events {
  remoteStatus: string;
}
