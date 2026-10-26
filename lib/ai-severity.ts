import { groq, VISION_MODEL, CHAT_MODEL } from '@/lib/llm';
import { supabaseAdmin } from '@/lib/db';
import type { AISeverity } from '@/types';

const PROMPT = `You assess civic issues reported by citizens in India for a municipal priority queue.
Rate how SEVERE the problem is on a 1-5 scale, judging only harm and risk:
1 = cosmetic / inconvenience, 2 = minor nuisance, 3 = affects daily life or hygiene,
4 = health risk or injury risk, 5 = immediate danger to life (open manhole, live wire, sewage in drinking water, road cave-in).
Use the photo if one is attached; do not trust exaggerated words without evidence.
Reply with JSON only: {"severity": <1-5>, "hazards": [<up to 3 short phrases>], "reasoning": "<one sentence, max 25 words>"}`;

/**
 * Ask the LLM (Groq, Llama vision) to rate severity from the text and the photo.
 * Returns null if no key is configured or the call fails; the priority score
 * then falls back to the category baseline and keyword urgency.
 */
export async function assessSeverity(input: {
  title: string;
  description: string;
  category: string;
  imageDataUrl?: string | null;
}): Promise<AISeverity | null> {
  const client = groq();
  if (!client) return null;

  const text = `Category: ${input.category}\nTitle: ${input.title}\nDescription: ${input.description}`;
  const model = input.imageDataUrl ? VISION_MODEL : CHAT_MODEL;
  try {
    const res = await client.chat.completions.create(
      {
        model,
        temperature: 0,
        max_tokens: 200,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: PROMPT },
          {
            role: 'user',
            content: input.imageDataUrl
              ? [{ type: 'text', text }, { type: 'image_url', image_url: { url: input.imageDataUrl } }]
              : text,
          },
        ],
      },
      { timeout: 10_000 },
    );
    const raw = res.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as Partial<AISeverity>;
    const severity = Math.round(Number(parsed.severity));
    if (!(severity >= 1 && severity <= 5)) return null;
    const out: AISeverity = {
      severity,
      hazards: Array.isArray(parsed.hazards) ? parsed.hazards.slice(0, 3).map(String) : [],
      reasoning: String(parsed.reasoning ?? '').slice(0, 200),
      source: 'ai',
    };
    void supabaseAdmin.from('ai_logs').insert({ input: text, output: raw, model, type: 'severity' }).then(() => {});
    return out;
  } catch (err) {
    console.error('[AI] severity error:', err instanceof Error ? err.message : err);
    return null;
  }
}
