import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const res = NextResponse.redirect(new URL("/", url.origin));
  res.cookies.delete("rs_session");
  res.cookies.delete("rs_session_email");
  res.cookies.delete("rs_session_name");
  return res;
}
