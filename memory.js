// memory.js — Shared context and session history management

import fs from "fs";
import path from "path";
import CONFIG from "./config.js";

const { contextFile, historyFile, handoffFile, dir, maxHistoryEntries } =
  CONFIG.context;

/**
 * Ensure .ai/ directory and files exist in cwd
 */
export function initMemory(cwd = process.cwd()) {
  const aiDir = path.join(cwd, dir);

  if (!fs.existsSync(aiDir)) {
    fs.mkdirSync(aiDir, { recursive: true });
  }

  const ctxPath = path.join(cwd, contextFile);
  if (!fs.existsSync(ctxPath)) {
    fs.writeFileSync(
      ctxPath,
      `# Project Context\n\nAdd project-level context here. This file is injected into every AI call.\n\n## Stack\n\n## Goals\n\n## Notes\n`
    );
  }

  const histPath = path.join(cwd, historyFile);
  if (!fs.existsSync(histPath)) {
    fs.writeFileSync(histPath, JSON.stringify({ entries: [] }, null, 2));
  }

  const handoffPath = path.join(cwd, handoffFile);
  if (!fs.existsSync(handoffPath)) {
    fs.writeFileSync(
      handoffPath,
      `# Handoff Notes\n\nUsed when routing switches between models mid-task.\n`
    );
  }
}

/**
 * Read the project context markdown
 */
export function readContext(cwd = process.cwd()) {
  const ctxPath = path.join(cwd, contextFile);
  if (!fs.existsSync(ctxPath)) return "";
  return fs.readFileSync(ctxPath, "utf8").trim();
}

/**
 * Read session history
 */
export function readHistory(cwd = process.cwd()) {
  const histPath = path.join(cwd, historyFile);
  if (!fs.existsSync(histPath)) return [];
  try {
    const raw = fs.readFileSync(histPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed.entries || [];
  } catch {
    return [];
  }
}

/**
 * Append a new history entry
 */
export function appendHistory(entry, cwd = process.cwd()) {
  const histPath = path.join(cwd, historyFile);
  const history = readHistory(cwd);

  history.push({
    ...entry,
    timestamp: new Date().toISOString(),
  });

  // Keep bounded
  const trimmed = history.slice(-maxHistoryEntries);
  fs.writeFileSync(histPath, JSON.stringify({ entries: trimmed }, null, 2));
}

/**
 * Write handoff notes (used for model-to-model context passing)
 */
export function writeHandoff(task, fromModel, toModel, notes, cwd = process.cwd()) {
  const handoffPath = path.join(cwd, handoffFile);
  const content = `# Handoff: ${fromModel} → ${toModel}

**Task:** ${task}
**Time:** ${new Date().toISOString()}
**From:** ${fromModel}
**To:** ${toModel}

## Context Transfer Notes
${notes || "No additional notes."}

## Project Context
${readContext(cwd)}
`;
  fs.writeFileSync(handoffPath, content);
}

/**
 * Build the full context string to inject into model prompts
 */
export function buildInjectedContext(cwd = process.cwd()) {
  const ctx = readContext(cwd);
  const history = readHistory(cwd);

  const recentHistory = history
    .slice(-5)
    .map(
      (e) =>
        `- [${e.timestamp?.slice(0, 10)}] ${e.model?.toUpperCase()}: ${e.task}`
    )
    .join("\n");

  return [
    ctx ? `## Project Context\n${ctx}` : "",
    recentHistory
      ? `## Recent Session History (last 5)\n${recentHistory}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export default {
  initMemory,
  readContext,
  readHistory,
  appendHistory,
  writeHandoff,
  buildInjectedContext,
};