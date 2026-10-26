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

export const CHAT_MODEL = process.env.GROQ_CHAT_MODEL || 'llama-3.1-8b-instant';
export const VISION_MODEL = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
