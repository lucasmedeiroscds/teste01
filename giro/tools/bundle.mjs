/* Gera uma versão do Giro em arquivo único, para hospedar em qualquer lugar
 * que aceite um HTML solto — ou para abrir direto do disco, já que sem
 * servidor os módulos ES não carregam.
 *
 *   npm i esbuild
 *   node giro/tools/bundle.mjs            (minificado)
 *   node giro/tools/bundle.mjs --dev      (legível, para depurar)
 *
 * Saídas em giro/dist/:
 *   giro.html        página completa, autossuficiente
 *   giro.body.html   só o conteúdo, para plataformas que fornecem o <head>
 *
 * O CSS e o JavaScript entram embutidos. A fonte continua vindo do Google
 * Fonts, com pilha de fontes do sistema como reserva — se não carregar, o
 * layout não muda de lugar.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const p = (...partes) => resolve(raiz, ...partes);

let esbuild;
try {
  esbuild = await import('esbuild');
} catch {
  console.error('Falta o esbuild. Rode:  npm i esbuild');
  process.exit(1);
}

const FONTE = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@500;600&display=swap';

const minificar = !process.argv.includes('--dev');

const { outputFiles } = await esbuild.build({
  entryPoints: [p('assets/js/app.js')],
  bundle: true,
  format: 'esm',
  target: ['safari15', 'chrome90', 'firefox90'],   // piso prático: iOS 15
  charset: 'utf8',
  legalComments: 'none',
  minify: minificar,
  write: false,
});
const js = outputFiles[0].text;

let css = await readFile(p('assets/css/app.css'), 'utf8');
if (minificar) {
  css = (await esbuild.transform(css, { loader: 'css', minify: true })).code;
}
const html = await readFile(p('index.html'), 'utf8');

// pega o miolo do <body> do index, sem a tag de script (o JS entra embutido)
const corpo = html
  .slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .trim();

// Na página autossuficiente o <title> também é o que aparece na busca, então
// vale a frase inteira. Na versão de miolo ele é só o nome do app.
const tituloPagina = 'Giro — gestão financeira para entregadores e motoristas de app';
const descricao = 'Descubra quanto sobra de verdade de cada corrida: custo por quilômetro, ponto de equilíbrio, calculadora de corrida e dicas de gestão financeira para entregadores e motoristas de aplicativo.';

const cabeca = (titulo) => `<title>${titulo}</title>
<link rel="stylesheet" href="${FONTE}">
<style>
${css}</style>`;

const conteudo = `${corpo}

<script type="module">
${js}</script>`;

const miolo = (titulo) => `${cabeca(titulo)}\n\n${conteudo}`;

const paginaCompleta = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="${descricao}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#f2f2f0" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#101215" media="(prefers-color-scheme: dark)">
<meta name="format-detection" content="telephone=no">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='6' fill='%232a78d6'/%3E%3Cg fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='12' cy='12' r='6.5'/%3E%3Ccircle cx='12' cy='12' r='1.8'/%3E%3C/g%3E%3C/svg%3E">
${cabeca(tituloPagina)}
</head>
<body>
${conteudo}
</body>
</html>
`;

await mkdir(p('dist'), { recursive: true });
await writeFile(p('dist/giro.html'), paginaCompleta, 'utf8');
await writeFile(p('dist/giro.body.html'), miolo('Giro') + '\n', 'utf8');

const kb = (t) => (Buffer.byteLength(t, 'utf8') / 1024).toFixed(0);
console.log(`dist/giro.html       ${kb(paginaCompleta)} KB`);
console.log(`dist/giro.body.html  ${kb(miolo('Giro'))} KB   (CSS ${kb(css)} KB · JS ${kb(js)} KB)`);
