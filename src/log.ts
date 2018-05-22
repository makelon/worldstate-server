import util = require('util')
import os = require('os')
import h = require('./helpers')

let enableTimestamps = true

export let debug = _log,
	notice = _log,
	info = _log,
	warning = _log,
	error = _error

function _noop(...args: any[]): void {}

function timestamp(): string {
	if (!enableTimestamps) {
		return ''
	}
	const d = new Date(),
		hh = h.pad(d.getHours()),
		mm = h.pad(d.getMinutes()),
		ss = h.pad(d.getSeconds()),
		ms = h.pad(d.getMilliseconds(), 3)
	return `${hh}:${mm}:${ss}.${ms} `
}

function _print(stream: NodeJS.WriteStream, format: string, params: any[]): void {
	stream.write(timestamp() + util.format(format, ...params) + os.EOL)
}

function _log(format: string, ...params: any[]): void {
	_print(process.stdout, format, params)
}

function _error(format: string, ...params: any[]): void {
	_print(process.stderr, format, params)
}

export function setTimestamps(arg: boolean): void {
	enableTimestamps = arg
}

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
