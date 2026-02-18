type Summary = {
  scan: {
    id: string;
    status: string;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    error: string | null;
  };
  totals: { allDeps: number; directDeps: number; maxRiskScore: number };
  buckets: { high: number; medium: number; low: number };
};

type Dep = {
  riskScore: number;
  flags: string[];
  requestedRange: string | null;
  resolvedVersion: string;
  latestVersion: string;
  pkg: { name: string };
};

async function getSummary(scanId: string): Promise<Summary> {
  const base = process.env.NEXT_PUBLIC_API_BASE!;
  const res = await fetch(`${base}/scans/${scanId}/summary`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load summary");
  return res.json();
}

async function getTopRisky(scanId: string): Promise<Dep[]> {
  const base = process.env.NEXT_PUBLIC_API_BASE!;
  const res = await fetch(
    `${base}/scans/${scanId}?minRisk=1&onlyDirect=true&limit=50`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to load deps");
  const data = await res.json();
  return data.deps as Dep[];
}

export default async function ScanPage({ params }: { params: { scanId: string } }) {
  const summary = await getSummary(params.scanId);
  const deps = await getTopRisky(params.scanId);

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Scan {params.scanId}</h1>

      <div className="border rounded p-4 space-y-2">
        <div>Status: <span className="font-medium">{summary.scan.status}</span></div>
        <div>Max risk: {summary.totals.maxRiskScore}</div>
        <div>Deps: {summary.totals.allDeps} (direct: {summary.totals.directDeps})</div>
        <div>High/Med/Low: {summary.buckets.high}/{summary.buckets.medium}/{summary.buckets.low}</div>
        {summary.scan.error && <div className="text-red-600">Error: {summary.scan.error}</div>}
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Top risky direct deps</h2>
        {deps.length === 0 ? (
          <div className="text-gray-600">No risky direct dependencies 🎉</div>
        ) : (
          <div className="border rounded">
            {deps.map((d) => (
              <div key={d.pkg.name} className="p-3 border-b last:border-b-0">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{d.pkg.name}</div>
                  <div className="font-semibold">Risk {d.riskScore}</div>
                </div>
                <div className="text-sm text-gray-700">
                  {d.requestedRange ?? "(transitive)"} • {d.resolvedVersion} → {d.latestVersion}
                </div>
                <div className="text-xs text-gray-600">{d.flags.join(", ")}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
