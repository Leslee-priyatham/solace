import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { chatStream, AiNotConfiguredError, chat } from "@/lib/ai/client";
import { buildContext, systemPrompt, QUICK_ACTIONS } from "@/lib/ai/assistant";

export const maxDuration = 300;

// GET: list conversations, or one conversation's messages.
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const conv = await db.aiConversation.findFirst({ where: { id, userId: user.id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
    return NextResponse.json(conv);
  }
  const list = await db.aiConversation.findMany({ where: { userId: user.id, archived: false }, orderBy: { updatedAt: "desc" }, take: 50 });
  return NextResponse.json(list);
}

// DELETE ?id= : remove a conversation.
export async function DELETE(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (id) await db.aiConversation.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}

// POST: send a message and stream the reply as plain text.
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = (await req.json()) as { conversationId?: string; message?: string; action?: string; clientId?: string | null; sessionId?: string | null };

  const action = body.action ? QUICK_ACTIONS[body.action] : undefined;
  const userText = (body.message?.trim() || action?.prompt || "").trim();
  if (!userText) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  let conv = body.conversationId ? await db.aiConversation.findFirst({ where: { id: body.conversationId, userId: user.id } }) : null;
  if (!conv) {
    conv = await db.aiConversation.create({
      data: { userId: user.id, clientId: body.clientId ?? null, sessionId: body.sessionId ?? null, title: action?.label ?? userText.slice(0, 60) },
    });
  }
  await db.aiMessage.create({ data: { conversationId: conv.id, role: "user", content: userText } });

  // "Remember that …" is stored as a long-term memory.
  const remember = userText.match(/^(?:please\s+)?remember(?: that)?[:,]?\s+(.+)/i);
  const prefs = (user.preferences ?? {}) as { memory?: boolean };
  if (remember && prefs.memory !== false) {
    await db.assistantMemory.create({ data: { userId: user.id, content: remember[1].slice(0, 500) } });
  }

  const history = await db.aiMessage.findMany({ where: { conversationId: conv.id }, orderBy: { createdAt: "asc" } });
  const [system, context] = await Promise.all([
    systemPrompt(user.id),
    buildContext(user.id, { clientId: conv.clientId ?? body.clientId, sessionId: conv.sessionId ?? body.sessionId }),
  ]);
  const messages = history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  // Attach the record to the latest user turn so earlier turns stay unchanged between requests.
  messages[messages.length - 1] = { role: "user", content: `<record>\n${context}\n</record>\n\n${userText}` };

  const conversationId = conv.id;
  const isFirstExchange = history.length === 1;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let full = "";
      try {
        for await (const chunk of chatStream({ system, messages, maxTokens: 8000 })) {
          full += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (e) {
        const msg = e instanceof AiNotConfiguredError ? e.message : `Sorry — the AI request failed. ${e instanceof Error ? e.message : ""}`;
        full += (full ? "\n\n" : "") + msg;
        controller.enqueue(encoder.encode((full === msg ? "" : "\n\n") + msg));
      }
      await db.aiMessage.create({ data: { conversationId, role: "assistant", content: full } });
      await db.aiConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
      controller.close();
      if (isFirstExchange && !action) {
        try {
          const title = await chat({ messages: [{ role: "user", content: `Give a 3-6 word title for a chat that starts with: "${userText.slice(0, 300)}". Reply with the title only.` }], maxTokens: 30 });
          await db.aiConversation.update({ where: { id: conversationId }, data: { title: title.replace(/^["']|["']$/g, "").slice(0, 60) } });
        } catch {}
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-Conversation-Id": conversationId } });
}
