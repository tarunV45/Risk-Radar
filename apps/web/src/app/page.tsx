import Link from "next/link";

type Repo = {
  id: string;
  name: string;
  localPath: string;
  createdAt: string;
};

async function getRepos(): Promise<Repo[]> {
  const base = process.env.NEXT_PUBLIC_API_BASE!;
  const res = await fetch(`${base}/repos`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load repos");
  return res.json();
}

export default async function HomePage() {
  const repos = await getRepos();

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Risk Radar</h1>
        <Link className="underline" href="/new">Add repo</Link>
      </header>

      <div className="space-y-3">
        {repos.map((r) => (
          <div key={r.id} className="border rounded p-4 flex items-start justify-between">
            <div>
              <div className="font-medium">{r.name}</div>
              <div className="text-sm text-gray-600">{r.localPath}</div>
              <div className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleString()}</div>
            </div>

            <div className="flex gap-2">
              <form action={`/repos/${r.id}/scan`} method="post">
                <button className="border rounded px-3 py-1">Scan</button>
              </form>
              <Link className="border rounded px-3 py-1" href={`/repos/${r.id}`}>View</Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}