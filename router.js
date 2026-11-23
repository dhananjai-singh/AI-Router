// router.js — Qwen3-powered task routing logic

import CONFIG from "./config.js";

const { baseUrl, model } = CONFIG.ollama;
const timeoutMs = 120000; // 2 minutes — Qwen3 needs time to think

const ROUTING_SYSTEM_PROMPT = `You are an expert AI task router. Your job is to analyze a developer's task and decide which AI model should handle it.

MODELS AVAILABLE:
- gemini: Best for implementation-heavy tasks. Use for: writing code, building features, file generation, scaffolding, refactoring, debugging concrete code, writing tests, database schemas, API implementations, UI components.
- claude: Best for reasoning-heavy tasks. Use for: architecture decisions, code review, explaining concepts, system design, security analysis, trade-off analysis, documentation, planning, debugging logic errors.
- gemini_then_claude: Use when a task needs implementation FIRST, then review/analysis. Example: "Build this feature and then review the design."
- claude_then_gemini: Use when a task needs reasoning/planning FIRST, then implementation. Example: "Design the architecture for X then implement it."

RULES:
1. Respond ONLY with a JSON object — no markdown, no explanation.
2. The JSON must have exactly these fields: { "route": "<decision>", "confidence": <0.0-1.0>, "reason": "<one sentence>" }
3. route must be one of: gemini, claude, gemini_then_claude, claude_then_gemini
4. confidence is your certainty from 0.0 to 1.0
5. reason is a single short sentence explaining the decision

EXAMPLES:
Task: "Add a login endpoint to my Express app"
Response: {"route":"gemini","confidence":0.92,"reason":"Concrete implementation task — writing code for a specific feature."}

Task: "Should I use PostgreSQL or MongoDB for this use case?"
Response: {"route":"claude","confidence":0.88,"reason":"Architecture decision requiring trade-off analysis and reasoning."}

Task: "Design the auth system architecture then build it"
Response: {"route":"claude_then_gemini","confidence":0.85,"reason":"Needs design reasoning first, then concrete implementation."}

Task: "Build a caching layer and review whether it scales"
Response: {"route":"gemini_then_claude","confidence":0.80,"reason":"Build first, then review/analyze the design decisions."}`;

/**
 * Call Ollama with Qwen3 to route the task
 * @param {string} task - The user's input task
 * @returns {Promise<{route: string, confidence: number, reason: string, raw: string}>}
 */
export async function routeTask(task) {
  const url = `${baseUrl}/api/chat`;

  const body = {
    model,
    stream: false,
    options: {
      temperature: 0.1,
      num_predict: 1024, // enough room for thinking + JSON output
    },
    messages: [
      { role: "system", content: ROUTING_SYSTEM_PROMPT },
      { role: "user", content: `Task: "${task}"` },
    ],
  };

  let response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timer);
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(
        `Ollama timed out after ${timeoutMs / 1000}s. Is Ollama running? Try: ollama serve`
      );
    }
    throw new Error(
      `Cannot reach Ollama at ${baseUrl}. Is it running? Try: ollama serve\n${err.message}`
    );
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const raw = data?.message?.content || "";

  return parseRoutingResponse(raw, task);
}

/**
 * Parse and validate Qwen3's JSON response
 */
function parseRoutingResponse(raw, task) {
  const validRoutes = ["gemini", "claude", "gemini_then_claude", "claude_then_gemini"];

  // Strip thinking tags — Qwen3 always outputs <think>...</think> before the answer
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Also strip markdown code fences if present
  cleaned = cleaned.replace(/```json|```/gi, "").trim();

  // Extract JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("Raw router output:", raw);
    throw new Error(`Router returned unparseable output. Raw: ${raw.slice(0, 200)}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(`Router JSON parse failed: ${e.message}\nRaw: ${jsonMatch[0]}`);
  }

  const route = parsed.route?.toLowerCase?.();
  if (!validRoutes.includes(route)) {
    return {
      route: CONFIG.router.defaultModel,
      confidence: 0.5,
      reason: `Router returned invalid route "${parsed.route}", defaulting to ${CONFIG.router.defaultModel}.`,
      raw,
      fallback: true,
    };
  }

  return {
    route,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
    reason: parsed.reason || "No reason provided.",
    raw,
    fallback: false,
  };
}

/**
 * Check if Ollama is reachable and the model is available
 */
export async function checkOllama() {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    const models = data.models?.map((m) => m.name) || [];
    const hasModel = models.some((m) => m.startsWith(model));
    return { ok: true, models, hasModel, targetModel: model };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export default { routeTask, checkOllama };