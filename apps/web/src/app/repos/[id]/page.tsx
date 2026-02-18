import Link from "next/link";

type Repo = { id: string; name: string; localPath: string; createdAt: string };
type LatestScan = { repoId: string; latestScan: { id: string; status: string; createdAt: string } | null };

async function getRepo(id: string): Promise<Repo> {
  const base = process.env.NEXT_PUBLIC_API_BASE!;
  const res = await fetch(`${base}/repos/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Repo not found");
  return res.json();
}

async function getLatestScan(id: string): Promise<LatestScan> {
  const base = process.env.NEXT_PUBLIC_API_BASE!;
  const res = await fetch(`${base}/repos/${id}/latest-scan`, { cache: "no-store" });
  if (!res.ok) return { repoId: id, latestScan: null };
  return res.json();
}

export default async function RepoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getRepo(id);
  const latest = await getLatestScan(id);

  return (
    <main className="p-6 space-y-6">
      <Link className="underline" href="/">← Back</Link>

      <div className="border rounded p-4 space-y-1">
        <div className="text-xl font-semibold">{repo.name}</div>
        <div className="text-sm text-gray-600">{repo.localPath}</div>
        <div className="text-xs text-gray-500">{new Date(repo.createdAt).toLocaleString()}</div>
      </div>

      <div className="flex gap-2">
        <form action={`/repos/${repo.id}/scan`} method="post">
          <button className="border rounded px-3 py-2">Scan now</button>
        </form>
        {latest.latestScan?.id && (
          <Link className="border rounded px-3 py-2" href={`/scans/${latest.latestScan.id}`}>
            View latest scan
          </Link>
        )}
      </div>

      <div className="border rounded p-4">
        <div className="font-medium mb-2">Latest scan</div>
        {latest.latestScan ? (
          <div className="text-sm">
            <div>Status: {latest.latestScan.status}</div>
            <div>Created: {new Date(latest.latestScan.createdAt).toLocaleString()}</div>
            <div>Scan ID: {latest.latestScan.id}</div>
          </div>
        ) : (
          <div className="text-sm text-gray-600">No scans yet.</div>
        )}
      </div>
    </main>
  );
}