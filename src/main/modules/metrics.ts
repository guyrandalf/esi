import os from 'os'
import { get as getDb } from './db'

export interface MetricsSnapshot {
  cpuPercent: number
  memPercentUsed: number
  memUsedGb: number
  memTotalGb: number
  uptimeMinutes: number
  loadAvg1: number
  latencyMs: number[] // last 20 command durations
  latencyAvg: number
  commandsPerHour: number[] // 24 buckets, last 24 hours
  commandsToday: number
  errorRatePct: number // of last 50
  totalCommands: number
}

let prevCpu = os.cpus().map((c) => ({ ...c.times }))

function cpuPercent(): number {
  const curr = os.cpus().map((c) => ({ ...c.times }))
  let totalDiff = 0
  let idleDiff = 0
  for (let i = 0; i < curr.length; i++) {
    const prev = prevCpu[i] || curr[i]
    const currC = curr[i]
    const prevTotal =
      prev.user + prev.nice + prev.sys + prev.idle + prev.irq
    const currTotal =
      currC.user + currC.nice + currC.sys + currC.idle + currC.irq
    totalDiff += currTotal - prevTotal
    idleDiff += currC.idle - prev.idle
  }
  prevCpu = curr
  if (totalDiff === 0) return 0
  return Math.max(0, Math.min(100, Math.round(100 * (1 - idleDiff / totalDiff))))
}

export function snapshot(): MetricsSnapshot {
  const memTotal = os.totalmem()
  const memFree = os.freemem()
  const memUsed = memTotal - memFree
  const memPct = Math.round((memUsed / memTotal) * 100)

  const db = getDb()

  // Last 20 command latencies
  const latRows = db
    .prepare(
      `SELECT duration_ms FROM command_log ORDER BY id DESC LIMIT 20`
    )
    .all() as Array<{ duration_ms: number | null }>
  const latencyMs = latRows
    .map((r) => r.duration_ms ?? 0)
    .filter((n) => n > 0)
    .reverse()
  const latencyAvg = latencyMs.length
    ? Math.round(latencyMs.reduce((a, b) => a + b, 0) / latencyMs.length)
    : 0

  // Commands per hour (last 24 hours)
  const now = new Date()
  const hourBuckets: number[] = new Array(24).fill(0)
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const perHour = db
    .prepare(
      `SELECT timestamp FROM command_log WHERE timestamp > ? ORDER BY id ASC`
    )
    .all(from) as Array<{ timestamp: string }>
  for (const row of perHour) {
    const t = new Date(row.timestamp)
    const hoursAgo = Math.floor(
      (now.getTime() - t.getTime()) / (60 * 60 * 1000)
    )
    const bucket = 23 - hoursAgo
    if (bucket >= 0 && bucket < 24) hourBuckets[bucket]++
  }

  // Commands today
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const commandsToday =
    (db
      .prepare(
        `SELECT COUNT(*) as n FROM command_log WHERE timestamp > ?`
      )
      .get(todayStart.toISOString()) as { n: number }).n

  // Error rate (last 50)
  const last50 = db
    .prepare(
      `SELECT ok FROM command_log ORDER BY id DESC LIMIT 50`
    )
    .all() as Array<{ ok: number }>
  const errors = last50.filter((r) => r.ok === 0).length
  const errorRatePct = last50.length
    ? Math.round((errors / last50.length) * 100)
    : 0

  const totalCommands =
    (db.prepare(`SELECT COUNT(*) as n FROM command_log`).get() as {
      n: number
    }).n

  return {
    cpuPercent: cpuPercent(),
    memPercentUsed: memPct,
    memUsedGb: Math.round((memUsed / 1024 ** 3) * 10) / 10,
    memTotalGb: Math.round((memTotal / 1024 ** 3) * 10) / 10,
    uptimeMinutes: Math.round(os.uptime() / 60),
    loadAvg1: Math.round(os.loadavg()[0] * 100) / 100,
    latencyMs,
    latencyAvg,
    commandsPerHour: hourBuckets,
    commandsToday,
    errorRatePct,
    totalCommands
  }
}
