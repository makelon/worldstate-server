import { EventEmitter } from 'events'
import { createReadStream } from 'fs'
import { basename, join as joinPath } from 'path'
import { createInterface } from 'readline'

import config from './config'
import * as log from './log'
import { appendFile, renameFile, removeFile, writeFile } from './promisify'

type WfRecordPatchContext<T extends WfRecordType> = {
	[K in keyof T]: T[K] extends string | number | boolean | undefined | null ? never : K
}[keyof T]

type WfRecordPatch<T extends WfRecordType> = Partial<T> & { __context?: WfRecordPatchContext<T> }

/**
 * Number of table updates before temp file cleanup is initiated
 */
const cleanTmpThreshold = 50

function errorHandler(err: NodeJS.ErrnoException): void {
	if (err) {
		log.error('File I/O error: "%s"', err.message)
	}
}

export default class Database implements WfDb {
	private loading = 0
	private tables: { [tblName: string]: WfDbTableI<WfRecordType> } = {}
	private ee = new EventEmitter()

	constructor(private dbName: string) {}

	/**
	 * Create and remove tables as required by the config.
	 * If reloading existing tables, update their path info
	 *
	 * @param onLoad Function to call once all tables are loaded
	*/
	setupTables(onLoad: () => void): void {
		const oldTables: WfSet = {}
		for (const t in this.tables) {
			oldTables[t] = true
		}
		for (const tableName of config.wsFields) {
			if (!(tableName in this.tables)) {
				++this.loading
				this.tables[tableName] = new Table(this.dbName, tableName, () => { this.setReady() })
			}
			else {
				this.tables[tableName].setPath()
			}
			delete oldTables[tableName]
		}
		for (const t in oldTables) {
			log.notice('Unloading %s/%s', this.dbName, t)
			delete this.tables[t]
		}
		if (this.loading) {
			this.ee.once('load', onLoad)
		}
		else {
			setImmediate(onLoad)
		}
	}

	/**
	 * Return table
	 *
	 * @param string tableName
	 * @returns WfDbTable
	*/
	getTable<T extends WfRecordType>(tableName: string): WfDbTable<T> {
		return (this.tables[tableName] as WfDbTable<T>) || null
	}

	/**
	 * Trigger the 'load' event when all tables are loaded
	 */
	private setReady(): void {
		if (--this.loading === 0) {
			this.ee.emit('load')
		}
	}

	/**
	 * Flush all tables
	 */
	flush(): void {
		for (const table in this.tables) {
			this.tables[table].flush()
		}
	}
}

class Table<T extends WfRecordType> implements WfDbTableI<T> {
	private tablePath = ''
	private ready = false
	private records: { [id: string]: T } = {}
	private lastUpdate = 0
	private updates = ''
	private tmpUpdates = ''
	private tmpUpdateCount = 0
	private tableBusy = true
	private tableTmpBusy = true
	private ee = new EventEmitter()

	/**
	 * Create a database table and load its data
	 *
	 * @param dbName Name of the database the table belongs to
	 * @param tableName Table name
	 * @param onLoad Function to call once the table is ready
	 */
	constructor(
		private dbName: string,
		private tableName: string,
		onLoad: () => void,
	) {
		this.ee.once('load', onLoad)
		this.setPath()
		if (this.tablePath !== '') {
			this.load(this.tablePath + '.tmp')
				.then(() => { this.setReady() })
				.catch(err => { log.error(err.message) })
		}
		else {
			setImmediate(() => { this.setReady() })
		}
	}

	/**
	 * Set the table's data file path
	 */
	setPath(): void {
		if (config.dbRoot) {
			this.tablePath = joinPath(config.dbRoot, this.dbName, basename(this.tableName) + '.db')
		}
		else {
			this.tablePath = ''
		}
	}

	/**
	 * Load records that were active on last shutdown
	 *
	 * @param tablePath Path to the table's file data
	 * @returns Promise that resolves when the table is ready
	 */
	private load(tablePath: string): Promise<void> {
		return new Promise<void>(resolve => {
			log.notice('Loading %s/%s', this.dbName, this.tableName)
			const readStream = createReadStream(tablePath, {
					encoding: 'utf8',
					flags: 'r',
				}),
				tStart = process.hrtime()
			readStream.on('error', (err: NodeJS.ErrnoException) => {
				if (err && err.code !== 'ENOENT') {
					throw new Error(`Error loading database ${this.dbName}/${this.tableName}: ${err.message}`)
				}
				log.notice('No database for %s/%s', this.dbName, this.tableName)
				resolve()
			})
			let recordCount = 0,
				updateCount = 0
			createInterface(readStream)
				.on('line', line => {
					const dataStart = line.indexOf('\t'),
						id = line.substr(0, dataStart)
					let patch: WfRecordPatch<T>
					try {
						patch = this.parsePatch(line.substr(dataStart + 1))
					}
					catch (err) {
						log.error('Failed to read record %s/%s: %s', this.dbName, this.tableName, err.message)
						return
					}
					if (this.records[id]) {
						this.applyPatch(this.records[id], patch)
						++updateCount
						++this.tmpUpdateCount
						log.debug('Updated record %s in %s/%s', id, this.dbName, this.tableName)
					}
					else {
						this.loadRecord(id, patch as T)
						++recordCount
						log.debug('Loaded record %s from %s/%s', id, this.dbName, this.tableName)
					}
				}).on('close', () => {
					const tEnd = process.hrtime(),
						loadTime = (tEnd[0] * 1e9 + tEnd[1]) - (tStart[0] * 1e9 + tStart[1])
					log.notice('Loaded %d records and %d updates from %s/%s in %d ms', recordCount, updateCount, this.dbName, this.tableName, Math.floor(loadTime / 1e3) / 1e3)
					resolve()
				})
		})
	}

	/**
	 * Parse a JSON object
	 */
	private parsePatch(input: string): WfRecordPatch<T> {
		const parsed: unknown = JSON.parse(input)
		if (typeof parsed !== 'object' || parsed === null) {
			throw new Error('Expected an object')
		}
		return parsed as T
	}

	/**
	 * Read a new record from temporary storage
	 */
	private loadRecord(id: string, record: T): void {
		this.records[id] = record
		if (!('id' in record)) {
			record.id = id
		}
	}

	/**
	 * Read incremental update for a record
	 */
	private applyPatch(record: T, patch: WfRecordPatch<T>): void {
		const context = patch.__context
		delete patch.__context
		if (context) {
			if (!record[context]) {
				record[context] = Object.create({})
			}
			Object.assign(record[context], patch)
		}
		else {
			Object.assign(record, patch)
		}
	}

	/**
	 * Mark table ready and trigger the 'load' event
	 */
	private setReady(): void {
		this.lastUpdate = Date.now()
		this.ready = true
		this.tableBusy = false
		this.tableTmpBusy = false
		log.notice('Database %s/%s is ready', this.dbName, this.tableName)
		this.ee.emit('load')
	}

	/**
	 * @returns true is table is ready
	 */
	isReady(): boolean {
		return this.ready
	}

	/**
	 * @param id Record id
	 * @returns Table record or null if not found
	 */
	get(id: string): T | null {
		return this.records[id] || null
	}

	/**
	 * @returns All table records
	 */
	getAll(): T[] {
		const ret: T[] = []
		for (const id in this.records) {
			ret.push(this.records[id])
		}
		return ret
	}

	/**
	 * @returns Set of record ids
	 */
	getIdMap(): WfSet {
		const ret: WfSet = {}
		for (const id in this.records) {
			ret[id] = true
		}
		return ret
	}

	/**
	 * @returns Timestamp of last update truncated to seconds
	 */
	getLastUpdate(): number {
		return Math.floor(this.lastUpdate / 1000)
	}

	/**
	 * Add record to the table and optionally write it to the temp table file
	 *
	 * @param id Record id
	 * @param data Record data
	 * @param write Whether to write to file
	 */
	add(id: string, data: T, write: boolean): void {
		this.records[id] = data
		if (write) {
			this.updateTmp(id, data)
		}
	}

	/**
	 * Remove record and force a cleanup on the next flush() call
	 *
	 * @param id Id of record to remove
	 */
	remove(id: string): void {
		this.tmpUpdateCount = cleanTmpThreshold
		delete this.records[id]
	}

	/**
	 * Move temporary record to permanent storage. Since only active records
	 * are kept in memory, add record to the archive table update buffer,
	 * then remove the record and force a cleanup on the next flush() call
	 *
	 * @param id Id of record to move
	 */
	moveTmp(id: string): void {
		if (id in this.records) {
			this.updates += this.serialize(id, this.records[id])
			this.remove(id)
		}
	}

	/**
	 * Write updates to temp table file
	 *
	 * @param id Id of record to update
	 * @param updates Updated record data
	 */
	updateTmp(id: string, updates: Partial<T>): void {
		if (id in this.records) {
			++this.tmpUpdateCount
			this.tmpUpdates += this.serialize(id, updates)
		}
	}

	/**
	 * Return record string to be written to file
	 *
	 * @param id
	 * @param data
	 * @returns Serialized data
	 */
	private serialize(id: string, data: Partial<T>): string {
		return id + '\t' + JSON.stringify(data) + '\n'
	}

	/**
	 * Clean up temp table file by writing all active records to a new file
	 * and overwriting the old one if the operation is successful
	 */
	private clean(): void {
		if (this.tableTmpBusy) {
			log.error('Temp database %s is busy', this.tableName)
			return
		}
		this.tmpUpdateCount = 0
		this.tableTmpBusy = true
		let records = ''
		for (const id in this.records) {
			records += this.serialize(id, this.records[id])
		}
		if (records === '') {
			removeFile(this.tablePath + '.tmp')
				.catch(errorHandler)
				.then(() => { this.tableTmpBusy = false })
		}
		else {
			writeFile(this.tablePath + '.tmp1', records)
				.then(() => renameFile(this.tablePath + '.tmp1', this.tablePath + '.tmp'))
				.catch(errorHandler)
				.then(() => { this.tableTmpBusy = false })
		}
	}

	/**
	 * Write update buffers to file storage and clean up temp table file if necessary
	 */
	flush(): void {
		if (this.updates || this.tmpUpdates) {
			this.lastUpdate = Date.now()
		}
		if (!config.enableDbWrites) {
			this.updates = this.tmpUpdates = ''
			this.tmpUpdateCount = 0
			return
		}
		if (this.tableBusy) {
			log.error('Database %s is busy', this.tableName)
		}
		else if (this.updates) {
			this.tableBusy = true
			const updatesBuf = this.updates
			this.updates = ''
			appendFile(this.tablePath, updatesBuf)
				.catch(err => {
					this.updates = updatesBuf + this.updates
					errorHandler(err)
				}).then(() => { this.tableBusy = false })
		}
		if (this.tableTmpBusy) {
			log.error('Temp database %s is busy', this.tableName)
		}
		else if (this.tmpUpdates) {
			this.tableTmpBusy = true
			const tmpUpdatesBuf = this.tmpUpdates
			this.tmpUpdates = ''
			appendFile(this.tablePath + '.tmp', tmpUpdatesBuf)
				.then(() => {
					this.tableTmpBusy = false
					if (this.tmpUpdateCount >= cleanTmpThreshold) {
						this.clean()
					}
				}).catch(err => {
					this.tmpUpdates = tmpUpdatesBuf + this.tmpUpdates
					this.tableTmpBusy = false
					errorHandler(err)
				})
		}
		else if (this.tmpUpdateCount >= cleanTmpThreshold) {
			this.clean()
		}
	}
}
