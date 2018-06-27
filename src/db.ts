import fs = require('fs')
import path = require('path')
import readline = require('readline')
import EventEmitter = require('events')
import log = require('./log')
import config from './config'
import promisify = require('./promisify')

/**
 * Number of table updates before temp file cleanup is initiated
 */
const cleanTmpThreshold = 50

/**
 * Return record string to be written to file
 *
 * @param id
 * @param data
 * @returns Serialized data
 */
function serialize(id: string, data: any): string {
	return id + '\t' + JSON.stringify(data) + '\n'
}

function errorHandler(err: NodeJS.ErrnoException): void {
	if (err) {
		log.error('File I/O error: "%s"', err.message)
	}
}

type TableMap = { [tblName: string]: WfDbTableI<WfDbTableType> }

export default class Database implements WfDb {
	private loading: number = 0
	private tables: TableMap = {}
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
	getTable(tableName: string): WfDbTable<WfDbTableType> {
		return this.tables[tableName] || null
	}

	/**
	 * Trigger the 'load' event when all tables are loaded
	 */
	private setReady(): void {
		if (--this.loading == 0) {
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

	/**
	 * Update paths for all tables
	 */
	setPaths(): void {
		for (const table in this.tables) {
			this.tables[table].setPath()
		}
	}
}

type RecordMap<T> = { [id: string]: T }

class Table<T extends WfDbTableType> implements WfDbTableI<T> {
	private tablePath = ''
	private ready = false
	private records: RecordMap<T> = {}
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
		onLoad: () => void
	) {
		this.ee.once('load', onLoad)
		this.setPath()
		if (this.tablePath != '') {
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
			this.tablePath = path.join(config.dbRoot, this.dbName, path.basename(this.tableName) + '.db')
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
		return new Promise<void>((resolve, reject) => {
			log.notice('Loading %s/%s', this.dbName, this.tableName)
			const readStream = fs.createReadStream(tablePath, {
					encoding: 'utf8',
					flags: 'r'
				}),
				tStart = process.hrtime()
			readStream.on('error', err => {
				if (err && err.code != 'ENOENT') {
					throw new Error(`Error loading database ${this.dbName}/${this.tableName}: ${err.message}`)
				}
				log.notice('No database for %s/%s', this.dbName, this.tableName)
				resolve()
			})
			let recordCount = 0,
				updateCount = 0
			readline.createInterface(readStream)
				.on('line', line => {
					const dataStart = line.indexOf('\t'),
						id = line.substr(0, dataStart),
						data = JSON.parse(line.substr(dataStart + 1))
					let record = this.records[id] as any
					if (record) {
						// Read incremental updates for record
						if (data.__context) {
							// Updates belong in a subkey of <record>
							const context = data.__context
							if (!(context in record)) {
								record[context] = {}
							}
							record = record[context]
							delete data.__context
						}
						for (const key in data) {
							record[key] = data[key]
						}
						++updateCount
						++this.tmpUpdateCount
						log.debug('Updated record %s in %s/%s', id, this.dbName, this.tableName)
					}
					else {
						// Read new record
						this.records[id] = data
						if (!('id' in data)) {
							data.id = id
						}
						++recordCount
						log.debug('Loaded record %s from %s/%s', id, this.dbName, this.tableName)
					}
				}).on('close', () => {
					const tEnd = process.hrtime(),
						loadTime = (tEnd[0] * 1e9 + tEnd[1]) - (tStart[0] * 1e9 + tStart[1])
					log.notice('Loaded %d records and %d updates from %s/%s in %f ms', recordCount, updateCount, this.dbName, this.tableName, Math.floor(loadTime / 1e3) / 1e3)
					resolve()
				})
		})
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
	 * Remove record
	 *
	 * @param id Id of record to remove
	 */
	remove(id: string): void {
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
			this.updates += serialize(id, this.records[id])
			this.tmpUpdateCount = cleanTmpThreshold
			delete this.records[id]
		}
	}

	/**
	 * Write updates to temp table file
	 *
	 * @param id Id of record to update
	 * @param updates Updated record data
	 */
	updateTmp(id: string, updates: any): void {
		if (id in this.records) {
			++this.tmpUpdateCount
			this.tmpUpdates += serialize(id, updates)
		}
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
			records += serialize(id, this.records[id])
		}
		if (records === '') {
			promisify.removeFile(this.tablePath + '.tmp')
				.catch(errorHandler)
				.then(() => { this.tableTmpBusy = false })
		}
		else {
			promisify.writeFile(this.tablePath + '.tmp1', records)
				.then(() => promisify.renameFile(this.tablePath + '.tmp1', this.tablePath + '.tmp'))
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
			promisify.appendFile(this.tablePath, updatesBuf)
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
			promisify.appendFile(this.tablePath + '.tmp', tmpUpdatesBuf)
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
