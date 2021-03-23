interface WfDb {
	setupTables(onLoad: () => void): void
	getTable<T extends WfRecordKey>(tblName: T): WfDbTable<WfRecordTypes[T]>
	getTable<T extends WfRecordType>(tblName: string): WfDbTable<T>
	flush(): void
}

interface WfDbTableI<T extends WfRecordType> {
	setPath(): void
	isReady(): boolean
	get(id: string): T | null
	getAll(): T[]
	getIdMap(): WfSet
	getLastUpdate(): number
	add(id: string, data: T, write: boolean): void
	moveTmp(id: string): void
	remove(id: string): void
	updateTmp(id: string, data: Partial<T>): void
	flush(): void
}

type WfDbTable<T extends WfRecordType> = WfDbTableI<T> | null
