// config.js — Central configuration for ai-router

export const CONFIG = {
  // Ollama settings
  ollama: {
    baseUrl: process.env.OLLAMA_HOST || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "qwen3:0.6b",
    timeoutMs: 30000,
  },

  // Model CLI commands
  models: {
    gemini: {
      command: "agy",
      args: [],
      description: "Gemini CLI — implementation-heavy tasks",
    },
    claude: {
      command: "claude",
      args: [],
      description: "Claude Code — reasoning-heavy tasks",
    },
  },

  // Context paths (resolved relative to cwd at runtime)
  context: {
    dir: ".ai",
    contextFile: ".ai/context.md",
    historyFile: ".ai/history.json",
    handoffFile: ".ai/handoff.md",
    maxHistoryEntries: 50,
  },

  // Router thresholds
  router: {
    confidenceThreshold: 0.6,
    defaultModel: "claude",
    hybridDelimiter: "_then_",
  },
};

export default CONFIG;