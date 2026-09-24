import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { findKit, getKit } from '@/lib/kits';
import { renderSite, renderPitch, slugify } from '@/lib/renderTemplate';
import { deployStaticSite, uniqueSlug } from '@/lib/vercel';

const HERO_ROOT = path.join(process.cwd(), 'hero-library', 'by-industry');
const OUT_ROOT = process.env.VERCEL ? path.join('/tmp', 'out') : path.join(process.cwd(), 'out');

function listHeroes(industryKey) {
  const dir = path.join(HERO_ROOT, industryKey);
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.webp'))
      .sort();
  } catch {
    return [];
  }
}

function pickHero(kitKey, overrideFileName) {
  const heroes = listHeroes(kitKey);
  if (overrideFileName && heroes.includes(overrideFileName)) {
    return { fileName: overrideFileName, buffer: fs.readFileSync(path.join(HERO_ROOT, kitKey, overrideFileName)) };
  }
  if (heroes.length) {
    return { fileName: heroes[0], buffer: fs.readFileSync(path.join(HERO_ROOT, kitKey, heroes[0])) };
  }
  return null;
}

// Processes one lead row end to end: resolve kit, resolve hero, render the
// locked template, then either write to out/<slug>/ (dry run) or deploy it
// as its own Vercel project on team shauns.
async function buildOne(lead, rowOpts, dryRun) {
  const kit = rowOpts.kitKey ? getKit(rowOpts.kitKey) : findKit(lead.industry, lead.notes);
  if (!kit) {
    return {
      businessName: lead.businessName,
      ok: false,
      error: `No kit matched industry "${lead.industry}". Pass kitKey explicitly or add a kit to lib/kits.js.`,
    };
  }

  const hero = pickHero(kit.key, rowOpts.heroFileName);
  if (!hero) {
    return {
      businessName: lead.businessName,
      ok: false,
      error: `No hero images found under hero-library/by-industry/${kit.key}/. Upload one first.`,
    };
  }

  const { html, slug: baseSlug } = renderSite(lead, kit, { accent: rowOpts.accent });
  const slug = uniqueSlug(baseSlug, rowOpts.disambiguate ? lead.phone : null);

  if (dryRun) {
    const dir = path.join(OUT_ROOT, slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
    fs.writeFileSync(path.join(dir, 'hero.webp'), hero.buffer);
    return {
      businessName: lead.businessName,
      industry: kit.key,
      hero: hero.fileName,
      ok: true,
      dryRun: true,
      outPath: `out/${slug}/`,
      pitch: renderPitch(lead, `(dry run — no live URL yet)`, kit),
    };
  }

  const deployed = await deployStaticSite(slug, [
    { path: 'index.html', content: html, encoding: 'utf-8' },
    { path: 'hero.webp', content: hero.buffer.toString('base64'), encoding: 'base64' },
  ]);

  if (!deployed.ok) {
    return { businessName: lead.businessName, ok: false, error: deployed.error };
  }

  return {
    businessName: lead.businessName,
    industry: kit.key,
    hero: hero.fileName,
    ok: true,
    dryRun: false,
    url: deployed.url,
    pitch: renderPitch(lead, deployed.url, kit),
  };
}

export async function POST(req) {
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.leads) || !body.leads.length) {
    return NextResponse.json({ error: 'Request body must include a non-empty "leads" array.' }, { status: 400 });
  }

  const dryRun = !!body.dryRun;
  const overrides = body.overrides || {}; // keyed by lead index: { kitKey, heroFileName, accent }

  const results = [];
  for (let i = 0; i < body.leads.length; i++) {
    const lead = body.leads[i];
    if (!lead.businessName || !lead.phone) {
      results.push({ businessName: lead.businessName || `(row ${i + 1})`, ok: false, error: 'Missing businessName or phone.' });
      continue;
    }
    try {
      const result = await buildOne(lead, overrides[i] || {}, dryRun);
      results.push(result);
    } catch (err) {
      results.push({ businessName: lead.businessName, ok: false, error: err.message });
    }
  }

  return NextResponse.json({ results });
}

export async function GET() {
  // Lists available kits + hero counts, so the Leads UI can populate its
  // per-row kit/hero pickers without hardcoding anything client-side.
  const { KITS } = await import('@/lib/kits');
  const kits = KITS.map((k) => ({
    key: k.key,
    industryLabel: k.industryLabel,
    accent: k.accent,
    heroes: listHeroes(k.key),
  }));
  return NextResponse.json({ kits });
}
