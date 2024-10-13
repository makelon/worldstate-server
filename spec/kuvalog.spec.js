import config from '../out/config.js'
import Database from '../out/db.js'
import Worldstate from '../out/worldstate.js'
import fixtures from './fixtures/data.js'
import MockGame from './fixtures/mockgame.js'

describe('Kuvalog', () => {
	const ws = new Worldstate(new Database('test')),
		mockGame = new MockGame()

	beforeAll(async () => {
		const waitForDb = new Promise(resolve => {
			ws.db.ee.once('load', resolve)
		})
		mockGame.start(() => {
			ws.start()
		})
		await waitForDb
	}, 1000)

	afterAll(done => {
		mockGame.shutdown(done)
	}, 1000)

	it('should request kuvalog data', async () => {
		config.kuvalogUrl = `http://${mockGame.host}:${mockGame.port}`
		const [[testData]] = fixtures.getKuvalog()
		mockGame.setData(testData)
		const waitForRead = new Promise(resolve => {
			ws.readKuvalog = function() {
				delete ws.readKuvalog
				Worldstate.prototype.readKuvalog.call(ws)
				resolve()
			}
		})
		ws.kuvalog.reload()
		await waitForRead
		config.kuvalogUrl = ''
	})

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
