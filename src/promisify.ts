import { createWriteStream, mkdir, rename, unlink } from 'fs'
import { dirname, join as joinPath, parse as parsePath, sep as pathSeparator } from 'path'

import * as log from './log'

/**
 * fs.write Promise wrapper. Creates directory tree if necessary
 *
 * @param file Path to file to write to
 * @param data Data to write
 * @param flags File mode - 'a': append, 'w': write
 * @param tryMkdir Whether to try to create missing folders. Used for preventing infinite recursion
 */
function promiseWrite(file: string, data: string | Buffer, flags: string = 'w', tryMkdir: boolean = true): Promise<number> {
	return new Promise<number>((resolve, reject) => {
		const ws = createWriteStream(file, { flags: flags })
		ws.on('error', err => {
			if (!tryMkdir || err.code != 'ENOENT') {
				reject(err)
				return
			}
			createDirectory(dirname(file))
				.then(() => promiseWrite(file, data, flags, false))
				.then(resolve)
		})
		ws.end(data, () => { resolve(ws.bytesWritten) })
	})
}

/**
 * fs.mkdir Promise wrapper
 *
 * @param dir Path to directory to create
 */
function promiseMkdir(dir: string): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		mkdir(dir, err => {
			if (err && err.code != 'EEXIST') {
				log.error('mkdir: Failed to create folder "%s"', dir)
				reject(err)
				return
			}
			log.debug('mkdir: Clearing cached promise "%s"', dir)
			delete mkdirCache[dir]
			resolve()
		})
	})
}

/**
 * Map of pending fsMkdir calls
 */
const mkdirCache: { [dir: string]: Promise<void> } = {}

/**
 * Promisified mkdir -p with cache to prevent duplicate calls
 *
 * @param dir Path to directory to create
 */
export function createDirectory(dir: string): Promise<void> {
	const pathInfo = parsePath(dir)
	if (pathInfo.dir === pathInfo.root) {
		log.error('mkdir: Cannot create root folder "%s"', dir)
	}
	dir = joinPath(pathInfo.dir, pathInfo.base)
	if (mkdirCache[dir]) {
		log.debug('mkdir: Returning cached promise for "%s"', dir)
		return mkdirCache[dir]
	}
	const createThen = (dirInner: string) => () => promiseMkdir(dirInner),
		dirs = dir.substr(pathInfo.root.length).split(pathSeparator)
	let curPath = pathInfo.root || `.${pathSeparator}`,
		promise = Promise.resolve()
	for (const subDir of dirs) {
		curPath += subDir
		if (mkdirCache[curPath]) {
			log.debug('mkdir: Returning cached promise for "%s"', curPath)
			promise = mkdirCache[curPath]
		}
		else {
			log.debug('mkdir: Creating folder "%s"', curPath)
			promise = promise.then(createThen(curPath))
			mkdirCache[curPath] = promise
		}
		curPath += pathSeparator
	}
	return promise
}

/**
 * Create or truncate a file and write the given data to it
 *
 * @param file Path of file to write to
 * @param data Data to write
 */
export function writeFile(file: string, data: string | Buffer): Promise<number> {
	return promiseWrite(file, data, 'w')
}

/**
 * Create a file if necessary and append the given data to it
 *
 * @param file Path of file to write to
 * @param data Data to write
 */
export function appendFile(file: string, data: string | Buffer): Promise<number> {
	return promiseWrite(file, data, 'a')
}

/**
 * fs.rename Promise wrapper
 *
 * @param from
 * @param to
 */
export function renameFile(from: string, to: string): Promise<void> {
	return new Promise((resolve, reject) => {
		rename(from, to, err => {
			if (err) {
				reject(err)
				return
			}
			resolve()
		})
	})
}

/**
 * fs.unlink Promise wrapper
 *
 * @param file
 */
export function removeFile(file: string): Promise<void> {
	return new Promise((resolve, reject) => {
		unlink(file, err => {
			if (err && err.code != 'ENOENT') {
				reject(err)
				return
			}
			resolve()
		})
	})
}

/**
 * Scheduling function to prevent chains of function calls from
 * blocking I/O for long periods of time
 *
 * @param _this The context in which the functions are called
 * @param fcns Functions to call
 */
export function queue(_this: any, ...fcns: Function[]): Promise<void> {
	const wait = () => new Promise<void>((resolve, reject) => { setImmediate(resolve) })
	let promise = wait()
	for (let i = 0, lastFun = fcns.length - 1; i <= lastFun; ++i) {
		promise = promise.then(() => {
			fcns[i].call(_this)
			if (i < lastFun) {
				return wait()
			}
		})
	}
	return promise
}
