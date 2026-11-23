// models/claude.js — Claude Code integration

import { spawn } from "child_process";
import CONFIG from "../config.js";

const { command, args } = CONFIG.models.claude;

/**
 * Launch Claude Code with the task and optional context injected.
 *
 * Claude Code is an agentic CLI that can be invoked with:
 *   claude "task here"                    → interactive session with initial prompt
 *   claude -p "task here"                 → non-interactive, print mode
 *   claude --print "task here"            → same as -p
 *
 * @param {string} task - The user's coding task
 * @param {string} context - Injected project context
 * @param {object} options
 * @param {boolean} options.nonInteractive - Use -p flag for one-shot mode
 * @returns {Promise<{exitCode: number}>}
 */
export async function launchClaude(task, context = "", options = {}) {
  const { nonInteractive = false } = options;

  const fullPrompt = buildPrompt(task, context);

  if (nonInteractive) {
    return spawnModel(command, [...args, "-p", fullPrompt], "inherit");
  } else {
    // Interactive: pass task as first positional arg, Claude Code opens session
    return spawnModel(command, [...args, fullPrompt], "inherit");
  }
}

/**
 * Build the full prompt string with context injected
 */
function buildPrompt(task, context) {
  if (!context) return task;
  return `[PROJECT CONTEXT]\n${context}\n\n[TASK]\n${task}`;
}

/**
 * Spawn a process with full stdio inheritance (user sees terminal output)
 */
function spawnModel(cmd, cmdArgs, stdio = "inherit") {
  return new Promise((resolve, reject) => {
    // Join all args into a single quoted string for PowerShell
    const fullCmd = [cmd, ...cmdArgs.map(a => `"${a.replace(/"/g, '`"')}"`)] .join(" ");
    
    const proc = spawn("powershell.exe", ["-NoProfile", "-Command", fullCmd], {
      stdio,
      shell: false,
      env: { ...process.env },
    });

    proc.on("error", (err) => {
      if (err.code === "ENOENT") {
        reject(new Error(`Claude Code not found. Install it: npm install -g @anthropic-ai/claude-code`));
      } else {
        reject(new Error(`Claude launch error: ${err.message}`));
      }
    });

    proc.on("close", (code) => {
      resolve({ exitCode: code ?? 0 });
    });
  });
}

/**
 * Check if Claude Code is available in PATH
 */
export async function checkClaude() {
  return new Promise((resolve) => {
    const proc = spawn(command, ["--version"], { stdio: "pipe" });
    let output = "";

    proc.stdout?.on("data", (d) => (output += d.toString()));
    proc.stderr?.on("data", (d) => (output += d.toString()));

    proc.on("error", () => resolve({ ok: false, version: null }));
    proc.on("close", (code) => {
      resolve({
        ok: code === 0 || output.length > 0,
        version: output.trim().split("\n")[0] || "unknown",
      });
    });
  });
}

export default { launchClaude, checkClaude };