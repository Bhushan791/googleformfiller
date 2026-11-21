import dotenv from "dotenv";
dotenv.config();

import {
  getConfiguredProviders,
  runStartupTest,
} from "../services/llm/index.js";

async function main() {
  console.log("🔍 Checking LLM Providers configuration...\n");
  const providers = getConfiguredProviders();

  if (providers.length === 0) {
    console.error("❌ No LLM providers configured in .env (GEMINI_KEY or GROQ_KEY).");
    process.exit(1);
  }

  console.log(`Found ${providers.length} configured provider(s):`);
  providers.forEach((p) => {
    console.log(`  • ${p.name} (model: ${p.model}, key: ${p.maskedKey})`);
  });
  console.log("\nTesting provider connectivity (prompt: 'Reply with the word OK')...\n");

  const results = await runStartupTest({ silent: false });

  console.log("\n=== Test Results Summary ===");
  const okProviders = results.providers.filter((r) => r.status === "OK");
  const failedProviders = results.providers.filter((r) => r.status !== "OK");

  console.log(`Working: ${okProviders.length} / ${results.providers.length}`);

  if (okProviders.length === 0) {
    console.error("\n❌ All LLM providers failed connectivity tests.");
    process.exit(1);
  } else {
    console.log("\n✅ At least one LLM provider is active and functional.");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Unexpected error in test-llm:", err);
  process.exit(1);
});

