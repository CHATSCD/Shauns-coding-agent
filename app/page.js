"use client";
import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');

  const runAgent = async () => {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setResponse('');
    setError('');

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || `Request failed with status ${res.status}.`);
      } else {
        setResponse(data?.reply ?? '(no reply)');
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">AI Coding Agent</h1>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="w-full h-32 border rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="e.g., Create a /api/hello endpoint in Next.js and push it to GitHub."
      />
      <button
        onClick={runAgent}
        disabled={loading || !prompt.trim()}
        className="bg-blue-500 disabled:bg-blue-300 text-white px-4 py-2 mt-4 rounded hover:bg-blue-600 transition-colors"
      >
        {loading ? 'Running...' : 'Run'}
      </button>
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
