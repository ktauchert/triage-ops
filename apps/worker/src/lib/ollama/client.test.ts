import { describe, expect, it } from "vitest";
import {
  chat,
  embed,
  healthCheck,
  OllamaApiError,
} from "./client.js";
import {
  ollamaChatHandler,
  ollamaEmbedHandler,
  ollamaErrorHandler,
  ollamaTagsHandler,
  server,
} from "../../test/msw-server.js";

const testConfig = {
  host: "http://localhost:11434",
  chatModel: "llama3.2:3b",
  embedModel: "nomic-embed-text",
};

describe("healthCheck", () => {
  it("returns model names from /api/tags", async () => {
    server.use(
      ollamaTagsHandler(["llama3.2:3b", "nomic-embed-text"]),
    );

    const result = await healthCheck(fetch, testConfig);

    expect(result.ok).toBe(true);
    expect(result.models).toEqual(["llama3.2:3b", "nomic-embed-text"]);
  });

  it("throws OllamaApiError when tags endpoint fails", async () => {
    server.use(ollamaErrorHandler("/api/tags", 503, "unavailable"));

    await expect(healthCheck(fetch, testConfig)).rejects.toMatchObject({
      name: "OllamaApiError",
      status: 503,
    } satisfies Partial<OllamaApiError>);
  });
});

describe("chat", () => {
  it("returns assistant message content", async () => {
    server.use(
      ollamaChatHandler("Draft description for pagination feature."),
    );

    const content = await chat(
      {
        messages: [
          { role: "user", content: "Draft a bug report description." },
        ],
      },
      fetch,
      testConfig,
    );

    expect(content).toBe("Draft description for pagination feature.");
  });

  it("throws OllamaApiError on chat failure", async () => {
    server.use(ollamaErrorHandler("/api/chat", 500, "model not found"));

    await expect(
      chat({ messages: [{ role: "user", content: "hi" }] }, fetch, testConfig),
    ).rejects.toMatchObject({
      name: "OllamaApiError",
      status: 500,
    } satisfies Partial<OllamaApiError>);
  });
});

describe("embed", () => {
  it("returns embedding vectors", async () => {
    server.use(ollamaEmbedHandler([[0.1, 0.2, 0.3]]));

    const vectors = await embed(
      { input: "Login fails with SSO" },
      fetch,
      testConfig,
    );

    expect(vectors).toEqual([[0.1, 0.2, 0.3]]);
  });

  it("supports batch input", async () => {
    server.use(
      ollamaEmbedHandler([
        [0.1, 0.2],
        [0.3, 0.4],
      ]),
    );

    const vectors = await embed(
      { input: ["issue a", "issue b"] },
      fetch,
      testConfig,
    );

    expect(vectors).toHaveLength(2);
  });
});
