import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractTraceContext } from "./trace.js";

describe("extractTraceContext", () => {
  it("extracts action, URL, DOM, and accessibility context from trace directories", async () => {
    const tracePath = resolve(process.cwd(), "../../examples/basic-playwright/fixtures/trace-dir");

    const context = await extractTraceContext(tracePath);

    expect(context.pageUrl).toBe("http://localhost:3000/login");
    expect(context.actions).toContainEqual({
      apiName: "locator.click",
      selector: 'getByText("Sign in")',
      url: undefined
    });
    expect(context.domSnapshots[0]?.html).toContain("login-submit");
    expect(context.accessibilityNodes).toContainEqual({
      role: "button",
      name: "Log in",
      text: undefined,
      selector: 'button[data-testid="login-submit"]'
    });
  });

  it("decodes Playwright-style trace events and resource snapshots", async () => {
    const tracePath = resolve(process.cwd(), "../../examples/basic-playwright/fixtures/real-trace");

    const context = await extractTraceContext(tracePath, {
      failedSelector: 'getByText("Sign in")'
    });

    expect(context.failedAction).toMatchObject({
      callId: "call@7",
      apiName: "locator.click",
      selector: 'getByText("Sign in")',
      error: "Timeout 30000ms exceeded"
    });
    expect(context.domSnapshots.some((snapshot) => snapshot.html?.includes("login-submit"))).toBe(
      true
    );
    expect(context.pageUrl).toBe("http://localhost:3000/login");
  });

  it("decodes form field traces with accessibility nodes", async () => {
    const tracePath = resolve(process.cwd(), "../../examples/basic-playwright/fixtures/form-trace");

    const context = await extractTraceContext(tracePath, {
      failedSelector: 'getByLabel("Email")'
    });

    expect(context.failedAction).toMatchObject({
      apiName: "locator.fill",
      selector: 'getByLabel("Email")'
    });
    expect(context.accessibilityNodes).toContainEqual({
      role: "textbox",
      name: "Work email",
      text: undefined,
      selector: 'input[name="email"]'
    });
    expect(context.domSnapshots[0]?.html).toContain("you@example.com");
  });

  it("keeps duplicate button snapshots for downstream ambiguity diagnostics", async () => {
    const tracePath = resolve(process.cwd(), "../../examples/basic-playwright/fixtures/duplicate-button-trace");

    const context = await extractTraceContext(tracePath, {
      failedSelector: 'getByText("Save")'
    });

    expect(context.failedAction?.selector).toBe('getByText("Save")');
    expect(context.domSnapshots[0]?.html?.match(/Save/g)).toHaveLength(2);
  });
});
