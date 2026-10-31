export const SUBTERRANEAN_RELICS = [
  {
    id: 'relic-seed',
    name: 'The Fossilized Folio Seed',
    milestone: '1 Book Milestone',
    seal: '🌱',
    tier: 0,
    baseCx: 500,
    baseCy: 1010,
    viewBox: '445 960 110 100',
    threshold: 1,
    thresholdLabel: 'Read 1 book',
    clue: 'A golden amber nodule glows near the taproot, encasing a petrified leaf with primordial ink. Read 1 book to awaken the seed.',
    lore: 'Your first book completed! From this prehistoric fossilized seed, the entire Reading Tree draws its ancient life.',
    art: `
      <path d="M 500,970 C 532,970 538,1005 532,1035 C 526,1055 474,1055 468,1035 C 462,1005 468,970 500,970 Z" fill="#d97706" fill-opacity="0.88" stroke="#78350f" stroke-width="2.0" stroke-linejoin="round"/>
      <path d="M 500,976 C 524,976 528,1005 524,1030 C 520,1048 480,1048 476,1030 C 472,1005 476,976 500,976 Z" fill="#f59e0b" fill-opacity="0.75"/>
      <path d="M 478,985 C 484,978 495,975 506,975" fill="none" stroke="#fef08a" stroke-width="2.2" stroke-linecap="round" opacity="0.85"/>
      <path d="M 500,1040 C 498,1015 500,995 500,985" fill="none" stroke="#78350f" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M 500,1025 C 490,1020 484,1015 482,1008 C 488,1006 496,1014 500,1018" fill="#fef08a" stroke="#b45309" stroke-width="1.1"/>
      <path d="M 500,1020 C 510,1015 516,1010 518,1003 C 512,1001 504,1009 500,1013" fill="#fef08a" stroke="#b45309" stroke-width="1.1"/>
      <path d="M 500,1005 C 492,1000 488,996 487,990 C 493,989 498,995 500,999" fill="#ffffff" stroke="#b45309" stroke-width="1.1"/>
      <path d="M 500,1001 C 508,996 512,992 513,986 C 507,985 502,991 500,995" fill="#ffffff" stroke="#b45309" stroke-width="1.1"/>
      <circle cx="512" cy="1022" r="1.8" fill="#fef08a" opacity="0.9"/>
      <circle cx="488" cy="1030" r="1.4" fill="#fef08a" opacity="0.8"/>
      <circle cx="508" cy="992" r="1.2" fill="#ffffff" opacity="0.95"/>
    `
  },
  {
    id: 'relic-nautilus',
    name: 'The Nautilus of Alexandria',
    milestone: '3 Books Milestone',
    seal: '🐚',
    tier: 1,
    baseCx: 500,
    baseCy: 1280,
    viewBox: '450 1235 105 95',
    threshold: 3,
    thresholdLabel: 'Read 3 books',
    clue: 'A spiraling clockwork ammonite shell rests in the subsoil strata. Read 3 books this year to wind its gears.',
    lore: '3 books finished! A miraculous clockwork cephalopod from the submerged shelves of Alexandria, calculating reading cycles in golden ratio spirals.',
    art: `
      <path d="M 460,1292 C 455,1250 495,1242 525,1250 C 545,1256 552,1275 550,1295 C 548,1315 530,1325 505,1322 C 480,1320 465,1308 460,1292 Z" fill="#e2e8f0" stroke="#475569" stroke-width="2.0"/>
      <path d="M 500,1285 C 475,1275 465,1260 475,1248" fill="none" stroke="#d4af37" stroke-width="1.6"/>
      <path d="M 500,1285 C 490,1265 498,1250 515,1250" fill="none" stroke="#d4af37" stroke-width="1.6"/>
      <path d="M 500,1285 C 515,1268 532,1268 542,1278" fill="none" stroke="#d4af37" stroke-width="1.6"/>
      <path d="M 500,1285 C 525,1285 540,1295 545,1308" fill="none" stroke="#d4af37" stroke-width="1.6"/>
      <path d="M 500,1285 C 515,1305 518,1318 505,1322" fill="none" stroke="#d4af37" stroke-width="1.6"/>
      <circle cx="496" cy="1285" r="15" fill="#1e293b" stroke="#d4af37" stroke-width="1.5"/>
      <rect x="493.5" y="1267" width="5" height="36" rx="1" fill="#f59e0b"/>
      <rect x="478" y="1282.5" width="36" height="5" rx="1" fill="#f59e0b"/>
      <rect x="483" y="1272" width="26" height="26" rx="1" transform="rotate(45 496 1285)" fill="#d97706"/>
      <circle cx="496" cy="1285" r="7" fill="#b45309" stroke="#fbbf24" stroke-width="1.2"/>
      <circle cx="496" cy="1285" r="3" fill="#ef4444"/>
    `
  },
  {
    id: 'relic-astrolabe',
    name: 'The Nocturnal Astrolabe',
    milestone: '6 Books Milestone',
    seal: '🌌',
    tier: 2,
    baseCx: 500,
    baseCy: 1590,
    viewBox: '455 1535 90 100',
    threshold: 6,
    thresholdLabel: 'Read 6 books',
    clue: 'Deep in the sedimentary clay, an ancient celestial navigation disc waits in silence. Read 6 books to align its rings with the stars.',
    lore: '6 books explored! A masterwork bronze and lapis lazuli astrolabe, charting constellations of myth and literature far beneath the surface.',
    art: `
      <circle cx="500" cy="1542" r="7.5" fill="none" stroke="#d4af37" stroke-width="2.6"/>
      <path d="M 492,1549 L 508,1549 L 513,1555 L 487,1555 Z" fill="#78350f" stroke="#451a03" stroke-width="1.2"/>
      <circle cx="500" cy="1590" r="38" fill="#3b1d0e" stroke="#d4af37" stroke-width="3.2"/>
      <circle cx="500" cy="1590" r="32" fill="none" stroke="#fbbf24" stroke-width="1.2" stroke-dasharray="2 3"/>
      <circle cx="500" cy="1590" r="28" fill="#1e1b4b"/>
      <circle cx="493" cy="1584" r="16" fill="none" stroke="#fbbf24" stroke-width="1.4" opacity="0.9"/>
      <path d="M 478,1600 C 490,1594 506,1600 520,1588" fill="none" stroke="#d4af37" stroke-width="1.3"/>
      <polygon points="493,1568 491,1573 495,1573" fill="#fbbf24"/>
      <polygon points="518,1588 514,1585 515,1590" fill="#fbbf24"/>
      <polygon points="478,1600 482,1603 481,1598" fill="#fbbf24"/>
      <line x1="466" y1="1590" x2="534" y2="1590" stroke="#78350f" stroke-width="1.2"/>
      <line x1="500" y1="1556" x2="500" y2="1624" stroke="#78350f" stroke-width="1.2"/>
      <line x1="478" y1="1612" x2="522" y2="1568" stroke="#fef08a" stroke-width="3.0" stroke-linecap="round"/>
      <circle cx="500" cy="1590" r="4.5" fill="#451a03" stroke="#fbbf24" stroke-width="1.6"/>
    `
  },
  {
    id: 'relic-lantern',
    name: 'The Scriptorium Lantern',
    milestone: '12 Books Milestone (1 Book a Month!)',
    seal: '🏮',
    tier: 3,
    baseCx: 500,
    baseCy: 1930,
    viewBox: '465 1873 70 100',
    threshold: 12,
    thresholdLabel: 'Read 12 books (1 book a month)',
    clue: 'Suspended in a bedrock cavern, a gothic iron & faceted quartz lantern flickers. Achieve 12 books, one for each month, to kindle its perpetual flame.',
    lore: '12 books achieved: a full book for every month of the year! The ancient Scriptorium Lantern blazes with trapped bioluminescent embers, illuminating subterranean depths.',
    art: `
      <circle cx="500" cy="1880" r="7.0" fill="none" stroke="#d4af37" stroke-width="2.6"/>
      <path d="M 494,1887 L 506,1887 L 512,1894 L 488,1894 Z" fill="#78350f" stroke="#3b1d0e" stroke-width="1.2"/>
      <path d="M 482,1894 L 518,1894 L 526,1904 L 474,1904 Z" fill="#451a03" stroke="#d4af37" stroke-width="1.5"/>
      <circle cx="493" cy="1900" r="1.6" fill="#fbbf24"/>
      <circle cx="500" cy="1899" r="1.6" fill="#fbbf24"/>
      <circle cx="507" cy="1900" r="1.6" fill="#fbbf24"/>
      <rect x="474" y="1904" width="52" height="48" rx="2" fill="#0f172a" stroke="#d4af37" stroke-width="2.0"/>
      <line x1="491" y1="1904" x2="491" y2="1952" stroke="#d4af37" stroke-width="1.6"/>
      <line x1="509" y1="1904" x2="509" y2="1952" stroke="#d4af37" stroke-width="1.6"/>
      <ellipse cx="500" cy="1928" rx="18" ry="16" fill="#f59e0b" fill-opacity="0.35"/>
      <circle cx="500" cy="1928" r="9" fill="#ffedd5" fill-opacity="0.95"/>
      <circle cx="498" cy="1924" r="4.5" fill="#fef08a"/>
      <circle cx="484" cy="1922" r="1.8" fill="#fbbf24"/>
      <circle cx="516" cy="1936" r="1.6" fill="#fbbf24"/>
      <circle cx="500" cy="1914" r="1.4" fill="#ffffff"/>
      <path d="M 472,1952 L 528,1952 L 522,1959 L 478,1959 Z" fill="#451a03" stroke="#d4af37" stroke-width="1.4"/>
      <polygon points="500,1968 496,1959 504,1959" fill="#d4af37" stroke="#3b1d0e" stroke-width="1.0"/>
    `
  },
  {
    id: 'relic-heart',
    name: 'The Clockwork Heart of Alexandria',
    milestone: '24 Books Milestone (2 Books a Month)',
    seal: '🫀',
    tier: 4,
    baseCx: 500,
    baseCy: 2290,
    viewBox: '455 2245 90 90',
    threshold: 24,
    thresholdLabel: 'Read 24 books (2 books a month)',
    clue: 'Buried in the deep granite mantle, a crystalline carnelian heart beats in a cage of bronze gears. Read 24 books to awaken its pulse.',
    lore: '24 books read: a dedicated pace of two books a month. The legendary Clockwork Heart pulses with the tireless passion of true bibliophiles.',
    art: `
      <circle cx="500" cy="2290" r="40" fill="none" stroke="#78350f" stroke-width="3.0"/>
      <ellipse cx="500" cy="2290" rx="39" ry="24" transform="rotate(-30 500 2290)" fill="none" stroke="#d4af37" stroke-width="2.0"/>
      <ellipse cx="500" cy="2290" rx="39" ry="24" transform="rotate(30 500 2290)" fill="none" stroke="#fbbf24" stroke-width="1.8"/>
      <circle cx="460" cy="2290" r="3.2" fill="#fbbf24" stroke="#451a03" stroke-width="1.0"/>
      <circle cx="540" cy="2290" r="3.2" fill="#fbbf24" stroke="#451a03" stroke-width="1.0"/>
      <path d="M 500,2308 C 475,2294 466,2275 476,2263 C 486,2251 498,2258 500,2268 C 502,2258 514,2251 524,2263 C 534,2275 525,2294 500,2308 Z" fill="#dc2626" stroke="#450a0a" stroke-width="2.2" stroke-linejoin="round"/>
      <polygon points="500,2270 488,2278 500,2302 512,2278" fill="#ef4444"/>
      <polygon points="500,2270 488,2278 479,2267 493,2261" fill="#f87171"/>
      <polygon points="500,2270 512,2278 521,2267 507,2261" fill="#fca5a5"/>
      <polygon points="500,2302 488,2278 474,2284" fill="#991b1b"/>
      <polygon points="500,2302 512,2278 526,2284" fill="#7f1d1d"/>
      <circle cx="500" cy="2282" r="10" fill="none" stroke="#fef08a" stroke-width="1.4" stroke-dasharray="3 3"/>
      <circle cx="500" cy="2282" r="3" fill="#ffffff"/>
    `
  },
  {
    id: 'relic-obelisk',
    name: 'The Sunken Obelisk of Babel',
    milestone: '36 Books Milestone (3 Books a Month)',
    seal: '🏛️',
    tier: 5,
    baseCx: 500,
    baseCy: 2650,
    viewBox: '460 2588 80 120',
    threshold: 36,
    thresholdLabel: 'Read 36 books (3 books a month)',
    clue: 'A towering obsidian monolith deeply submerged in primeval basalt, covered in glowing runes of lost tongues. Reach 36 books to translate its wisdom.',
    lore: '36 books mastered: an astounding three books a month. The Sunken Obelisk of Babel resonates with the echoes of every lost library in human history.',
    art: `
      <rect x="465" y="2692" width="70" height="12" rx="2" fill="#1e293b" stroke="#0f172a" stroke-width="1.8"/>
      <rect x="473" y="2684" width="54" height="8" rx="1.5" fill="#334155" stroke="#0f172a" stroke-width="1.4"/>
      <polygon points="480,2684 485,2610 515,2610 520,2684" fill="#0f172a" stroke="#d4af37" stroke-width="2.0"/>
      <polygon points="485,2610 500,2592 515,2610" fill="#fbbf24" stroke="#78350f" stroke-width="1.6"/>
      <line x1="494" y1="2620" x2="506" y2="2620" stroke="#fef08a" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="497" y1="2626" x2="503" y2="2626" stroke="#fef08a" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="492" y1="2634" x2="508" y2="2634" stroke="#fef08a" stroke-width="1.8" stroke-linecap="round"/>
      <polygon points="500,2640 496,2646 504,2646" fill="#fef08a"/>
      <line x1="493" y1="2654" x2="507" y2="2654" stroke="#fef08a" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="500" cy="2662" r="2.2" fill="#fef08a"/>
      <line x1="491" y1="2672" x2="509" y2="2672" stroke="#fef08a" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="475" cy="2628" r="1.4" fill="#fcd34d" opacity="0.8"/>
      <circle cx="525" cy="2644" r="1.4" fill="#fcd34d" opacity="0.8"/>
    `
  },
  {
    id: 'relic-orrery',
    name: 'The Celestial Orrery of the Abyss',
    milestone: '52 Books Milestone (1 Book a Week!)',
    seal: '🪐',
    tier: 6,
    baseCx: 500,
    baseCy: 3020,
    viewBox: '445 2975 110 90',
    threshold: 52,
    thresholdLabel: 'Read 52 books (1 book a week!)',
    clue: 'At the ultimate planetary abyss, a celestial apparatus forged of meteoric platinum turns in silent majesty. Complete 52 books, one for every week, to command the cosmos.',
    lore: '52 books conquered: the legendary feat of a book every single week! You have unearthed the Celestial Orrery of the Abyss, master of all knowledge and ruler of the literary spheres.',
    art: `
      <ellipse cx="500" cy="3020" rx="46" ry="18" fill="none" stroke="#94a3b8" stroke-width="2.2"/>
      <ellipse cx="500" cy="3020" rx="46" ry="18" fill="none" stroke="#e2e8f0" stroke-width="1.2" stroke-dasharray="4 4"/>
      <ellipse cx="500" cy="3020" rx="34" ry="32" fill="none" stroke="#d4af37" stroke-width="1.8"/>
      <ellipse cx="500" cy="3020" rx="22" ry="10" transform="rotate(-35 500 3020)" fill="none" stroke="#fbbf24" stroke-width="1.6"/>
      <circle cx="500" cy="3020" r="14" fill="#f59e0b" fill-opacity="0.35"/>
      <circle cx="500" cy="3020" r="9" fill="#fbbf24" stroke="#d97706" stroke-width="1.5"/>
      <circle cx="500" cy="3020" r="5" fill="#fffbeb"/>
      <circle cx="456" cy="3018" r="4.8" fill="#06b6d4" stroke="#083344" stroke-width="1.0"/>
      <circle cx="452" cy="3014" r="1.4" fill="#e0f2fe"/>
      <circle cx="544" cy="3022" r="5.2" fill="#eab308" stroke="#713f12" stroke-width="1.0"/>
      <ellipse cx="544" cy="3022" rx="9" ry="2.8" fill="none" stroke="#fef08a" stroke-width="1.2" transform="rotate(-20 544 3022)"/>
      <circle cx="500" cy="2988" r="4.2" fill="#a855f7" stroke="#3b0764" stroke-width="1.0"/>
      <circle cx="498" cy="2986" r="1.2" fill="#faf5ff"/>
      <circle cx="500" cy="3052" r="4.0" fill="#ef4444" stroke="#450a0a" stroke-width="1.0"/>
      <circle cx="482" cy="3005" r="1.2" fill="#ffffff"/>
      <circle cx="518" cy="3035" r="1.2" fill="#ffffff"/>
    `
  }
];
