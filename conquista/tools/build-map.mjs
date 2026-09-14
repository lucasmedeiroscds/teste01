// Gera public/data/world.json a partir do world-atlas (Natural Earth 110m).
// Roda offline no desenvolvimento; o servidor e o cliente so consomem o JSON pronto.
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature, neighbors } from 'topojson-client';
import { COUNTRIES, SEA_ROUTES } from '../src/countries.js';

const require = createRequire(import.meta.url);
const topo = require('world-atlas/countries-110m.json');
const W = 1000;
const H = 520;

const geometries = topo.objects.countries.geometries;
const features = feature(topo, topo.objects.countries).features;
const projection = geoNaturalEarth1().fitExtent([[6, 6], [W - 6, H - 6]], { type: 'Sphere' });
const pathGen = geoPath(projection);

const indexByName = new Map(geometries.map((g, i) => [g.properties.name, i]));
const selected = new Map(); // indice no atlas -> pais do jogo
for (const c of COUNTRIES) {
  const i = indexByName.get(c.atlas);
  if (i === undefined) throw new Error(`Pais nao encontrado no atlas: ${c.atlas}`);
  selected.set(i, c);
}

const nbrs = neighbors(geometries);
const adj = new Map(COUNTRIES.map((c) => [c.id, new Set()]));
const link = (a, b) => {
  if (!a || !b || a === b) return;
  adj.get(a).add(b);
  adj.get(b).add(a);
};
for (const [i, country] of selected) {
  for (const j of nbrs[i]) {
    const direct = selected.get(j);
    if (direct) { link(country.id, direct.id); continue; }
    // Corredor: fronteira atraves de um unico pais fora do jogo (ex.: Etiopia-Egito pelo Sudao).
    for (const k of nbrs[j]) {
      const hop = selected.get(k);
      if (hop) link(country.id, hop.id);
    }
  }
}
for (const [a, b] of SEA_ROUTES) link(a, b);

const out = { viewBox: `0 0 ${W} ${H}`, countries: [], decor: [] };

// Paises fora do jogo entram como cenario: aparecem no mapa, mas nao sao clicaveis.
for (let i = 0; i < features.length; i++) {
  if (selected.has(i)) continue;
  const nome = geometries[i].properties.name;
  if (nome === 'Antarctica') continue; // so ocuparia a base do mapa
  const d = pathGen(features[i]);
  if (d) out.decor.push({ name: nome, path: d.replace(/(\.\d)\d+/g, '$1') });
}
for (const [i, c] of selected) {
  const f = features[i];
  const d = pathGen(f);
  const [cx, cy] = pathGen.centroid(f);
  if (!d || !Number.isFinite(cx)) throw new Error(`Geometria invalida: ${c.atlas}`);
  out.countries.push({
    id: c.id,
    name: c.name,
    cont: c.cont,
    rank: c.rank,
    income: c.income,
    price: c.price,
    path: d.replace(/(\.\d)\d+/g, '$1'), // uma casa decimal ja basta nesta escala
    cx: Math.round(cx * 10) / 10,
    cy: Math.round(cy * 10) / 10,
    neighbors: [...adj.get(c.id)].sort(),
  });
}
out.countries.sort((a, b) => a.rank - b.rank);

// Confere que o mapa e um grafo conexo (senao existiriam paises impossiveis de conquistar).
const seen = new Set([out.countries[0].id]);
const queue = [out.countries[0].id];
const byId = new Map(out.countries.map((c) => [c.id, c]));
while (queue.length) {
  for (const n of byId.get(queue.pop()).neighbors) if (!seen.has(n)) { seen.add(n); queue.push(n); }
}
const isolated = out.countries.filter((c) => !seen.has(c.id)).map((c) => c.id);
if (isolated.length) throw new Error(`Paises desconectados do mapa: ${isolated.join(', ')}`);

writeFileSync(new URL('../public/data/world.json', import.meta.url), JSON.stringify(out));
const semVizinhos = out.countries.filter((c) => c.neighbors.length < 2).map((c) => `${c.id}(${c.neighbors.length})`);
const kb = Math.round(JSON.stringify(out).length / 1024);
console.log(
  `ok: ${out.countries.length} paises jogaveis + ${out.decor.length} de cenario, ${seen.size} conectados, ` +
  `${kb} KB, poucos vizinhos: ${semVizinhos.join(', ') || 'nenhum'}`,
);
