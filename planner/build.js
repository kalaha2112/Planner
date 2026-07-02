#!/usr/bin/env node
/* ============================================================
   build.js — bundle the planner into a single standalone.html
   ------------------------------------------------------------
   Inlines vendor/leaflet (css+js), styles.css and app.js into
   the structure of index.html, producing standalone.html — one
   file you can open by double-clicking (no server, no relative
   files). It is a GENERATED artifact: edit the sources, not
   standalone.html, and re-run this script.

   Usage:
     node build.js            one-shot build
     node build.js --watch    rebuild on every source save

   (Map tiles + address geocoding still need an internet
   connection; offline, the route still draws as vector pins.)
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const OUT = path.join(DIR, 'standalone.html');
const SOURCES = ['index.html', 'styles.css', 'app.js', 'vendor/leaflet/leaflet.css', 'vendor/leaflet/leaflet.js', 'vendor/topojson/topojson.min.js', 'vendor/topojson/countries-110m.json'];

const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

function build() {
  let html = read('index.html');
  const leafletCss = read('vendor/leaflet/leaflet.css');
  const leafletJs = read('vendor/leaflet/leaflet.js');
  const topojsonJs = read('vendor/topojson/topojson.min.js');
  const worldAtlas = read('vendor/topojson/countries-110m.json');
  const styles = read('styles.css');
  const app = read('app.js');

  // NOTE: use FUNCTION replacements — a string replacement would interpret
  // `$&`, `$1`, `$$` etc., which the inlined JS/CSS contains in abundance
  // (template literals `${...}`, regex), corrupting the output.
  // 1) Leaflet CSS <link> → inline <style>
  html = html.replace(
    /<link rel="stylesheet" href="vendor\/leaflet\/leaflet\.css">/,
    () => `<style>\n/* vendor/leaflet/leaflet.css */\n${leafletCss}\n</style>`
  );
  // 2) Leaflet JS <script src> → inline <script>
  html = html.replace(
    /<script src="vendor\/leaflet\/leaflet\.js"><\/script>/,
    () => `<script>\n/* vendor/leaflet/leaflet.js */\n${leafletJs}\n</script>`
  );
  // 3) TopoJSON client + world atlas — both inlined, zero network dependency
  html = html.replace(
    /<script src="vendor\/topojson\/topojson\.min\.js"><\/script>/,
    () => `<script>\n/* vendor/topojson/topojson.min.js */\n${topojsonJs}\n</script>\n<script>window.WORLD_ATLAS_DATA=${worldAtlas};</script>`
  );
  // 4) styles.css <link> (with optional ?v=) → inline <style>
  html = html.replace(
    /<link rel="stylesheet" href="styles\.css(?:\?v=\d+)?">/,
    () => `<style>\n/* styles.css */\n${styles}\n</style>`
  );
  // 5) app.js <script src> (with optional ?v=) → inline <script>
  html = html.replace(
    /<script src="app\.js(?:\?v=\d+)?"><\/script>/,
    () => `<script>\n/* app.js */\n${app}\n</script>`
  );
  // 6) PWA wiring is meaningless on file:// (no manifest fetch, no service
  //    worker, icon paths won't travel with the single file) — strip both blocks
  html = html.replace(/[ \t]*<!-- PWA: installable app[\s\S]*?<link rel="apple-touch-icon"[^>]*>\n/, '');
  html = html.replace(/[ \t]*<!-- PWA: offline cache[\s\S]*?<\/script>\n/, '');

  const banner = `<!--\n  GENERATED FILE — do not edit by hand.\n  Built from index.html + styles.css + app.js + vendor/leaflet + vendor/topojson by build.js.\n  Edit those sources and re-run:  node build.js   (or: node build.js --watch)\n  Built: ${new Date().toISOString()}\n-->\n`;
  html = html.replace(/^<!DOCTYPE html>/i, `<!DOCTYPE html>\n${banner}`);

  // sanity: every external app/style/leaflet ref should now be inlined
  const leftovers = (html.match(/href="(styles\.css|vendor\/leaflet\/leaflet\.css)/g) || [])
    .concat(html.match(/src="(app\.js|vendor\/leaflet\/leaflet\.js|vendor\/topojson\/topojson\.min\.js)/g) || []);
  if (leftovers.length) {
    console.error('⚠ build: some references were not inlined:', leftovers.join(', '));
    process.exitCode = 1;
  }

  fs.writeFileSync(OUT, html);
  const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
  console.log(`✓ built standalone.html (${kb} KB) at ${new Date().toLocaleTimeString()}`);
}

function watch() {
  build();
  console.log('… watching for changes (Ctrl-C to stop)');
  let timer = null;
  const rebuild = () => { clearTimeout(timer); timer = setTimeout(() => { try { build(); } catch (e) { console.error('build error:', e.message); } }, 120); };
  for (const rel of SOURCES) {
    try { fs.watch(path.join(DIR, rel), rebuild); } catch (e) { /* file may be absent; ignore */ }
  }
}

if (process.argv.includes('--watch')) watch();
else build();
