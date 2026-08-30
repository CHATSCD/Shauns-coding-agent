"use client";
import { useEffect, useRef, useState } from 'react';

function describeToolCalls(toolCalls) {
  return toolCalls
    .map((tc) => {
      try {
        return `${tc.function.name}(${tc.function.arguments})`;
      } catch {
        return tc.function?.name || 'tool call';
      }
    })
    .join(', ');
}

function HistoryEntry({ message }) {
  const time = message.created_at ? new Date(message.created_at).toLocaleTimeString() : '';

  if (message.role === 'user') {
    return (
      <div className="text-sm">
        <span className="text-gray-400">{time}</span>{' '}
        <span className="font-semibold">You:</span> {message.content}
      </div>
    );
  }

  if (message.role === 'assistant' && message.tool_calls?.length) {
    return (
      <div className="text-sm">
        <span className="text-gray-400">{time}</span>{' '}
        <span className="font-semibold text-amber-700">Proposed:</span>{' '}
        {describeToolCalls(message.tool_calls)}
        {message.content && <div className="text-gray-600 mt-0.5">{message.content}</div>}
      </div>
    );
  }

  if (message.role === 'tool') {
    return (
      <div className="text-sm">
        <span className="text-gray-400">{time}</span>{' '}
        <span className="font-semibold text-gray-700">Result:</span> {message.content}
      </div>
    );
  }

  // assistant with a plain reply
  return (
    <div className="text-sm">
      <span className="text-gray-400">{time}</span>{' '}
      <span className="font-semibold text-blue-700">Agent:</span> {message.content}
    </div>
  );
}

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  // chatMessages mirrors the messages table in Supabase — the conversation
  // lives in the database now, not the browser, so it survives a reload,
  // a different device, or clearing site data.
  const [chatMessages, setChatMessages] = useState([]);
  const [plan, setPlan] = useState(null); // { items, note }
  // setLoading(true) doesn't block a second click until React re-renders,
  // so a fast double-click could fire two overlapping requests (and
  // potentially double-execute an approved action). Check this ref
  // synchronously instead of relying on the loading state's render timing.
  const inFlightRef = useRef(false);

  // Load the conversation from the database on mount.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/agent');
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setError(data?.error || `Failed to load conversation (status ${res.status}).`);
        } else {
          setChatMessages(data.messages || []);
          setPlan(data.plan || null);
        }
      } catch (err) {
        setError(`Network error loading conversation: ${err.message}`);
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, []);

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
        setPlan(null);
        // If an action had already been approved and executed before this
        // failure (e.g. the follow-up model call timed out), the server
        // returns the updated messages including that real tool result —
        // use it so the record isn't lost. Otherwise leave chatMessages as
        // they were.
        if (Array.isArray(data?.messages)) {
          setChatMessages(data.messages);
        }
        return;
      }

      setChatMessages(data.messages);
      if (data.status === 'plan') {
        setPlan({ items: data.plan, note: data.note });
      } else {
        setResponse(data.reply ?? '(no reply)');
        setPlan(null);
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
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
    callAgent({ message: prompt });
    setPrompt('');
  };

  const respondToPlan = (decision) => {
    if (!plan || inFlightRef.current) return;
    callAgent({ decision });
  };

  const startNewConversation = async () => {
    setError('');
    try {
      const res = await fetch('/api/agent', { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || `Failed to clear conversation (status ${res.status}).`);
        return;
      }
      setChatMessages([]);
      setPlan(null);
      setResponse('');
    } catch (err) {
      setError(`Network error: ${err.message}`);
    }
  };

  return (
    <main className="max-w-2xl mx-auto p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">AI Coding Agent</h1>
        {chatMessages.length > 0 && (
          <button
            onClick={startNewConversation}
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
        disabled={!!plan || loadingHistory}
      />
      <button
        onClick={runAgent}
        disabled={loading || loadingHistory || !prompt.trim() || !!plan}
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

      {chatMessages.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold mb-2 text-sm text-gray-500 uppercase tracking-wide">History</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto border rounded p-3 bg-white">
            {chatMessages.map((message, i) => (
              <HistoryEntry key={i} message={message} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
