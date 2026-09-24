// Small CSV parser (no dependency) for lead lists:
// businessName, phone, industry, city, state, notes
// Handles quoted fields and commas inside quotes; not a full RFC4180 parser
// but covers the shapes leads actually come in.

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseLeadsCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1);
  return rows.map((line) => {
    const cells = parseCsvLine(line);
    const row = {};
    header.forEach((h, i) => {
      row[h] = cells[i] ?? '';
    });
    return {
      businessName: row.businessname || row.business_name || row.business || '',
      phone: row.phone || '',
      industry: row.industry || '',
      city: row.city || '',
      state: row.state || '',
      notes: row.notes || '',
    };
  });
}

export function parseLeadsJson(text) {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : data.leads;
  if (!Array.isArray(arr)) throw new Error('Expected a JSON array of leads (or { "leads": [...] }).');
  return arr.map((l) => ({
    businessName: l.businessName || l.business_name || l.business || '',
    phone: l.phone || '',
    industry: l.industry || '',
    city: l.city || '',
    state: l.state || '',
    notes: l.notes || '',
  }));
}
