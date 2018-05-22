import fs = require('fs')
import path = require('path')
import readline = require('readline')
import EventEmitter = require('events')
import log = require('./log')
import config from './config'
import promisify = require('./promisify')

// Number of table updates before temp file cleanup is initiated
const cleanTmpThreshold = 50

// Return record string to be written to file
function serialize(id: string, data: any) {
	return id + '\t' + JSON.stringify(data) + '\n'
}

function errorHandler(err: NodeJS.ErrnoException) {
	if (err) {
		log.error('File I/O error: "%s"', err.message)
	}
}

type TableMap = { [tblName: string]: WfDbTableI<WfDbTableType> }

export default class Database implements WfDb {
	private dbName: string
	private loading: number = 0
	private ready: boolean = false
	private tables: TableMap = {}
	private ee: EventEmitter

	constructor(dbName: string, onLoad: () => void) {
		this.dbName = dbName
		this.ee = new EventEmitter()
		this.setupTables(onLoad)
	}

	setupTables(onLoad: () => void): void {
		const oldTbls: WfSet = {}
		for (const t in this.tables) {
			oldTbls[t] = true
		}
		for (const tblName of config.wsFields) {
			if (!(tblName in this.tables)) {
				++this.loading
				this.ready = false
				this.tables[tblName] = new Table(this.dbName, tblName, () => { this.setReady() })
			}
			else {
				this.tables[tblName].setPath()
			}
			delete oldTbls[tblName]
		}
		for (const t in oldTbls) {
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

	getTable(tblName: string): WfDbTable<WfDbTableType> | null {
		return this.tables[tblName] || null
	}

	private setReady(): void {
		if (--this.loading == 0) {
			this.ready = true
			this.ee.emit('load')
		}
	}

	// Flush all tables
	flush(): void {
		for (const table in this.tables) {
			this.tables[table].flush()
		}
	}

	setPaths(): void {
		for (const table in this.tables) {
			this.tables[table].setPath()
		}
	}
}

type RecordMap<T> = { [id: string]: T }

class Table<T extends WfDbTableType> implements WfDbTableI<T> {
	private dbName: string
	private tblName: string
	private tblPath: string = ''
	private ready: boolean = false
	private records: RecordMap<T> = {}
	private lastUpdate: number = 0
	private updates: string = ''
	private tmpUpdates: string = ''
	private tmpUpdateCount: number = 0
	private tblBusy: boolean = true
	private tblTmpBusy: boolean = true
	private ee: EventEmitter = new EventEmitter()

	constructor(dbName: string, tblName: string, onLoad: () => void) {
		this.dbName = dbName
		this.tblName = tblName
		this.ee.once('load', onLoad)
		this.setPath()
		if (this.tblPath != '') {
			this.load(this.tblPath + '.tmp')
				.then(() => { this.setReady() })
				.catch(err => { log.error(err.message) })
		}
		else {
			setImmediate(() => { this.setReady() })
		}
	}

	setPath(): void {
		if (config.dbRoot) {
			this.tblPath = path.join(config.dbRoot, this.dbName, path.basename(this.tblName) + '.db')
		}
		else {
			this.tblPath = ''
		}
	}

	// Load records that were active on last shutdown
	private load(tblPath: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			log.notice('Loading %s/%s', this.dbName, this.tblName)
			const readStream = fs.createReadStream(tblPath, {
					encoding: 'utf8',
					flags: 'r'
				}),
				tStart = process.hrtime()
			readStream.on('error', err => {
				if (err && err.code != 'ENOENT') {
					throw new Error(`Error loading database ${this.dbName}/${this.tblName}: ${err.message}`)
				}
				log.notice('No database for %s/%s', this.dbName, this.tblName)
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
						log.debug('Updated record %s in %s/%s', id, this.dbName, this.tblName)
					}
					else {
						// Read new record
						this.records[id] = data
						if (!('id' in data)) {
							data.id = id
						}
						++recordCount
						log.debug('Loaded record %s from %s/%s', id, this.dbName, this.tblName)
					}
				}).on('close', () => {
					const tEnd = process.hrtime(),
						loadTime = (tEnd[0] * 1e9 + tEnd[1]) - (tStart[0] * 1e9 + tStart[1])
					log.notice('Loaded %d records and %d updates from %s/%s in %f ms', recordCount, updateCount, this.dbName, this.tblName, Math.floor(loadTime / 1e3) / 1e3)
					resolve()
				})
		})
	}

	private setReady(): void {
		this.lastUpdate = Date.now()
		this.ready = true
		this.tblBusy = false
		this.tblTmpBusy = false
		log.notice('Database %s/%s is ready', this.dbName, this.tblName)
		this.ee.emit('load')
	}

	isReady(): boolean {
		return this.ready
	}

	get(id: string): T | null {
		return this.records[id] || null
	}

	getAll(): T[] {
		const ret: T[] = []
		for (const id in this.records) {
			ret.push(this.records[id])
		}
		return ret
	}

	getIdMap(): WfSet {
		const ret: WfSet = {}
		for (const id in this.records) {
			ret[id] = true
		}
		return ret
	}

	getLastUpdate(): number {
		return Math.floor(this.lastUpdate / 1000)
	}

	// Add record to the table and optionally write it to the temp table file
	add(id: string, data: T, write: boolean): void {
		this.records[id] = data
		if (write) {
			this.updateTmp(id, data)
		}
	}

	remove(id: string): void {
		delete this.records[id]
	}

	// Since only active records are kept in memory, add record to the archive table update buffer,
	// then remove the record and force a cleanup on the next flush() call
	moveTmp(id: string): void {
		if (id in this.records) {
			this.updates += serialize(id, this.records[id])
			this.tmpUpdateCount = cleanTmpThreshold
			delete this.records[id]
		}
	}

	// Write updates to temp table file
	updateTmp(id: string, updates: any): void {
		if (id in this.records) {
			++this.tmpUpdateCount
			this.tmpUpdates += serialize(id, updates)
		}
	}

	// Clean up temp table file by writing all active records to a new file
	// and overwriting the old one if the operation is successful
	private clean(): void {
		if (this.tblTmpBusy) {
			log.error('Temp database %s is busy', this.tblName)
			return
		}
		this.tmpUpdateCount = 0
		this.tblTmpBusy = true
		let records = ''
		for (const id in this.records) {
			records += serialize(id, this.records[id])
		}
		if (records === '') {
			promisify.removeFile(this.tblPath + '.tmp')
				.catch(errorHandler)
				.then(() => { this.tblTmpBusy = false })
		}
		else {
			promisify.writeFile(this.tblPath + '.tmp1', records)
				.then(() => promisify.renameFile(this.tblPath + '.tmp1', this.tblPath + '.tmp'))
				.catch(errorHandler)
				.then(() => { this.tblTmpBusy = false })
		}
	}

	// Write update buffers to file storage and clean up temp table file if necessary
	flush(): void {
		if (this.updates || this.tmpUpdates) {
			this.lastUpdate = Date.now()
		}
		if (!config.enableDbWrites) {
			this.updates = this.tmpUpdates = ''
			this.tmpUpdateCount = 0
			return
		}
		if (this.tblBusy) {
			log.error('Database %s is busy', this.tblName)
		}
		else if (this.updates) {
			this.tblBusy = true
			const updatesBuf = this.updates
			this.updates = ''
			promisify.appendFile(this.tblPath, updatesBuf)
				.catch(err => {
					this.updates = updatesBuf + this.updates
					errorHandler(err)
				}).then(() => { this.tblBusy = false })
		}
		if (this.tblTmpBusy) {
			log.error('Temp database %s is busy', this.tblName)
		}
		else if (this.tmpUpdates) {
			this.tblTmpBusy = true
			const tmpUpdatesBuf = this.tmpUpdates
			this.tmpUpdates = ''
			promisify.appendFile(this.tblPath + '.tmp', tmpUpdatesBuf)
				.then(() => {
					this.tblTmpBusy = false
					if (this.tmpUpdateCount >= cleanTmpThreshold) {
						this.clean()
					}
				}).catch(err => {
					this.tmpUpdates = tmpUpdatesBuf + this.tmpUpdates
					this.tblTmpBusy = false
					errorHandler(err)
				})
		}
		else if (this.tmpUpdateCount >= cleanTmpThreshold) {
			this.clean()
		}
	}
}
