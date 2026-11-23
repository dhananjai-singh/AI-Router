#!/usr/bin/env node
// index.js — Unified `ai` CLI entry point

import { createRequire } from "module";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// ESM-compatible __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dynamic imports (ESM)
import chalk from "chalk";
import ora from "ora";
import { Command } from "commander";

import { routeTask, checkOllama } from "./router.js";
import { launchGemini, checkGemini } from "./models/gemini.js";
import { launchClaude, checkClaude } from "./models/claude.js";
import {
  initMemory,
  readContext,
  buildInjectedContext,
  appendHistory,
  writeHandoff,
} from "./memory.js";
import {
  updateContextAfterSession,
  initContextForProject,
} from "./context-builder.js";
import CONFIG from "./config.js";

// ─── UI helpers ──────────────────────────────────────────────────────────────

const ROUTE_COLORS = {
  gemini: chalk.cyan,
  claude: chalk.magenta,
  gemini_then_claude: chalk.yellow,
  claude_then_gemini: chalk.blue,
};

const ROUTE_ICONS = {
  gemini: "◆",
  claude: "◇",
  gemini_then_claude: "◆→◇",
  claude_then_gemini: "◇→◆",
};

const ROUTE_LABELS = {
  gemini: "Gemini CLI",
  claude: "Claude Code",
  gemini_then_claude: "Gemini → Claude",
  claude_then_gemini: "Claude → Gemini",
};

function printBanner() {
  console.log();
  console.log(chalk.bold.white("  ┌─────────────────────────────┐"));
  console.log(chalk.bold.white("  │  ") + chalk.bold.cyan("ai") + chalk.bold.white(" router") + chalk.dim(" v1.0") + chalk.bold.white("              │"));
  console.log(chalk.bold.white("  │  ") + chalk.dim("Qwen3 · Gemini · Claude Code") + chalk.bold.white("  │"));
  console.log(chalk.bold.white("  └─────────────────────────────┘"));
  console.log();
}

function printRoute(result) {
  const color = ROUTE_COLORS[result.route] || chalk.white;
  const icon = ROUTE_ICONS[result.route] || "→";
  const label = ROUTE_LABELS[result.route] || result.route;
  const pct = Math.round((result.confidence || 0) * 100);

  console.log(
    chalk.dim("  Routing to  ") +
    color.bold(`${icon}  ${label}`) +
    chalk.dim(`  (${pct}% confidence)`)
  );
  console.log(chalk.dim(`  Reason: ${result.reason}`));
  if (result.fallback) {
    console.log(chalk.yellow("  ⚠ Router fallback triggered — defaulting to " + CONFIG.router.defaultModel));
  }
  console.log();
}

// ─── Core dispatch logic ─────────────────────────────────────────────────────

async function dispatch(task, route, context, opts = {}) {
  const { dryRun = false, nonInteractive = false } = opts;

  if (dryRun) {
    console.log(chalk.yellow("  [dry-run] Would launch: ") + chalk.bold(route));
    console.log(chalk.yellow("  [dry-run] Task: ") + task);
    return;
  }

  if (route === "gemini") {
    console.log(chalk.dim("  Launching Gemini CLI...\n") + chalk.dim("─".repeat(50)));
    await launchGemini(task, context, { nonInteractive });

  } else if (route === "claude") {
    console.log(chalk.dim("  Launching Claude Code...\n") + chalk.dim("─".repeat(50)));
    await launchClaude(task, context, { nonInteractive });

  } else if (route === "gemini_then_claude") {
    console.log(chalk.dim("  Phase 1: Launching Gemini CLI...\n") + chalk.dim("─".repeat(50)));
    await launchGemini(task, context, { nonInteractive });

    console.log();
    console.log(chalk.dim("  Phase 2: Handing off to Claude Code...\n") + chalk.dim("─".repeat(50)));
    writeHandoff(task, "gemini", "claude", "Gemini implementation phase complete.", process.cwd());
    const handoffContext = buildInjectedContext(process.cwd());
    await launchClaude(task, handoffContext, { nonInteractive });

  } else if (route === "claude_then_gemini") {
    console.log(chalk.dim("  Phase 1: Launching Claude Code...\n") + chalk.dim("─".repeat(50)));
    await launchClaude(task, context, { nonInteractive });

    console.log();
    console.log(chalk.dim("  Phase 2: Handing off to Gemini CLI...\n") + chalk.dim("─".repeat(50)));
    writeHandoff(task, "claude", "gemini", "Claude reasoning phase complete.", process.cwd());
    const handoffContext = buildInjectedContext(process.cwd());
    await launchGemini(task, handoffContext, { nonInteractive });
  }
}

// ─── Main `ai run` command ───────────────────────────────────────────────────

async function runTask(task, cmdOpts) {
  printBanner();
  initMemory(process.cwd());
  initContextForProject(process.cwd());

  // Step 1: Route via Qwen3
  const spinner = ora({
    text: chalk.dim("  Routing task with Qwen3..."),
    spinner: "dots2",
  }).start();

  let routeResult;
  try {
    routeResult = await routeTask(task);
    spinner.succeed(chalk.dim("  Router decision ready"));
  } catch (err) {
    spinner.fail(chalk.red("  Routing failed: ") + err.message);

    if (!cmdOpts.force) {
      console.log();
      console.log(chalk.dim("  Tip: Run ") + chalk.cyan("ai status") + chalk.dim(" to check Ollama."));
      console.log(chalk.dim("  Override with: ") + chalk.cyan(`ai run --model gemini "${task}"`));
      process.exit(1);
    }

    // --force: use specified model or default
    const fallbackModel = cmdOpts.model || CONFIG.router.defaultModel;
    console.log(chalk.yellow(`  Using --force fallback: ${fallbackModel}`));
    routeResult = {
      route: fallbackModel,
      confidence: 1.0,
      reason: "Manual override via --force flag.",
      fallback: true,
    };
  }

  // Step 2: Print routing decision
  printRoute(routeResult);

  // Step 3: Dispatch
  const context = buildInjectedContext(process.cwd());
  const finalRoute = cmdOpts.model || routeResult.route;

  if (cmdOpts.model && cmdOpts.model !== routeResult.route) {
    console.log(chalk.yellow(`  ⚡ Model override: using ${cmdOpts.model} instead of ${routeResult.route}`));
    console.log();
  }

  await dispatch(task, finalRoute, context, {
    dryRun: cmdOpts.dryRun,
    nonInteractive: cmdOpts.nonInteractive,
  });

  // Step 4: Log to history
  appendHistory({
    task,
    model: finalRoute,
    confidence: routeResult.confidence,
    reason: routeResult.reason,
  });

  // Step 5: Silently update context.md in background
  updateContextAfterSession(task, finalRoute, process.cwd());
}

// ─── Status check command ────────────────────────────────────────────────────

async function runStatus() {
  printBanner();
  console.log(chalk.bold("  System Status\n"));

  // Ollama
  const ollamaSpinner = ora({ text: "  Checking Ollama...", spinner: "dots2" }).start();
  const ollama = await checkOllama();
  if (ollama.ok) {
    ollamaSpinner.succeed(
      chalk.green("  Ollama ") +
      chalk.dim("reachable at " + CONFIG.ollama.baseUrl)
    );
    if (ollama.hasModel) {
      console.log(chalk.green("    ✓ ") + chalk.dim(`Model "${CONFIG.ollama.model}" available`));
    } else {
      console.log(
        chalk.yellow("    ⚠ ") +
        chalk.dim(`Model "${CONFIG.ollama.model}" not found. Pull it: `) +
        chalk.cyan(`ollama pull ${CONFIG.ollama.model}`)
      );
      if (ollama.models?.length) {
        console.log(chalk.dim("    Available: " + ollama.models.join(", ")));
      }
    }
  } else {
    ollamaSpinner.fail(chalk.red("  Ollama unreachable: ") + ollama.error);
    console.log(chalk.dim("    Fix: run ") + chalk.cyan("ollama serve"));
  }

  // Gemini
  const geminiSpinner = ora({ text: "  Checking Gemini CLI...", spinner: "dots2" }).start();
  const gemini = await checkGemini();
  if (gemini.ok) {
    geminiSpinner.succeed(chalk.green("  Gemini CLI ") + chalk.dim(gemini.version));
  } else {
    geminiSpinner.fail(chalk.red("  Gemini CLI not found"));
    console.log(chalk.dim("    Fix: npm install -g @google/generative-ai-cli"));
  }

  // Claude
  const claudeSpinner = ora({ text: "  Checking Claude Code...", spinner: "dots2" }).start();
  const claude = await checkClaude();
  if (claude.ok) {
    claudeSpinner.succeed(chalk.green("  Claude Code ") + chalk.dim(claude.version));
  } else {
    claudeSpinner.fail(chalk.red("  Claude Code not found"));
    console.log(chalk.dim("    Fix: npm install -g @anthropic-ai/claude-code"));
  }

  // Context
  console.log();
  const ctx = readContext(process.cwd());
  if (ctx) {
    console.log(chalk.green("  ✓ ") + chalk.dim("Project context loaded (.ai/context.md)"));
  } else {
    console.log(chalk.dim("  No .ai/context.md found. Run: ") + chalk.cyan("ai init"));
  }

  console.log();
}

// ─── Init command ────────────────────────────────────────────────────────────

async function runInit() {
  initMemory(process.cwd());
  console.log();
  console.log(chalk.green("  ✓ Initialized .ai/ directory"));
  console.log(chalk.dim("    .ai/context.md   — edit this with project info"));
  console.log(chalk.dim("    .ai/history.json — session history (auto-managed)"));
  console.log(chalk.dim("    .ai/handoff.md   — model handoff notes (auto-managed)"));
  console.log();
  console.log(chalk.dim("  Next: edit ") + chalk.cyan(".ai/context.md") + chalk.dim(" then run ") + chalk.cyan(`ai "your task"`));
  console.log();
}

// ─── Commander CLI setup ─────────────────────────────────────────────────────

const program = new Command();

program
  .name("ai")
  .description("Unified AI development router — Gemini + Claude via Qwen3")
  .version("1.0.0");

// Default command: `ai "task"`
program
  .argument("[task...]", "Coding task to route and execute")
  .option("-m, --model <model>", "Override model (gemini|claude|gemini_then_claude|claude_then_gemini)")
  .option("-f, --force", "Continue even if Ollama is unavailable (use default/override model)")
  .option("-n, --non-interactive", "Run model in non-interactive (print) mode")
  .option("--dry-run", "Show routing decision without launching any model")
  .action(async (task, opts) => {
    task = Array.isArray(task) ? task.join(" ") : task;
    if (!task) {
      program.help();
      return;
    }
    try {
      await runTask(task, opts);
    } catch (err) {
      console.error(chalk.red("\n  Error: ") + err.message);
      process.exit(1);
    }
  });

// `ai init`
program
  .command("init")
  .description("Initialize .ai/ context directory in current project")
  .action(async () => {
    try {
      await runInit();
    } catch (err) {
      console.error(chalk.red("Error: ") + err.message);
      process.exit(1);
    }
  });

// `ai status`
program
  .command("status")
  .description("Check status of all connected AI tools")
  .action(async () => {
    try {
      await runStatus();
    } catch (err) {
      console.error(chalk.red("Error: ") + err.message);
      process.exit(1);
    }
  });

// `ai history`
program
  .command("history")
  .description("Show recent session history")
  .option("-n, --count <n>", "Number of entries to show", "10")
  .action(async (opts) => {
    const { readHistory } = await import("./memory.js");
    initMemory(process.cwd());
    const history = readHistory(process.cwd());

    printBanner();
    console.log(chalk.bold("  Session History\n"));

    if (!history.length) {
      console.log(chalk.dim("  No history yet. Run a task first."));
      console.log();
      return;
    }

    const entries = history.slice(-parseInt(opts.count)).reverse();
    for (const e of entries) {
      const color = ROUTE_COLORS[e.model] || chalk.white;
      const icon = ROUTE_ICONS[e.model] || "→";
      console.log(
        chalk.dim(`  ${e.timestamp?.slice(0, 16).replace("T", " ")}  `) +
        color(`${icon} ${ROUTE_LABELS[e.model] || e.model}`) +
        chalk.dim(`  (${Math.round((e.confidence || 0) * 100)}%)`)
      );
      console.log(chalk.white(`    ${e.task}`));
      console.log(chalk.dim(`    ${e.reason}`));
      console.log();
    }
  });

// `ai context`
program
  .command("context")
  .description("Show current project context")
  .action(async () => {
    initMemory(process.cwd());
    const ctx = readContext(process.cwd());
    printBanner();
    console.log(chalk.bold("  Project Context (.ai/context.md)\n"));
    if (ctx) {
      console.log(ctx.split("\n").map((l) => "  " + l).join("\n"));
    } else {
      console.log(chalk.dim("  Empty. Edit .ai/context.md to add project context."));
    }
    console.log();
  });

program.parse(process.argv);