import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createGithubRepo, pushFileToGitHub } from '@/lib/github';
import { runSql } from '@/lib/supabase';
import { triggerVercelDeploy } from '@/lib/vercel';

const MAX_TURNS = 20;

// Tool definitions
const tools = [
  {
    type: "function",
    function: {
      name: "create_github_repo",
      description: "Create a new GitHub repository under the configured GitHub account/org. Use this before pushing files when starting a brand-new project.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          private: { type: "boolean" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "push_file_to_github",
      description: "Write a file to a GitHub repository (create or update). Without repo/owner, this defaults to the repository this very agent app lives in — only rely on that default when the user is asking you to modify this app itself. If the user asks you to build a different/new project, call create_github_repo first and pass its repo (and owner) here so you don't overwrite this app's own files.",
      parameters: {
        type: "object",
        properties: {
          file_path: { type: "string" },
          content: { type: "string" },
          commit_message: { type: "string" },
          repo: { type: "string" },
          owner: { type: "string" },
        },
        required: ["file_path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_sql_on_supabase",
      description: "Execute SQL commands on the Supabase database (e.g., CREATE TABLE).",
      parameters: {
        type: "object",
        properties: {
          sql: { type: "string" },
        },
        required: ["sql"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "trigger_vercel_deploy",
      description: "Trigger a Vercel deployment for the current project via its deploy hook.",
      parameters: { type: "object", properties: {} },
    },
  },
];

async function executeToolCall(toolCall) {
  const { name, arguments: argsJson } = toolCall.function;
  try {
    const args = JSON.parse(argsJson);
    switch (name) {
      case "create_github_repo":
        return await createGithubRepo(args.name, { description: args.description, private: args.private });
      case "push_file_to_github":
        return await pushFileToGitHub(args.file_path, args.content, args.commit_message, args.repo, args.owner);
      case "run_sql_on_supabase":
        return await runSql(args.sql);
      case "trigger_vercel_deploy":
        return await triggerVercelDeploy();
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    return `❌ Error running tool ${name}: ${err.message}`;
  }
}

function describeToolCall(toolCall) {
  let args = {};
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch {
    // leave args empty if the model produced malformed JSON
  }

  // push_file_to_github silently falls back to the configured default repo
  // when the model doesn't pass repo/owner — resolve that here so the
  // approval screen always shows the real destination instead of hiding it
  // behind an omitted argument.
  if (toolCall.function.name === "push_file_to_github") {
    args = {
      ...args,
      owner: args.owner || process.env.GITHUB_REPO_OWNER || "(not configured)",
      repo: args.repo || process.env.GITHUB_REPO_NAME || "(not configured)",
    };
  }

  return { name: toolCall.function.name, args };
}

export async function POST(req) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json(
      { error: "DEEPSEEK_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  const body = await req.json();
  const { message, decision } = body;
  let messages = Array.isArray(body.messages) ? body.messages : [];
  let turns = Number.isInteger(body.turns) ? body.turns : 0;

  if (message !== undefined) {
    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "Request body must include a non-empty 'message' string." },
        { status: 400 }
      );
    }
    messages = [...messages, { role: "user", content: message }];
  } else if (decision === "approve" || decision === "reject") {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant" || !lastMessage.tool_calls?.length) {
      return NextResponse.json(
        { error: "There is no pending plan to respond to." },
        { status: 400 }
      );
    }

    if (decision === "approve") {
      for (const toolCall of lastMessage.tool_calls) {
        const result = await executeToolCall(toolCall);
        messages = [...messages, { role: "tool", tool_call_id: toolCall.id, content: result }];
      }
    } else {
      for (const toolCall of lastMessage.tool_calls) {
        messages = [
          ...messages,
          {
            role: "tool",
            tool_call_id: toolCall.id,
            content: "❌ The user did not approve this action. It was not performed.",
          },
        ];
      }
    }
  } else {
    return NextResponse.json(
      { error: "Request body must include either 'message' or 'decision'." },
      { status: 400 }
    );
  }

  if (turns >= MAX_TURNS) {
    return NextResponse.json({ status: "final", reply: "Maximum turns reached.", messages });
  }

  const deepseek = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com', // critical for DeepSeek
    // The SDK's own default timeout is 600s — longer than Vercel's 300s
    // function limit — so a stalled DeepSeek response would otherwise never
    // time out on our side and would just silently ride out the platform's
    // hard kill with no error at all. Fail well before that instead.
    timeout: 45_000,
    maxRetries: 1,
  });

  try {
    // One model call per request: if it proposes tool calls, they are
    // returned as a plan for the user to approve/reject rather than being
    // executed immediately. Execution only happens once the client sends
    // decision: "approve" for that exact plan.
    console.log(`[agent] calling DeepSeek (turn ${turns + 1})...`);
    const response = await deepseek.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      messages,
      tools,
      tool_choice: "auto",
    });
    console.log(`[agent] DeepSeek responded (turn ${turns + 1})`);

    const assistant = response.choices[0].message;
    turns += 1;

    // Preserve the whole message as DeepSeek returned it (not just content +
    // tool_calls) — "thinking mode" responses include a reasoning_content
    // field that the API requires to be echoed back on the next call, and
    // dropping it here breaks the follow-up request once a plan is approved
    // or rejected.
    if (!assistant.tool_calls?.length) {
      messages = [...messages, assistant];
      return NextResponse.json({ status: "final", reply: assistant.content, messages });
    }

    messages = [...messages, assistant];

    return NextResponse.json({
      status: "plan",
      messages,
      turns,
      note: assistant.content || null,
      plan: assistant.tool_calls.map(describeToolCall),
    });
  } catch (err) {
    console.error(`[agent] DeepSeek call failed (turn ${turns + 1}):`, err.message);
    // messages may already include a real tool result from an approved
    // action above (the file push / SQL run / deploy trigger already
    // happened) even though this later model call failed — return it so
    // the client doesn't lose that record or end up with a conversation
    // that has an assistant tool_calls message with no matching tool
    // result, which would break every subsequent request.
    return NextResponse.json(
      { error: `Agent request failed: ${err.message}`, messages },
      { status: 500 }
    );
  }
}
