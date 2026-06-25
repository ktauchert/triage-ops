import { getOptionalEnv } from "../../config/env.js";
import { fetchWithResilience, getOllamaHttpTimeoutMs } from "../http.js";

export class OllamaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string,
  ) {
    super(message);
    this.name = "OllamaApiError";
  }
}

export type FetchFn = typeof fetch;

export type OllamaClientConfig = {
  host: string;
  chatModel: string;
  embedModel: string;
};

export function getOllamaConfig(): OllamaClientConfig {
  return {
    host: getOptionalEnv("OLLAMA_HOST", "http://localhost:11434").replace(
      /\/+$/,
      "",
    ),
    chatModel: getOptionalEnv("OLLAMA_CHAT_MODEL", "llama3.2:3b"),
    embedModel: getOptionalEnv("OLLAMA_EMBED_MODEL", "nomic-embed-text"),
  };
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatOptions = {
  model?: string;
  messages: ChatMessage[];
  stream?: boolean;
};

export type ChatResponse = {
  message: { role: string; content: string };
};

export type EmbedOptions = {
  model?: string;
  input: string | string[];
};

export type EmbedResponse = {
  embeddings: number[][];
};

async function ollamaFetch(
  path: string,
  init: RequestInit,
  fetchImpl: FetchFn,
  config: OllamaClientConfig,
): Promise<Response> {
  const url = `${config.host}${path}`;
  const response = await fetchWithResilience(url, init, {
    fetchImpl,
    timeoutMs: getOllamaHttpTimeoutMs(),
    retries: 0,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new OllamaApiError(
      `Ollama API error: ${response.status} ${response.statusText}`,
      response.status,
      body,
    );
  }

  return response;
}

export async function healthCheck(
  fetchImpl: FetchFn = fetch,
  config: OllamaClientConfig = getOllamaConfig(),
): Promise<{ ok: true; models: string[] }> {
  const response = await ollamaFetch(
    "/api/tags",
    { method: "GET" },
    fetchImpl,
    config,
  );
  const data = (await response.json()) as {
    models?: Array<{ name: string }>;
  };

  return {
    ok: true,
    models: (data.models ?? []).map((model) => model.name),
  };
}

export async function chat(
  options: ChatOptions,
  fetchImpl: FetchFn = fetch,
  config: OllamaClientConfig = getOllamaConfig(),
): Promise<string> {
  const response = await ollamaFetch(
    "/api/chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: options.model ?? config.chatModel,
        messages: options.messages,
        stream: options.stream ?? false,
      }),
    },
    fetchImpl,
    config,
  );

  const data = (await response.json()) as ChatResponse;
  return data.message.content;
}

export async function embed(
  options: EmbedOptions,
  fetchImpl: FetchFn = fetch,
  config: OllamaClientConfig = getOllamaConfig(),
): Promise<number[][]> {
  const response = await ollamaFetch(
    "/api/embed",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: options.model ?? config.embedModel,
        input: options.input,
      }),
    },
    fetchImpl,
    config,
  );

  const data = (await response.json()) as EmbedResponse;
  return data.embeddings;
}
