const Worldstate = require('../out/worldstate').default
const fixtures = require('./deps/fixtures')

describe('World state', () => {
	const ws = new Worldstate('pc')

	function setWorldstateData(data, timestamp) {
		ws.ws = data
		ws.now = timestamp
	}

	beforeAll(() => {
		ws.start()
	})

	it('should read acolytes', () => {
		const dataKey = 'acolytes'
		let timestamp = fixtures.timeNowShort
		for (const [data, expected] of fixtures.getAcolytes()) {
			setWorldstateData(data, timestamp)
			ws.readAcolytes()
			const result = JSON.parse(ws.get([dataKey]))
			expect(result[dataKey].data[0]).toEqual(expected)
			timestamp += fixtures.timeStep
		}
	})

	it('should read alerts', () => {
		const dataKey = 'alerts'
		let timestamp = fixtures.timeNowShort
		for (const [data, expected] of fixtures.getAlerts()) {
			setWorldstateData(data, timestamp)
			ws.readAlerts()
			const result = JSON.parse(ws.get([dataKey]))
			expect(result[dataKey].data[0]).toEqual(expected)
			timestamp += fixtures.timeStep
		}
	})

	it('should read bounties', () => {
		const dataKey = 'bounties'
		let timestamp = fixtures.timeNowShort
		for (const [data, expected] of fixtures.getBounties()) {
			setWorldstateData(data, timestamp)
			ws.readSyndicateMissions()
			const result = JSON.parse(ws.get([dataKey]))
			expect(result[dataKey].data[0]).toEqual(expected)
			timestamp += fixtures.timeStep
		}
	})

	it('should read daily deals', () => {
		const dataKey = 'dailydeals'
		let timestamp = fixtures.timeNowShort
		for (const [data, expected] of fixtures.getDailyDeals()) {
			setWorldstateData(data, timestamp)
			ws.readDailyDeals()
			const result = JSON.parse(ws.get([dataKey]))
			expect(result[dataKey].data[0]).toEqual(expected)
			timestamp += fixtures.timeStep
		}
	})

	it('should read faction projects', () => {
		const dataKey = 'factionprojects'
		let timestamp = fixtures.timeNowShort
		for (const [data, expected] of fixtures.getFactionProjects()) {
			setWorldstateData(data, timestamp)
			ws.readFactionProjects()
			const result = JSON.parse(ws.get([dataKey]))
			expect(result[dataKey].data[0]).toEqual(expected)
			timestamp += fixtures.timeStep
		}
	})

	it('should read fomorians', () => {
		const dataKey = 'fomorians'
		let timestamp = fixtures.timeNowShort
		for (const [data, expected] of fixtures.getGoals()) {
			setWorldstateData(data, timestamp)
			ws.readGoals()
			const result = JSON.parse(ws.get([dataKey]))
			expect(result[dataKey].data[0]).toEqual(expected)
			timestamp += fixtures.timeStep
		}
	})

	it('should read invasions', () => {
		const dataKey = 'invasions'
		let timestamp = fixtures.timeNowShort
		for (const [data, expected] of fixtures.getInvasions()) {
			setWorldstateData(data, timestamp)
			ws.readInvasions()
			const result = JSON.parse(ws.get([dataKey]))
			expect(result[dataKey].data[0]).toEqual(expected)
			timestamp += fixtures.timeStep
		}
	})

	it('should read news', () => {
		const dataKey = 'news'
		let timestamp = fixtures.timeNowShort
		for (const [data, expected] of fixtures.getNews()) {
			setWorldstateData(data, timestamp)
			ws.readNews()
			const result = JSON.parse(ws.get([dataKey]))
			expect(result[dataKey].data[0]).toEqual(expected)
			timestamp += fixtures.timeStep
		}
	})

	it('should read sorties', () => {
		const dataKey = 'sorties'
		let timestamp = fixtures.timeNowShort
		for (const [data, expected] of fixtures.getSorties()) {
			setWorldstateData(data, timestamp)
			ws.readSorties()
			const result = JSON.parse(ws.get([dataKey]))
			expect(result[dataKey].data[0]).toEqual(expected)
			timestamp += fixtures.timeStep
		}
	})

	it('should read upgrades', () => {
		const dataKey = 'upgrades'
		let timestamp = fixtures.timeNowShort
		for (const [data, expected] of fixtures.getUpgrades()) {
			setWorldstateData(data, timestamp)
			ws.readUpgrades()
			const result = JSON.parse(ws.get([dataKey]))
			expect(result[dataKey].data[0]).toEqual(expected)
			timestamp += fixtures.timeStep
		}
	})

	it('should read void fissures', () => {
		const dataKey = 'fissures'
		let timestamp = fixtures.timeNowShort
		for (const [data, expected] of fixtures.getVoidFissures()) {
			setWorldstateData(data, timestamp)
			ws.readVoidFissures()
			const result = JSON.parse(ws.get([dataKey]))
			expect(result[dataKey].data[0]).toEqual(expected)
			timestamp += fixtures.timeStep
		}
	})

	it('should read void traders', () => {
		const dataKey = 'voidtraders'
		let timestamp = fixtures.timeNowShort
		for (const [data, expected] of fixtures.getVoidTraders()) {
			setWorldstateData(data, timestamp)
			ws.readVoidTraders()
			const result = JSON.parse(ws.get([dataKey]))
			expect(result[dataKey].data[0]).toEqual(expected)
			timestamp += fixtures.timeStep
		}
	})
})
