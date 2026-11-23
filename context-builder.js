// context-builder.js — Auto-builds .ai/context.md after every session

import fs from "fs";
import path from "path";
import CONFIG from "./config.js";

const { baseUrl, model } = CONFIG.ollama;

/**
 * Detect project stack from known config files
 */
export function detectProjectStack(cwd = process.cwd()) {
  const checks = [
    {
      files: ["package.json"],
      fn: () => {
        try {
          const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));
          const deps = {
            ...pkg.dependencies,
            ...pkg.devDependencies,
          };
          const stack = [];

          if (deps["react"] || deps["next"]) stack.push(deps["next"] ? "Next.js" : "React");
          if (deps["express"]) stack.push("Express");
          if (deps["fastify"]) stack.push("Fastify");
          if (deps["vue"]) stack.push("Vue");
          if (deps["typescript"] || pkg.devDependencies?.["typescript"]) stack.push("TypeScript");
          if (deps["prisma"] || deps["@prisma/client"]) stack.push("Prisma");
          if (deps["mongoose"]) stack.push("MongoDB/Mongoose");
          if (deps["pg"] || deps["postgres"]) stack.push("PostgreSQL");
          if (deps["tailwindcss"]) stack.push("Tailwind CSS");
          if (deps["jest"] || deps["vitest"]) stack.push(deps["vitest"] ? "Vitest" : "Jest");

          return {
            language: "Node.js" + (deps["typescript"] ? " / TypeScript" : " / JavaScript"),
            stack: stack.join(", ") || "Node.js",
            name: pkg.name || null,
            description: pkg.description || null,
          };
        } catch {
          return null;
        }
      },
    },
    {
      files: ["requirements.txt", "pyproject.toml", "setup.py"],
      fn: () => {
        let deps = "";
        for (const f of ["requirements.txt", "pyproject.toml"]) {
          const fp = path.join(cwd, f);
          if (fs.existsSync(fp)) {
            deps = fs.readFileSync(fp, "utf8").toLowerCase();
            break;
          }
        }
        const stack = [];
        if (deps.includes("django")) stack.push("Django");
        if (deps.includes("flask")) stack.push("Flask");
        if (deps.includes("fastapi")) stack.push("FastAPI");
        if (deps.includes("sqlalchemy")) stack.push("SQLAlchemy");
        if (deps.includes("pandas")) stack.push("Pandas");
        return { language: "Python", stack: stack.join(", ") || "Python", name: null, description: null };
      },
    },
    {
      files: ["go.mod"],
      fn: () => {
        return { language: "Go", stack: "Go", name: null, description: null };
      },
    },
    {
      files: ["pom.xml", "build.gradle"],
      fn: () => {
        return { language: "Java", stack: "Java", name: null, description: null };
      },
    },
    {
      files: ["Cargo.toml"],
      fn: () => {
        return { language: "Rust", stack: "Rust", name: null, description: null };
      },
    },
  ];

  for (const check of checks) {
    if (check.files.some((f) => fs.existsSync(path.join(cwd, f)))) {
      const result = check.fn();
      if (result) return result;
    }
  }

  return null;
}

/**
 * Build initial context from project files (first-time setup)
 */
export function buildInitialContext(cwd = process.cwd()) {
  const stack = detectProjectStack(cwd);
  if (!stack) return null;

  const lines = [
    "# Project Context",
    "",
    "## Stack",
    stack.language,
    stack.stack ? `Frameworks/Libraries: ${stack.stack}` : "",
    "",
    "## Goals",
    stack.description || "Add project goals here.",
    "",
    "## Notes",
    "Auto-detected from project files.",
  ].filter((l) => l !== undefined);

  return lines.join("\n");
}

/**
 * Use Qwen3 to summarize a completed session and update context.md silently
 */
export async function updateContextAfterSession(task, model_used, cwd = process.cwd()) {
  const contextPath = path.join(cwd, ".ai", "context.md");
  const currentContext = fs.existsSync(contextPath)
    ? fs.readFileSync(contextPath, "utf8")
    : "";

  // Don't update if context looks like it was manually edited (has real content)
  const isDefault = currentContext.includes("Add project-level context here") ||
    currentContext.includes("Auto-detected from project files") ||
    currentContext.trim().length < 100;

  const prompt = `You are a project context summarizer. A developer just completed an AI-assisted coding session.

PREVIOUS CONTEXT:
${currentContext || "No previous context."}

LATEST TASK: "${task}"
MODEL USED: ${model_used}

Your job: Write an updated project context markdown file that captures:
1. What stack/technologies are being used (infer from the task if not in previous context)
2. What the project goals appear to be
3. Any important notes or patterns from recent work

Keep it concise — under 200 words. Use this exact format:

# Project Context

## Stack
[languages, frameworks, databases]

## Goals
[what this project is trying to do]

## Notes
[important patterns, decisions, or constraints]

## Recent Work
[brief bullet list of recent tasks]

Reply with ONLY the markdown content, no explanation.`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: CONFIG.ollama.model,
        stream: false,
        options: { temperature: 0.3, num_predict: 512 },
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) return;

    const data = await response.json();
    let content = data?.message?.content || "";

    // Strip thinking tags
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    // Strip markdown fences
    content = content.replace(/```markdown|```/gi, "").trim();

    if (content && content.startsWith("#")) {
      fs.writeFileSync(contextPath, content);
    }
  } catch {
    // Silent fail — never interrupt the user's workflow
  }
}

/**
 * Initialize context for a new project — auto-detect stack, write context.md
 */
export function initContextForProject(cwd = process.cwd()) {
  const contextPath = path.join(cwd, ".ai", "context.md");

  // Only auto-init if context is empty/default
  if (fs.existsSync(contextPath)) {
    const existing = fs.readFileSync(contextPath, "utf8");
    if (!existing.includes("Add project-level context here")) return false;
  }

  const autoContext = buildInitialContext(cwd);
  if (autoContext) {
    fs.writeFileSync(contextPath, autoContext);
    return true;
  }

  return false;
}

export default {
  detectProjectStack,
  buildInitialContext,
  updateContextAfterSession,
  initContextForProject,
};