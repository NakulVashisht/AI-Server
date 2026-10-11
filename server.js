import express from "express";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const app = express();
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// ─── System prompt that makes the AI return structured responses ───
const AGENT_SYSTEM_PROMPT = `You are a coding assistant agent. When the user asks you to write code, generate code, or modify code, you MUST respond using the following structured JSON format ONLY (no markdown wrapping, no extra text outside the JSON):

{
  "type": "code_response",
  "files": [
    {
      "filepath": "relative/path/to/file.ext",
      "description": "Brief description of what this file does or what changed",
      "code": "the full file content here"
    }
  ],
  "explanation": "A brief explanation of the overall changes"
}

Rules:
1. If the user's prompt contains a file path or file name, use that as the "filepath".
2. If the user says "write this to X" or "save to X" or "put this in X", use X as the filepath.
3. The "code" field must contain the COMPLETE file content, ready to overwrite the target file.
4. If NO code is being requested (e.g., the user is asking a question, having a conversation, or asking for explanations), respond with:
{
  "type": "chat_response",
  "message": "your conversational response here"
}
5. ALWAYS respond with valid JSON only. No markdown code fences. No extra text before or after the JSON.
6. If you need to provide multiple files, include all of them in the "files" array.`;

// ─── System prompt for fixing broken code ───
const FIX_SYSTEM_PROMPT = `You are a code repair agent. The user will provide broken, incomplete, or buggy code from a specific file. Your job is to:

1. Identify ALL issues: syntax errors, logic bugs, missing imports, typos, incomplete code, etc.
2. Fix every issue you find.
3. Return the COMPLETE fixed file content.

You MUST respond with ONLY this JSON format (no markdown, no extra text):

{
  "type": "fix_response",
  "filepath": "the original file path",
  "issues_found": [
    {
      "line": "approximate line number or range",
      "problem": "description of the issue",
      "fix": "what you changed to fix it"
    }
  ],
  "fixed_code": "the COMPLETE corrected file content, ready to overwrite",
  "summary": "brief summary of all fixes applied"
}

Rules:
1. The "fixed_code" must be the ENTIRE file, not just the changed lines.
2. Fix ALL issues, not just the first one.
3. Preserve the original intent and style of the code.
4. If the code has incomplete sections (e.g., TODO, empty functions), complete them based on context.
5. ALWAYS respond with valid JSON only.`;

// ─── Helper: call Gemini with fallback ───
async function callGemini(contents, systemInstruction) {
  const primaryModel = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  try {
    return await ai.models.generateContent({
      model: primaryModel,
      contents,
      config: { systemInstruction },
    });
  } catch (primaryErr) {
    console.warn(`Primary model (${primaryModel}) failed: ${primaryErr.message}. Trying fallback...`);
    return await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents,
      config: { systemInstruction },
    });
  }
}

// ─── Helper: parse AI response JSON (strips markdown fences if needed) ───
function parseAIResponse(rawText) {
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return JSON.parse(cleaned.trim());
}

// ─── Original /chat endpoint (backward compatible) ───
app.post("/chat", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const primaryModel = process.env.GEMINI_MODEL || "gemini-3.5-flash";
    let response;
    try {
      response = await ai.models.generateContent({
        model: primaryModel,
        contents: prompt,
      });
    } catch (primaryErr) {
      console.warn(`Primary model (${primaryModel}) failed: ${primaryErr.message}. Trying fallback (gemini-3.5-flash-lite)...`);
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",
        contents: prompt,
      });
    }

    res.json({ answer: response.text });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: error.message || "Server error" });
  }
});

// ─── /agent endpoint with structured code responses ───
app.post("/agent", async (req, res) => {
  try {
    const { prompt, history } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // Build contents with conversation history support
    const contents = [];
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        contents.push({
          role: msg.role,
          parts: [{ text: msg.text }],
        });
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: prompt }],
    });

    const response = await callGemini(contents, AGENT_SYSTEM_PROMPT);
    const rawText = response.text;

    try {
      const parsed = parseAIResponse(rawText);
      res.json({ structured: true, data: parsed, raw: rawText });
    } catch {
      res.json({
        structured: true,
        data: { type: "chat_response", message: rawText },
        raw: rawText,
      });
    }
  } catch (error) {
    console.error("Agent API Error:", error);
    res.status(500).json({ error: error.message || "Server error" });
  }
});

// ─── /fix endpoint: reads broken code and returns fixed version ───
app.post("/fix", async (req, res) => {
  try {
    const { filepath, code, instruction } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Code content is required" });
    }

    const userPrompt = instruction
      ? `Fix the following code from file "${filepath || "unknown"}".\n\nUser instruction: ${instruction}\n\nBroken code:\n\`\`\`\n${code}\n\`\`\``
      : `Fix all issues in the following code from file "${filepath || "unknown"}":\n\n\`\`\`\n${code}\n\`\`\``;

    const contents = [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ];

    const response = await callGemini(contents, FIX_SYSTEM_PROMPT);
    const rawText = response.text;

    try {
      const parsed = parseAIResponse(rawText);
      res.json({ structured: true, data: parsed, raw: rawText });
    } catch {
      res.json({
        structured: false,
        data: { type: "chat_response", message: rawText },
        raw: rawText,
      });
    }
  } catch (error) {
    console.error("Fix API Error:", error);
    res.status(500).json({ error: error.message || "Server error" });
  }
});

const PORT = 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Endpoints: POST /chat (basic), POST /agent (structured), POST /fix (code repair)`);
});
