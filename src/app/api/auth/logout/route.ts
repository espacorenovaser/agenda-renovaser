import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const res = NextResponse.redirect(new URL("/", url.origin));
  res.cookies.delete("rs_session_email");
  res.cookies.delete("rs_session_name");
  // limpa cookies setando maxAge 0
  res.cookies.set("rs_session_email", "", { maxAge: 0, path: "/" });
  res.cookies.set("rs_session_name", "", { maxAge: 0, path: "/" });
  return res;
}
