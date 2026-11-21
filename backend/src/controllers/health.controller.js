/**
 * GET /health
 * Lightweight liveness / readiness probe — no DB calls, no heavy work.
 */
const getHealth = (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    time: new Date().toISOString(),
  });
};

export default getHealth;

