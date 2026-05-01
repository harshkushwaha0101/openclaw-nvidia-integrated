import type { ModelProviderConfig } from "openclaw/plugin-sdk/provider-model-shared";

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const NVIDIA_DEFAULT_MODEL_ID = "nvidia/nemotron-3-super-120b-a12b";
const NVIDIA_DEFAULT_MAX_TOKENS = 8192;
const NVIDIA_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

// Fallback models in case API fetch fails
const FALLBACK_MODELS = [
  {
    id: "moonshotai/kimi-k2.5",
    name: "Kimi K2.5",
    reasoning: false,
    input: ["text" as "text"],
    cost: NVIDIA_DEFAULT_COST,
    contextWindow: 262144,
    maxTokens: NVIDIA_DEFAULT_MAX_TOKENS,
  },
  {
    id: NVIDIA_DEFAULT_MODEL_ID,
    name: "NVIDIA Nemotron 3 Super 120B",
    reasoning: false,
    input: ["text" as "text"],
    cost: NVIDIA_DEFAULT_COST,
    contextWindow: 262144,
    maxTokens: NVIDIA_DEFAULT_MAX_TOKENS,
  },
  {
    id: "minimaxai/minimax-m2.5",
    name: "MiniMax M2.5",
    reasoning: false,
    input: ["text" as "text"],
    cost: NVIDIA_DEFAULT_COST,
    contextWindow: 196608,
    maxTokens: NVIDIA_DEFAULT_MAX_TOKENS,
  },
  {
    id: "z-ai/glm5",
    name: "GLM-5",
    reasoning: false,
    input: ["text" as "text"],
    cost: NVIDIA_DEFAULT_COST,
    contextWindow: 202752,
    maxTokens: NVIDIA_DEFAULT_MAX_TOKENS,
  },
  {
    id: "nvidia/llama-3.1-nemotron-nano-8b-v1",
    name: "NVIDIA Llama 3.1 Nemotron Nano 8B",
    reasoning: false,
    input: ["text" as "text"],
    cost: NVIDIA_DEFAULT_COST,
    contextWindow: 128000,
    maxTokens: NVIDIA_DEFAULT_MAX_TOKENS,
  },
];

// Model metadata for context windows and capabilities
const MODEL_METADATA: Record<string, { contextWindow: number; maxTokens: number; reasoning?: boolean }> = {
  "nvidia/nemotron-3-super-120b-a12b": {
    contextWindow: 262144,
    maxTokens: NVIDIA_DEFAULT_MAX_TOKENS,
  },
  "moonshotai/kimi-k2.5": {
    contextWindow: 262144,
    maxTokens: NVIDIA_DEFAULT_MAX_TOKENS,
  },
  "minimaxai/minimax-m2.5": {
    contextWindow: 196608,
    maxTokens: NVIDIA_DEFAULT_MAX_TOKENS,
  },
  "z-ai/glm5": {
    contextWindow: 202752,
    maxTokens: NVIDIA_DEFAULT_MAX_TOKENS,
  },
  "nvidia/llama-3.1-nemotron-nano-8b-v1": {
    contextWindow: 128000,
    maxTokens: NVIDIA_DEFAULT_MAX_TOKENS,
  },
};

/**
 * Fetch available models from NVIDIA NIM API
 */
async function fetchNvidiaModels(
  apiKey: string,
  baseUrl: string = NVIDIA_BASE_URL
): Promise<Array<{ id: string; object: string; owned_by: string; permission: string[] }>> {
  try {
    const response = await fetch(`${baseUrl}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch NVIDIA models: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = (await response.json()) as { data?: Array<{ id: string; object: string; owned_by: string; permission: string[] }> };
    return data.data || [];
  } catch (error) {
    console.error("Error fetching NVIDIA models:", error);
    return [];
  }
}

/**
 * Transform NVIDIA API model response to OpenClaw ModelConfig format
 */
function transformNvidiaModel(model: { id: string; object: string; owned_by: string }): (typeof FALLBACK_MODELS)[number] {
  const metadata = MODEL_METADATA[model.id] || {
    contextWindow: 128000,
    maxTokens: NVIDIA_DEFAULT_MAX_TOKENS,
  };

  return {
    id: model.id,
    name: formatModelName(model.id),
    reasoning: false,
    input: ["text" as "text"],
    cost: NVIDIA_DEFAULT_COST,
    contextWindow: metadata.contextWindow,
    maxTokens: metadata.maxTokens,
  };
}

/**
 * Format model ID into a human-readable name
 */
function formatModelName(modelId: string): string {
  // Replace hyphens with spaces and capitalize
  return modelId
    .split("/")
    .map((part) =>
      part
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    )
    .join(" / ");
}

export async function buildNvidiaProvider(): Promise<ModelProviderConfig> {
  const apiKey = process.env.NVIDIA_API_KEY;
  const baseUrl = process.env.NVIDIA_NIM_BASE_URL || NVIDIA_BASE_URL;

  let models = FALLBACK_MODELS;

  // If API key is provided, try to fetch live models
  if (apiKey) {
    const nvidiaModels = await fetchNvidiaModels(apiKey, baseUrl);
    if (nvidiaModels.length > 0) {
      models = nvidiaModels.map(transformNvidiaModel);
      console.log(`Loaded ${models.length} models from NVIDIA NIM API`);
    }
  }

  return {
    baseUrl,
    api: "openai-completions",
    models,
  };
}
