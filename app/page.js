"use client";
import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [conversation, setConversation] = useState(null); // { messages, turns }
  const [plan, setPlan] = useState(null); // { items, note }

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
        setError(data?.error || `Request failed with status ${res.status}.`);
        setPlan(null);
        setConversation(null);
        return;
      }

      if (data.status === 'plan') {
        setConversation({ messages: data.messages, turns: data.turns });
        setPlan({ items: data.plan, note: data.note });
      } else {
        setResponse(data.reply ?? '(no reply)');
        setPlan(null);
        setConversation(null);
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
      setPlan(null);
      setConversation(null);
    } finally {
      setLoading(false);
    }
  };

  const runAgent = () => {
    if (!prompt.trim() || loading) return;
    setResponse('');
    setPlan(null);
    setConversation(null);
    callAgent({ message: prompt });
  };

  const respondToPlan = (decision) => {
    if (!conversation || loading) return;
    callAgent({ messages: conversation.messages, turns: conversation.turns, decision });
  };

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">AI Coding Agent</h1>
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
    </main>
  );
}
