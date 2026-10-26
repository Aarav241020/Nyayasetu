import { NextRequest, NextResponse } from "next/server";
import { groq, CHAT_MODEL } from "@/lib/llm";

export async function POST(req: NextRequest) {
  try {
    const client = groq();
    if (!client) {
      return NextResponse.json(
        { error: "Groq API key not configured." },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { messages } = body;

    const systemPrompt = `
You are NyayaSetu, an assistant that helps citizens anywhere in India report civic issues.
Reply in the language the user writes in (Hindi or English). Keep replies under 80 words.

Your job: understand the problem well enough to file a report. Ask at most two short follow-up
questions, one at a time, only if needed: what exactly is wrong, roughly where (landmark), since when,
and whether anyone is in danger (open manhole, live wire, accident risk, children nearby).

Allowed categories: garbage_collection, water_leakage, sewer_blockage, drain_overflow, streetlight,
pothole, illegal_dumping, mosquito_sanitation, stray_animal, park_maintenance, encroachment.

When you have enough, say one friendly sentence telling them to open the report and pin the location,
then on the LAST line output exactly:
[[REPORT {"title": "<max 60 chars, English>", "category": "<one allowed category>", "description": "<2-4 sentences in English with all details, at least 40 characters>"}]]
Never output the REPORT line before you understand the problem. Do not invent details.
If the request is not a civic issue, politely say you can only help report civic problems.
`;

    const stream = await client.chat.completions.create({
      model: CHAT_MODEL,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...(Array.isArray(messages) ? messages.slice(-12) : []),
      ],
    });

    const encoder = new TextEncoder();

    return new Response(
      new ReadableStream({
        async start(controller) {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({text:content})}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      }),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      }
    );
  } catch (error) {
    console.error("Groq chat error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
