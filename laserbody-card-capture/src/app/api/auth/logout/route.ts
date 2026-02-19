import { NextResponse } from "next/server";

export async function POST() {
  // Clear the JWT cookie
  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.set("lbmd_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
