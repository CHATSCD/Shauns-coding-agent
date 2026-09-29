import fs from 'fs';
import path from 'path';

let cachedTemplate = null;

function loadTemplate() {
  if (cachedTemplate) return cachedTemplate;
  const templatePath = path.join(process.cwd(), 'master-template', 'index.html');
  cachedTemplate = fs.readFileSync(templatePath, 'utf8');
  return cachedTemplate;
}

export function slugify(businessName) {
  return businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'onejob-site';
}

export function normalizePhone(phoneRaw) {
  const digits = (phoneRaw || '').replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (ten.length !== 10) {
    return { display: phoneRaw || '', tel: digits ? `+1${digits}` : '' };
  }
  const display = `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
  return { display, tel: `+1${ten}` };
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function pickHeadline(kit, notes) {
  const seeds = kit.painSeeds || [];
  if (!seeds.length) return kit.tagline;
  if (notes) {
    // deterministic-but-varied pick so re-runs on the same lead don't reshuffle
    let hash = 0;
    for (const ch of notes) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return seeds[hash % seeds.length];
  }
  return seeds[0];
}

function renderServices(kit) {
  return kit.services
    .map(
      (s) =>
        `<div class="service-chip"><span>${escapeHtml(s)}</span><span class="mini-call">Call</span></div>`
    )
    .join('\n      ');
}

function renderWhyPoints(kit) {
  return kit.whyPoints
    .map((p) => `<div class="why-item"><div class="dot"></div><p>${escapeHtml(p)}</p></div>`)
    .join('\n      ');
}

/**
 * Fill the locked master template for one lead.
 * @param {object} lead - { businessName, phone, industry, city, state, notes }
 * @param {object} kit - a kit object from lib/kits.js
 * @param {object} opts - { heroFileName, accent }
 * @returns {{ html: string, slug: string, tel: string, phoneDisplay: string }}
 */
export function renderSite(lead, kit, opts = {}) {
  const { display: phoneDisplay, tel } = normalizePhone(lead.phone);
  const accent = opts.accent || kit.accent || '#FFD000';
  const headline = pickHeadline(kit, lead.notes);
  const body = kit.tagline;

  let html = loadTemplate();
  const slots = {
    businessName: escapeHtml(lead.businessName),
    phone: escapeHtml(phoneDisplay),
    tel,
    city: escapeHtml(lead.city),
    state: escapeHtml(lead.state),
    tagline: escapeHtml(kit.tagline),
    headline: escapeHtml(headline),
    body: escapeHtml(body),
    accent,
    industryLabel: escapeHtml(kit.industryLabel),
    services: renderServices(kit),
    whyPoints: renderWhyPoints(kit),
  };

  for (const [key, value] of Object.entries(slots)) {
    html = html.split(`{{${key}}}`).join(value);
  }

  return {
    html,
    slug: slugify(lead.businessName),
    tel,
    phoneDisplay,
    headline,
  };
}

const TRADE_NEEDS = {
  electrical: 'an electrician',
  locksmith: 'a locksmith',
  plumbing: 'a plumber',
  hvac: 'heating or AC help',
  handyman: 'a handyman',
  landscaping: 'yard help',
};

function cleanFirstName(raw) {
  if (!raw) return '';
  const word = String(raw).trim().split(/\s+/)[0] || '';
  const cleaned = word.replace(/[^A-Za-z'\-.]/g, '').replace(/[.'\-]+$/, '');
  // skip initials-only / lowercase junk ("M", "the")
  if (cleaned.length < 2 || !/^[A-Z]/.test(cleaned)) return '';
  return cleaned;
}

/** Owner first name from explicit lead fields, else from notes patterns. */
export function ownerFirstName(lead = {}) {
  const explicit = lead.ownerName || lead.owner || lead.owner_name || lead.ownername;
  const fromField = cleanFirstName(explicit);
  if (fromField) return fromField;

  const notes = String(lead.notes || '');
  const patterns = [
    /owner[-\s]+(?:run|operated)\s+by\s+([A-Z][a-zA-Z'\-]+)/i,
    /family[-\s]+owned\s+by\s+([A-Z][a-zA-Z'\-]+)/i,
    /owned\s+(?:and\s+operated\s+)?by\s+([A-Z][a-zA-Z'\-]+)/i,
    /\b[Oo]wner(?:\s+is|:)?\s+([A-Z][a-zA-Z'\-]+)/,
  ];
  for (const re of patterns) {
    const m = notes.match(re);
    if (m) {
      const name = cleanFirstName(m[1]);
      if (name && !/^(run|operated|by|and|the|is)$/i.test(name)) return name;
    }
  }
  return '';
}

export function pitchBusinessName(name) {
  return String(name || '')
    .trim()
    .replace(/,?\s+(Inc\.?|LLC\.?|L\.L\.C\.|Company|Co\.)$/i, '')
    .trim();
}

export function renderPitch(lead, siteUrl, kit) {
  const first = ownerFirstName(lead);
  const greeting = first ? `Hey ${first}` : 'Hey there';
  const biz = pitchBusinessName(lead.businessName);
  const phone = normalizePhone(lead.phone).display;
  const need = (kit && TRADE_NEEDS[kit.key]) || (lead.industry ? `${String(lead.industry).toLowerCase()} help` : '');
  const city = String(lead.city || '').trim();
  const who = city ? `folks in ${city}` : 'folks nearby';
  const whoNeeds = need ? `${who} who need ${need}` : who;
  return `${greeting}, I built a quick one-tap-to-call page for ${biz}: ${siteUrl}. It takes one look and one tap for ${whoNeeds} to reach you at ${phone}. Want me to point your Google listing at it?`;
}
