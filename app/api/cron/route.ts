import { NextRequest, NextResponse } from "next/server";
import { checkOnce } from "@/lib/check";
import { listChats, sendTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Vercel Cron gửi "Authorization: Bearer <CRON_SECRET>"; dịch vụ cron khác có thể dùng ?secret=
  return (
    req.headers.get("authorization") === `Bearer ${secret}` ||
    req.nextUrl.searchParams.get("secret") === secret
  );
}

/**
 * GET /api/cron                    kiểm tra review mới và gửi Telegram
 * GET /api/cron?notifyExisting=1   lần đầu cũng gửi các review hiện có
 * GET /api/cron?action=test        gửi tin nhắn thử
 * GET /api/cron?action=chat-id     liệt kê chat id (nhắn /start cho bot trước)
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const params = req.nextUrl.searchParams;
  try {
    switch (params.get("action")) {
      case "chat-id":
        return NextResponse.json({ chats: await listChats() });
      case "test":
        await sendTelegram("✅ Bot thông báo review đã kết nối thành công.");
        return NextResponse.json({ ok: true });
      default: {
        const results = await checkOnce(params.get("notifyExisting") === "1");
        const failed = results.some((r) => r.error);
        return NextResponse.json({ ok: !failed, results }, { status: failed ? 502 : 200 });
      }
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
