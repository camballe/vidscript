import { ModelMap } from "./types.js";

export const MODELS: ModelMap = {
  // Anthropic models
  "claude-3-opus": {
    provider: "anthropic",
    modelName: "claude-3-opus-20240229",
    contextWindow: 200000,
  },
  "claude-3.5-sonnet": {
    provider: "anthropic",
    modelName: "claude-3-5-sonnet-20240620",
    contextWindow: 200000,
  },
  "claude-3.7-sonnet": {
    provider: "anthropic",
    modelName: "claude-3-7-sonnet-20240723",
    contextWindow: 200000,
  },
  // OpenAI models
  "gpt-4-turbo": {
    provider: "openai",
    modelName: "gpt-4-turbo",
    contextWindow: 128000,
  },
  "gpt-4o": {
    provider: "openai",
    modelName: "gpt-4o",
    contextWindow: 128000,
  },
};

export function getModel(modelKey: string) {
  if (!MODELS[modelKey]) {
    throw new Error(
      `Unsupported model: ${modelKey}. Available models: ${Object.keys(MODELS).join(", ")}`
    );
  }
  return MODELS[modelKey];
}
