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

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  // chatMessages is the actual conversation sent to the model on every
  // request — this is what gives the agent memory of what was said before.
  // The History panel below is a separate, human-readable log; it never
  // fed back into the model, which is why the agent had no memory even
  // though the log showed past turns.
  const [chatMessages, setChatMessages] = useState([]);
  const [chatTurns, setChatTurns] = useState(0);
  const [plan, setPlan] = useState(null); // { items, note }
  const [history, setHistory] = useState([]);
  const loadedRef = useRef(false);
  // setLoading(true) doesn't block a second click until React re-renders,
  // so a fast double-click could fire two overlapping requests (and
  // potentially double-execute an approved action). Check this ref
  // synchronously instead of relying on the loading state's render timing.
  const inFlightRef = useRef(false);

  // Restore any saved session on first mount, so a hung/failed request or a
  // page reload doesn't lose the conversation memory, history log, or a
  // pending plan.
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

  // Persist on every change, once the initial load above has run.
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
        // If an action had already been approved and executed before this
        // failure (e.g. the follow-up model call timed out), the server
        // returns the updated messages including that real tool result —
        // use it so the record isn't lost and the conversation doesn't end
        // up with an unresolved tool_calls message that would break every
        // later request. Otherwise leave chatMessages as they were.
        if (Array.isArray(data?.messages)) {
          setChatMessages(data.messages);
        }
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
    // Send the conversation so far along with the new message, so the
    // model has memory of everything discussed in this session.
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
            Start new conversation
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
