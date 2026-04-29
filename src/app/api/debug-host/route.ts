import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMP: diagnostic endpoint to capture how Railway forwards the host.
// Delete this file once www→apex redirect is confirmed working in prod.
export async function GET(request: NextRequest) {
  const allHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    allHeaders[key] = value;
  });

  return NextResponse.json({
    nextUrl: {
      host: request.nextUrl.host,
      hostname: request.nextUrl.hostname,
      origin: request.nextUrl.origin,
      protocol: request.nextUrl.protocol,
      pathname: request.nextUrl.pathname,
    },
    headers: allHeaders,
    requestUrl: request.url,
  });
}
