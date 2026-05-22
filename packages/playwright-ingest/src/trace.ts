import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import AdmZip from "adm-zip";
import type { AccessibilityNode, DomSnapshot, TraceAction, TraceContext } from "@helix-heal/core";

type UnknownRecord = Record<string, unknown>;

export async function extractTraceContext(tracePath: string): Promise<TraceContext> {
  const entries = tracePath.endsWith(".zip")
    ? readZipTraceEntries(tracePath)
    : await readDirectoryTraceEntries(tracePath);

  return buildTraceContext(tracePath, entries);
}

function readZipTraceEntries(tracePath: string): string[] {
  const zip = new AdmZip(tracePath);

  return zip
    .getEntries()
    .filter((entry) => !entry.isDirectory && isTraceLikeFile(entry.entryName))
    .map((entry) => entry.getData().toString("utf8"));
}

async function readDirectoryTraceEntries(tracePath: string): Promise<string[]> {
  const fileStat = await stat(tracePath);
  if (fileStat.isFile()) {
    return isTraceLikeFile(tracePath) ? [await readFile(tracePath, "utf8")] : [];
  }

  const files = await walk(tracePath);
  const contents: string[] = [];

  for (const file of files.filter(isTraceLikeFile)) {
    contents.push(await readFile(file, "utf8"));
  }

  return contents;
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

function buildTraceContext(tracePath: string, traceEntryContents: string[]): TraceContext {
  const context: TraceContext = {
    tracePath,
    actions: [],
    domSnapshots: [],
    accessibilityNodes: []
  };

  for (const content of traceEntryContents) {
    for (const event of parseTraceEvents(content)) {
      collectUrl(context, event);
      collectAction(context, event);
      collectDomSnapshot(context, event);
      collectAccessibilityNodes(context, event);
    }
  }

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
  const url = firstString(event.url, nestedString(event, "page", "url"));
  if (url && !context.pageUrl) {
    context.pageUrl = url;
  }
}

function collectAction(context: TraceContext, event: UnknownRecord): void {
  const apiName = firstString(event.apiName, event.method, event.action);
  const params = isRecord(event.params) ? event.params : undefined;
  const selector = firstString(params?.selector, event.selector);
  const url = firstString(event.url, params?.url);

  if (!apiName && !selector) {
    return;
  }

  const action: TraceAction = { apiName, selector, url };
  context.actions.push(action);
}

function collectDomSnapshot(context: TraceContext, event: UnknownRecord): void {
  const snapshot = isRecord(event.snapshot) ? event.snapshot : event;
  const html = firstString(snapshot.html, snapshot.dom, snapshot.markup);
  const text = firstString(snapshot.text, snapshot.innerText);
  const url = firstString(snapshot.url, event.url);

  if (!html && !text) {
    return;
  }

  const source = firstString(event.type, event.event, event.name) ?? "trace";
  const domSnapshot: DomSnapshot = { source, html, text, url };
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

function isTraceLikeFile(path: string): boolean {
  return (
    path.endsWith(".trace") ||
    path.endsWith(".jsonl") ||
    path.endsWith(".ndjson") ||
    path.endsWith(".trace.json")
  );
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
