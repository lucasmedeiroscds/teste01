// Carrega o mapa-mundi gerado por tools/build-map.mjs.
import { readFileSync } from 'node:fs';

const world = JSON.parse(readFileSync(new URL('../public/data/world.json', import.meta.url), 'utf8'));

export const WORLD = world;
export const MAP_COUNTRIES = world.countries;
export const ADJACENCY = new Map(world.countries.map((c) => [c.id, c.neighbors]));
