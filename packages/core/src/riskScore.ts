import semver from "semver";

export type RiskFlag =
  | "OUTDATED_MAJOR"
  | "OUTDATED_MINOR"
  | "OUTDATED_PATCH"
  | "DEPRECATED"
  | "PRERELEASE";

export function computeRiskScore(args: {
  resolvedVersion: string;
  latestVersion: string;
  deprecated?: boolean;
}): { riskScore: number; flags: RiskFlag[] } {
  const flags: RiskFlag[] = [];
  let score = 0;

  const resolved = semver.coerce(args.resolvedVersion)?.version;
  const latest = semver.coerce(args.latestVersion)?.version;

  if (resolved && latest) {
    const r = semver.parse(resolved)!;
    const l = semver.parse(latest)!;

    if (semver.lt(resolved, latest)) {
      if (r.major !== l.major) {
        flags.push("OUTDATED_MAJOR");
        score += 50;
      } else if (r.minor !== l.minor) {
        flags.push("OUTDATED_MINOR");
        score += 25;
      } else if (r.patch !== l.patch) {
        flags.push("OUTDATED_PATCH");
        score += 10;
      }
    }

    if (semver.prerelease(resolved)) {
      flags.push("PRERELEASE");
      score += 15;
    }
  }

  if (args.deprecated) {
    flags.push("DEPRECATED");
    score += 30;
  }

  return { riskScore: Math.min(100, score), flags };
}