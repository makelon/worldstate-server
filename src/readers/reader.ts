type WfReaderData<T> = { time: number, data: T[] } | undefined

export default abstract class WfReader<T extends WfRecordType> {
	protected dbTable?: WfDbTable<T>
	protected abstract readonly dbTableId: WfRecordKey

	constructor(
		protected platform: string
	) {}

	start(db: WfDb): void {
		this.dbTable = db.getTable<T>(this.dbTableId)
	}

	abstract read(input: any[], timestamp: number): void

	get entityRewards(): WfRewardTableMap { return {} }

	getData(): WfReaderData<T> {
		if (!this.dbTable?.isReady()) {
			return
		}
		return {
			time: this.dbTable.getLastUpdate(),
			data: this.dbTable.getAll()
		}
	}
}
