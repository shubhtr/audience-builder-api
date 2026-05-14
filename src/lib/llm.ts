import OpenAI from "openai";

export function getLLMClient(): OpenAI {
  const provider = (process.env.LLM_PROVIDER || 'openrouter').toLowerCase();
  if (provider === 'ollama') {
    return new OpenAI({
      baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
      apiKey: 'ollama',
    });
  }
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY!,
  });
}

export function getLLMModel(): string {
  const provider = (process.env.LLM_PROVIDER || 'openrouter').toLowerCase();
  if (provider === 'ollama') {
    return process.env.LLM_MODEL_OLLAMA || 'llama3.2';
  }
  return process.env.LLM_MODEL_OPENROUTER || 'google/gemini-2.0-flash';
}
