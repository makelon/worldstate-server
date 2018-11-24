# Worldstate Server

A server that parses the dynamic world data for the video game [Warframe](https://www.warframe.com) and outputs it in a more readable form.
It serves as the back end of the [Tenno Tools](https://tenno.tools) world tracker.

## Installation and use

1. Get the source files.

   `git clone https://github.com/makelon/worldstate-server`

2. Install dependencies, and the TypeScript compiler if it isn't available as a global package.

   `npm install`  
   `npm install --no-save typescript` (if necessary)

3. Download [languages.json](https://github.com/WFCD/warframe-worldstate-data/raw/master/data/languages.json) from [WFCD](https://github.com/WFCD)'s data repository and place it in the `data` folder.

4. Convert the language data to a format that the worldstate server can understand.

   `node items`

5. Build the project.

   `node build` or `node build h` for options that can be useful when modifying the code.

6. Copy `config.dist.json` to `out/config.json` or the prefered destination and edit the content. Use `config.ts` as a guide.

   **Note**: The server does little in the way of HTTP request validation, so it is highly recommended to run it behind a reverse proxy such as nginx or Apache.

7. Start the server.

   `node out`

## API

`GET /<platform>` or `GET /<platform>/<components>` returns a response with the following format:

```
{
	"time": 1512345678,
	<component data described below>
}
```

### Parameters

`platform` - **Required**. Selected platform.

* `pc` - PC  
* `ps4` - PlayStation 4  
* `xb1` - Xbox One  
* `ns` - Nintendo Switch

`components` - Comma-separated list of components. If omitted, all components are returned.

* `acolytes` - Acolytes.

    ```
    "acolytes": {
    	"time": 1512345678,
    	"data": [
    		{
    			"id": "59abcdef0123456789abcdef",
    			"name": "Acolyte name",
    			"health": 0.7,
    			"healthHistory": [
    				[1512345678, 0.9],
    				<...>
    			],
    			"discovered": true | false,
    			"location": "Planet/Node"
    		},
    		<...>
    	]
    }
    ```

    **Notes**

    The last pair in `healthHistory` may have a negative timestamp, indicating that the value may change in the future.

* `alerts` - Alerts.

    ```
    "alerts": {
    	"time": 1512345678,
    	"data": [
    		{
    			"id": "59abcdef0123456789abcdef",
    			"start": 1512345678,
    			"end": 1523456789,
    			"location": "Planet/Node",
    			"missionType": "Mission type",
    			"faction": "Faction",
    			"minLevel": 22,
    			"maxLevel": 27,
    			"rewards": {
    				"credits": 9000,
    				"items": [
    					{ "name": "Item name", "type": "Item type", "count": 1 },
    					<...>
    				]
    			}
    		},
    		<...>
    	]
    }
    ```

* `bounties` - Syndicate bounties.

    ```
    "bounties": {
    	"time": 1512345678,
    	"data": [
    		{
    			"id": "59abcdef0123456789abcdef",
    			"start": 1512345678,
    			"end": 1523456789,
    			"syndicate": "Syndicate name",
    			"jobs": [
    				{
    					"minLevel": 5,
    					"maxLevel": 15,
    					"rewards": [
    						[
    							{ "name": "Item name", "type": "Item type", "count": 1, "chance": 0.5 },
    							<...>
    						],
    						<... higher reward tiers>
    					],
    					xpAmounts: [500, <...>]
    				},
    				<...>
    			]
    		},
    		<...>
    	]
    }
    ```

* `dailydeals` - Darvo's Daily Deals.

    ```
    "dailydeals": {
    	"time": 1512345678,
    	"data": [
    		{
    			"id": "59abcdef0123456789abcdef",
    			"start": 1512345678,
    			"end": 1523456789,
    			"item": { "name": "Item name", "type": "Item type" },
    			"price": 50,
    			"originalPrice": 250,
    			"stock": 150,
    			"sold": 50
    		},
    		<...>
    	]
    }
    ```

* `daynight` - Day cycles for regions that have them.

    ```
    "daynight": {
    	"time": 1512345678,
    	"data": [
    		{
    			"id": "regionId",
    			"start": 1512345678,
    			"dayStart": 0,
    			"dayEnd": 14400,
    			"length": 28800,
    		},
    		<...>
    	]
    }
    ```

    **Notes**

    `start` is a timestamp of a past midnight in the region.

    `dayStart` and `dayEnd` are the number of seconds into the cycle when day starts and ends.

* `factionprojects` - Balor Fomorian and Razorback construction progress.

    ```
    "factionprojects": {
    	"time": 1512345678,
    	"data": [
    		{
    			"id": "1",
    			"type": "Enemy type",
    			"progress": 5.92,
    			"progressHistory": [
    				[1512345678, 3.1],
    				<...>
    			]
    		},
    		<...>
    	]
    }
    ```

    **Notes**

    `id` strings are reused for different construction cycles.

    The last pair in `progressHistory` may have a negative timestamp, indicating that the value may change in the future.

* `fissures` - Void fissures.

    ```
    "fissures": {
    	"time": 1512345678,
    	"data": [
    		{
    			"id": "59abcdef0123456789abcdef",
    			"start": 1512345678,
    			"end": 1523456789,
    			"location": "Planet/Node",
    			"faction": "Faction",
    			"missionType": "Mission type",
    			"tier": "Void tier"
    		},
    		<...>
    	]
    }
    ```

* `fomorians` - Balor Fomorian and Razorback attacks.

    ```
    "fomorians": {
    	"time": 1512345678,
    	"data": [
    		{
    			"id": "59abcdef0123456789abcdef",
    			"start": 1512345678,
    			"end": 1523456789,
    			"type": "Fomorian type",
    			"health": 0.7,
    			"healthHistory": [
    				[1512345678, 0.9],
    				<...>
    			],
    			"endGoal": 3,
    			"missionType": "Mission type",
    			"victimLocation": "Planet/Node",
    			"missionLocation": "Planet/Node",
    			"requiredItems": [
    				{ "name": "Item name", "type": "Item type" },
    				<...>
    			],
    			"goalReward": {
    				"credits": 9000,
    				"items": [
    					{ "name": "Item name", "type": "Item type", "count": 1 },
    					<...>
    				]
    			},
    			"randomRewards": [
    				[
    					{ "name": "Item name", "type": "Item type", "count": 1, "chance": 0.5 },
    					<...>
    				],
    				<... higher reward tiers>
    			]
    		},
    		<...>
    	]
    }
    ```

    **Notes**

    `endGoal` is the personal score required to receive the `goalReward`.

    The last pair in `healthHistory` may have a negative timestamp, indicating that the value may change in the future.

* `invasions` - Invasions.

    ```
    "invasions": {
    	"time": 1512345678,
    	"data": [
    		{
    			"id": "59abcdef0123456789abcdef",
    			"start": 1512345678,
    			"location": "Planet/Node",
    			"endScore": 9000,
    			"score": 5000,
    			"scoreHistory": [
    				[1512345678, 100],
    				<...>
    			],
    			"factionAttacker": "Attacking faction",
    			"factionDefender": "Defending faction",
    			"rewardsAttacker": {
    				credits: 9000,
    				items: [
    					{ "name": "Item name", "type": "Item type", "count": 1 },
    					<...>
    				]
    			},
    			"rewardsDefender": {
    				credits: 9000,
    				items: [
    					{ "name": "Item name", "type": "Item type", "count": 1 },
    					<...>
    				]
    			}
    		},
    		<...>
    	]
    }
    ```

    **Notes**

    Depending on which side is in the lead, `score` will be positive (attacker) or negative (defender).

    The last pair in `scoreHistory` may have a negative timestamp, indicating that the value may change in the future.

* `news` - News articles.

    ```
    "news": {
    	"time": 1512345678,
    	"data": [
    		{
    			"id": "59abcdef0123456789abcdef",
    			"start": 1512345678,
    			"text": "Article text",
    			"link": "Article URL",
    			"eventStart": 1512345678,
    			"eventEnd": 1523456789,
    			"eventUrl": "Event URL"
    		},
    		<...>
    	]
    }
    ```

    **Notes**

    `eventStart`, `eventEnd` and `eventUrl` are present if the event takes place on an external web site.

* `sorties` - Sorties.

    ```
    "sorties": {
    	"time": 1512345678,
    	"data": [
    		{
    			"id": "59abcdef0123456789abcdef",
    			"start": 1512345678,
    			"end": 1523456789,
    			"faction": "Faction",
    			"bossName": "Boss name",
    			"rewards": [
    				[
    					{ "name": "Item name", "type": "Item type", "count": 1, "chance": 0.5 },
    					<...>
    				],
    				<... higher reward tiers>
    			],
    			"missions": [
    				{ "missionType": Mission type", "modifier": "Modifier", "location": "Planet/Node" },
    				<...>
    			]
    		},
    		<...>
    	]
    }
    ```

* `upgrades` - Global boosters.

    ```
    "upgrades": {
    	"time": 1512345678,
    	"data": [
    		{
    			"id": "59abcdef0123456789abcdef",
    			"start": 1512345678,
    			"end": 1523456789,
    			"type": "Booster type",
    			"opType": "Upgrade operation",
    			"value": 2
    		},
    		<...>
    	]
    }
    ```

    **Notes**

    `opType` determines the mathematical operation by which `value` modifies the game's calculations.

* `voidtraders` - Void traders.

    ```
    "voidtraders": {
    	"time": 1512345678,
    	"data": [
    		{
    			"id": "59abcdef0123456789abcdef1512345678",
    			"start": 1512345678,
    			"end": 1523456789,
    			"name": "Void trader name",
    			"location": "Planet/Node",
    			"active": true | false,
    			"items": [
    				{ "name": "Item name", "type": "Item type", "ducats": 500, "credits": 9000 },
    				<...>
    			]
    		},
    		<...>
    	]
    }
    ```
