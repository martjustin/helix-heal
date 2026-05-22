import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import AdmZip from "adm-zip";
import type { AccessibilityNode, DomSnapshot, TraceAction, TraceContext } from "@helix-heal/core";

type UnknownRecord = Record<string, unknown>;

export type TraceDecodeOptions = {
  failedSelector?: string;
};

type TraceEntry = {
  name: string;
  content: string;
};

export async function extractTraceContext(
  tracePath: string,
  options: TraceDecodeOptions = {}
): Promise<TraceContext> {
  const entries = tracePath.endsWith(".zip")
    ? readZipTraceEntries(tracePath)
    : await readDirectoryTraceEntries(tracePath);

  return buildTraceContext(tracePath, entries, options);
}

function readZipTraceEntries(tracePath: string): TraceEntry[] {
  const zip = new AdmZip(tracePath);

  return zip
    .getEntries()
    .filter((entry) => !entry.isDirectory && isTraceContextFile(entry.entryName))
    .map((entry) => ({
      name: entry.entryName,
      content: entry.getData().toString("utf8")
    }));
}

async function readDirectoryTraceEntries(tracePath: string): Promise<TraceEntry[]> {
  const fileStat = await stat(tracePath);
  if (fileStat.isFile()) {
    return isTraceContextFile(tracePath)
      ? [{ name: basename(tracePath), content: await readFile(tracePath, "utf8") }]
      : [];
  }

  const files = await walk(tracePath);
  const entries: TraceEntry[] = [];

  for (const file of files.filter(isTraceContextFile)) {
    entries.push({
      name: file,
      content: await readFile(file, "utf8")
    });
  }

  return entries;
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(path)));
    } else {
      files.push(path);
    }
  }

  return files;
}

function buildTraceContext(
  tracePath: string,
  traceEntries: TraceEntry[],
  options: TraceDecodeOptions
): TraceContext {
  const context: TraceContext = {
    tracePath,
    actions: [],
    domSnapshots: [],
    accessibilityNodes: []
  };

  for (const entry of traceEntries) {
    if (isHtmlLikeFile(entry.name)) {
      context.domSnapshots.push({
        source: entry.name,
        html: entry.content,
        text: htmlToText(entry.content)
      });
      continue;
    }

    for (const event of parseTraceEvents(entry.content)) {
      collectUrl(context, event);
      collectAction(context, event);
      collectDomSnapshot(context, event);
      collectAccessibilityNodes(context, event);
    }
  }

  context.failedAction = selectFailedAction(context.actions, options.failedSelector);
  return context;
}

function parseTraceEvents(content: string): UnknownRecord[] {
  const trimmed = content.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = safeJsonParse(trimmed);
    if (Array.isArray(parsed)) return parsed.filter(isRecord);
    if (isRecord(parsed)) return [parsed];
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => safeJsonParse(line))
    .filter(isRecord);
}

function collectUrl(context: TraceContext, event: UnknownRecord): void {
  const url = firstString(event.url, nestedString(event, "page", "url"), nestedString(event, "params", "url"));
  if (url && !context.pageUrl) {
    context.pageUrl = url;
  }
}

function collectAction(context: TraceContext, event: UnknownRecord): void {
  const apiName = firstString(event.apiName, event.method, event.action);
  const params = isRecord(event.params) ? event.params : undefined;
  const selector = firstString(params?.selector, event.selector);
  const url = firstString(event.url, params?.url);
  const callId = firstString(event.callId);
  const error = firstString(event.error, nestedString(event, "error", "message"));

  if (!apiName && !selector && !callId) {
    return;
  }

  const existing = callId ? context.actions.find((action) => action.callId === callId) : undefined;
  const action: TraceAction = {
    ...existing,
    callId: callId ?? existing?.callId,
    apiName: apiName ?? existing?.apiName,
    selector: selector ?? existing?.selector,
    url: url ?? existing?.url,
    startTime: numberValue(event.startTime) ?? existing?.startTime,
    endTime: numberValue(event.endTime) ?? existing?.endTime,
    error: error ?? existing?.error
  };

  if (existing) {
    Object.assign(existing, action);
    return;
  }

  context.actions.push(action);
}

function collectDomSnapshot(context: TraceContext, event: UnknownRecord): void {
  const snapshot = isRecord(event.snapshot) ? event.snapshot : event;
  const html = firstString(
    snapshot.html,
    snapshot.dom,
    snapshot.markup,
    snapshotHtml(snapshot.html)
  );
  const text = firstString(snapshot.text, snapshot.innerText);
  const url = firstString(snapshot.url, event.url);

  if (!html && !text) {
    return;
  }

  const source = firstString(event.type, event.event, event.name) ?? "trace";
  const domSnapshot: DomSnapshot = { source, html, text: text ?? htmlToText(html ?? ""), url };
  context.domSnapshots.push(domSnapshot);
}

function collectAccessibilityNodes(context: TraceContext, event: UnknownRecord): void {
  const nodes = event.accessibilityTree ?? event.accessibility ?? event.axTree;
  for (const node of flattenNodes(nodes)) {
    const accessibilityNode: AccessibilityNode = {
      role: firstString(node.role),
      name: firstString(node.name),
      text: firstString(node.text),
      selector: firstString(node.selector)
    };

    if (accessibilityNode.role || accessibilityNode.name || accessibilityNode.text) {
      context.accessibilityNodes.push(accessibilityNode);
    }
  }
}

function flattenNodes(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) {
    return value.flatMap(flattenNodes);
  }

  if (!isRecord(value)) {
    return [];
  }

  const children = flattenNodes(value.children);
  return [value, ...children];
}

function isTraceContextFile(path: string): boolean {
  return (
    path.endsWith(".trace") ||
    path.endsWith(".jsonl") ||
    path.endsWith(".ndjson") ||
    path.endsWith(".trace.json") ||
    path.endsWith(".html")
  );
}

function isHtmlLikeFile(path: string): boolean {
  return path.endsWith(".html");
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function nestedString(record: UnknownRecord, key: string, nestedKey: string): string | undefined {
  const nested = record[key];
  return isRecord(nested) ? firstString(nested[nestedKey]) : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function selectFailedAction(
  actions: TraceAction[],
  failedSelector: string | undefined
): TraceAction | undefined {
  if (failedSelector) {
    const normalizedFailedSelector = normalizeSelector(failedSelector);
    const selectorMatch = actions.find((action) =>
      action.selector ? normalizeSelector(action.selector).includes(normalizedFailedSelector) : false
    );

    if (selectorMatch) {
      return selectorMatch;
    }
  }

  return actions.find((action) => action.error) ?? actions.at(-1);
}

function normalizeSelector(value: string): string {
  return value.replace(/^page\./, "").replace(/\s+/g, "");
}

function snapshotHtml(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(snapshotHtml).filter(Boolean).join("");
  }

  if (isRecord(value)) {
    return Object.values(value).map(snapshotHtml).filter(Boolean).join("");
  }

  return undefined;
}

function htmlToText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
