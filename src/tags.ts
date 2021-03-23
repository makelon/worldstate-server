import { readFileSync } from 'fs'

export let
	locations: WfMap,
	nodeMissionTypes: WfMap,
	nodeFactions: WfMap,
	challenges: {[id: string]: WfChallengeInfo}

export const
	acolyteNames: WfMap = {
		AreaCasterAcolyte: 'Misery',
		BurstCasterAcolyte: 'Angst',
		ControlAcolyte: 'Torment',
		DuellistAcolyte: 'Violence',
		HeavyAcolyte: 'Malice',
		RogueAcolyte: 'Mania',
	},
	factions: WfMap = {
		FC_CORPUS: 'Corpus',
		FC_GRINEER: 'Grineer',
		FC_INFESTATION: 'Infestation',
		FC_OROKIN: 'Corrupted',
		FC_SENTIENT: 'Sentient',
		FC_STALKER: 'Stalker',
		FC_TENNO: 'Tenno',
	},
	fomorianTypes: WfMap = {
		FC_CORPUS: 'Razorback',
		FC_GRINEER: 'Balor Fomorian',
	},
	fomorianFactions: WfMap = {
		0: 'FC_GRINEER',
		1: 'FC_CORPUS',
	},
	missionTypes: WfMap = {
		MT_ARTIFACT: 'Disruption',
		MT_ASSASSINATION: 'Assassination',
		MT_ASSAULT: 'Assault',
		MT_CAPTURE: 'Capture',
		MT_COUNTER_INTEL: 'Deception',
		MT_DEFENSE: 'Defense',
		MT_EVACUATION: 'Defection',
		MT_EXCAVATE: 'Excavation',
		MT_EXTERMINATION: 'Exterminate',
		MT_HIVE: 'Hive',
		MT_INTEL: 'Spy',
		MT_LANDSCAPE: 'Free Roam',
		MT_MOBILE_DEFENSE: 'Mobile Defense',
		MT_PURIFY: 'Infested Salvage',
		MT_PURSUIT: 'Pursuit',
		MT_RACE: 'Rush',
		MT_RESCUE: 'Rescue',
		MT_RETRIEVAL: 'Hijack',
		MT_SABOTAGE: 'Sabotage',
		MT_SURVIVAL: 'Survival',
		MT_TERRITORY: 'Interception',
		MT_ARENA: 'Arena',
		MT_PVP: 'Conclave',
	},
	sortieBosses: WfMap<string, { faction: string, name: string }> = {
		SORTIE_BOSS_VOR: { faction: 'FC_GRINEER', name: 'Vor' },
		SORTIE_BOSS_HEK: { faction: 'FC_GRINEER', name: 'Vay Hek' },
		SORTIE_BOSS_RUK: { faction: 'FC_GRINEER', name: 'Sargas Ruk' },
		SORTIE_BOSS_KELA: { faction: 'FC_GRINEER', name: 'Kela de Thaym' },
		SORTIE_BOSS_KRIL: { faction: 'FC_GRINEER', name: 'Lech Kril' },
		SORTIE_BOSS_TYL: { faction: 'FC_GRINEER', name: 'Tyl Regor' },
		SORTIE_BOSS_JACKAL: { faction: 'FC_CORPUS', name: 'Jackal' },
		SORTIE_BOSS_ALAD: { faction: 'FC_CORPUS', name: 'Alad V' },
		SORTIE_BOSS_AMBULAS: { faction: 'FC_CORPUS', name: 'Ambulas' },
		SORTIE_BOSS_HYENA: { faction: 'FC_CORPUS', name: 'Hyenas' },
		SORTIE_BOSS_NEF: { faction: 'FC_CORPUS', name: 'Nef Anyo' },
		SORTIE_BOSS_RAPTOR: { faction: 'FC_CORPUS', name: 'Raptor' },
		SORTIE_BOSS_PHORID: { faction: 'FC_INFESTATION', name: 'Phorid' },
		SORTIE_BOSS_LEPHANTIS: { faction: 'FC_INFESTATION', name: 'Lephantis' },
		SORTIE_BOSS_INFALAD: { faction: 'FC_INFESTATION', name: 'Mutalist Alad V' },
		SORTIE_BOSS_CORRUPTED_VOR: { faction: 'FC_OROKIN', name: 'Corrupted Vor' },
	},
	sortieModifiers: WfMap = {
		SORTIE_MODIFIER_HAZARD_FOG: 'Dense fog',
		SORTIE_MODIFIER_HAZARD_ICE: 'Cryogenic leakage',
		SORTIE_MODIFIER_HAZARD_FIRE: 'Fire hazard',
		SORTIE_MODIFIER_HAZARD_MAGNETIC: 'Magnetic anomalies',
		SORTIE_MODIFIER_HAZARD_COLD: 'Extreme cold',
		SORTIE_MODIFIER_HAZARD_RADIATION: 'Radiation hazard',
		// Weapon restrictions
		SORTIE_MODIFIER_RIFLE_ONLY: 'Weapon restriction (Assault rifle)',
		SORTIE_MODIFIER_SHOTGUN_ONLY: 'Weapon restriction (Shotgun)',
		SORTIE_MODIFIER_SNIPER_ONLY: 'Weapon restriction (Sniper rifle)',
		SORTIE_MODIFIER_SECONDARY_ONLY: 'Weapon restriction (Secondary)',
		SORTIE_MODIFIER_MELEE_ONLY: 'Weapon restriction (Melee)',
		SORTIE_MODIFIER_BOW_ONLY: 'Weapon restriction (Bow)',
		// Enemy enhancements
		SORTIE_MODIFIER_FREEZE: 'Elemental buffs (Ice)',
		SORTIE_MODIFIER_EXPLOSION: 'Elemental buffs (Blast)',
		SORTIE_MODIFIER_FIRE: 'Elemental buffs (Fire)',
		SORTIE_MODIFIER_ELECTRICITY: 'Elemental buffs (Electricity)',
		SORTIE_MODIFIER_POISON: 'Elemental buffs (Toxic)',
		SORTIE_MODIFIER_RADIATION: 'Elemental buffs (Radiation)',
		SORTIE_MODIFIER_MAGNETIC: 'Elemental buffs (Magnetic)',
		SORTIE_MODIFIER_VIRAL: 'Elemental buffs (Viral)',
		SORTIE_MODIFIER_CORROSIVE: 'Elemental buffs (Corrosive)',
		SORTIE_MODIFIER_IMPACT: 'Physical buffs (Impact)',
		SORTIE_MODIFIER_SLASH: 'Physical buffs (Slash)',
		SORTIE_MODIFIER_PUNCTURE: 'Physical buffs (Puncture)',
		// Miscellaneous
		SORTIE_MODIFIER_ARMOR: 'Augmented enemy armor',
		SORTIE_MODIFIER_SHIELDS: 'Augmented enemy shields',
		SORTIE_MODIFIER_LOW_ENERGY: 'Energy reduction',
		SORTIE_MODIFIER_EXIMUS: 'Eximus stronghold',
	},
	syndicateNames: WfMap = {
		ArbitersSyndicate: 'Arbiters of Hexis',
		CephalonSudaSyndicate: 'Cephalon Suda',
		CetusSyndicate: 'Ostron',
		NewLokaSyndicate: 'New Loka',
		PerrinSyndicate: 'The Perrin Sequence',
		QuillsSyndicate: 'The Quills',
		RedVeilSyndicate: 'Red Veil',
		SteelMeridianSyndicate: 'Steel Meridian',
		GhoulEmergence: 'Ghoul Purge',
		InfestedPlains: 'Plague Star',
		SolarisSyndicate: 'Solaris United',
		RadioLegionSyndicate: 'Nightwave',
		EntratiSyndicate: 'Entrati',
	},
	upgradeTypes: WfMap = {
		GAMEPLAY_KILL_XP_AMOUNT: 'Affinity',
		GAMEPLAY_MONEY_REWARD_AMOUNT: 'Credit',
		GAMEPLAY_PICKUP_AMOUNT: 'Resource',
		GAMEPLAY_PICKUP_RATE: 'Resource Chance',
	},
	voidTiers: WfMap = {
		VoidT1: 'Lith',
		VoidT2: 'Meso',
		VoidT3: 'Neo',
		VoidT4: 'Axi',
		VoidT5: 'Requiem',
	},
	voidTraderNames: WfMap = {
		'Baro\'Ki Teel': 'Baro Ki\'Teer',
	}

/**
 * Load star chart node and challenge information
 *
 * @param _starchart Path to star chart JSON data
 * @param _challenges Path to challenges JSON data
 */
export function load(_starchart: string, _challenges: string): void {
	try {
		const tmp = JSON.parse(readFileSync(_starchart, 'utf8'))
		locations = tmp.locations
		nodeMissionTypes = tmp.missionTypes
		nodeFactions = tmp.factions

		challenges = JSON.parse(readFileSync(_challenges, 'utf8'))
	}
	catch(err) {
		throw Error(`Failed to initialize tags: '${err.message}'`)
	}
}
