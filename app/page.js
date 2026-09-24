"use client";
import { useEffect, useRef, useState } from 'react';
import { parseLeadsCsv, parseLeadsJson } from '@/lib/csv';

const STORAGE_KEY = 'ai-agent-session-v1';
const MAX_HISTORY = 200;

function loadStoredState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveStoredState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — history just won't persist
  }
}

function HistoryEntry({ entry }) {
  const time = new Date(entry.ts).toLocaleTimeString();

  if (entry.type === 'user') {
    return (
      <div className="text-sm">
        <span className="text-gray-400">{time}</span>{' '}
        <span className="font-semibold">You:</span> {entry.text}
      </div>
    );
  }
  if (entry.type === 'plan') {
    return (
      <div className="text-sm">
        <span className="text-gray-400">{time}</span>{' '}
        <span className="font-semibold text-amber-700">Proposed:</span>{' '}
        {entry.items.map((item) => item.name).join(', ')}
        {entry.note && <div className="text-gray-600 mt-0.5">{entry.note}</div>}
      </div>
    );
  }
  if (entry.type === 'decision') {
    return (
      <div className="text-sm">
        <span className="text-gray-400">{time}</span>{' '}
        <span className={entry.decision === 'approve' ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
          {entry.decision === 'approve' ? 'Approved' : 'Rejected'}
        </span>
      </div>
    );
  }
  if (entry.type === 'error') {
    return (
      <div className="text-sm">
        <span className="text-gray-400">{time}</span>{' '}
        <span className="font-semibold text-red-600">Error:</span> {entry.text}
      </div>
    );
  }
  return (
    <div className="text-sm">
      <span className="text-gray-400">{time}</span>{' '}
      <span className="font-semibold text-blue-700">Agent:</span> {entry.text}
    </div>
  );
}


const TABS = ['DeepSeek', 'Leads', 'Kits', 'Hero Library', 'Results'];

export default function Home() {
  const [tab, setTab] = useState('DeepSeek');
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

  // DeepSeek chat → deploy
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatTurns, setChatTurns] = useState(0);
  const [plan, setPlan] = useState(null);
  const [history, setHistory] = useState([]);
  const loadedRef = useRef(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    const saved = loadStoredState();
    if (saved) {
      setHistory(saved.history || []);
      setChatMessages(saved.chatMessages || []);
      setChatTurns(saved.chatTurns || 0);
      setPlan(saved.plan || null);
    }
    loadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    saveStoredState({ history, chatMessages, chatTurns, plan });
  }, [history, chatMessages, chatTurns, plan]);

  const logEvent = (entry) => {
    setHistory((prev) => [...prev, { ...entry, ts: Date.now() }].slice(-MAX_HISTORY));
  };

  const callAgent = async (body) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = data?.error || `Request failed with status ${res.status}.`;
        setError(message);
        logEvent({ type: 'error', text: message });
        setPlan(null);
        if (Array.isArray(data?.messages)) setChatMessages(data.messages);
        return;
      }
      if (data.status === 'plan') {
        setChatMessages(data.messages);
        setChatTurns(data.turns);
        setPlan({ items: data.plan, note: data.note });
        logEvent({ type: 'plan', items: data.plan, note: data.note });
      } else {
        const reply = data.reply ?? '(no reply)';
        setChatMessages(data.messages);
        setChatTurns(0);
        setResponse(reply);
        setPlan(null);
        logEvent({ type: 'reply', text: reply });
      }
    } catch (err) {
      const message = `Network error: ${err.message}`;
      setError(message);
      logEvent({ type: 'error', text: message });
      setPlan(null);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  const runAgent = () => {
    if (!prompt.trim() || inFlightRef.current) return;
    setResponse('');
    setError('');
    setPlan(null);
    logEvent({ type: 'user', text: prompt });
    callAgent({ messages: chatMessages, message: prompt });
    setPrompt('');
  };

  const respondToPlan = (decision) => {
    if (!plan || inFlightRef.current) return;
    logEvent({ type: 'decision', decision });
    callAgent({ messages: chatMessages, turns: chatTurns, decision });
  };

  const clearHistory = () => {
    setHistory([]);
    setChatMessages([]);
    setChatTurns(0);
    setPlan(null);
    setResponse('');
    setError('');
    try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
  };


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
          Chat with DeepSeek to deploy a one-pager, or batch leads on the Leads tab.
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


      {tab === 'DeepSeek' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              Tell DeepSeek the business, phone, trade, and city. It proposes a deploy — you approve — then you get the live URL.
            </p>
            {history.length > 0 && (
              <button onClick={clearHistory} className="text-sm text-gray-500 hover:text-red-600 whitespace-nowrap">
                New chat
              </button>
            )}
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full h-32 border rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            placeholder="e.g. Deploy a one-pager for Colony Plumbing, (251) 555-0142, plumber in Mobile, AL — kitchen sink backs up every Friday."
            disabled={!!plan}
          />
          <button
            onClick={runAgent}
            disabled={loading || !prompt.trim() || !!plan}
            className="bg-blue-500 disabled:bg-blue-300 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            {loading ? 'Running...' : 'Go'}
          </button>
          {loading && (
            <p className="text-sm text-gray-500">Waiting on DeepSeek — this can take up to about a minute.</p>
          )}
          {plan && (
            <div className="border border-amber-300 bg-amber-50 rounded p-4">
              <h2 className="font-semibold mb-2">Proposed action{plan.items.length > 1 ? 's' : ''} — approval required</h2>
              {plan.note && <p className="mb-3 text-sm text-gray-700 whitespace-pre-wrap">{plan.note}</p>}
              <ul className="space-y-2 mb-4">
                {plan.items.map((item, i) => (
                  <li key={i} className="bg-white border rounded p-2">
                    <div className="font-mono text-sm font-semibold">{item.name}</div>
                    {Object.keys(item.args || {}).length > 0 && (
                      <pre className="text-xs mt-1 whitespace-pre-wrap break-words">{JSON.stringify(item.args, null, 2)}</pre>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button onClick={() => respondToPlan('approve')} disabled={loading} className="bg-green-600 disabled:bg-green-300 text-white px-4 py-2 rounded">Approve</button>
                <button onClick={() => respondToPlan('reject')} disabled={loading} className="bg-red-600 disabled:bg-red-300 text-white px-4 py-2 rounded">Reject</button>
              </div>
            </div>
          )}
          {error && <pre className="bg-red-50 text-red-700 border border-red-200 rounded p-4 whitespace-pre-wrap">{error}</pre>}
          {response && <pre className="bg-gray-100 rounded p-4 whitespace-pre-wrap">{response}</pre>}
          {history.length > 0 && (
            <div>
              <h2 className="font-semibold mb-2 text-sm text-gray-500 uppercase tracking-wide">History</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto border rounded p-3 bg-white">
                {history.map((entry, i) => (
                  <HistoryEntry key={i} entry={entry} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

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

          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-sm">
                {leads.length > 0
                  ? `${leads.length} lead${leads.length > 1 ? 's' : ''} loaded`
                  : 'No leads loaded yet'}
              </h2>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
                Dry run (write to out/, don&apos;t deploy)
              </label>
            </div>

            {leads.length > 0 ? (
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
            ) : (
              <p className="text-sm text-gray-400 border rounded p-3">
                Paste or upload leads above, then hit Parse. Build &amp; Deploy stays here so you always know where Go is.
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={runBuild}
                disabled={building || !leads.length}
                className="bg-green-600 disabled:bg-green-300 hover:bg-green-700 text-white text-sm px-4 py-2 rounded"
              >
                {building ? 'Building…' : dryRun ? 'Build (dry run)' : 'Build & Deploy'}
              </button>
              {!leads.length && (
                <span className="text-xs text-gray-400">Parse at least one lead to enable this.</span>
              )}
            </div>
          </div>
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
