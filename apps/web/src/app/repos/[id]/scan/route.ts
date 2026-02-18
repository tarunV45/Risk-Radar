import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const base = process.env.NEXT_PUBLIC_API_BASE;
  if (!base) {
    return new NextResponse("NEXT_PUBLIC_API_BASE is not set", { status: 500 });
  }

  const res = await fetch(`${base}/repos/${id}/scans`, { method: "POST" });

  if (!res.ok) {
    const text = await res.text();
    return new NextResponse(text, { status: res.status });
  }

  const data = await res.json(); // { scanId, status }
  return NextResponse.redirect(new URL(`/scans/${data.scanId}`, req.url));
}