import OpenAI from 'openai';

// Groq speaks the OpenAI API. Created lazily so builds and pages work without a key.
let client: OpenAI | null | undefined;

export function groq(): OpenAI | null {
  if (client === undefined) {
    client = process.env.GROQ_API_KEY
      ? new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
      : null;
  }
  return client;
}

// Groq retires models often; check https://console.groq.com/docs/models and override in .env.local.
// qwen3.8-27b (Oct 2026): reads images, returns valid JSON, good Hindi, fast.
export const CHAT_MODEL = process.env.GROQ_CHAT_MODEL || 'qwen/qwen3.8-27b';
export const VISION_MODEL = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b';
