import fs from 'fs';
import path from 'path';
import { findKit, getKit, KITS } from '@/lib/kits';
import { renderSite, renderPitch } from '@/lib/renderTemplate';
import { deployStaticSite, uniqueSlug } from '@/lib/vercel';

const HERO_ROOT = path.join(process.cwd(), 'hero-library', 'by-industry');
const OUT_ROOT = process.env.VERCEL ? path.join('/tmp', 'out') : path.join(process.cwd(), 'out');

export function listHeroes(industryKey) {
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

export function listKitsSummary() {
  return KITS.map((k) => ({
    key: k.key,
    industryLabel: k.industryLabel,
    accent: k.accent,
    heroes: listHeroes(k.key),
  }));
}

/**
 * Build one OneJob tap-to-call one-pager from a lead.
 * dryRun=true writes to out/<slug>/; dryRun=false deploys on Vercel team shauns.
 */
export async function buildOne(lead, rowOpts = {}, dryRun = false) {
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
  const slug = uniqueSlug(baseSlug, lead.phone || null);

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
