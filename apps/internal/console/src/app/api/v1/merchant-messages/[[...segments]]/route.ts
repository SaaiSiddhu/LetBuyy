import { NextRequest, NextResponse } from "next/server";
import { MerchantMessageCommandSchema } from "@letbuyy/shared-types";
import { requireConsoleApiSession } from "@/lib/console-api-auth";
import { fetchConsoleApi } from "@/lib/console-api";
async function handle(
  request: NextRequest,
  { params }: { params: Promise<{ segments?: string[] }> },
) {
  const denied = await requireConsoleApiSession(request, { mfa: true });
  if (denied) return denied;
  const { segments = [] } = await params,
    path = segments.join("/");
  if (
    (request.method === "GET" &&
      !/^(?:accounts|[0-9a-f-]{36}(?:\/review)?)?$/i.test(path)) ||
    (request.method === "POST" && path !== "commands")
  )
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  let body: unknown;
  if (request.method === "POST") {
    if (request.headers.get("origin") !== request.nextUrl.origin)
      return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
    const parsed = MerchantMessageCommandSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return NextResponse.json(
        { error: "Check the message fields and reason." },
        { status: 400 },
      );
    if (request.headers.get("X-Idempotency-Key") !== parsed.data.request_key)
      return NextResponse.json(
        { error: "Use the original request key." },
        { status: 400 },
      );
    body = parsed.data;
  }
  const result = await fetchConsoleApi(
    "/internal/console/merchant-messages" + (path ? "/" + path : ""),
    {
      method: request.method as "GET" | "POST",
      query:
        request.method === "GET"
          ? Object.fromEntries(request.nextUrl.searchParams)
          : undefined,
      body,
      idempotencyKey: request.headers.get("X-Idempotency-Key") || undefined,
    },
  );
  return NextResponse.json(result.data ?? { error: result.error }, {
    status: result.error ? result.status || 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
export const GET = handle;
export const POST = handle;
