const h = require('../out/helpers')
const fixtures = require('./deps/fixtures')

describe('Helper functions', () => {
	it('should pad numbers', () => {
		expect(h.pad(1, 3)).toBe('001')
	})

	it('should return IDs', () => {
		const id = fixtures.entryId,
			dataOld = {
				_id: {
					$id: id
				}
			},
			dataNew = {
				_id: {
					$oid: id
				}
			}
		expect(h.getId(dataOld)).toBe(id)
		expect(h.getId(dataNew)).toBe(id)
	})

	it('should return timestamps', () => {
		const dataOld = {
				sec: fixtures.timeStartShort,
				usec: 0
			},
			dataNew = {
				$date: {
					$numberLong: fixtures.timeEndLong
				}
			}
		expect(h.getDate(dataOld)).toBe(fixtures.timeStartShort)
		expect(h.getDate(dataNew)).toBe(fixtures.timeEndShort)
	})

	it('should return node locations', () => {
		expect(h.getLocation(fixtures.nodes[0].id)).toBe(fixtures.nodes[0].name)
	})

	it('should return mission types', () => {
		expect(h.getMissionType(fixtures.missionTypes[0].id)).toBe(fixtures.missionTypes[0].name)
	})

	it('should return a node\'s mission type', () => {
		expect(h.getNodeMissionType(fixtures.nodes[1].id)).toBe(fixtures.missionTypes[1].name)
	})

	it('should return a node\'s faction id', () => {
		expect(h.getNodeFaction(fixtures.nodes[1].id)).toBe(fixtures.factions[1].name)
	})

	it('should return faction names', () => {
		expect(h.getFaction(fixtures.factions[0].id)).toBe(fixtures.factions[0].name)
	})

	it('should return void tiers', () => {
		expect(h.getVoidTier('VoidT3')).toBe('Neo')
	})

	it('should return fomorian types', () => {
		expect(h.getFomorianType('FC_CORPUS')).toBe('Razorback')
	})

	it('should return fomorian construction faction ids', () => {
		expect(h.getFomorianFaction(0)).toBe('FC_GRINEER')
	})

	it('should return syndicate names', () => {
		expect(h.getSyndicateName('RedVeilSyndicate')).toBe('Red Veil')
	})

	it('should return void trader names', () => {
		expect(h.getVoidTraderName('Baro\'Ki Teel')).toBe('Baro Ki\'Teer')
	})

	it('should return acolyte names', () => {
		expect(h.getAcolyteName('RogueAcolyte')).toBe('Mania')
	})
})
