/**
 * Concurrency limiter to bound parallel LLM calls to maxConcurrency (default 2),
 * with an asynchronous FIFO queue for pending requests.
 */
export class ConcurrencyLimiter {
  constructor(maxConcurrency = 2) {
    this.maxConcurrency = maxConcurrency;
    this.active = 0;
    this.queue = [];
  }

  async run(fn) {
    if (this.active >= this.maxConcurrency) {
      await new Promise((resolve) => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next();
      }
    }
  }

  get queueLength() {
    return this.queue.length;
  }

  get activeCount() {
    return this.active;
  }
}

