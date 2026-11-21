import app from "./app.js";
import config from "./config/env.js";
import jobStore from "./services/jobStore.js";
import jobWorker from "./services/jobWorker.js";
import { runStartupTest } from "./services/llm/index.js";

const PORT = config.PORT;

function sanitizeError(err) {
  if (!err) return "";
  const msg = err.message || String(err);
  return msg.replace(/:[^:@]+@/, ":****@");
}

process.on("unhandledRejection", (reason) => {
  console.error("💥 Unhandled Rejection:", sanitizeError(reason));
});

process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", sanitizeError(err));
});

const server = app.listen(PORT, "0.0.0.0", async () => {
  console.log(
    `🚀  Server running in ${config.NODE_ENV} mode on http://0.0.0.0:${PORT}`
  );

  // Initialize job store (Redis with memory fallback)
  await jobStore.init();

  jobWorker.resumeRunningJobsOnBoot().catch((err) => {
    console.warn("⚠️ Failed to resume running jobs on boot:", err.message);
  });
  runStartupTest().catch((err) => {
    console.warn("⚠️ LLM startup self-test error:", err.message);
  });
});

// ---------------------------------------------------------------------------
// Graceful shutdown — let in-flight requests finish before exiting.
// ---------------------------------------------------------------------------
const shutdown = async (signal) => {
  console.log(`\n⏳  ${signal} received — shutting down gracefully…`);
  try {
    await jobWorker.handleShutdown();
    await jobStore.close();
  } catch (err) {
    console.error("Error during job worker shutdown:", err);
  }

  server.close(() => {
    console.log("✅  All connections closed. Bye!");
    process.exit(0);
  });

  // Force-kill if shutdown takes too long (10 s)
  setTimeout(() => {
    console.error("⚠️  Forced shutdown after timeout.");
    process.exit(1);
  }, 10_000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
