import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const PROTECTED_PATHS = [
  "/dashboard",
  "/dashboard/profile",
  "/dashboard/calendar",
  "/api/dashboard/overview",
];

function isProtectedPath(path: string) {
  return PROTECTED_PATHS.some((protectedPath) => path.startsWith(protectedPath));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get("lbmd_token")?.value;
  console.log("MIDDLEWARE: token", token);

  if (!token) {
    console.log("MIDDLEWARE: No token, redirecting to /login");
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  try {
    jwt.verify(token, JWT_SECRET);
    console.log("MIDDLEWARE: Token valid, proceeding");
    return NextResponse.next();
  } catch (err) {
    console.log("MIDDLEWARE: Token invalid", err);
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/dashboard/:path*",
  ],
};
