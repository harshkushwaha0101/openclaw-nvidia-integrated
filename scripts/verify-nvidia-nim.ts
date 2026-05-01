/**
 * Quick test script to verify NVIDIA NIM provider setup
 * Usage: pnpm ts-node scripts/verify-nvidia-nim.ts
 */

import { buildNvidiaProvider } from "../extensions/nvidia/provider-catalog.js";

async function verifySetup() {
  console.log("\n=== OpenClaw NVIDIA NIM Setup Verification ===\n");

  // Check environment variables
  const apiKey = process.env.NVIDIA_API_KEY;
  const baseUrl = process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1";

  console.log("📋 Configuration Check:");
  console.log(`  NVIDIA_API_KEY: ${apiKey ? "✓ Set" : "✗ Not set"}`);
  console.log(`  NVIDIA_NIM_BASE_URL: ${baseUrl}`);

  if (!apiKey) {
    console.log("\n⚠️  Warning: NVIDIA_API_KEY is not set");
    console.log("   Set it with: set NVIDIA_API_KEY=nvapi-your-key-here");
    console.log("   Or load it from: .openclaw/credentials/nvidia.env");
  }

  // Build provider and fetch models
  console.log("\n🔄 Building provider...");
  const provider = await buildNvidiaProvider();

  console.log("\n✅ Provider Configuration:");
  console.log(`  Base URL: ${provider.baseUrl}`);
  console.log(`  API Type: ${provider.api}`);
  console.log(`  Available Models: ${provider.models.length}`);

  if (provider.models.length > 0) {
    console.log("\n📦 Available Models:");
    provider.models.slice(0, 10).forEach((model, idx) => {
      console.log(`  ${idx + 1}. ${model.name}`);
      console.log(`     ID: ${model.id}`);
      console.log(`     Context: ${model.contextWindow} tokens, Max: ${model.maxTokens}`);
    });

    if (provider.models.length > 10) {
      console.log(`  ... and ${provider.models.length - 10} more models`);
    }
  } else {
    console.log("\n⚠️  No models found. Check your API key and network connection.");
  }

  console.log("\n✨ Setup Verification Complete!\n");
}

verifySetup().catch((err) => {
  console.error("❌ Error during verification:", err);
  process.exit(1);
});
