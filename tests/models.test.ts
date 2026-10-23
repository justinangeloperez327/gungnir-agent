import { describe, expect, it } from "vitest";
import { ModelTextBackend, resolveModelConfig } from "@gungnir/model-adapters";
import type { ModelInvoker } from "@gungnir/model-adapters";

const env = { OPENAI_API_KEY: "unit-test-key" };
const config = (more: Record<string, number> = {}) =>
  resolveModelConfig({provider:"openai",model:"test-model", ...more},env);
const signal = new AbortController().signal;

describe("AI SDK v6 credential and provider configuration", () => {
  it("requires explicit valid provider, model, and a provider-specific key", () => {
    expect(config()).toMatchObject({provider:"openai",model:"test-model",maxOutputTokens:512,maxRequests:20});
    expect(() => resolveModelConfig({provider:"openai",model:"m"},{}))
      .toThrow("Set OPENAI_API_KEY");
    expect(() => resolveModelConfig({provider:"anthropic",model:"m"},{}))
      .toThrow("Set ANTHROPIC_API_KEY");
    expect(() => resolveModelConfig({provider:"gateway",model:"openai/m"},{}))
      .toThrow("Set AI_GATEWAY_API_KEY");
    expect(() => resolveModelConfig({provider:"gateway",model:"unqualified"},{AI_GATEWAY_API_KEY:"key"}))
      .toThrow("Gateway models require");
    expect(() => resolveModelConfig({provider:"unsupported",model:"m"},env))
      .toThrow("Unknown provider");
  });
  it("rejects incomplete pricing and invalid limits", () => {
    expect(() => config({maxRequests:0})).toThrow();
    expect(() => config({sessionOutputTokens:10})).toThrow();
    expect(() => config({inputPerMillionUsd:2})).toThrow();
    expect(config({inputPerMillionUsd:1,outputPerMillionUsd:2,maxEstimatedCostUsd:0.05})
      .pricing?.maxEstimatedCostUsd).toBe(0.05);
  });
});
describe("model streaming and bounded budgets (no paid network calls)", () => {
  it("forwards mode and prompt and accounts actual usage", async () => {
    const calls: string[] = [];
    const invoker: ModelInvoker = request => {
      calls.push(request.mode + ":" + request.prompt);
      return { textStream: (async function*() {yield "Hello"; yield " world";})(),
        totalUsage:Promise.resolve({inputTokens:10,outputTokens:2}),finishReason:Promise.resolve("stop") };
    };
    const backend = new ModelTextBackend(config({maxRequests:2}), invoker);
    const out: string[] = [];
    for await (const chunk of backend.streamText({mode:"ask",prompt:"hi",signal})) out.push(chunk);
    expect(out.join("")).toBe("Hello world");
    expect(calls).toEqual(["ask:hi"]);
    expect(backend.usage).toMatchObject({requests:1,inputTokens:10,outputTokens:2});
  });
  it("denies exhausted request quotas before invoking a provider", async () => {
    let count=0;
    const backend = new ModelTextBackend(config({maxRequests:1}),() => {
      count++;
      return {textStream:(async function*(){yield "ok";})(),
        totalUsage:Promise.resolve({inputTokens:1,outputTokens:1}),finishReason:Promise.resolve("stop")};
    });
    for await (const chunk of backend.streamText({mode:"plan",prompt:"a",signal})) { void chunk; }
    await expect(async () => {
      for await (const chunk of backend.streamText({mode:"plan",prompt:"b",signal})) { void chunk; }
    }).rejects.toMatchObject({code:"MODEL_BUDGET_EXCEEDED"});
    expect(count).toBe(1);
  });
  it("enforces estimated cost caps based on user-supplied rates", async () => {
    const backend = new ModelTextBackend(config({
      inputPerMillionUsd:100,outputPerMillionUsd:100,maxEstimatedCostUsd:0.001,
    }),() => {throw Error("Should not run");});
    await expect(async () => {
      for await (const chunk of backend.streamText({mode:"ask",prompt:"test",signal})) { void chunk; }
    }).rejects.toMatchObject({code:"MODEL_BUDGET_EXCEEDED"});
    expect(backend.usage.requests).toBe(0);
  });
  it("sanitizes provider failures rather than echoing credentials", async () => {
    const backend = new ModelTextBackend(config(), () => {throw Error("test-key");});
    await expect(async () => {
      for await (const chunk of backend.streamText({mode:"ask",prompt:"test",signal})) { void chunk; }
    }).rejects.toMatchObject({code:"MODEL_REQUEST_FAILED",message:"Model generation failed"});
  });
  it("propagates cancellation without invoking the model", async () => {
    const controller = new AbortController();
    controller.abort();
    const backend = new ModelTextBackend(config(),() => {throw Error("must not call");});
    await expect(async () => {
      for await (const chunk of backend.streamText({mode:"ask",prompt:"test",signal:controller.signal})) { void chunk; }
    }).rejects.toMatchObject({code:"PROCESS_CANCELLED"});
  });
});
