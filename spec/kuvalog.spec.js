const config = require('../out/config').default
const Database = require('../out/db').default
const Worldstate = require('../out/worldstate').default
const fixtures = require('./deps/fixtures')
const MockGame = require('./deps/mockgame')

describe('Kuvalog', () => {
	const mockKuvalogHost = '127.0.0.1',
		mockKuvalogPort = 20354,
		ws = new Worldstate(new Database('pc'), 'pc', 0),
		mockGame = new MockGame(mockKuvalogHost, mockKuvalogPort)

	beforeAll(done => {
		config.kuvalogUrls.pc = `http://${mockKuvalogHost}:${mockKuvalogPort}`
		const [[testData]] = fixtures.getKuvalog()
		mockGame.setData(testData)
		mockGame.start(done)
	}, 1000)

	afterAll(done => {
		config.kuvalogUrls = {}
		mockGame.shutdown(done)
	}, 1000)

	it('should request kuvalog data', done => {
		ws.readKuvalog = function() { // Makeshift trigger for read completion
			delete ws.readKuvalog
			Worldstate.prototype.readKuvalog.call(ws)
			done()
		}
		ws.start()
	}, 1000)

	it('should read arbitrations and kuva siphons', () => {
		const dataKeyArbitrations = 'arbitrations',
			dataKeyKuvaSiphons = 'kuvasiphons'
		for (const [testData, expectedArbitration, expectedKuvamission] of fixtures.getKuvalog()) {
			ws.kuvalog.readKuvalog(testData)
			const resultArbitrations = JSON.parse(ws.get([dataKeyArbitrations]))
			expect(resultArbitrations[dataKeyArbitrations].data).toEqual(expectedArbitration)
			const resultKuvaSiphons = JSON.parse(ws.get([dataKeyKuvaSiphons]))
			expect(resultKuvaSiphons[dataKeyKuvaSiphons].data).toEqual(expectedKuvamission)
		}
	})
})
