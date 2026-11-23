// models/gemini.js — Antigravity CLI (agy) integration

import { spawn } from "child_process";
import CONFIG from "../config.js";

const { command, args } = CONFIG.models.gemini;

/**
 * Launch Antigravity CLI (agy) with the task.
 * Note: agy reads project files itself, so we just pass the task directly.
 *
 * @param {string} task - The user's coding task
 * @param {string} context - Not used for agy (it reads files itself)
 * @param {object} options
 * @returns {Promise<{exitCode: number}>}
 */
export async function launchGemini(task, context = "", options = {}) {
  // --add-dir scopes agy to current directory and prevents timeout from over-exploring
  return spawnModel(command, [...args, "--add-dir", ".", "-p", task], "inherit");
}

/**
 * Spawn via PowerShell on Windows to handle PATH correctly
 */
function spawnModel(cmd, cmdArgs, stdio = "inherit") {
  return new Promise((resolve, reject) => {
    const fullCmd = [cmd, ...cmdArgs.map(a => `"${a.replace(/"/g, '`"')}"`)].join(" ");

    const proc = spawn("powershell.exe", ["-NoProfile", "-Command", fullCmd], {
      stdio,
      shell: false,
      env: { ...process.env },
    });

    proc.on("error", (err) => {
      if (err.code === "ENOENT") {
        reject(
          new Error(
            `Antigravity CLI (agy) not found. Install it:\nirm https://antigravity.google/cli/install.ps1 | iex`
          )
        );
      } else {
        reject(new Error(`Antigravity launch error: ${err.message}`));
      }
    });

    proc.on("close", (code) => {
      resolve({ exitCode: code ?? 0 });
    });
  });
}

/**
 * Check if agy is available
 */
export async function checkGemini() {
  return new Promise((resolve) => {
    const proc = spawn("powershell.exe", ["-NoProfile", "-Command", "agy --version"], {
      stdio: "pipe",
      shell: false,
    });
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

export default { launchGemini, checkGemini };