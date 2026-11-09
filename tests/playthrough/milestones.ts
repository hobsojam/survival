import { STALL_IDS, pieceDone, squareMarked } from '../../src/game/square';
import { bridgeDone } from '../../src/game/bridge';
import { milestoneDone, roadDone } from '../../src/game/meadow';
import { NEEDS, TOWERS, castleFinished, hallFinished, isRevealed, moatFill, towerFinished, wallFinished } from '../../src/game/castle';
import { KEEP_DOOR_AT, keepFinished } from '../../src/game/keep';
import type { GameState, StructureId } from '../../src/game/state';

export interface Milestone { id: string; label: string; reached: (state: GameState) => boolean }

const built = (id: StructureId, label: string): Milestone => ({ id: `built-${id}`, label, reached: state => state.structures[id] });

/** The way-marks of a whole game, roughly in the order a player meets them. */
export const MILESTONES: readonly Milestone[] = [
  built('shelter', 'Built the shelter'),
  built('bed', 'Built a bed'),
  built('toolshed', 'Built the toolshed'),
  { id: 'cold-night', label: 'Weathered the cold night', reached: state => state.progress.hearthUnlocked },
  { id: 'axe', label: 'Made the stone axe', reached: state => state.progress.axeCrafted },
  { id: 'quarry', label: 'Found the quarry', reached: state => state.progress.quarryFound },
  { id: 'homestead', label: 'Found the old homestead', reached: state => state.progress.homesteadFound },
  { id: 'pickaxe', label: 'Made the pickaxe', reached: state => state.progress.pickaxeCrafted },
  { id: 'lookout', label: 'Repaired the lookout', reached: state => state.progress.lookoutRepaired },
  { id: 'first-clearing', label: 'Cleared the first ground', reached: state => state.clearing.cleared.length > 0 },
  built('woodpile', 'Built the woodpile'),
  built('larder', 'Built the larder'),
  built('house', 'Moved into the house'),
  built('vegetableBeds', 'Built the vegetable beds'),
  built('well', 'Built the well'),
  built('workshop', 'Built the workshop'),
  built('field', 'Built the grain field'),
  { id: 'first-grain', label: 'Threshed the first grain', reached: state => state.field.grain > 0 || state.field.straw > 0 },
  built('granary', 'Built the granary'),
  built('windmill', 'Built the windmill'),
  built('bakery', 'Built the bakery'),
  built('beehive', 'Built the beehive'),
  built('chickenCoop', 'Built the chicken coop'),
  { id: 'chickens', label: 'Led the chickens home', reached: state => state.chickens.rescued },
  built('sheepPen', 'Built the sheep pen'),
  { id: 'sheep', label: 'The sheep arrived', reached: state => state.sheep.arrived },
  { id: 'shorn', label: 'Sheared the flock', reached: state => state.sheep.lastShornYear !== null },
  built('loom', 'Built the loom'),
  built('orchard', 'Fenced the orchard'),
  { id: 'first-tree', label: 'Planted the first apple tree', reached: state => state.orchard.trees.some(tree => tree !== null) },
  { id: 'all-cleared', label: 'Cleared all the ground', reached: state => state.clearing.cleared.length === 12 },
  { id: 'hills', label: 'Came out on the hills', reached: state => state.progress.hillsFound },
  { id: 'ore', label: 'Found ore', reached: state => state.progress.oreFoundDay !== null },
  { id: 'forge', label: 'Added the forge', reached: state => state.progress.workshop.forge },
  { id: 'pony', label: 'Won over the pony', reached: state => state.pony.won !== null },
  { id: 'shod', label: 'Shod the pony', reached: state => state.pony.shod !== null },
  { id: 'hinges', label: 'Made the iron hinges', reached: state => state.progress.workshop.hinges },
  { id: 'keep-started', label: 'Laid the keep\'s first stone', reached: state => state.keep.stones > 0 },
  { id: 'keep-door', label: 'Hung the keep\'s door', reached: state => state.keep.door && state.keep.stones >= KEEP_DOOR_AT },
  { id: 'keep-finished', label: 'Finished the keep', reached: keepFinished },
  // EASTER EGG: the castle, see src/game/castle.ts.
  { id: 'castle-line', label: 'Saw the line of stones', reached: isRevealed },
  { id: 'road', label: 'Laid the road to the keep', reached: state => state.castle.road >= NEEDS.road },
  { id: 'cart', label: 'Made the stone cart', reached: state => state.progress.workshop.stoneCart },
  { id: 'frames', label: 'Raised the timber frames', reached: state => state.castle.frames >= NEEDS.frames },
  { id: 'wall', label: 'Finished the curtain wall', reached: state => wallFinished(state.castle) },
  { id: 'towers', label: 'Roofed and fitted the four towers', reached: state => TOWERS.every(id => towerFinished(state.castle.towers[id])) },
  { id: 'gatehouse', label: 'Finished the gatehouse', reached: state => state.castle.gatehouse >= NEEDS.gatehouse },
  { id: 'moat-dug', label: 'Dug the moat', reached: state => state.castle.moat.stretches >= NEEDS.moat },
  { id: 'moat-full', label: 'The spring rain filled the moat', reached: state => moatFill(state) === 1 },
  { id: 'hall', label: 'Built, roofed and hung the great hall', reached: state => hallFinished(state.castle.hall) },
  { id: 'feast', label: 'Set the first dish on the hall\'s table', reached: state => Object.values(state.castle.feast).some(count => count > 0) },
  { id: 'castle-finished', label: 'Finished the castle with the feast', reached: castleFinished },
  { id: 'castle-home', label: 'Made the great hall home', reached: state => state.castle.home === 'hall' },
  // EASTER EGG: the town, see src/game/town.ts.
  { id: 'town-traveller', label: 'A traveller came to the hall door', reached: state => state.town.namesUsed > 0 },
  { id: 'town-neighbour', label: 'Took on the first neighbour', reached: state => state.town.people.length > 0 },
  { id: 'town-house', label: 'Built the first house', reached: state => state.town.houses[0]?.doneDay !== null },
  { id: 'town-house-2', label: 'Built the second house', reached: state => state.town.houses[1]?.doneDay !== null },
  { id: 'town-house-3', label: 'Three houses, three neighbours', reached: state => state.town.houses[2]?.doneDay !== null && state.town.people.some(person => person.house === 2) },
  { id: 'square-marked', label: 'Marked out the square', reached: squareMarked },
  { id: 'square-paved', label: 'Paved the square', reached: state => pieceDone(state.town.square, 'paving') },
  { id: 'square-well', label: 'Finished the well', reached: state => pieceDone(state.town.square, 'well') },
  { id: 'square-stalls', label: 'Raised all five stalls', reached: state => STALL_IDS.every(id => pieceDone(state.town.square, id)) },
  { id: 'bridge-piers', label: 'Raised the bridge\'s piers', reached: state => state.town.bridge.doneDays.piers !== undefined },
  { id: 'bridge', label: 'Finished the bridge', reached: state => bridgeDone(state.town.bridge) },
  { id: 'meadow', label: 'Crossed to the meadow', reached: state => state.progress.meadowFound },
  { id: 'meadow-road', label: 'Cleared the old road', reached: state => roadDone(state.town.road) },
  { id: 'milestone', label: 'Set the milestone', reached: state => milestoneDone(state.town.road) },
  { id: 'meadow-house', label: 'Built the first house in the meadow', reached: state => state.town.houses[12]?.doneDay != null }
];
