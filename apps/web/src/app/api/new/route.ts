import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const form = await req.formData();
  const name = String(form.get("name") || "");
  const localPath = String(form.get("localPath") || "");

  const base = process.env.NEXT_PUBLIC_API_BASE!;
  const res = await fetch(`${base}/repos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, localPath })
  });

  if (!res.ok) {
    const text = await res.text();
    return new NextResponse(text, { status: 400 });
  }

  return NextResponse.redirect(new URL("/", req.url));
}