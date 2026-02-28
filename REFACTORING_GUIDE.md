# HonkaRogue Modular Refactoring Guide

## Current Structure
The game is currently in a single 5360+ line `index.html` file. This guide outlines how to split it into manageable modules.

## New Directory Structure

```
index.html                (HTML shell: structures & CSS only)
style.css                 (External stylesheet - keep existing)
js/
├── data.js              (Constants, data structures, config)
├── utils.js             (Math, RNG, helper functions)  
├── game.js              (Game logic, battle mechanics)
└── ui.js                (Rendering, UI, event handlers)
```

## Module Responsibilities

### js/data.js ✅ CREATED
Contains all static data:
- `PARTS_DATA_EMBEDDED` - Parts configuration
- `TYPE_EFF` - Type effectiveness chart
- `ROSTER` - Starter honkers (4 choices)
- `HONKER_DEX` - 30 named encounter honkers
- `MOVE_POOLS` - Moves by type
- `LOOT_POOL` - Loot table
- `BIOMES` - Stage biomes
- Type color/emoji pools
- All constant definitions
- `CAMPAIGN` - Initial game state

### js/utils.js ✅ CREATED
Contains utility functions:
- `seededRng(seed)` - Deterministic RNG
- `hash32(str)` - FNV-1a hashing
- `seeded01(key)` - Seeded random [0-1)
- `slugMoveName(s)` - Convert to slug IDs
- `cloneJson(value)` - Deep JSON clone
- `pickWeightedIndex(weights, rng)` - Weighted selection
- `levelStatScale(level, key)` - Stat growth calculation
- `getEff(a, d1, d2)` - Type effectiveness
- `rarityWeight(rarity)` - Rarity scoring
- `tierDistance(a, b)` - Rarity distance
- `randomElement(arr, rng)` - Array sampling

### js/game.js (PLACEHOLDER - TODO)
Game mechanics and logic:

**Core Generator:**
- `generateStage(n)` - Create encounter from stage number
- `chooseDexForStage(n, isBoss, rng, biome)` - Pick named honker
- `buildDexPartBlueprint(dex)` - Assemble honker from parts
- `computeDexAssembledParts(dex)` - Part composition
- `pickDexPartForSlot(dex, slot)` - Part selection for slot
- `getBiomeForStage(n)` - Get biome for stage
- `pickBiomeType(biome, rng, isBoss)` - Type selection

**Parts System:**
- `ensurePartTrackingState()` - Init tracking arrays
- `isPartCaught(partOrId)` - Check if caught
- `isPartSeen(partOrId)` - Check if seen
- `isPartUnlocked(partOrId)` - Alias for caught (backwards compat)
- `catchPartIds(ids)` - Mark parts as caught
- `seePartIds(ids)` - Mark as seen only
- `resetStarterCaughtParts()` - Initial part unlock
- `grantCatchPartUnlocks(caught, enemyRef)` - Unlock on catch
- `enemyHasUncaughtParts(enemyData)` - Check if enemy offers new parts
- `getStarterUnlockedPartIds()` - Get base part IDs
- `getAllPartIds()` - All part IDs
- `unlockedPartsByFamilyType(type)` - Filter by type
- `getPartTypeFromData(part)` - Determine part's type

**Part Processing:**
- `normalizePartRarityByFamily(data)` - Rarity assignment  
- `applyPartProgressionCurve(data)` - Stat calculation
- `attachPartMoveLinks(data)` - Assign default moves to parts
- `initDexPartPresets()` - Cache assembled dex honkers
- `getDexAssembledParts(dex)` - Get cached composition

**Move Selection:**
- `moveTier(m)` - Categorize move rarity
- `rarityTargetTier(rarity)` - Map part rarity to move tier
- `partTypeFromData(part)` - Get type from part
- `scoreMoveForPart(move, part, idx)` - Score move for part
- `pickPartMoves(part)` - Select 2 default moves

**Battle Mechanics:**
- `Honker` class - Battle fighter instance
- Damage calculation methods
- Status effect application
- Move power calculation
- AI move selection
- Type advantage checking

**Battle State:**
- `levelStatScale(level, key)` - Growth multiplier
- Effect/status tracking
- Battle phase management
- Event system for wild events

**Scoring & Balance:**
- `stageThreat(n)` - Threat level for stage
- `playerPower(pb)` - Player power calculation
- `deriveHonkerFromParts(parts)` - Compute stats from parts

### js/ui.js (PLACEHOLDER - TODO)
Rendering and user interface:

**Screen Management:**
- `showScreen(screenId)` - Show a screen
- `hideAllScreens()` - Toggle visibility
- Per-screen show functions:
  - `showTitle()` - Title screen
  - `showCharSelect()` - Starter selection
  - `showPartyBox()` - Party management
  - `showMap()` - Stage select
  - `showBattle()` - Battle arena
  - `showPartsDex()` - Parts encyclopedia
  - `showAssemblyScreen()` - Part assembly UI
  - `showHonkerDex()` - Honker encyclopedia
  - `showPartySwap()` - Mid-battle swap overlay
  - `showLoot()` - Loot screen
  - `showShop()` - Shop screen

**Rendering Functions:**
- `buildHonkerCard(honker, onclick)` - Honker display card
- `buildPartCard(part)` - Part card
- `buildDexGrid()` - Honker dex grid
- `buildPartsDexGrid()` - Parts dex grid
- `buildPartSelectors()` - Assembly selectors
- `renderPartySlot(honker, idx, isActive)` - Party member display
- `renderLoot(item)` - Loot card
- `setupFighterUI(f, side)` - Battle UI for fighter
- `updateBattleDisplay()` - Refresh battle screen

**Battle UI:**
- `setupFighterUI(fighter, side)` - Initialize fighter display
- Move/stats/status rendering
- HP bar updates
- Effect badge display
- Encounter badge display ("EPIC", "LEGENDARY")
- "NEW PARTS" indicator

**Event Handlers:**
- Button onclick functions
- Move/action selection
- Item use
- Party member selection
- Assembly part selection
- Shop item purchase
- Retry/confirm dialogs

**Search/Filter:**
- Part dex search
- Honker dex search
- Sort toggling
- Filter by family/slot/rarity

## Migration Steps

### Step 1: Verify Current State
- [x] Create `js/` directory
- [x] Create `js/data.js` with core constants
- [x] Create `js/utils.js` with helper functions
- [ ] Create `js/game.js` stub
- [ ] Create `js/ui.js` stub

### Step 2: Extract Game Logic (MEDIUM EFFORT)
1. Copy `generateStage()` function family to `js/game.js`
2. Copy all parts-related functions to `js/game.js`
3. Copy move selection logic to `js/game.js`
4. Copy Honker class to `js/game.js`
5. Copy damage/battle calculations to `js/game.js`
6. Update index.html to load: `<script src="js/game.js"></script>`

### Step 3: Extract UI Rendering (HIGH EFFORT)
1. Copy all `show*()` functions to `js/ui.js`
2. Copy all `build*()` rendering functions to `js/ui.js`
3. Copy event handler registration to `js/ui.js`
4. Copy screen visibility management to `js/ui.js`
5. Update index.html to load: `<script src="js/ui.js"></script>`

### Step 4: Update Script Loading Order
In `index.html`, add before closing `</body>` tag:
```html
<script src="js/data.js"></script>
<script src="js/utils.js"></script>
<script src="js/game.js"></script>
<script src="js/ui.js"></script>
<script>
  // Main initialization code here (showScreen('screen-title'), etc)
</script>
```

### Step 5: Extract Remaining Code
- Move any remaining initialization logic to main script block
- Move any remaining event handlers
- Move any remaining state management

## Benefits
- ✅ Easier to navigate each file
- ✅ Clear separation of concerns
- ✅ Reusable modules for other projects
- ✅ Easier testing and debugging
- ✅ Cleaner git history and diffs
- ✅ Better IDE/editor support
- ✅ Faster load times (can be minified separately)

## Key Dependencies
- `data.js` has no dependencies
- `utils.js` needs: `data.js` (for constants)
- `game.js` needs: `data.js`, `utils.js`
- `ui.js` needs: `data.js`, `game.js`, `utils.js`
- `index.html` needs: all of the above

## Notes
- Do NOT split HTML structure or CSS yet - that stays in index.html
- CSS can later be extracted to `style.css` if not already external
- Keep inline styles until fully modularized
- Test in browser after each major extraction to ensure nothing broke

