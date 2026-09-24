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

export function renderPitch(lead, siteUrl, kit) {
  const first = lead.businessName.split(' ')[0];
  return `Hey ${first} — built a quick one-tap-to-call page for ${lead.businessName}: ${siteUrl}\nTakes one look and one tap to reach you at ${normalizePhone(lead.phone).display}. Want me to point your Google listing at it?`;
}
