const config = require('../out/config').default
const Db = require('../out/db').default

describe('Database', () => {
	let originalWsFields,
		originalDbRoot
	const db = new Db('test')

	beforeAll(() => {
		originalDbRoot = config.dbRoot
		originalWsFields = config.wsFields
		config.dbRoot = 'fixtures/db'
	})

	afterAll(() => {
		config.dbRoot = originalDbRoot
		config.wsFields = originalWsFields
	})

	afterEach(done => {
		config.wsFields = []
		db.setupTables(done)
	})

	it('should load database records', done => {
		config.wsFields = ['no-patch']
		db.setupTables(() => {
			const dbTable = db.getTable('no-patch')
			expect(dbTable.getAll().length).toBe(2)
			expect(dbTable.get('test1')).toEqual({ id: 'test1', data: 'Test 1' })
			expect(dbTable.get('test2')).toEqual({ id: 'test2', data: 'Test 2' })
			done()
		})
	})

	it('should load database record patches', done => {
		config.wsFields = ['patch']
		db.setupTables(() => {
			const dbTable = db.getTable('patch')
			expect(dbTable.getAll().length).toBe(1)
			expect(dbTable.get('test1')).toEqual({ id: 'test1', data: 'Test 1', patch: 'Patch 1'})
			done()
		})
	})

	it('should load database record patches with __context fields', done => {
		config.wsFields = ['context-patch']
		db.setupTables(() => {
			const dbTable = db.getTable('context-patch')
			expect(dbTable.getAll().length).toBe(1)
			expect(dbTable.get('test1')).toEqual({
				id: 'test1',
				data: 'Test 1',
				patch: {
					patch1: 'Patch 1',
					patch2: 'Patch 2',
				},
			})
			done()
		})
	})
})
