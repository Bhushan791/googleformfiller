import { safeFetch, validateUrl } from "../services/formParser.js";

/**
 * Dev utility to inspect a live Google Form.
 * Usage: npm run inspect-form -- <url>
 */

function truncate(str, max = 60) {
  if (typeof str !== "string") {
    str = typeof str === "object" ? JSON.stringify(str) : String(str);
  }
  if (!str) return '""';
  const clean = str.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max) + "…" : clean;
}

function typeOf(val) {
  if (val === null) return "null";
  if (Array.isArray(val)) return `Array(${val.length})`;
  return typeof val;
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: npm run inspect-form -- <url>");
    process.exit(1);
  }

  console.log(`\n🔍 Inspecting Google Form: ${url}\n`);

  validateUrl(url);
  const { response, finalUrl } = await safeFetch(url);
  console.log(`📍 Resolved URL: ${finalUrl}`);
  console.log(`📡 HTTP Status: ${response.status}\n`);

  const html = await response.text();

  // 1. Extract hidden fields
  const hiddenFields = {};
  const hiddenMatches = html.matchAll(/<input[^>]+type=["']hidden["'][^>]*>/gi);
  for (const match of hiddenMatches) {
    const tag = match[0];
    const nameMatch = tag.match(/name=["']([^"']+)["']/i);
    const valueMatch = tag.match(/value=["']([^"']*)["']/i);
    if (nameMatch) {
      hiddenFields[nameMatch[1]] = valueMatch ? valueMatch[1] : "";
    }
  }

  console.log("🔒 Hidden Form Fields in HTML:");
  for (const [k, v] of Object.entries(hiddenFields)) {
    console.log(`   • ${k}: ${truncate(v, 40)}`);
  }
  console.log();

  // 2. Extract FB_PUBLIC_LOAD_DATA_
  const match = html.match(
    /var\s+FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]*?\]);\s*<\/script>/
  );
  if (!match?.[1]) {
    console.error("❌ FB_PUBLIC_LOAD_DATA_ not found in HTML.");
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(match[1]);
  } catch (err) {
    console.error("❌ Failed to parse FB_PUBLIC_LOAD_DATA_ JSON:", err.message);
    process.exit(1);
  }

  const title = data?.[3] ?? data?.[1]?.[8] ?? data?.[1]?.[0] ?? "Untitled";
  const desc =
    typeof data?.[1]?.[0] === "string" && data[1][0] !== title
      ? data[1][0]
      : (typeof data?.[1]?.[1] === "string" ? data[1][1] : "");

  console.log(`📋 Form Title: "${truncate(title, 60)}"`);
  if (desc) console.log(`📝 Description: "${truncate(desc, 60)}"`);

  const items = Array.isArray(data?.[1]?.[1])
    ? data[1][1]
    : Array.isArray(data?.[1]?.[4])
    ? data[1][4]
    : [];

  const basePath = Array.isArray(data?.[1]?.[1]) ? "[1][1]" : "[1][4]";
  console.log(`📊 Found ${items.length} items at ${basePath}:\n`);

  items.forEach((item, idx) => {
    const itemPath = `${basePath}[${idx}]`;
    if (!item) {
      console.log(`  ${itemPath}: null`);
      return;
    }

    const qId = item[0];
    const qTitle = item[1];
    const qType = item[3];
    const answerConfig = item[4];

    console.log(`  ${itemPath} (${typeOf(item)})`);
    console.log(`    ├── id: ${qId} (${typeOf(qId)})`);
    console.log(`    ├── title: "${truncate(qTitle, 50)}" (${typeOf(qTitle)})`);
    console.log(`    ├── typeCode: ${qType} (${typeOf(qType)})`);
    console.log(`    └── answerConfig [4]: ${typeOf(answerConfig)}`);

    // Level 1 inspection
    if (Array.isArray(answerConfig)) {
      answerConfig.forEach((ans, aIdx) => {
        const ansPath = `${itemPath}[4][${aIdx}]`;
        console.log(`        ├── ${ansPath} (${typeOf(ans)})`);
        if (Array.isArray(ans)) {
          console.log(`        │   ├── [0] entryId/id: ${truncate(ans[0], 30)} (${typeOf(ans[0])})`);
          console.log(`        │   ├── [1] options/steps: ${typeOf(ans[1])} ${ans[1] ? truncate(ans[1], 40) : ""}`);
          console.log(`        │   ├── [2] required: ${ans[2]} (${typeOf(ans[2])})`);
          if (ans[3] !== undefined) {
            console.log(`        │   └── [3] labels/meta: ${truncate(ans[3], 40)} (${typeOf(ans[3])})`);
          }
        }
      });
    }
  });

  console.log("\n✅ Inspection complete.");
}

main().catch((err) => {
  console.error("💥 Error inspecting form:", err.message);
  process.exit(1);
});

