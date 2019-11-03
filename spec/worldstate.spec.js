const config = require('../out/config').default
const Database = require('../out/db').default
const Worldstate = require('../out/worldstate').default
const fixtures = require('./deps/fixtures')
const extraData = require('../out/extradata').default

describe('Worldstate', () => {
	const ws = new Worldstate(new Database('pc'), 'pc')

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
			ws.readGoals()
			ws.readSyndicateMissions()
			const result = JSON.parse(ws.get([dataKey]))
			expect(result[dataKey].data).toEqual(expected)
			timestamp += fixtures.timeStep
		}
	})

	it('should read challenges', () => {
		const dataKey = 'challenges'
		let timestamp = fixtures.timeNowShort
		for (const [data, expected] of fixtures.getChallenges()) {
			setWorldstateData(data, timestamp)
			ws.readChallenges()
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

	it('should read day cycles', () => {
		// More of an algorithm test as very little data processing is going on
		const dataKey = 'daynight'
		for (const [data, time, expected] of fixtures.getDayNight()) {
			ws.readers.daynight.read(data)
			const result = JSON.parse(ws.get([dataKey]))[dataKey].data[0],
				cycleTime = (time - result.start) % result.length,
				isDay = cycleTime >= result.dayStart && cycleTime < result.dayEnd,
				cycleEnd = isDay
					? result.dayEnd
					: (cycleTime < result.dayStart
						? result.dayStart
						: result.dayStart + result.length)
			expect(isDay).toEqual(expected.isDay)
			expect(cycleEnd - cycleTime).toEqual(expected.cycleEnd)
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

	it('should load extra data', () => {
		config.wsUrls.pc = ''
		extraData.data = {}
		extraData.load('data/extradata.json')
		expect(extraData.data.pc.bounties.length).toBe(1)
		expect(extraData.getData('pc', 'bounties')).toEqual(extraData.data.pc.bounties)
		expect(extraData.getData('pc', 'x')).toEqual([])
		expect(extraData.getData('x', 'bounties')).toEqual([])
		extraData.data = {}
		delete config.wsUrls.pc
	})

	it('should load extra bounties', () => {
		config.wsUrls.pc = ''
		extraData.data = {}
		const dataKey = 'bounties'
		let timestamp = fixtures.timeNowShort
		setWorldstateData({}, timestamp)
		for (const [dataPath, expected] of fixtures.getExtraBounties()) {
			extraData.load(dataPath)
			ws.readSyndicateMissions()
			const result = JSON.parse(ws.get([dataKey]))
			expect(result[dataKey].data).toEqual(expected)
			timestamp += fixtures.timeStep
		}
		extraData.data = {}
		delete config.wsUrls.pc
	})
})
