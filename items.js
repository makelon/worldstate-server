import { readFileSync, writeFile } from 'fs'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

process.chdir(dirname(fileURLToPath(import.meta.url)))

let lang,
	itemNames = {},
	itemTypes = {}

/* eslint-disable style/comma-dangle -- This needs to be valid JSON for better maintainability */
const itemTypeTree = {
	"boosters": "Booster",
	"powersuits": {
		"": "Warframe",
		"archwing": "Archwing"
	},
	"packages": {
		"vteosarmourbundle": "Cosmetic",
		"resourcebundles": "Resource"
	},
	"types": {
		"friendly": {
			"pets": {
				"": "Companion",
				"beastweapons": {
					"": "Companion",
					"stances": "Mod"
				},
				"catbrowpetprecepts": "Mod",
				"kubrowpetprecepts": "Mod"
			}
		},
		"game": {
			"catbrowpet": {
				"": "Companion",
				"colors": "Cosmetic",
				"patterns": "Cosmetic"
			},
			"kubrowpet": {
				"": "Companion",
				"colors": "Cosmetic",
				"patterns": "Cosmetic"
			},
			"quarterswallpapers": "Cosmetic",
			"projections": "Relic"
		},
		"gameplay": {
			"eidolon": {
				"resources": "Resource"
			},
			"entratilab": {
				"resources": "Resource"
			},
			"infestedmicroplanet": {
				"resources": {
					"": "Resource",
					"mechs": ""
				}
			},
			"jadeshadows": {
				"resources": "Resource"
			},
			"venus": {
				"resources": "Resource"
			},
			"zariman": {
				"resources": "Resource"
			}
		},
		"items": {
			"emotes": "Cosmetic",
			"gems": "Resource",
			"fusiontreasures": "Ayatan",
			"miscitems": {
				"": "Resource",
				"*": {
					"forma": "",
					"photobooth": "",
					"weapon": ""
				},
				"orokincatalyst": "",
				"orokinreactor": "",
				"utilityunlocker": ""
			},
			"plants": "Resource",
			"railjackmiscitems": "Resource",
			"research": "Resource",
			"shipdecos": "Cosmetic"
		},
		"keys": "",
		"pickups": {
			"credits": "Credits"
		},
		"recipes": {
			"archwingrecipes": "Archwing",
			"armourattachments": "Cosmetic",
			"cronusblueprint": "Weapon",
			"darkswordblueprint": "Weapon",
			"eidolonrecipes": {
				"prospecting": "Resource"
			},
			"helmets": "Cosmetic",
			"kubrow": "Cosmetic",
			"lens": "Lens",
			"modfuserblueprint": "Mod",
			"sentinelrecipes": "Weapon",
			"syandanas": "Cosmetic",
			"warframerecipes": "Warframe",
			"warframeskins": "Cosmetic",
			"weapons": {
				"": "Weapon",
				"skins": "Cosmetic"
			},
			"weaponskins": "Cosmetic"
		},
		"sentinels": {
			"sentinelprecepts": "Mod",
			"sentinelpowersuits": "Weapon"
		},
		"storeitems": {
			"avatarimages": "Cosmetic",
			"creditbundles": "Credits",
			"suitcustomizations": "Cosmetic",
			"packages": {
				"resourcebundles": "Resource"
			}
		}
	},
	"upgrades": {
		"": "Mod",
		"fusionbundles": "Endo",
		"focus": "Lens",
		"cosmeticenhancers": "Arcane",
		"skins": "Cosmetic"
	},
	"weapons": {
		"": "Weapon",
		"tenno": {
			"": "Weapon",
			"melee": {
				"": "Weapon",
				"meleetrees": "Mod"
			}
		}
	}
}
/* eslint-enable style/comma-dangle */

try {
	lang = JSON.parse(readFileSync('./data/languages.json', 'utf8'))
}
catch (e) {
	console.log('Failed to read language file: %s', e.message)
	process.exit(1)
}

function getItemType(itemId) {
	let branch = itemTypeTree
	for (const dir of itemId.split('/')) {
		if (!(dir in branch)) {
			if ('*' in branch) {
				const wildcards = branch['*']
				for (const search in wildcards) {
					const type = wildcards[search]
					if (dir.substring(0, search.length) === search) {
						return type
					}
				}
			}
			return branch[''] || ''
		}
		branch = branch[dir]
		if (typeof branch === 'string') {
			return branch
		}
	}
	// This should be unreachable
	return ''
}

for (let itemId in lang) {
	const itemName = lang[itemId].value.replace(/\b[A-Z]{2,}\b/g, (word) => word[0] + word.substring(1).toLowerCase())
	if (itemId[0] === '/') {
		itemId = itemId.toLowerCase().replace(/^\/lotus(?:(?:\/types)?\/storeitems)?\//, '')
	}
	itemNames[itemId] = itemName
	const itemType = getItemType(itemId)
	if (itemType) {
		itemTypes[itemName] = itemType
	}
}

writeFile('./data/itemnames.json', JSON.stringify(itemNames), 'utf8', (err) => {
	if (err) {
		console.log('Failed to write itemnames.json: %s', err.message)
	}
})
writeFile('./data/itemtypes.json', JSON.stringify(itemTypes), 'utf8', (err) => {
	if (err) {
		console.log('Failed to write itemtypes.json: %s', err.message)
	}
})
