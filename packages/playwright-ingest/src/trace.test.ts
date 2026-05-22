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
});
