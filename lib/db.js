import { createClient } from '@supabase/supabase-js';

let client;

function getClient() {
  if (!client) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured on the server.');
    }
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return client;
}

function rowToMessage(row) {
  const msg = { role: row.role, created_at: row.created_at };
  if (row.content !== null) msg.content = row.content;
  if (row.tool_calls) msg.tool_calls = row.tool_calls;
  if (row.tool_call_id) msg.tool_call_id = row.tool_call_id;
  if (row.reasoning_content) msg.reasoning_content = row.reasoning_content;
  return msg;
}

export async function loadMessages() {
  const { data, error } = await getClient()
    .from('messages')
    .select('role, content, tool_calls, tool_call_id, reasoning_content, created_at')
    .order('id', { ascending: true });
  if (error) throw new Error(`Failed to load conversation: ${error.message}`);
  return data.map(rowToMessage);
}

export async function appendMessages(messages) {
  if (!messages.length) return;
  const rows = messages.map((m) => ({
    role: m.role,
    content: m.content ?? null,
    tool_calls: m.tool_calls ?? null,
    tool_call_id: m.tool_call_id ?? null,
    reasoning_content: m.reasoning_content ?? null,
  }));
  const { error } = await getClient().from('messages').insert(rows);
  if (error) throw new Error(`Failed to save conversation: ${error.message}`);
}

export async function clearConversation() {
  const { error } = await getClient().from('messages').delete().gte('id', 0);
  if (error) throw new Error(`Failed to clear conversation: ${error.message}`);
}
