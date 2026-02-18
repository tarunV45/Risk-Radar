import { Worker } from "bullmq";
import { prisma } from "@risk-radar/db";
import { scanNpmLockfile } from "./scanNpmLockFile.js";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

new Worker(
  "scan",
  async (job: any) => {
    const { scanId, repoId } = job.data as { scanId: string; repoId: string };

    const repo = await prisma.repo.findUnique({ where: { id: repoId } });
    if (!repo) throw new Error("Repo not found");

    await prisma.scan.update({
      where: { id: scanId },
      data: { status: "RUNNING", startedAt: new Date(), error: null }
    });

    try {
      const results = await scanNpmLockfile(repo.localPath);

      // wipe any previous deps for this scan (safe)
      await prisma.scanDependency.deleteMany({ where: { scanId } });

      for (const r of results) {
        const pkg = await prisma.package.upsert({
          where: { name: r.name },
          update: {},
          create: { name: r.name }
        });

        await prisma.scanDependency.create({
          data: {
            scanId,
            packageId: pkg.id,
            requestedRange: r.requestedRange || null,
            resolvedVersion: r.resolvedVersion,
            latestVersion: r.latestVersion,
            riskScore: r.riskScore,
            flags: r.flags
          }
        });
      }

      await prisma.scan.update({
        where: { id: scanId },
        data: { status: "SUCCEEDED", finishedAt: new Date() }
      });

      return { ok: true, deps: results.length };
    } catch (e: any) {
      await prisma.scan.update({
        where: { id: scanId },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          error: String(e?.message || e)
        }
      });
      throw e;
    }
  },
  { connection: { url: redisUrl } }
);

console.log("Worker running: queue=scan");
