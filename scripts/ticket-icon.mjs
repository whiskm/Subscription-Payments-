// Writes a square app icon with the ticket at a given size. The ticket is drawn
// once in its own 320×212 coordinates and scaled, so every variant matches.
// Usage: node scripts/ticket-icon.mjs <scale> <out.svg> [--rounded] [--shadow]
import { writeFileSync } from 'node:fs';

const [scaleArg, out, ...flags] = process.argv.slice(2);
const k = Number(scaleArg);
if (!k || !out) throw new Error('usage: ticket-icon.mjs <scale> <out.svg> [--rounded]');
const rounded = flags.includes('--rounded');
// A drop shadow shows through the notches as a dark crescent, so it is off by default.
const shadow = flags.includes('--shadow');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <mask id="t" maskUnits="userSpaceOnUse" x="-40" y="-40" width="420" height="320">
      <rect x="-40" y="-40" width="420" height="320" fill="#fff"/>
      <circle cx="222" cy="0" r="20" fill="#000"/>
      <circle cx="222" cy="212" r="20" fill="#000"/>
    </mask>
    <!-- The shadow gets the same notches, or it would show through them. -->
    <mask id="s" maskUnits="userSpaceOnUse" x="-40" y="-40" width="420" height="320">
      <rect x="-40" y="-40" width="420" height="320" fill="#fff"/>
      <circle cx="228" cy="14" r="20" fill="#000"/>
      <circle cx="228" cy="226" r="20" fill="#000"/>
    </mask>
  </defs>
  <rect width="512" height="512"${rounded ? ' rx="112"' : ''} fill="#E4572E"/>
  <g transform="translate(256 256) rotate(-8) scale(${k}) translate(-160 -106)">
${shadow ? '    <rect x="6" y="14" width="320" height="212" rx="30" fill="#1B1915" opacity=".2" mask="url(#s)"/>\n' : ''}    <rect width="320" height="212" rx="30" fill="#FAF6EC" mask="url(#t)"/>
    <path d="M222 32v148" stroke="#1B1915" stroke-width="7" stroke-linecap="round" stroke-dasharray="1 17"/>
    <rect x="36" y="40" width="58" height="58" rx="16" fill="#1B1915"/>
    <rect x="36" y="122" width="148" height="16" rx="8" fill="#1B1915" opacity=".85"/>
    <rect x="36" y="154" width="96" height="16" rx="8" fill="#1B1915" opacity=".35"/>
    <text x="271" y="132" text-anchor="middle" font-family="Unbounded, Arial Black, sans-serif" font-weight="800" font-size="92" fill="#E4572E">7</text>
  </g>
</svg>
`;
writeFileSync(out, svg);
