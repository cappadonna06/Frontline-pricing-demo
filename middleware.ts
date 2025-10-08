import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const USER = process.env.BASIC_AUTH_USER || "";
const PASS = process.env.BASIC_AUTH_PASS || "";

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get("authorization");
  const url = req.nextUrl;

  if (basicAuth) {
    const authValue = basicAuth.split(" ")[1];
    const [user, pwd] = atob(authValue).split(":");

    if (user === USER && pwd === PASS) {
      return NextResponse.next();
    }
  }

  return new Response("Auth required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Secure Area"' },
  });
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|api/).*)"],
};
