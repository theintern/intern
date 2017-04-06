import Server from 'src/Server';
import Session from 'src/Session';
import Command from 'src/Command';
import { LeadfootURL } from 'src/interfaces';

export * from 'src/lib/util';

export function createServer(config: LeadfootURL|string) {
	return new Server(config);
}

export function createServerFromRemote(remote: any) {
	if (remote.session && remote.session.server) {
		return new Server(remote.session.server.url);
	}

	throw new Error('Unsupported remote');
}

export function createSessionFromRemote(remote: Command<any>, SessionCtor: any = Session) {
	const server = createServerFromRemote(remote);

	function fixGet(session: any) {
		const oldGet = session.get;
		session.get = function (this: Session, url: string) {
			if (!/^[A-Za-z][A-Za-z0-9+.-]+:/.test(url)) {
				url = convertPathToUrl(remote, url);
			}

			return oldGet.call(this, url);
		};
	}

	if (remote.session) {
		const session = new SessionCtor(remote.session.sessionId, server, remote.session.capabilities);
		fixGet(session);
		return (<any> server)._fillCapabilities(session);
	}

	throw new Error('Unsupported remote');
}

export function convertPathToUrl(session: any, url: string) {
	if (session.session) {
		session = session.session;
	}

	return session.proxyUrl + url.slice(session.proxyBasePathLength);
}
