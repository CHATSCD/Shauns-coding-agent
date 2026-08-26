"use client";
import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');

  const runAgent = async () => {
    setLoading(true);
    setResponse('');
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: prompt }),
    });
    const data = await res.json();
    setResponse(data.reply);
    setLoading(false);
  };

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">AI Coding Agent</h1>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="w-full h-32 border p-2"
        placeholder="e.g., Create a /api/hello endpoint in Next.js and push it to GitHub."
      />
      <button
        onClick={runAgent}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 mt-4"
      >
        {loading ? 'Running...' : 'Run'}
      </button>
      {response && <pre className="mt-4 bg-gray-100 p-4">{response}</pre>}
    </main>
  );
      }
