import http from "node:http";
import app from "../app.js";
import config from "../config/env.js";

async function runSimulation() {
  console.log("=== Local Production Simulation ===");
  console.log(`NODE_ENV: ${process.env.NODE_ENV || config.NODE_ENV}`);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Simulation server listening on ${baseUrl}`);

  let allPassed = true;

  try {
    // 1. Test /health
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthJson = await healthRes.json();
    const healthOk = healthRes.status === 200 && healthJson.status === "ok";
    console.log(`1. GET /health -> status: ${healthRes.status}, ok: ${healthOk}`);
    if (!healthOk) allPassed = false;

    // 2. Test /api/status
    const statusRes = await fetch(`${baseUrl}/api/status`);
    const statusJson = await statusRes.json();
    const statusOk =
      statusRes.status === 200 &&
      (statusJson.redis === "connected" || statusJson.redis === "memory") &&
      Array.isArray(statusJson.llm) &&
      typeof statusJson.uptime === "number" &&
      statusJson.version === "1.0.0";
    console.log(`2. GET /api/status -> status: ${statusRes.status}, data: ${JSON.stringify(statusJson)} (valid: ${statusOk})`);
    if (!statusOk) allPassed = false;

    // 3. Test CORS preflight from allowed origin
    const allowedOrigin = config.FRONTEND_URL.split(",")[0].trim().replace(/\/+$/, "");
    const corsAllowedRes = await fetch(`${baseUrl}/api/ping`, {
      method: "OPTIONS",
      headers: {
        Origin: allowedOrigin,
        "Access-Control-Request-Method": "GET",
      },
    });
    const allowOriginHeader = corsAllowedRes.headers.get("access-control-allow-origin");
    const corsAllowedOk = allowOriginHeader === allowedOrigin;
    console.log(`3. CORS preflight (allowed: ${allowedOrigin}) -> header: ${allowOriginHeader} (ok: ${corsAllowedOk})`);
    if (!corsAllowedOk) allPassed = false;

    // 4. Test CORS from blocked origin
    const blockedOrigin = "https://evil.com";
    const corsBlockedRes = await fetch(`${baseUrl}/api/ping`, {
      method: "OPTIONS",
      headers: {
        Origin: blockedOrigin,
        "Access-Control-Request-Method": "GET",
      },
    });
    const blockedOriginHeader = corsBlockedRes.headers.get("access-control-allow-origin");
    const corsBlockedOk = !blockedOriginHeader || blockedOriginHeader !== blockedOrigin;
    console.log(`4. CORS preflight (blocked: ${blockedOrigin}) -> header: ${blockedOriginHeader} (blocked: ${corsBlockedOk})`);
    if (!corsBlockedOk) allPassed = false;

  } finally {
    server.close();
  }

  if (allPassed) {
    console.log("\n✅ All production simulation checks passed!");
    process.exit(0);
  } else {
    console.error("\n❌ Some production simulation checks failed!");
    process.exit(1);
  }
}

runSimulation().catch((err) => {
  console.error("Simulation error:", err);
  process.exit(1);
});

