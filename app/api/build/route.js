import { NextResponse } from 'next/server';
import { buildOne, listKitsSummary } from '@/lib/buildSite';

export async function POST(req) {
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.leads) || !body.leads.length) {
    return NextResponse.json({ error: 'Request body must include a non-empty "leads" array.' }, { status: 400 });
  }

  const dryRun = !!body.dryRun;
  const overrides = body.overrides || {};

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
  return NextResponse.json({ kits: listKitsSummary() });
}
