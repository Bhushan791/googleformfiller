import crypto from "node:crypto";
import Redis from "ioredis";
import config from "../config/env.js";

/**
 * Mask Redis URL to prevent leaking credentials in logs, errors, or reports.
 * Example: rediss://default:****@true-javelin-210190.upstash.io:6379
 */
export function maskRedisUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const user = parsed.username || "default";
    return `${parsed.protocol}//${user}:****@${parsed.host}`;
  } catch {
    return "rediss://default:****@host:6379";
  }
}

/**
 * Clean error message by masking any passwords or tokens.
 */
function sanitizeErrorMessage(msg) {
  if (!msg) return "";
  return msg.replace(/:[^:@]+@/, ":****@");
}

/**
 * Hashing utility: Hash client IP with SHA-256 (never store raw IP).
 */
export function hashIp(ip = "127.0.0.1") {
  return crypto.createHash("sha256").update(ip.trim()).digest("hex");
}

/**
 * In-Memory Job Store implementation.
 */
export class MemoryJobStore {
  constructor() {
    this.jobs = new Map();
    this.creationTimestamps = new Map(); // ipHash -> [timestampMs, ...]
  }

  async ping() {
    return "PONG";
  }

  async createJob(job) {
    this.jobs.set(job.id, JSON.parse(JSON.stringify(job)));
    const now = Date.now();
    const timestamps = this.creationTimestamps.get(job.ipHash) || [];
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

  async deleteJob(id) {
    this.jobs.delete(id);
  }

  async close() {
    this.jobs.clear();
  }
}

/**
 * Redis Job Store implementation via ioredis with TLS (rediss://) support.
 */
export class RedisJobStore {
  constructor(redisUrl, options = {}) {
    this.redisUrl = redisUrl;
    this.suppressErrors = options.suppressErrors ?? false;
    if (options.client) {
      this.client = options.client;
    } else {
      this.client = new Redis(redisUrl, {
        connectTimeout: 10000,
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          if (times > 5) return null; // stop retrying after 5 attempts
          return Math.min(times * 200, 3000);
        },
        lazyConnect: true,
        enableReadyCheck: true,
      });
    }

    // Lazy error handling to avoid uncaught exception crashes
    this.client.on("error", (err) => {
      if (this.suppressErrors) return;
      const safeMsg = sanitizeErrorMessage(err.message);
      // Suppress noisy output on known closed/retrying sockets
      if (!safeMsg.includes("Connection is closed")) {
        console.warn("⚠️  Redis client warning:", safeMsg);
      }
    });
  }

  jobKey(id) {
    return `faf:job:${id}`;
  }

  ipHistoryKey(ipHash) {
    return `faf:ip_history:${ipHash}`;
  }

  async ping() {
    return await this.client.ping();
  }

  async createJob(job) {
    const key = this.jobKey(job.id);
    await this.client.set(key, JSON.stringify(job));
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
    const updated = {
      ...existing,
      ...updates,
      results: updates.results ? [...updates.results] : existing.results,
    };
    await this.client.set(this.jobKey(id), JSON.stringify(updated));

    // Ensure 24h TTL on finished jobs
    if (["completed", "failed", "cancelled"].includes(updated.status)) {
      await this.setJobTTL(id, 86400);
    }

    return updated;
  }

  async getActiveJobsCount() {
    const keys = await this.client.keys(this.jobKey("*"));
    let count = 0;
    for (const k of keys) {
      const raw = await this.client.get(k);
      if (raw) {
        try {
          const j = JSON.parse(raw);
          if (j.status === "queued" || j.status === "running") {
            count++;
          }
        } catch {}
      }
    }
    return count;
  }

  async getActiveJobsForIp(ipHash) {
    const keys = await this.client.keys(this.jobKey("*"));
    const active = [];
    for (const k of keys) {
      const raw = await this.client.get(k);
      if (raw) {
        try {
          const j = JSON.parse(raw);
          if (
            j.ipHash === ipHash &&
            (j.status === "queued" || j.status === "running")
          ) {
            active.push(j);
          }
        } catch {}
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
    const keys = await this.client.keys(this.jobKey("*"));
    const running = [];
    for (const k of keys) {
      const raw = await this.client.get(k);
      if (raw) {
        try {
          const j = JSON.parse(raw);
          if (j.status === "running") {
            running.push(j);
          }
        } catch {}
      }
    }
    return running;
  }

  async setJobTTL(id, ttlSeconds = 86400) {
    await this.client.expire(this.jobKey(id), ttlSeconds);
  }

  async deleteJob(id) {
    await this.client.del(this.jobKey(id));
  }

  async close() {
    try {
      if (typeof this.client.quit === "function") {
        await this.client.quit();
      }
    } catch {}
  }
}

/**
 * Resilient Job Store facade:
 * Connects to Redis via rediss://, falling back gracefully to MemoryJobStore
 * on connection error or when REDIS_URL is not configured.
 */
export class ResilientJobStore {
  constructor(redisUrl = config.REDIS_URL) {
    this.redisUrl = redisUrl;
    this.memoryStore = new MemoryJobStore();
    this.redisStore = null;
    this.status = "memory-fallback";
    this.mode = "memory";
    this._initialized = false;
  }

  getStatus() {
    return this.status;
  }

  get activeStore() {
    return this.mode === "redis" && this.redisStore ? this.redisStore : this.memoryStore;
  }

  async init() {
    if (this._initialized) return;
    this._initialized = true;

    if (!this.redisUrl || this.redisUrl.trim() === "") {
      console.warn(
        "⚠️  REDIS_URL is not configured: using In-Memory job store. Jobs will not survive server restarts!"
      );
      this.mode = "memory";
      this.status = "memory-fallback";
      return;
    }

    try {
      this.redisStore = new RedisJobStore(this.redisUrl, { suppressErrors: true });
      if (typeof this.redisStore.client.connect === "function") {
        await this.redisStore.client.connect();
      }
      await this.redisStore.ping();
      this.redisStore.suppressErrors = false;
      this.mode = "redis";
      this.status = "connected";
      console.log("Job store: Redis (connected)");

      this.redisStore.client.on("ready", () => {
        this.status = "connected";
        this.mode = "redis";
      });

      this.redisStore.client.on("close", () => {
        this.status = "memory-fallback";
      });
    } catch (err) {
      if (this.redisStore) {
        this.redisStore.suppressErrors = true;
      }
      const safeErr = sanitizeErrorMessage(err.message) || "Connection failed";
      let shortReason = safeErr;
      if (safeErr.includes("WRONGPASS")) shortReason = "WRONGPASS";
      else if (safeErr.includes("ETIMEDOUT") || safeErr.includes("timeout")) shortReason = "timeout";
      console.warn(`⚠️  Failed to connect to Redis (${shortReason}), falling back to in-memory store`);
      try {
        if (this.redisStore?.client) {
          this.redisStore.client.disconnect(false);
        }
      } catch {}
      this.mode = "memory";
      this.status = "memory-fallback";
    }
  }

  async createJob(job) {
    try {
      return await this.activeStore.createJob(job);
    } catch (err) {
      console.warn("⚠️  Redis createJob failed, falling back to memory:", sanitizeErrorMessage(err.message));
      this.status = "memory-fallback";
      return await this.memoryStore.createJob(job);
    }
  }

  async getJob(id) {
    try {
      return await this.activeStore.getJob(id);
    } catch (err) {
      console.warn("⚠️  Redis getJob failed, falling back to memory:", sanitizeErrorMessage(err.message));
      this.status = "memory-fallback";
      return await this.memoryStore.getJob(id);
    }
  }

  async updateJob(id, updates) {
    try {
      return await this.activeStore.updateJob(id, updates);
    } catch (err) {
      console.warn("⚠️  Redis updateJob failed, falling back to memory:", sanitizeErrorMessage(err.message));
      this.status = "memory-fallback";
      return await this.memoryStore.updateJob(id, updates);
    }
  }

  async getActiveJobsCount() {
    try {
      return await this.activeStore.getActiveJobsCount();
    } catch (err) {
      console.warn("⚠️  Redis getActiveJobsCount failed, falling back to memory:", sanitizeErrorMessage(err.message));
      this.status = "memory-fallback";
      return await this.memoryStore.getActiveJobsCount();
    }
  }

  async getActiveJobsForIp(ipHash) {
    try {
      return await this.activeStore.getActiveJobsForIp(ipHash);
    } catch (err) {
      console.warn("⚠️  Redis getActiveJobsForIp failed, falling back to memory:", sanitizeErrorMessage(err.message));
      this.status = "memory-fallback";
      return await this.memoryStore.getActiveJobsForIp(ipHash);
    }
  }

  async getCreationCountLastHour(ipHash) {
    try {
      return await this.activeStore.getCreationCountLastHour(ipHash);
    } catch (err) {
      console.warn("⚠️  Redis getCreationCountLastHour failed, falling back to memory:", sanitizeErrorMessage(err.message));
      this.status = "memory-fallback";
      return await this.memoryStore.getCreationCountLastHour(ipHash);
    }
  }

  async getRunningJobs() {
    try {
      return await this.activeStore.getRunningJobs();
    } catch (err) {
      console.warn("⚠️  Redis getRunningJobs failed, falling back to memory:", sanitizeErrorMessage(err.message));
      this.status = "memory-fallback";
      return await this.memoryStore.getRunningJobs();
    }
  }

  async setJobTTL(id, ttlSeconds = 86400) {
    try {
      return await this.activeStore.setJobTTL(id, ttlSeconds);
    } catch (err) {
      console.warn("⚠️  Redis setJobTTL failed:", sanitizeErrorMessage(err.message));
      return await this.memoryStore.setJobTTL(id, ttlSeconds);
    }
  }

  async deleteJob(id) {
    try {
      return await this.activeStore.deleteJob(id);
    } catch (err) {
      return await this.memoryStore.deleteJob(id);
    }
  }

  async close() {
    if (this.redisStore) {
      await this.redisStore.close();
    }
    await this.memoryStore.close();
  }
}

const storeInstance = new ResilientJobStore();
export default storeInstance;
