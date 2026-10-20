/**
 * API Service - Handles communication with the AI server
 */

import { GoogleGenAI } from '@google/genai';
import { config, getServerConfig, ntfyConfig, serverDefaults } from '../config';
import { ServerConfig, AIResponse } from '../types';
import { print } from '../utils/print';

// ─── System Prompts ───
export const AGENT_SYSTEM_PROMPT = `You are a coding assistant agent. When the user asks you to write code, generate code, or modify code, you MUST respond using the following structured JSON format ONLY (no markdown wrapping, no extra text outside the JSON):

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

export const FIX_SYSTEM_PROMPT = `You are a code repair agent. The user will provide broken, incomplete, or buggy code from a specific file. Your job is to:

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


// ─── AI Client ───
let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not set in environment');
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// ─── Server URL Resolution ───
let cachedServerConfig: ServerConfig | null = null;

export async function resolveServerUrl(): Promise<ServerConfig> {
  if (cachedServerConfig) {
    return cachedServerConfig;
  }

  // 1. Try local server first
  try {
    const res = await fetch(`${serverDefaults.localUrl}${serverDefaults.localCheckEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'ping' }),
      signal: AbortSignal.timeout(serverDefaults.localCheckTimeout),
    });
    
    if (res.ok || res.status === 200 || res.status === 400) {
      cachedServerConfig = getServerConfig(serverDefaults.localUrl);
      return cachedServerConfig;
    }
  } catch {
    // Ignore, try next method
  }

  // 2. Fetch active tunnel from ntfy auto-sync
  try {
    const res = await fetch(`${ntfyConfig.syncEndpoint}/raw?poll=1`, {
      signal: AbortSignal.timeout(ntfyConfig.pollTimeout),
    });
    
    if (res.ok) {
      const text = await res.text();
      const lines = text.trim().split('\n').filter(l => l.trim().startsWith('http'));
      if (lines.length > 0) {
        const url = lines[lines.length - 1].trim();
        cachedServerConfig = getServerConfig(url);
        return cachedServerConfig;
      }
    }
  } catch {
    // Ignore
  }

  // 3. Fallback to local
  cachedServerConfig = getServerConfig(serverDefaults.localUrl);
  return cachedServerConfig;
}

export function clearServerCache(): void {
  cachedServerConfig = null;
}

// ─── Response Parsing ───
export function parseAIResponse(rawText: string): AIResponse {
  let cleaned = rawText.trim();
  
  // Strip markdown code fences
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7).trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3).trim();
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3).trim();
  }
  
  const parsed = JSON.parse(cleaned);
  
  // Validate structure
  if (!parsed.type || !['code_response', 'chat_response', 'fix_response'].includes(parsed.type)) {
    throw new Error('Invalid response type');
  }
  
  return parsed as AIResponse;
}

// ─── API Calls ───
export async function callGemini(
  contents: Array<{ role: string; parts: Array<{ text: string }> }>,
  systemInstruction: string
): Promise<{ text: string }> {
  const ai = getAIClient();
  const primaryModel = config.defaultModel;
  
  try {
    const response = await ai.models.generateContent({
      model: primaryModel,
      contents,
      config: { systemInstruction },
    });
    return response;
  } catch (primaryErr) {
    print.warn(`Primary model (${primaryModel}) failed: ${(primaryErr as Error).message}. Trying fallback...`);
    
    const response = await ai.models.generateContent({
      model: config.fallbackModel,
      contents,
      config: { systemInstruction },
    });
    return response;
  }
}

export async function sendAgentQuery(
  prompt: string,
  history: Array<{ role: string; text: string }> = []
): Promise<AIResponse> {
  const serverConfig = await resolveServerUrl();
  
  // Build contents with conversation history
  const contents = [];
  for (const msg of history) {
    contents.push({
      role: msg.role,
      parts: [{ text: msg.text }],
    });
  }
  contents.push({
    role: 'user',
    parts: [{ text: prompt }],
  });
  
  const response = await callGemini(contents, AGENT_SYSTEM_PROMPT);
  const rawText = response.text;
  
  try {
    return parseAIResponse(rawText);
  } catch {
    // Fallback to chat response if parsing fails
    return {
      type: 'chat_response',
      message: rawText,
      raw: rawText,
      structured: false,
    };
  }
}

export async function sendBasicQuery(prompt: string): Promise<string> {
  const serverConfig = await resolveServerUrl();
  const primaryModel = config.defaultModel;
  
  try {
    const response = await callGemini(
      [{ role: 'user', parts: [{ text: prompt }] }],
      ''
    );
    return response.text;
  } catch (primaryErr) {
    print.warn(`Primary model (${primaryModel}) failed: ${(primaryErr as Error).message}. Trying fallback...`);
    
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: config.fallbackModel,
      contents: prompt,
    });
    return response.text;
  }
}

export async function sendFixQuery(
  filepath: string,
  code: string,
  instruction?: string
): Promise<AIResponse> {
  const serverConfig = await resolveServerUrl();
  
  const userPrompt = instruction
    ? `Fix the following code from file "${filepath}".\n\nUser instruction: ${instruction}\n\nBroken code:\n\`\`\`\n${code}\n\`\`\``
    : `Fix all issues in the following code from file "${filepath}":\n\n\`\`\`\n${code}\n\`\`\``;
  
  const contents = [{
    role: 'user',
    parts: [{ text: userPrompt }],
  }];
  
  const response = await callGemini(contents, FIX_SYSTEM_PROMPT);
  const rawText = response.text;
  
  try {
    return parseAIResponse(rawText);
  } catch {
    return {
      type: 'chat_response',
      message: rawText,
      raw: rawText,
      structured: false,
    };
  }
}