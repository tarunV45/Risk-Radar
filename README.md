# Risk Radar

A real-time transaction risk scoring engine that detects suspicious financial activity as it happens. Built with an event-driven architecture designed around a core principle: **systems should fail loudly, not silently**.

## Why this exists

Most fraud detection systems catch problems after the fact. Risk Radar scores transactions in real-time using a multi-factor risk engine, flags anomalies immediately, and ensures no alert is ever silently dropped — every failure in the pipeline is surfaced and accounted for.

## Architecture

┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Transaction │────▶│ Risk Scoring│────▶│ Alert │
│ Ingestion │ │ Engine │ │ Service │
│ (API) │ │ (BullMQ) │ │ │
└──────────────┘ └──────────────┘ └──────────────┘
│ │ │
▼ ▼ ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ PostgreSQL │ │ Redis │ │ Dashboard │
│ (Persistence│ │ (Queue + │ │ (Next.js) │
│ + History) │ │ Cache) │ │ │
└──────────────┘ └──────────────┘ └──────────────┘

## Tech stack

- **Runtime**: Node.js, TypeScript
- **Queue/Cache**: Redis, BullMQ (event-driven job processing)
- **Database**: PostgreSQL
- **Frontend**: Next.js, React
- **Infrastructure**: Docker, Docker Compose
- **Monorepo**: Turborepo (apps/ + packages/)

## Key design decisions

- **Event-driven processing**: Transactions flow through BullMQ queues rather than synchronous API calls. This decouples ingestion from scoring, so spikes in traffic don't block the scoring pipeline.
- **Silent failure detection**: Every job in the queue has explicit failure handlers and dead-letter tracking. If a transaction fails to score, it doesn't just disappear — it gets flagged for manual review.
- **Risk scoring composability**: The scoring engine applies multiple independent risk factors (velocity checks, amount anomalies, geo patterns) and combines them into a composite score rather than relying on a single threshold.

## Getting started

### Prerequisites
- Docker and Docker Compose
- Node.js 18+

### Run with Docker

```bash
git clone https://github.com/tarunV45/Risk-Radar.git
cd Risk-Radar
cp .env.example .env
docker-compose up -d
```

### Run locally

```bash
npm install
npm run dev
```
