import type { Review } from "./types";

const env = (k: string) => process.env[k]?.trim() ?? "";

const MAX_REVIEWS = 10;

/**
 * Đọc review mới nhất trên Google Maps bằng trình duyệt thật (Playwright), không cần API key.
 *
 * Phải chạy có cửa sổ (headless=false): Google trả bản Maps "chế độ bị hạn chế", không có review,
 * cho trình duyệt headless. Vì vậy chỉ chạy được trên máy/VPS có màn hình, không chạy được trên Vercel.
 * Giao diện Google thay đổi thì các selector bên dưới có thể phải cập nhật.
 */
export async function googleBrowserReviews(): Promise<Review[]> {
  const { chromium } = await import("playwright");
  const placeId = env("GOOGLE_PLACE_ID");
  const url = env("GOOGLE_MAPS_URL") || `https://www.google.com/maps/place/?q=place_id:${placeId}&hl=vi`;

  const browser = await chromium.launch({
    channel: env("GOOGLE_BROWSER_CHANNEL") || "chrome", // dùng Chrome cài sẵn; đặt "chromium" để dùng bản của Playwright
    headless: false,
  });
  try {
    const ctx = await browser.newContext({ locale: "vi-VN", viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(20_000);
    await page.goto(url, { waitUntil: "domcontentloaded" });

    await page.getByRole("tab", { name: /Bài đánh giá|Reviews/ }).click();
    await page.waitForSelector("div.jftiEf[data-review-id]");

    // đổi sắp xếp "Phù hợp nhất" -> "Mới nhất"
    await page.waitForTimeout(1500); // click quá sớm thì menu sắp xếp không mở
    await page.getByRole("button", { name: /Phù hợp nhất|Most relevant/ }).first().click();
    const menu = page.locator('[role="menuitemradio"]');
    await menu.first().waitFor();
    let clicked = false;
    for (const item of await menu.all()) {
      // Google trả chữ tiếng Việt dạng Unicode tổ hợp (NFD), phải chuẩn hóa mới khớp regex
      if (/Mới nhất|Newest/.test(((await item.textContent()) ?? "").normalize("NFC"))) {
        await item.click();
        clicked = true;
        break;
      }
    }
    if (!clicked) throw new Error('Không tìm thấy mục sắp xếp "Mới nhất".');
    await page.waitForTimeout(2500); // chờ danh sách tải lại theo thứ tự mới

    const place = (await page.title()).replace(/ - Google Maps$/, "") || "Google Maps";
    const cards = page.locator("div.jftiEf[data-review-id]");
    const count = Math.min(await cards.count(), MAX_REVIEWS);
    const out: Review[] = [];
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const more = card.locator("button.w8nwRe");
      if (await more.count()) await more.first().click().catch(() => {}); // mở rộng review dài
      const raw = await card.evaluate((el) => ({
        id: el.getAttribute("data-review-id") ?? "",
        author: el.querySelector(".d4r55")?.textContent?.trim() ?? "",
        rating: el.querySelector('[role="img"][aria-label]')?.getAttribute("aria-label") ?? "",
        text: el.querySelector(".wiI7pd")?.textContent?.trim() ?? "",
        date: el.querySelector(".rsqaWe")?.textContent?.trim() ?? "",
      }));
      if (!raw.id) continue;
      out.push({
        id: raw.id,
        source: "Google Maps",
        place,
        author: raw.author.normalize("NFC") || "Ẩn danh",
        rating: parseFloat(raw.rating.replace(",", ".")) || undefined,
        text: raw.text.normalize("NFC"),
        date: raw.date.normalize("NFC"),
        url: page.url(),
      });
    }
    if (!out.length) throw new Error("Không đọc được review nào (giao diện Google có thể đã đổi).");
    return out;
  } finally {
    await browser.close();
  }
}
