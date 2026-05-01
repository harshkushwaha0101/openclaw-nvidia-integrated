import { describe, expect, it } from "vitest";
import { buildNvidiaProvider } from "./provider-catalog.js";

describe("nvidia provider catalog", () => {
  it("builds the bundled NVIDIA provider defaults", async () => {
    const provider = await buildNvidiaProvider();

    expect(provider.baseUrl).toBe("https://integrate.api.nvidia.com/v1");
    expect(provider.api).toBe("openai-completions");
    // Should return at least the fallback models
    expect(provider.models.length).toBeGreaterThan(0);
    const modelIds = provider.models.map((model) => model.id);
    // Check that fallback models are present
    expect(modelIds).toContain("nvidia/nemotron-3-super-120b-a12b");
  });

  it("has valid model properties", async () => {
    const provider = await buildNvidiaProvider();

    provider.models.forEach((model) => {
      expect(model.id).toBeDefined();
      expect(model.name).toBeDefined();
      expect(model.input).toBeDefined();
      expect(model.contextWindow).toBeGreaterThan(0);
      expect(model.maxTokens).toBeGreaterThan(0);
      expect(model.cost).toBeDefined();
    });
  });
});
