import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { pushFileToGitHub } from '@/lib/github';
import { runSql } from '@/lib/supabase';
import { triggerVercelDeploy } from '@/lib/vercel';

// Tool definitions
const tools = [
  {
    type: "function",
    function: {
      name: "push_file_to_github",
      description: "Write a file to the GitHub repository (create or update).",
      parameters: {
        type: "object",
        properties: {
          file_path: { type: "string" },
          content: { type: "string" },
          commit_message: { type: "string" },
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

export async function POST(req) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  const { message } = await req.json();
  if (!message || typeof message !== "string") {
    return NextResponse.json(
      { error: "Request body must include a non-empty 'message' string." },
      { status: 400 }
    );
  }

  const gemini = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', // Gemini's OpenAI-compatible endpoint
  });

  const messages = [{ role: "user", content: message }];

  try {
    // Agent loop (max 10 iterations to prevent infinite loops)
    for (let i = 0; i < 10; i++) {
      const response = await gemini.chat.completions.create({
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        messages,
        tools,
        tool_choice: "auto",
      });

      const assistant = response.choices[0].message;

      // If no tool calls, return final answer
      if (!assistant.tool_calls) {
        return NextResponse.json({ reply: assistant.content });
      }

      // Add assistant message with tool calls to conversation
      messages.push({
        role: "assistant",
        content: assistant.content,
        tool_calls: assistant.tool_calls,
      });

      // Execute each tool call
      for (const toolCall of assistant.tool_calls) {
        const { name, arguments: argsJson } = toolCall.function;
        let result;

        try {
          const args = JSON.parse(argsJson);
          switch (name) {
            case "push_file_to_github":
              result = await pushFileToGitHub(args.file_path, args.content, args.commit_message);
              break;
            case "run_sql_on_supabase":
              result = await runSql(args.sql);
              break;
            case "trigger_vercel_deploy":
              result = await triggerVercelDeploy();
              break;
            default:
              result = `Unknown tool: ${name}`;
          }
        } catch (err) {
          result = `❌ Error running tool ${name}: ${err.message}`;
        }

        // Add tool result back to conversation
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }
    }

    return NextResponse.json({ reply: "Maximum iterations reached." });
  } catch (err) {
    return NextResponse.json(
      { error: `Agent request failed: ${err.message}` },
      { status: 500 }
    );
  }
}
