import { EOL } from 'os'
import { format as formatString } from 'util'

import { pad } from './helpers'

let enableTimestamps = true

export let debug = _log,
	notice = _log,
	info = _log,
	warning = _log,
	error = _error

function _noop(): void {}

/**
 * @returns Timestamp formatted as hh:mm:ss.SSS
 */
function timestamp(): string {
	if (!enableTimestamps) {
		return ''
	}
	const d = new Date(),
		hh = pad(d.getHours()),
		mm = pad(d.getMinutes()),
		ss = pad(d.getSeconds()),
		ms = pad(d.getMilliseconds(), 3)
	return `${hh}:${mm}:${ss}.${ms} `
}

/**
 * Write a formatted string with a trailing line break to the chosen output stream
 *
 * @param stream Destination stream, stdout or stderr
 * @param format Format string
 * @param params Replacement parameters
 */
function _print(stream: NodeJS.WriteStream, format: string, params: any[]): void {
	stream.write(timestamp() + formatString(format, ...params) + EOL)
}

/**
 * _print(process.stdout, ...)
 */
function _log(format: string, ...params: any[]): void {
	_print(process.stdout, format, params)
}

/**
 * _print(process.stderr, ...)
 */
function _error(format: string, ...params: any[]): void {
	_print(process.stderr, format, params)
}

/**
 * Enable or disable timestamps in output
 */
export function setTimestamps(arg: boolean): void {
	enableTimestamps = arg
}

/**
 * Select log level
 *
 * @param level
 */
export function setLevel(level: string): void {
	debug = notice = info = warning = error = _noop
	switch(level.toLowerCase()) {
		// Intentional fallthrough
		case 'debug':
			debug = _log
		case 'notice':
			notice = _log
		case 'info':
			info = _log
		case 'warning':
			warning = _log
		case 'error':
			error = _error
	}
}

setLevel('info')
