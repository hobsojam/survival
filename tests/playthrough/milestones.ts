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
  { id: 'keep-finished', label: 'Finished the keep', reached: keepFinished }
];
