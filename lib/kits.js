// Industry kits for OneJob Site Factory.
//
// To add a new trade: append one object to KITS below. Nothing else in the
// pipeline needs to change — the Leads table's industry auto-detect, the
// hero picker, and the build step all read from this list.
//
// - key: matches the folder name under hero-library/by-industry/<key>/
// - match: lowercase strings checked against the lead's `industry` field
//   (and, as a fallback, the lead's notes) to auto-detect this kit
// - industryLabel: short label used in the page title/kicker (e.g. "Electrician")
// - accent: default hex accent color (per-lead override is allowed)
// - tagline: used in <meta description>
// - painSeeds: short pain-point phrases the headline/body generator pulls from
// - services: chips shown in "What we handle"
// - whyPoints: 3 short trust bullets for "Why <city> calls <business>"

export const KITS = [
  {
    key: 'electrical',
    match: ['electric', 'electrician', 'electrical'],
    industryLabel: 'Electrician',
    accent: '#FFD000',
    tagline: 'Licensed electrical work, one tap away.',
    painSeeds: [
      'Breakers popping? Kill the guesswork.',
      'Lights flickering, outlets dead — stop guessing and call.',
      'Panel smells hot or the house goes dark — this is who you call.',
    ],
    services: ['Panel & breakers', 'Outlets & lighting', 'Storm damage', 'EV / generator', 'Inspections'],
    whyPoints: [
      "Electrical problems don't wait for a quote form",
      'Licensed work, not a YouTube DIY loop',
      'The fastest path to a ringing phone is a giant call button',
    ],
  },
  {
    key: 'locksmith',
    match: ['lock', 'locksmith', 'security'],
    industryLabel: 'Locksmith',
    accent: '#FFD000',
    tagline: 'Locked out? One call, one tap.',
    painSeeds: [
      'Locked out right now? Stop searching, start calling.',
      'Lost your keys or the lock stopped turning — call now.',
      'Break-in, lockout, or a lock that just quit — this is who you call.',
    ],
    services: ['Lockouts', 'Rekeys', 'Broken keys', 'Commercial locks', 'Security upgrades'],
    whyPoints: [
      "A lockout doesn't wait for a callback tomorrow",
      'Local, licensed, and already close by',
      'One tap gets a real locksmith, not a call center',
    ],
  },
  {
    key: 'plumbing',
    match: ['plumb', 'plumbing', 'plumber', 'drain', 'pipe'],
    industryLabel: 'Plumber',
    accent: '#FFD000',
    tagline: 'Leaks and clogs handled fast.',
    painSeeds: [
      'Water where it shouldn\u2019t be? Stop it before it spreads.',
      'Clogged drain or a leak that won\u2019t quit — call now.',
      'Burst pipe or backed-up drain — this is who you call.',
    ],
    services: ['Leaks & pipes', 'Drain clogs', 'Water heaters', 'Fixture install', 'Emergency calls'],
    whyPoints: [
      'A leak gets worse every hour it waits',
      'Local plumbers who show up, not a dispatch queue',
      'One tap and the water stops being your problem',
    ],
  },
  {
    key: 'hvac',
    match: ['hvac', 'heating', 'cooling', 'air condition', 'ac repair'],
    industryLabel: 'HVAC',
    accent: '#FFD000',
    tagline: 'AC down? Get cool again, fast.',
    painSeeds: [
      'AC down in this heat? Don\u2019t sweat it out.',
      'Furnace quit or the AC won\u2019t kick on — call now.',
      'No cold air, no heat — this is who you call.',
    ],
    services: ['AC repair', 'Heating repair', 'Tune-ups', 'New install', 'Emergency calls'],
    whyPoints: [
      'A dead unit is worse the longer it waits',
      'Local techs who actually answer',
      'One tap beats an online scheduling maze',
    ],
  },
  {
    key: 'handyman',
    match: ['handyman', 'repair', 'maintenance', 'general contractor'],
    industryLabel: 'Handyman',
    accent: '#FFD000',
    tagline: 'The fix-it list, finally handled.',
    painSeeds: [
      'That fix-it list isn\u2019t getting shorter on its own.',
      'Small job, big hassle finding someone reliable — call now.',
      'One project or a whole list — this is who you call.',
    ],
    services: ['Repairs', 'Install & mount', 'Drywall & paint', 'Punch lists', 'Small remodels'],
    whyPoints: [
      'Small jobs deserve a real answer, not a no-show',
      'One local pro instead of three app quotes',
      'One tap and it\u2019s on the schedule',
    ],
  },
];

export function findKit(industryRaw, notes) {
  const industry = (industryRaw || '').toLowerCase().trim();
  const haystack = `${industry} ${(notes || '').toLowerCase()}`;
  return (
    KITS.find((k) => k.key === industry) ||
    KITS.find((k) => k.match.some((m) => haystack.includes(m))) ||
    null
  );
}

export function getKit(key) {
  return KITS.find((k) => k.key === key) || null;
}
