import type { CandidateLocator, HelixConfig, NormalizedFailure } from "./types.js";

export function generateCandidates(
  failure: NormalizedFailure,
  config: HelixConfig
): CandidateLocator[] {
  const evidenceCandidates = [
    ...generateAccessibilityCandidates(failure),
    ...generateDomCandidates(failure, config)
  ];

  if (evidenceCandidates.length > 0) {
    return dedupeCandidates(evidenceCandidates);
  }

  const inferredName = inferHumanName(failure.failedSelector ?? failure.errorMessage);

  if (!inferredName) {
    return [];
  }

  const candidates: CandidateLocator[] = [];

  if (config.preferredLocators.includes("role")) {
    candidates.push({
      locator: `page.getByRole("button", { name: ${JSON.stringify(inferredName)} })`,
      strategy: "role",
      source: "deterministic",
      evidence: ["inferred accessible name from failed locator text"]
    });
  }

  if (config.preferredLocators.includes("text")) {
    candidates.push({
      locator: `page.getByText(${JSON.stringify(inferredName)})`,
      strategy: "text",
      source: "deterministic",
      evidence: ["fallback text locator candidate"]
    });
  }

  return candidates;
}

function generateAccessibilityCandidates(failure: NormalizedFailure): CandidateLocator[] {
  const nodes = failure.traceContext?.accessibilityNodes ?? [];

  return nodes.flatMap((node) => {
    const candidates: CandidateLocator[] = [];
    const actionCompatible = isActionCompatible(node.role, failure.action);

    if (node.role && node.name && actionCompatible) {
      candidates.push({
        locator: `page.getByRole(${JSON.stringify(node.role)}, { name: ${JSON.stringify(node.name)} })`,
        strategy: "role",
        source: "deterministic",
        evidence: ["accessibility tree role/name match"]
      });
    }

    const testId = extractTestId(node.selector);
    if (testId) {
      candidates.push({
        locator: `page.getByTestId(${JSON.stringify(testId)})`,
        strategy: "testId",
        source: "deterministic",
        evidence: ["accessibility node selector contains configured test ID"]
      });
    }

    return candidates;
  });
}

function generateDomCandidates(
  failure: NormalizedFailure,
  config: HelixConfig
): CandidateLocator[] {
  const snapshots = failure.traceContext?.domSnapshots ?? [];

  return snapshots.flatMap((snapshot) =>
    parseElements(snapshot.html ?? "")
      .flatMap((element) => elementToCandidates(element, config, failure.action))
  );
}

type ParsedElement = {
  tag: string;
  attrs: Record<string, string>;
  text: string;
};

function elementToCandidates(
  element: ParsedElement,
  config: HelixConfig,
  action: NormalizedFailure["action"]
): CandidateLocator[] {
  const candidates: CandidateLocator[] = [];
  if (isHiddenOrDisabled(element.attrs)) {
    return candidates;
  }

  const testId = element.attrs[config.testIdAttribute];
  const role = element.attrs.role ?? roleFromTag(element.tag, element.attrs);
  const name = element.attrs["aria-label"] ?? element.text;
  const actionCompatible = isActionCompatible(role, action);

  if (testId) {
    candidates.push({
      locator: `page.getByTestId(${JSON.stringify(testId)})`,
      strategy: "testId",
      source: "deterministic",
      evidence: [`DOM element has ${config.testIdAttribute}`]
    });
  }

  if (role && name && actionCompatible) {
    candidates.push({
      locator: `page.getByRole(${JSON.stringify(role)}, { name: ${JSON.stringify(name)} })`,
      strategy: "role",
      source: "deterministic",
      evidence: ["DOM element exposes role and accessible name"]
    });
  }

  if (element.attrs.placeholder) {
    candidates.push({
      locator: `page.getByPlaceholder(${JSON.stringify(element.attrs.placeholder)})`,
      strategy: "label",
      source: "deterministic",
      evidence: ["DOM element has placeholder text"]
    });
  }

  if (element.text && element.tag !== "script" && element.tag !== "style" && actionCompatible) {
    candidates.push({
      locator: `page.getByText(${JSON.stringify(element.text)})`,
      strategy: "text",
      source: "deterministic",
      evidence: ["DOM element has visible text"]
    });
  }

  return candidates;
}

function isHiddenOrDisabled(attrs: Record<string, string>): boolean {
  const style = attrs.style?.toLowerCase() ?? "";
  return (
    "hidden" in attrs ||
    "disabled" in attrs ||
    attrs["aria-hidden"] === "true" ||
    attrs["aria-disabled"] === "true" ||
    style.includes("display: none") ||
    style.includes("visibility: hidden")
  );
}

function isActionCompatible(role: string | undefined, action: NormalizedFailure["action"]): boolean {
  if (!role || action !== "click") {
    return true;
  }

  return ["button", "link", "checkbox", "radio", "menuitem", "switch", "tab"].includes(role);
}

function parseElements(html: string): ParsedElement[] {
  const elements: ParsedElement[] = [];
  const elementPattern = /<([a-zA-Z][\w:-]*)([^>]*)>([^<]*)/g;
  let match: RegExpExecArray | null;

  while ((match = elementPattern.exec(html)) !== null) {
    const [, tag, attrText, text] = match;
    elements.push({
      tag: tag.toLowerCase(),
      attrs: parseAttributes(attrText),
      text: normalizeText(text)
    });
  }

  const selfClosingPattern = /<([a-zA-Z][\w:-]*)([^>]*?)\/?>/g;
  while ((match = selfClosingPattern.exec(html)) !== null) {
    const [, tag, attrText] = match;
    if (!["input", "textarea", "select"].includes(tag.toLowerCase())) {
      continue;
    }

    elements.push({
      tag: tag.toLowerCase(),
      attrs: parseAttributes(attrText),
      text: ""
    });
  }

  return elements;
}

function parseAttributes(attrText: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrPattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match: RegExpExecArray | null;

  while ((match = attrPattern.exec(attrText)) !== null) {
    const [, name, doubleQuoted, singleQuoted, unquoted] = match;
    attrs[name] = doubleQuoted ?? singleQuoted ?? unquoted ?? "";
  }

  const booleanAttrPattern = /(?:^|\s)(hidden|disabled)(?=\s|$)/g;
  while ((match = booleanAttrPattern.exec(attrText)) !== null) {
    attrs[match[1]] = "true";
  }

  return attrs;
}

function roleFromTag(tag: string, attrs: Record<string, string>): string | undefined {
  if (tag === "button") return "button";
  if (tag === "a" && attrs.href) return "link";
  if (tag === "input") {
    if (attrs.type === "submit" || attrs.type === "button") return "button";
    return "textbox";
  }
  if (/^h[1-6]$/.test(tag)) return "heading";
  return undefined;
}

function extractTestId(selector: string | undefined): string | undefined {
  return selector?.match(/data-testid=["']?([^"'\]]+)/)?.[1];
}

function inferHumanName(value: string): string | undefined {
  const quoted = value.match(/["'`]([^"'`]{2,80})["'`]/);
  if (quoted?.[1]) {
    return quoted[1].trim();
  }

  return undefined;
}

function dedupeCandidates(candidates: CandidateLocator[]): CandidateLocator[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.locator)) {
      return false;
    }

    seen.add(candidate.locator);
    return true;
  });
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
