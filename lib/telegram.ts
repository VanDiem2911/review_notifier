import { fetchJson } from "./http";
import type { Review } from "./types";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function call<T>(method: string, payload: unknown = {}): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("Thiếu TELEGRAM_BOT_TOKEN");
  return fetchJson<T>(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function sendTelegram(text: string) {
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!chatId) throw new Error("Thiếu TELEGRAM_CHAT_ID (mở /api/cron?action=chat-id để lấy)");
  await call("sendMessage", {
    chat_id: chatId,
    text: text.slice(0, 4000), // giới hạn 4096 ký tự/tin
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

export function formatReview(r: Review): string {
  const lines = [`🔔 <b>Đánh giá mới trên ${escapeHtml(r.source)}</b>`];
  if (r.place) lines.push(`📍 ${escapeHtml(r.place)}`);
  if (typeof r.rating === "number") lines.push("⭐".repeat(Math.round(r.rating)) + ` (${r.rating}/5)`);
  lines.push(`👤 ${escapeHtml(r.author || "Ẩn danh")}${r.date ? ` · ${escapeHtml(r.date)}` : ""}`);
  if (r.text.trim()) {
    const t = r.text.trim();
    lines.push("", escapeHtml(t.length > 3000 ? t.slice(0, 3000) + "…" : t));
  }
  if (r.url) lines.push("", `<a href="${escapeHtml(r.url)}">Xem review</a>`);
  return lines.join("\n");
}

export async function listChats(): Promise<Record<string, string>> {
  const data = await call<{ result: any[] }>("getUpdates");
  const chats: Record<string, string> = {};
  for (const u of data.result ?? []) {
    const chat = (u.message ?? u.channel_post ?? u.my_chat_member)?.chat;
    if (chat) chats[String(chat.id)] = chat.title ?? chat.username ?? chat.first_name ?? "";
  }
  return chats;
}
