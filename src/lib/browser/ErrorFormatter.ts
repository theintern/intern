import ErrorFormatter from '../common/ErrorFormatter';

export default class BrowserErrorFormatter extends ErrorFormatter {
	/**
	 * Dereference the source from a traceline.
	 */
	protected _getSource(tracepath: string) {
		if (tracepath === '<anonymous>') {
			return 'anonymous';
		}

		const match = /^(.*?):(\d+)(:\d+)?$/.exec(tracepath);
		if (!match) {
			// no line or column data
			return tracepath;
		}

		tracepath = match[1];
		const line = Number(match[2]);
		const col = match[3] ? Number(match[3].substring(1)) : null;

		return tracepath + ':' + line + (col == null ? '' : ':' + col);
	}
}
