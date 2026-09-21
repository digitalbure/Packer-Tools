#!/usr/bin/env node
/**
 * Flags hype and filler words in user-facing copy. See docs/copy-standard.md.
 * Usage: node scripts/check-copy.mjs [dir ...]   (default: the modules that already follow the standard)
 * Add --all to scan all of src/ and report totals per file (informational, exits 0).
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const all = args.includes('--all');
const roots = args.filter(a => !a.startsWith('--'));
const targets = all ? ['src'] : roots.length ? roots : ['src/labels', 'src/components/landing', 'src/pages/HomePage.tsx', 'src/pages/LabelStudio.tsx'];

const BANNED = [
  'seamless', 'seamlessly', 'supercharge', 'unlock', 'revolutioniz', 'cutting-edge', 'next-gen', 'state-of-the-art', 'world-class',
  'game-chang', 'effortless', 'leverage', 'empower', 'elevate', 'robust', 'holistic', 'synerg', 'streamline', 'turnkey',
  'best-in-class', 'blazing', 'magic', 'delight', 'enterprise-grade', 'industrial-grade', 'mission-critical', 'ai-powered',
  'sandbox', 'simulated', 'simulate ', 'mock', 'lorem', 'placeholder text',
];
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function* files(p) {
  const st = fs.statSync(p);
  if (st.isFile()) { if (/\.(tsx?|css)$/.test(p) && !p.endsWith('.d.ts')) yield p; return; }
  for (const f of fs.readdirSync(p)) if (f !== 'node_modules') yield* files(path.join(p, f));
}

let total = 0;
const perFile = [];
for (const t of targets) {
  if (!fs.existsSync(t)) continue;
  for (const f of files(t)) {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    let n = 0;
    lines.forEach((line, i) => {
      // only look at text a person could read: string literals and JSX text
      if (!/["'`>]/.test(line) || /^\s*(import|\/\/|\*)/.test(line)) return;
      const hit = BANNED.find(w => new RegExp('\\b' + w.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(line)) || (EMOJI.test(line) ? 'emoji' : null);
      if (hit) { n++; if (!all) console.log(`${f}:${i + 1}: "${hit}"  ${line.trim().slice(0, 100)}`); }
    });
    if (n) perFile.push([n, f]);
    total += n;
  }
}
if (all) {
  perFile.sort((a, b) => b[0] - a[0]);
  console.log(`Files with flagged copy: ${perFile.length}, lines: ${total}\n`);
  perFile.slice(0, 25).forEach(([n, f]) => console.log(String(n).padStart(4), f));
  process.exit(0);
}
console.log(total ? `\n${total} line(s) need plain wording.` : 'Copy check passed.');
process.exit(total ? 1 : 0);
