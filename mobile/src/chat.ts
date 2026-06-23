// Typed chat client — talks to the backend /chat endpoint (real model + EU RAG tools).

import { BACKEND_URL } from './config';
import { authHeaders } from './supabase';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatReply {
  reply: string;
  sources: { title: string; url: string }[];
}

/** Send the conversation so far; get back Hop's grounded reply (+ source list). */
export async function sendChat(messages: ChatMessage[]): Promise<ChatReply> {
  const res = await fetch(`${BACKEND_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`chat ${res.status}`);
  return res.json();
}
