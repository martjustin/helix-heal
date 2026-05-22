import { describe, expect, it } from "vitest";
import { validateCandidateWithPage, type LiveValidationPage } from "./live-validator.js";

describe("validateCandidateWithPage", () => {
  it("passes when the candidate resolves uniquely and is actionable", async () => {
    const page = fakePage({ count: 1, visible: true, enabled: true });

    const validation = await validateCandidateWithPage(
      {
        locator: 'page.getByRole("button", { name: "Log in" })',
        strategy: "role",
        source: "deterministic",
        evidence: []
      },
      page
    );

    expect(validation).toMatchObject({
      status: "passed",
      mode: "live",
      matchCount: 1
    });
  });

  it("fails when the candidate resolves to multiple elements", async () => {
    const page = fakePage({ count: 2, visible: true, enabled: true });

    const validation = await validateCandidateWithPage(
      {
        locator: 'page.getByTestId("login-submit")',
        strategy: "testId",
        source: "deterministic",
        evidence: []
      },
      page
    );

    expect(validation).toMatchObject({
      status: "failed",
      mode: "live",
      matchCount: 2
    });
  });
});

function fakePage(result: { count: number; visible: boolean; enabled: boolean }): LiveValidationPage {
  const locator = {
    count: async () => result.count,
    isVisible: async () => result.visible,
    isEnabled: async () => result.enabled
  };

  return {
    getByRole: () => locator,
    getByTestId: () => locator,
    getByText: () => locator,
    getByLabel: () => locator,
    getByPlaceholder: () => locator
  };
}
