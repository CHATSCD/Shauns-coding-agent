import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { getKit } from '@/lib/kits';
import { pushBinaryFileToGitHub } from '@/lib/github';

const HERO_ROOT = path.join(process.cwd(), 'hero-library', 'by-industry');

function listHeroes(industryKey) {
  const dir = path.join(HERO_ROOT, industryKey);
  try {
    return fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.webp')).sort();
  } catch {
    return [];
  }
}

export async function GET() {
  const { KITS } = await import('@/lib/kits');
  const byIndustry = {};
  for (const k of KITS) byIndustry[k.key] = listHeroes(k.key);
  return NextResponse.json({ heroes: byIndustry });
}

// Accepts multipart/form-data: file, industry, (optional) fileName
// Crops/resizes to 800x450 webp (matching the locked template's hero slot),
// then commits it to this repo under hero-library/by-industry/<industry>/.
// Because this app's Vercel project is git-connected, that commit triggers
// a redeploy and the new hero becomes available to the build pipeline.
export async function POST(req) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Expected multipart/form-data.' }, { status: 400 });

  const industry = form.get('industry');
  const file = form.get('file');
  if (!industry || !getKit(industry)) {
    return NextResponse.json({ error: `Unknown industry "${industry}". Check lib/kits.js for valid keys.` }, { status: 400 });
  }
  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'Missing file.' }, { status: 400 });
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());

  let outBuffer;
  try {
    outBuffer = await sharp(inputBuffer)
      .resize(800, 450, { fit: 'cover', position: 'attention' })
      .webp({ quality: 78 })
      .toBuffer();
  } catch (err) {
    return NextResponse.json({ error: `Image processing failed: ${err.message}` }, { status: 400 });
  }

  // Keep it well under ~20KB where possible without trashing sharpness —
  // step quality down only if the first pass came in heavy.
  if (outBuffer.length > 20 * 1024) {
    outBuffer = await sharp(inputBuffer)
      .resize(800, 450, { fit: 'cover', position: 'attention' })
      .webp({ quality: 62 })
      .toBuffer();
  }

  const rawName = (form.get('fileName') || file.name || 'hero').toString();
  const baseName = rawName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'hero';
  const fileName = `${baseName}-${Date.now()}.webp`;
  const filePath = `hero-library/by-industry/${industry}/${fileName}`;

  const pushed = await pushBinaryFileToGitHub(
    filePath,
    outBuffer.toString('base64'),
    `Add hero image: ${fileName} (${industry})`
  );

  if (!pushed.ok) {
    return NextResponse.json({ error: pushed.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    fileName,
    industry,
    sizeBytes: outBuffer.length,
    note: 'Committed to the repo — it will show up in the hero picker once this app redeploys (usually under a minute).',
  });
}
