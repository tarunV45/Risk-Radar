import fs from "node:fs/promises";
import path from "node:path";
import { computeRiskScore } from "@risk-radar/core";

type DepResult = {
  name: string;
  requestedRange?: string;
  resolvedVersion: string;
  latestVersion: string;
  riskScore: number;
  flags: string[];
};

function lockPathToName(lockPath: string): string | null {
  // Examples:
  // node_modules/react
  // node_modules/@types/node
  const prefix = "node_modules/";
  const idx = lockPath.indexOf(prefix);
  if (idx === -1) return null;

  const rest = lockPath.slice(idx + prefix.length);
  if (!rest) return null;

  if (rest.startsWith("@")) {
    const parts = rest.split("/");
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
    return null;
  }

  return rest.split("/")[0] || null;
}

async function fetchNpmMeta(pkgName: string): Promise<any> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(pkgName)}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`npm registry error for ${pkgName}: ${res.status}`);
  return res.json();
}

function extractRequestedRanges(pkgJson: any): Record<string, string> {
  const out: Record<string, string> = {};
  const sections = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
  for (const s of sections) {
    const obj = pkgJson?.[s];
    if (obj && typeof obj === "object") {
      for (const [k, v] of Object.entries(obj)) out[k] = String(v);
    }
  }
  return out;
}

export async function scanNpmLockfile(repoPath: string): Promise<DepResult[]> {
  const lockPath = path.join(repoPath, "package-lock.json");
  const pkgPath = path.join(repoPath, "package.json");

  const [lockRaw, pkgRaw] = await Promise.all([
    fs.readFile(lockPath, "utf8"),
    fs.readFile(pkgPath, "utf8")
  ]);

  const lock = JSON.parse(lockRaw);
  const pkgJson = JSON.parse(pkgRaw);
  const requested = extractRequestedRanges(pkgJson);

  // npm lockfile v2 has "packages": { "": {...}, "node_modules/react": {...} }
  const packagesObj = lock?.packages;
  if (!packagesObj || typeof packagesObj !== "object") {
    throw new Error("Unsupported package-lock.json format (expected lockfile v2 'packages')");
  }

  // Gather unique packages
  const entries: { name: string; resolvedVersion: string }[] = [];
  for (const [p, info] of Object.entries<any>(packagesObj)) {
    if (p === "") continue;
    const name = lockPathToName(p);
    const version = info?.version;
    if (!name || !version) continue;
    entries.push({ name, resolvedVersion: String(version) });
  }

  // De-dupe by name (keep max risk later; MVP keeps first)
  const seen = new Map<string, string>();
  for (const e of entries) if (!seen.has(e.name)) seen.set(e.name, e.resolvedVersion);

  const results: DepResult[] = [];
  // simple concurrency: 8 at a time
  const names = [...seen.entries()];
  let i = 0;

  async function worker() {
    while (i < names.length) {
      const idx = i++;
      const [name, resolvedVersion] = names[idx];

      let meta: any;
      try {
        meta = await fetchNpmMeta(name);
      } catch {
        // If registry fails, still record with latest=resolved
        const { riskScore, flags } = computeRiskScore({ resolvedVersion, latestVersion: resolvedVersion });
        results.push({
          name,
          requestedRange: requested[name],
          resolvedVersion,
          latestVersion: resolvedVersion,
          riskScore,
          flags
        });
        continue;
      }

      const latestVersion = String(meta?.["dist-tags"]?.latest || resolvedVersion);
      const deprecated = Boolean(meta?.deprecated);

      const { riskScore, flags } = computeRiskScore({ resolvedVersion, latestVersion, deprecated });

      results.push({
        name,
        requestedRange: requested[name],
        resolvedVersion,
        latestVersion,
        riskScore,
        flags
      });
    }
  }

  await Promise.all(Array.from({ length: 8 }, () => worker()));

  // sort for convenience
  results.sort((a, b) => b.riskScore - a.riskScore);
  return results;
}