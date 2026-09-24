"use client";
import { useEffect, useRef, useState } from 'react';
import { parseLeadsCsv, parseLeadsJson } from '@/lib/csv';

const TABS = ['Leads', 'Kits', 'Hero Library', 'Results'];

export default function Home() {
  const [tab, setTab] = useState('Leads');
  const [leads, setLeads] = useState([]);
  const [pasteText, setPasteText] = useState('');
  const [parseError, setParseError] = useState('');
  const [overrides, setOverrides] = useState({}); // index -> { kitKey, heroFileName, accent }
  const [dryRun, setDryRun] = useState(true);
  const [building, setBuilding] = useState(false);
  const [results, setResults] = useState([]);
  const [kitsInfo, setKitsInfo] = useState([]);
  const [heroUploadIndustry, setHeroUploadIndustry] = useState('electrical');
  const [heroUploading, setHeroUploading] = useState(false);
  const [heroUploadMsg, setHeroUploadMsg] = useState('');
  const fileInputRef = useRef(null);
  const heroFileInputRef = useRef(null);

  const refreshKits = async () => {
    try {
      const res = await fetch('/api/build');
      const data = await res.json();
      setKitsInfo(data.kits || []);
    } catch {
      // build page still works without this — pickers just fall back to auto-detect
    }
  };

  useEffect(() => {
    refreshKits();
  }, []);

  const applyLeads = (parsed) => {
    setLeads(parsed);
    setOverrides({});
    setResults([]);
    setParseError('');
  };

  const handlePasteParse = () => {
    const trimmed = pasteText.trim();
    if (!trimmed) return;
    try {
      const parsed = trimmed.startsWith('[') || trimmed.startsWith('{')
        ? parseLeadsJson(trimmed)
        : parseLeadsCsv(trimmed);
      applyLeads(parsed);
    } catch (err) {
      setParseError(err.message);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = file.name.toLowerCase().endsWith('.json') ? parseLeadsJson(text) : parseLeadsCsv(text);
      applyLeads(parsed);
    } catch (err) {
      setParseError(err.message);
    }
    e.target.value = '';
  };

  const setOverride = (idx, field, value) => {
    setOverrides((prev) => ({ ...prev, [idx]: { ...prev[idx], [field]: value } }));
  };

  const runBuild = async () => {
    if (!leads.length || building) return;
    setBuilding(true);
    setResults([]);
    try {
      const res = await fetch('/api/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads, overrides, dryRun }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResults([{ businessName: '(batch)', ok: false, error: data.error || 'Build failed.' }]);
      } else {
        setResults(data.results);
        setTab('Results');
      }
    } catch (err) {
      setResults([{ businessName: '(batch)', ok: false, error: err.message }]);
    } finally {
      setBuilding(false);
    }
  };

  const uploadHero = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHeroUploading(true);
    setHeroUploadMsg('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('industry', heroUploadIndustry);
      const res = await fetch('/api/heroes', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setHeroUploadMsg(`❌ ${data.error}`);
      } else {
        setHeroUploadMsg(`✅ ${data.fileName} — ${data.note}`);
        setTimeout(refreshKits, 1500);
      }
    } catch (err) {
      setHeroUploadMsg(`❌ ${err.message}`);
    } finally {
      setHeroUploading(false);
      e.target.value = '';
    }
  };

  return (
    <main className="max-w-3xl mx-auto p-6 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">OneJob Site Factory</h1>
        <p className="text-sm text-gray-500 mt-1">
          Paste trade leads → tap-to-call one-pagers, deployed on Vercel, ready to text.
        </p>
      </div>

      <div className="flex gap-1 border-b mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${
              tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Leads' && (
        <section className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Paste leads (CSV or JSON)</label>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`businessName,phone,industry,city,state,notes\nEM Thomas Electric,(251) 456-0956,electrical,Mobile,AL,panel smells hot`}
              className="w-full h-28 border rounded p-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={handlePasteParse}
                className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-3 py-1.5 rounded"
              >
                Parse pasted leads
              </button>
              <span className="text-sm text-gray-400">or</span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="border text-sm px-3 py-1.5 rounded hover:bg-gray-50"
              >
                Upload CSV / JSON
              </button>
              <input ref={fileInputRef} type="file" accept=".csv,.json" className="hidden" onChange={handleFileUpload} />
            </div>
            {parseError && <p className="text-sm text-red-600 mt-2">{parseError}</p>}
          </div>

          {leads.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-sm">{leads.length} lead{leads.length > 1 ? 's' : ''} loaded</h2>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
                  Dry run (write to out/, don&apos;t deploy)
                </label>
              </div>
              <div className="overflow-x-auto border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="p-2">Business</th>
                      <th className="p-2">Phone</th>
                      <th className="p-2">City, State</th>
                      <th className="p-2">Kit override</th>
                      <th className="p-2">Hero override</th>
                      <th className="p-2">Accent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead, idx) => {
                      const ov = overrides[idx] || {};
                      const detectedKit = kitsInfo.find((k) => k.key === lead.industry?.toLowerCase());
                      const activeKitKey = ov.kitKey || detectedKit?.key || '';
                      const heroesForKit = kitsInfo.find((k) => k.key === activeKitKey)?.heroes || [];
                      return (
                        <tr key={idx} className="border-t">
                          <td className="p-2 font-medium">{lead.businessName}</td>
                          <td className="p-2">{lead.phone}</td>
                          <td className="p-2">{lead.city}, {lead.state}</td>
                          <td className="p-2">
                            <select
                              value={ov.kitKey || ''}
                              onChange={(e) => setOverride(idx, 'kitKey', e.target.value)}
                              className="border rounded px-1 py-0.5 text-xs"
                            >
                              <option value="">auto ({lead.industry || '?'})</option>
                              {kitsInfo.map((k) => (
                                <option key={k.key} value={k.key}>{k.industryLabel}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <select
                              value={ov.heroFileName || ''}
                              onChange={(e) => setOverride(idx, 'heroFileName', e.target.value)}
                              className="border rounded px-1 py-0.5 text-xs"
                            >
                              <option value="">default</option>
                              {heroesForKit.map((h) => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="color"
                              value={ov.accent || detectedKit?.accent || '#FFD000'}
                              onChange={(e) => setOverride(idx, 'accent', e.target.value)}
                              className="w-8 h-6 p-0 border rounded"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button
                onClick={runBuild}
                disabled={building}
                className="mt-4 bg-green-600 disabled:bg-green-300 hover:bg-green-700 text-white text-sm px-4 py-2 rounded"
              >
                {building ? 'Building…' : dryRun ? 'Build (dry run)' : 'Build & Deploy'}
              </button>
            </div>
          )}
        </section>
      )}

      {tab === 'Kits' && (
        <section>
          <p className="text-sm text-gray-500 mb-4">
            Kits live in <code className="text-xs bg-gray-100 px-1 rounded">lib/kits.js</code>. Add a new trade by
            appending one object there — industry auto-detect, hero picker, and the build pipeline all read from it,
            no other changes needed.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {kitsInfo.map((k) => (
              <div key={k.key} className="border rounded p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ background: k.accent }} />
                  <span className="font-semibold text-sm">{k.industryLabel}</span>
                  <span className="text-xs text-gray-400">({k.key})</span>
                </div>
                <p className="text-xs text-gray-500">{k.heroes.length} hero image{k.heroes.length === 1 ? '' : 's'} available</p>
              </div>
            ))}
            {!kitsInfo.length && <p className="text-sm text-gray-400">Loading kits…</p>}
          </div>
        </section>
      )}

      {tab === 'Hero Library' && (
        <section className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Industry</label>
            <select
              value={heroUploadIndustry}
              onChange={(e) => setHeroUploadIndustry(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              {kitsInfo.map((k) => (
                <option key={k.key} value={k.key}>{k.industryLabel}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => heroFileInputRef.current?.click()}
            disabled={heroUploading}
            className="border text-sm px-3 py-1.5 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            {heroUploading ? 'Uploading…' : 'Upload hero image'}
          </button>
          <input ref={heroFileInputRef} type="file" accept="image/*" className="hidden" onChange={uploadHero} />
          {heroUploadMsg && <p className="text-sm">{heroUploadMsg}</p>}
          <p className="text-xs text-gray-400">
            Auto-crops/resizes to 800×450 webp and commits it to hero-library/by-industry/{heroUploadIndustry}/.
            It becomes pickable in the Leads tab once this app redeploys (usually under a minute).
          </p>

          <div className="pt-2">
            <h2 className="font-semibold text-sm mb-2">Current library</h2>
            <div className="space-y-2">
              {kitsInfo.map((k) => (
                <div key={k.key} className="text-sm">
                  <span className="font-medium">{k.industryLabel}:</span>{' '}
                  <span className="text-gray-500">{k.heroes.length ? k.heroes.join(', ') : 'no heroes yet'}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === 'Results' && (
        <section>
          {!results.length && <p className="text-sm text-gray-400">No builds yet — run one from the Leads tab.</p>}
          <div className="space-y-3">
            {results.map((r, i) => (
              <div key={i} className={`border rounded p-3 ${r.ok ? '' : 'border-red-300 bg-red-50'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{r.businessName}</span>
                  {r.industry && <span className="text-xs text-gray-400">{r.industry}</span>}
                </div>
                {r.ok ? (
                  <>
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline break-all">
                        {r.url}
                      </a>
                    )}
                    {r.outPath && <p className="text-sm text-gray-600">{r.outPath}</p>}
                    {r.pitch && (
                      <pre className="text-xs bg-gray-50 border rounded p-2 mt-2 whitespace-pre-wrap">{r.pitch}</pre>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-red-700">{r.error}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
