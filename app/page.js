"use client";
import { useEffect, useRef, useState } from 'react';

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

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [conversation, setConversation] = useState(null); // { messages, turns }
  const [plan, setPlan] = useState(null); // { items, note }
  const [history, setHistory] = useState([]);
  const loadedRef = useRef(false);

  // Restore any saved session on first mount, so a hung/failed request or a
  // page reload doesn't lose the conversation history or a pending plan.
  useEffect(() => {
    const saved = loadStoredState();
    if (saved) {
      setHistory(saved.history || []);
      setConversation(saved.conversation || null);
      setPlan(saved.plan || null);
    }
    loadedRef.current = true;
  }, []);

  // Persist on every change, once the initial load above has run.
  useEffect(() => {
    if (!loadedRef.current) return;
    saveStoredState({ history, conversation, plan });
  }, [history, conversation, plan]);

  const logEvent = (entry) => {
    setHistory((prev) => [...prev, { ...entry, ts: Date.now() }].slice(-MAX_HISTORY));
  };

  const callAgent = async (body) => {
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
        setConversation(null);
        return;
      }

      if (data.status === 'plan') {
        setConversation({ messages: data.messages, turns: data.turns });
        setPlan({ items: data.plan, note: data.note });
        logEvent({ type: 'plan', items: data.plan, note: data.note });
      } else {
        const reply = data.reply ?? '(no reply)';
        setResponse(reply);
        setPlan(null);
        setConversation(null);
        logEvent({ type: 'reply', text: reply });
      }
    } catch (err) {
      const message = `Network error: ${err.message}`;
      setError(message);
      logEvent({ type: 'error', text: message });
      setPlan(null);
      setConversation(null);
    } finally {
      setLoading(false);
    }
  };

  const runAgent = () => {
    if (!prompt.trim() || loading) return;
    setResponse('');
    setError('');
    setPlan(null);
    setConversation(null);
    logEvent({ type: 'user', text: prompt });
    callAgent({ message: prompt });
    setPrompt('');
  };

  const respondToPlan = (decision) => {
    if (!conversation || loading) return;
    logEvent({ type: 'decision', decision });
    callAgent({ messages: conversation.messages, turns: conversation.turns, decision });
  };

  const clearHistory = () => {
    setHistory([]);
    setConversation(null);
    setPlan(null);
    setResponse('');
    setError('');
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  return (
    <main className="max-w-2xl mx-auto p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">AI Coding Agent</h1>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            Clear history
          </button>
        )}
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="w-full h-32 border rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        placeholder="e.g., Create a /api/hello endpoint in Next.js and push it to GitHub."
        disabled={!!plan}
      />
      <button
        onClick={runAgent}
        disabled={loading || !prompt.trim() || !!plan}
        className="bg-blue-500 disabled:bg-blue-300 text-white px-4 py-2 mt-4 rounded hover:bg-blue-600 transition-colors"
      >
        {loading ? 'Running...' : 'Run'}
      </button>
      {loading && (
        <p className="text-sm text-gray-500 mt-2">
          Waiting on the model — this can take up to about a minute.
        </p>
      )}

      {plan && (
        <div className="mt-4 border border-amber-300 bg-amber-50 rounded p-4">
          <h2 className="font-semibold mb-2">Proposed action{plan.items.length > 1 ? 's' : ''} — approval required</h2>
          {plan.note && <p className="mb-3 text-sm text-gray-700 whitespace-pre-wrap">{plan.note}</p>}
          <ul className="space-y-2 mb-4">
            {plan.items.map((item, i) => (
              <li key={i} className="bg-white border rounded p-2">
                <div className="font-mono text-sm font-semibold">{item.name}</div>
                {Object.keys(item.args).length > 0 && (
                  <pre className="text-xs mt-1 whitespace-pre-wrap break-words">
                    {JSON.stringify(item.args, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              onClick={() => respondToPlan('approve')}
              disabled={loading}
              className="bg-green-600 disabled:bg-green-300 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => respondToPlan('reject')}
              disabled={loading}
              className="bg-red-600 disabled:bg-red-300 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {error && (
        <pre className="mt-4 bg-red-50 text-red-700 border border-red-200 rounded p-4 whitespace-pre-wrap">
          {error}
        </pre>
      )}
      {response && (
        <pre className="mt-4 bg-gray-100 rounded p-4 whitespace-pre-wrap">
          {response}
        </pre>
      )}

      {history.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold mb-2 text-sm text-gray-500 uppercase tracking-wide">History</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto border rounded p-3 bg-white">
            {history.map((entry, i) => (
              <HistoryEntry key={i} entry={entry} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
