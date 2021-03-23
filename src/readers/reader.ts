type WfReaderData<T> = { time: number, data: T[] } | undefined

export default abstract class WfReader<T extends WfRecordType> {
	protected dbTable?: WfDbTable<T>
	protected abstract readonly dbTableId: WfRecordKey
	protected isActive?(record: T, timestamp: number): boolean

	constructor(protected platform: WfPlatform) {}

	start(db: WfDb): void {
		this.dbTable = db.getTable<T>(this.dbTableId)
	}

	//eslint-disable-next-line @typescript-eslint/no-explicit-any
	abstract read(input: any, timestamp: number): void

	get entityRewards(): WfRewardTableMap { return {} }

	getData(timestamp: number): WfReaderData<T> {
		if (!this.dbTable?.isReady()) {
			return
		}
		const records = this.dbTable.getAll()
		return {
			time: this.dbTable.getLastUpdate(),
			data: this.isActive
				? records.filter(record => this.isActive!(record, timestamp))
				: records,
		}
	}
}
