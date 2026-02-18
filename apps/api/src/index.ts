import Fastify from "fastify";
import { prisma } from "@risk-radar/db";
import { Queue } from "bullmq";

const fastify = Fastify({ logger: true });

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const scanQueue = new Queue("scan", { connection: { url: redisUrl } });

fastify.get("/health", async () => ({ ok: true }));

fastify.post("/repos", async (req, reply) => {
  const body = req.body as any;
  const name = String(body?.name || "").trim();
  const localPath = String(body?.localPath || "").trim();

  if (!name || !localPath) {
    return reply.code(400).send({ error: "name and localPath are required" });
  }

  const repo = await prisma.repo.create({ data: { name, localPath } });
  return reply.code(201).send(repo);
});

fastify.get("/repos", async () => {
  return prisma.repo.findMany({ orderBy: { createdAt: "desc" } });
});

fastify.post("/repos/:id/scans", async (req, reply) => {
  const repoId = (req.params as any).id as string;
  const repo = await prisma.repo.findUnique({ where: { id: repoId } });
  if (!repo) return reply.code(404).send({ error: "repo not found" });

  const scan = await prisma.scan.create({ data: { repoId, status: "QUEUED" } });

  await scanQueue.add("scanRepo", { scanId: scan.id, repoId: repo.id });

  return reply.code(202).send({ scanId: scan.id, status: scan.status });
});

fastify.get("/repos/:id", async (req, reply) => {
  const repoId = (req.params as any).id as string;

  const repo = await prisma.repo.findUnique({ where: { id: repoId } });
  if (!repo) return reply.code(404).send({ error: "repo not found" });

  return repo;
});

fastify.get("/repos/:id/latest-scan", async (req, reply) => {
  const repoId = (req.params as any).id as string;

  const repo = await prisma.repo.findUnique({ where: { id: repoId } });
  if (!repo) return reply.code(404).send({ error: "repo not found" });

  const latestScan = await prisma.scan.findFirst({
    where: { repoId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
      error: true
    }
  });

  return { repoId, latestScan };
});

// fastify.get("/scans/:scanId", async (req, reply) => {
//   const scanId = (req.params as any).scanId as string;

//   const scan = await prisma.scan.findUnique({
//     where: { id: scanId },
//     include: {
//       repo: true,
//       deps: {
//         include: { pkg: true },
//         orderBy: { riskScore: "desc" }
//       }
//     }
//   });

//   if (!scan) return reply.code(404).send({ error: "scan not found" });
//   return scan;
// });

fastify.get("/scans/:scanId", async (req, reply) => {
  const scanId = (req.params as any).scanId as string;

  const q = (req.query as any) ?? {};
  const minRisk = Number.isFinite(Number(q.minRisk)) ? Number(q.minRisk) : 0;
  const limit = Number.isFinite(Number(q.limit)) ? Math.max(1, Math.min(1000, Number(q.limit))) : 1000;
  const onlyDirect = String(q.onlyDirect || "false").toLowerCase() === "true";

  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: {
      repo: true,
      deps: {
        where: {
          riskScore: { gte: minRisk },
          ...(onlyDirect ? { requestedRange: { not: null } } : {})
        },
        include: { pkg: true },
        orderBy: { riskScore: "desc" },
        take: limit
      }
    }
  });

  if (!scan) return reply.code(404).send({ error: "scan not found" });

  return {
    ...scan,
    filters: { minRisk, limit, onlyDirect }
  };
});

fastify.get("/scans/:scanId/summary", async (req, reply) => {
  const scanId = (req.params as any).scanId as string;

  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    select: {
      id: true,
      repoId: true,
      status: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
      error: true
    }
  });

  if (!scan) return reply.code(404).send({ error: "scan not found" });

  const totalAgg = await prisma.scanDependency.aggregate({
    where: { scanId },
    _count: { _all: true },
    _max: { riskScore: true }
  });

  const directDeps = await prisma.scanDependency.count({
    where: { scanId, requestedRange: { not: null } }
  });

  const high = await prisma.scanDependency.count({
    where: { scanId, riskScore: { gte: 50 } }
  });

  const medium = await prisma.scanDependency.count({
    where: { scanId, riskScore: { gte: 25, lt: 50 } }
  });

  const low = await prisma.scanDependency.count({
    where: { scanId, riskScore: { gte: 1, lt: 25 } }
  });

  return {
    scan,
    totals: {
      allDeps: totalAgg._count._all,
      directDeps,
      maxRiskScore: totalAgg._max.riskScore ?? 0
    },
    buckets: { high, medium, low }
  };
});

const port = Number(process.env.PORT || 3001);
fastify.listen({ port, host: "0.0.0.0" }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
