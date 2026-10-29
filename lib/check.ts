import { enabledSources } from "./sources";
import { loadState, saveState } from "./state";
import { formatReview, sendTelegram } from "./telegram";

export interface SourceResult {
  source: string;
  fetched: number;
  sent: number;
  seeded?: boolean;
  error?: string;
}

/**
 * Lấy review từ từng nguồn, gửi Telegram những review chưa thấy.
 * Lần chạy đầu của mỗi nguồn chỉ ghi nhận review hiện có (trừ khi notifyExisting).
 */
let running = false;

export async function checkOnce(notifyExisting = false): Promise<SourceResult[]> {
  if (running) throw new Error("Lần kiểm tra trước vẫn đang chạy, bỏ qua lần này.");
  running = true;
  try {
    return await runCheck(notifyExisting);
  } finally {
    running = false;
  }
}

async function runCheck(notifyExisting: boolean): Promise<SourceResult[]> {
  const sources = enabledSources();
  if (!sources.length) throw new Error("Chưa cấu hình nguồn review nào (xem .env.example).");
  const state = await loadState();
  const results: SourceResult[] = [];

  for (const { name, fetch } of sources) {
    const result: SourceResult = { source: name, fetched: 0, sent: 0 };
    results.push(result);
    try {
      const reviews = await fetch();
      result.fetched = reviews.length;
      const firstRun = !state[name];
      const seen = new Set(state[name] ?? []);
      let fresh = reviews.filter((r) => !seen.has(r.id));

      if (firstRun && !notifyExisting) {
        result.seeded = true;
        fresh = [];
        reviews.forEach((r) => seen.add(r.id));
      }
      // review cũ hơn gửi trước để đúng thứ tự thời gian
      for (const r of fresh.reverse()) {
        try {
          await sendTelegram(formatReview(r));
        } catch (e) {
          result.error = `Gửi Telegram lỗi, sẽ thử lại lần sau: ${(e as Error).message}`;
          break;
        }
        seen.add(r.id);
        result.sent++;
      }
      if (firstRun) reviews.forEach((r) => seen.add(r.id));
      state[name] = [...seen];
      await saveState(state);
    } catch (e) {
      result.error = (e as Error).message; // một nguồn lỗi không ảnh hưởng nguồn khác
    }
  }
  return results;
}
