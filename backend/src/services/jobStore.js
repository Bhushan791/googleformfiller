import crypto from "node:crypto";
import Redis from "ioredis";
import config from "../config/env.js";

/**
 * Hashing utility: Hash client IP with SHA-256 (never store raw IP).
 */
export function hashIp(ip = "127.0.0.1") {
  return crypto.createHash("sha256").update(ip.trim()).digest("hex");
}

/**
 * JobStore interface abstraction.
 * Implemented with Redis if REDIS_URL is provided, otherwise In-Memory.
 */
class MemoryJobStore {
  constructor() {
    this.jobs = new Map();
    this.creationTimestamps = new Map(); // ipHash -> [timestampMs, ...]
    console.warn(
      "⚠️  REDIS_URL is not configured: using In-Memory job store. Jobs will not survive server restarts!"
    );
  }

  async createJob(job) {
    this.jobs.set(job.id, JSON.parse(JSON.stringify(job)));
    const now = Date.now();
    const timestamps = this.creationTimestamps.get(job.ipHash) || [];
    // Retain only last hour
    const recent = timestamps.filter((t) => now - t < 60 * 60 * 1000);
    recent.push(now);
    this.creationTimestamps.set(job.ipHash, recent);
    return this.getJob(job.id);
  }

  async getJob(id) {
    const job = this.jobs.get(id);
    if (!job) return null;
    return JSON.parse(JSON.stringify(job));
  }

  async updateJob(id, updates) {
    const existing = this.jobs.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
      results: updates.results ? [...updates.results] : existing.results,
    };
    this.jobs.set(id, updated);
    return JSON.parse(JSON.stringify(updated));
  }

  async getActiveJobsCount() {
    let count = 0;
    for (const job of this.jobs.values()) {
      if (job.status === "queued" || job.status === "running") {
        count++;
      }
    }
    return count;
  }

  async getActiveJobsForIp(ipHash) {
    const list = [];
    for (const job of this.jobs.values()) {
      if (
        job.ipHash === ipHash &&
        (job.status === "queued" || job.status === "running")
      ) {
        list.push(JSON.parse(JSON.stringify(job)));
      }
    }
    return list;
  }

  async getCreationCountLastHour(ipHash) {
    const now = Date.now();
    const timestamps = this.creationTimestamps.get(ipHash) || [];
    const valid = timestamps.filter((t) => now - t < 60 * 60 * 1000);
    this.creationTimestamps.set(ipHash, valid);
    return valid.length;
  }

  async getRunningJobs() {
    const list = [];
    for (const job of this.jobs.values()) {
      if (job.status === "running") {
        list.push(JSON.parse(JSON.stringify(job)));
      }
    }
    return list;
  }

  async setJobTTL(id, ttlSeconds = 86400) {
    setTimeout(() => {
      this.jobs.delete(id);
    }, ttlSeconds * 1000).unref();
  }
}

class RedisJobStore {
  constructor(redisUrl) {
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        return Math.min(times * 100, 3000);
      },
    });

    this.client.on("error", (err) => {
      console.error("❌ Redis connection error:", err.message);
    });
  }

  jobKey(id) {
    return `formbot:job:${id}`;
  }

  ipHistoryKey(ipHash) {
    return `formbot:ip_history:${ipHash}`;
  }

  async createJob(job) {
    const key = this.jobKey(job.id);
    await this.client.set(key, JSON.stringify(job));
    // Record creation timestamp for rate limiting (1 hr window)
    const histKey = this.ipHistoryKey(job.ipHash);
    const now = Date.now();
    await this.client.zadd(histKey, now, `${job.id}:${now}`);
    await this.client.zremrangebyscore(histKey, 0, now - 60 * 60 * 1000);
    await this.client.expire(histKey, 3600);
    return job;
  }

  async getJob(id) {
    const raw = await this.client.get(this.jobKey(id));
    if (!raw) return null;
    return JSON.parse(raw);
  }

  async updateJob(id, updates) {
    const existing = await this.getJob(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    await this.client.set(this.jobKey(id), JSON.stringify(updated));
    return updated;
  }

  async getActiveJobsCount() {
    const keys = await this.client.keys("formbot:job:*");
    let count = 0;
    for (const k of keys) {
      const raw = await this.client.get(k);
      if (raw) {
        const j = JSON.parse(raw);
        if (j.status === "queued" || j.status === "running") {
          count++;
        }
      }
    }
    return count;
  }

  async getActiveJobsForIp(ipHash) {
    const keys = await this.client.keys("formbot:job:*");
    const active = [];
    for (const k of keys) {
      const raw = await this.client.get(k);
      if (raw) {
        const j = JSON.parse(raw);
        if (
          j.ipHash === ipHash &&
          (j.status === "queued" || j.status === "running")
        ) {
          active.push(j);
        }
      }
    }
    return active;
  }

  async getCreationCountLastHour(ipHash) {
    const histKey = this.ipHistoryKey(ipHash);
    const now = Date.now();
    await this.client.zremrangebyscore(histKey, 0, now - 60 * 60 * 1000);
    return await this.client.zcard(histKey);
  }

  async getRunningJobs() {
    const keys = await this.client.keys("formbot:job:*");
    const running = [];
    for (const k of keys) {
      const raw = await this.client.get(k);
      if (raw) {
        const j = JSON.parse(raw);
        if (j.status === "running") {
          running.push(j);
        }
      }
    }
    return running;
  }

  async setJobTTL(id, ttlSeconds = 86400) {
    await this.client.expire(this.jobKey(id), ttlSeconds);
  }
}

// Select implementation based on environment configuration
let storeInstance = null;
if (config.REDIS_URL && config.REDIS_URL.trim() !== "") {
  try {
    storeInstance = new RedisJobStore(config.REDIS_URL);
  } catch (err) {
    console.warn("⚠️ Failed to connect to Redis, falling back to MemoryJobStore:", err.message);
    storeInstance = new MemoryJobStore();
  }
} else {
  storeInstance = new MemoryJobStore();
}

export { MemoryJobStore, RedisJobStore };
export default storeInstance;

