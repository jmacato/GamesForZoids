import { readFileSync } from 'node:fs';

const path = new URL('../site/index.html', import.meta.url);
const html = readFileSync(path, 'utf8');
const frames = [];
for (const match of html.matchAll(/<template id="(feature-frame-[^"]+)">([\s\S]*?)<\/template>/g)) frames.push([match[1], match[2]]);
for (const match of html.matchAll(/<svg class="(section-frame[^"]*)"[\s\S]*?<\/svg>/g)) frames.push([match[1], match[0]]);
for (const match of html.matchAll(/<svg class="(language-chevrons)"[\s\S]*?<\/svg>/g)) frames.push([match[1], match[0]]);
for (const match of html.matchAll(/<h2 id="patcher-title"[\s\S]*?<\/svg>/g)) frames.push(['patcher-title', match[0]]);

const problems = [];
function add(name, message) {
  problems.push(`${name}: ${message}`);
}

for (const [name, body] of frames) {
  const segments = [];
  for (const match of body.matchAll(/ d="([^"]+)"/g)) {
    const local = [];
    const push = (a, b) => {
      if (a[0] === b[0] && a[1] === b[1]) return;
      local.push([a, b]);
      segments.push([a, b]);
    };
    const tokens = match[1].match(/[MLZ]|-?\d+(?:\.\d+)?/g) ?? [];
    let x = 0;
    let y = 0;
    let start = true;
    let command = 'M';
    const points = [];
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index];
      if (/[MLZ]/.test(token)) {
        command = token;
        if (command === 'Z') points.push(points[0]);
        if (command === 'Z') {
          for (let i = 0; i + 1 < points.length; i++) push(points[i], points[i + 1]);
          points.length = 0;
          start = true;
        }
        continue;
      }
      const nextX = Number(token);
      const nextY = Number(tokens[++index]);
      if (!Number.isInteger(nextX) || !Number.isInteger(nextY)) add(name, `fractional vertex ${nextX},${nextY}`);
      if (command === 'M' && start) {
        x = nextX;
        y = nextY;
        points.push([x, y]);
        start = false;
        continue;
      }
      const dx = nextX - x;
      const dy = nextY - y;
      if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) add(name, `segment ${x},${y} -> ${nextX},${nextY} is not horizontal, vertical or 45 degrees`);
      x = nextX;
      y = nextY;
      points.push([x, y]);
    }
    if (points.length > 1) {
      for (let i = 0; i + 1 < points.length; i++) push(points[i], points[i + 1]);
    }
    const side = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    for (let i = 0; i < local.length; i++) {
      for (let j = i + 1; j < local.length; j++) {
        const [a1, a2] = local[i];
        const [b1, b2] = local[j];
        const shares = (p, q) => p[0] === q[0] && p[1] === q[1];
        if (shares(a1, b1) || shares(a1, b2) || shares(a2, b1) || shares(a2, b2)) continue;
        if (side(a1, a2, b1) * side(a1, a2, b2) < 0 && side(b1, b2, a1) * side(b1, b2, a2) < 0) {
          add(name, `segments ${a1}->${a2} and ${b1}->${b2} cross`);
        }
      }
    }
  }

  for (let index = segments.length - 1; index >= 0; index--) {
    const [a, b] = segments[index];
    if (a[0] === b[0] && a[1] === b[1]) segments.splice(index, 1);
  }

  const overlap = (a, b) => Math.max(Math.min(a[0], a[1]), Math.min(b[0], b[1])) < Math.min(Math.max(a[0], a[1]), Math.max(b[0], b[1]));
  const shared = (a, b) => a[0] === b[0] && a[1] === b[1];
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const [a1, a2] = segments[i];
      const [b1, b2] = segments[j];
      if (shared(a1, b1) || shared(a1, b2) || shared(a2, b1) || shared(a2, b2)) continue;
      const vertical = a2[0] === a1[0] && b2[0] === b1[0];
      const horizontal = a2[1] === a1[1] && b2[1] === b1[1];
      const diagonal = !vertical && !horizontal && !(b2[0] === b1[0] || b2[1] === b1[1]) &&
        Math.abs(Math.abs(a2[0] - a1[0]) - Math.abs(a2[1] - a1[1])) === 0 &&
        Math.abs(Math.abs(b2[0] - b1[0]) - Math.abs(b2[1] - b1[1])) === 0;
      let distance;
      if (vertical) distance = Math.abs(a1[0] - b1[0]);
      else if (horizontal) distance = Math.abs(a1[1] - b1[1]);
      else if (diagonal) {
        const slopeA = Math.sign((a2[0] - a1[0]) * (a2[1] - a1[1]));
        const slopeB = Math.sign((b2[0] - b1[0]) * (b2[1] - b1[1]));
        if (slopeA !== slopeB) continue;
        const line = point => slopeA > 0 ? point[1] - point[0] : point[1] + point[0];
        distance = Math.abs(line(a1) - line(b1));
      } else continue;
      if (!overlap([a1[0], a2[0]], [b1[0], b2[0]]) && !overlap([a1[1], a2[1]], [b1[1], b2[1]])) continue;
      if (distance < 2) add(name, `parallel edges ${a1}->${a2} and ${b1}->${b2} are ${distance} units apart`);
    }
  }
}

console.log(`${frames.length} frame drawings checked`);
for (const problem of problems) console.log(problem);
if (problems.length) process.exit(1);
