import { NextRequest, NextResponse } from "next/server";
import { MerchantInboxQuerySchema } from "@letbuyy/shared-types";
import { merchantApiFetch, merchantApiErrorResponse } from "@/lib/api/client";
import { validateMerchantMutationRequest } from "@/lib/api/request-origin";
async function handle(
  request: NextRequest,
  { params }: { params: Promise<{ segments?: string[] }> },
) {
  try {
    const { segments = [] } = await params,
      path = segments.join("/");
    if (
      (request.method === "GET" && !/^(?:count|[0-9a-f-]{36})?$/i.test(path)) ||
      (request.method === "PATCH" && !/^[0-9a-f-]{36}\/read$/i.test(path))
    )
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (request.method === "PATCH") {
      const denied = validateMerchantMutationRequest(request, {
        requireKey: false,
      });
      if (denied) return denied;
    }
    const query = MerchantInboxQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!query.success)
      return NextResponse.json(
        { error: "Invalid inbox filters." },
        { status: 400 },
      );
    const search = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(query.data).map(([key, value]) => [key, String(value)]),
      ),
      source: "platform",
    });
    const result = await merchantApiFetch(
      "/notifications" +
        (path ? "/" + path : "") +
        (request.method === "GET" ? "?" + search : ""),
      {
        method: request.method,
        requireSession: true,
        cache: "no-store",
        ...(request.method === "PATCH" ? { body: "{}" } : {}),
      },
    );
    return new NextResponse(await result.text(), {
      status: result.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return merchantApiErrorResponse(e, "Account inbox unavailable.");
  }
}
export const GET = handle;
export const PATCH = handle;
