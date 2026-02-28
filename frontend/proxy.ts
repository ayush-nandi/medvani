import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const isChatPath = request.nextUrl.pathname.startsWith("/chat");
  if (!isChatPath) return NextResponse.next();

  const hasAuthCookie = request.cookies.get("medvani_auth")?.value === "1";
  if (!hasAuthCookie) {
    const signupUrl = new URL("/auth/signup", request.url);
    return NextResponse.redirect(signupUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/chat/:path*"],
};
