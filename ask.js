import readline from "readline";
import fs from "fs";
import path from "path";
import { execSync, spawn } from "child_process";

// ─── Configuration & Dynamic Server Discovery ───
let SERVER_URL = process.env.SERVER_URL || "http://127.0.0.1:3000";
let AGENT_ENDPOINT = `${SERVER_URL}/agent`;
let CHAT_ENDPOINT = `${SERVER_URL}/chat`;
let FIX_ENDPOINT = `${SERVER_URL}/fix`;

async function resolveServerUrl() {
  // 1. Try local server first (fast check)
  try {
    const res = await fetch("http://127.0.0.1:3000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "ping" }),
      signal: AbortSignal.timeout(1000),
    });
    if (res.ok || res.status === 200 || res.status === 400) {
      SERVER_URL = "http://127.0.0.1:3000";
      AGENT_ENDPOINT = `${SERVER_URL}/agent`;
      CHAT_ENDPOINT = `${SERVER_URL}/chat`;
      FIX_ENDPOINT = `${SERVER_URL}/fix`;
      return SERVER_URL;
    }
  } catch {}

  // 2. Fetch active tunnel from ntfy auto-sync
  try {
    const res = await fetch("https://ntfy.sh/ghosty001_ai_tunnel_sync/raw?poll=1", {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const text = await res.text();
      const lines = text.trim().split("\n").filter((l) => l.trim().startsWith("http"));
      if (lines.length > 0) {
        SERVER_URL = lines[lines.length - 1].trim();
        AGENT_ENDPOINT = `${SERVER_URL}/agent`;
        CHAT_ENDPOINT = `${SERVER_URL}/chat`;
        FIX_ENDPOINT = `${SERVER_URL}/fix`;
        return SERVER_URL;
      }
    }
  } catch {}

  return SERVER_URL;
}

// Working directory for file writes (defaults to current directory)
const WORK_DIR = process.cwd();

// ─── Conversation history for context ───
const conversationHistory = [];

// ─── Last AI response (for /write command) ───
let lastCodeResponse = null;

// ─── Last written files (for /test command) ───
let lastWrittenFiles = [];

// ─── Agent mode flag ───
let agentMode = true;

// ─── Help: only shown when user types /help ───
function printHelp() {
  console.log();
  console.log("available commands:");
  console.log("  /write         - write last AI code to file(s)");
  console.log("  /write test    - write and syntax-check");
  console.log("  /test [file]   - syntax-check a file (or last written)");
  console.log("  /fix <file>    - AI reads and fixes broken code");
  console.log("  /run <file>    - run a file");
  console.log("  /files         - show pending code files");
  console.log("  /history       - show conversation history");
  console.log("  /clear         - clear history");
  console.log("  /mode          - toggle agent/basic mode");
  console.log("  exit           - quit");
  console.log();
}

// ─── Show code block in a readable but plain way ───
function printCodeBlock(filepath, code) {
  const ext = path.extname(filepath).slice(1) || "txt";
  console.log(`--- ${filepath} [${ext}] ---`);
  const lines = code.split("\n");
  const maxLines = 25;
  const showLines = lines.slice(0, maxLines);
  showLines.forEach((line, i) => {
    const lineNum = String(i + 1).padStart(3, " ");
    console.log(`  ${lineNum} | ${line}`);
  });
  if (lines.length > maxLines) {
    console.log(`  ... (${lines.length - maxLines} more lines)`);
  }
  console.log("---");
}

// ════════════════════════════════════════════════════════════
// ─── TEST: Syntax-check and run files ───
// ════════════════════════════════════════════════════════════

function getTestCommand(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  const cmds = {
    ".js": { syntax: `node -c "${filepath}"`, run: `node "${filepath}"` },
    ".mjs": { syntax: `node -c "${filepath}"`, run: `node "${filepath}"` },
    ".ts": { syntax: `npx tsc --noEmit "${filepath}"`, run: `npx tsx "${filepath}"` },
    ".py": { syntax: `python -c "import py_compile; py_compile.compile('${filepath}', doraise=True)"`, run: `python "${filepath}"` },
    ".json": { syntax: `node -e "JSON.parse(require('fs').readFileSync('${filepath}','utf8'))"`, run: null },
    ".html": { syntax: null, run: null },
    ".css": { syntax: null, run: null },
    ".sh": { syntax: `bash -n "${filepath}"`, run: `bash "${filepath}"` },
    ".bat": { syntax: null, run: `"${filepath}"` },
    ".ps1": { syntax: null, run: `powershell -File "${filepath}"` },
  };
  return cmds[ext] || { syntax: null, run: null };
}

function runTestOnFile(filepath, mode = "syntax") {
  const fullPath = path.resolve(WORK_DIR, filepath);

  if (!fs.existsSync(fullPath)) {
    console.log(`  [x] not found: ${filepath}`);
    return { success: false, error: "File not found" };
  }

  const testCmd = getTestCommand(fullPath);
  const cmd = mode === "run" ? testCmd.run : testCmd.syntax;

  if (!cmd) {
    const ext = path.extname(filepath);
    console.log(`  [-] skip: ${filepath} (no ${mode === "run" ? "runner" : "checker"} for ${ext})`);
    return { success: true, skipped: true };
  }

  try {
    const output = execSync(cmd, {
      cwd: WORK_DIR,
      encoding: "utf-8",
      timeout: 15000,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const label = mode === "run" ? "ran ok" : "syntax ok";
    console.log(`  [ok] ${label}: ${filepath}`);
    if (output.trim()) {
      console.log(`       ${output.trim().split("\n").slice(0, 5).join("\n       ")}`);
    }
    return { success: true };
  } catch (err) {
    const label = mode === "run" ? "run failed" : "syntax error";
    console.log(`  [x] ${label}: ${filepath}`);

    const errorOutput = (err.stderr || err.stdout || err.message || "").toString().trim();
    if (errorOutput) {
      const errorLines = errorOutput.split("\n").slice(0, 10);
      for (const line of errorLines) {
        console.log(`       ${line}`);
      }
    }
    return { success: false, error: errorOutput };
  }
}

function testFiles(filePaths, mode = "syntax") {
  const label = mode === "run" ? "running" : "testing";
  console.log(`\n${label} ${filePaths.length} file(s)...\n`);

  const results = [];
  for (const fp of filePaths) {
    const result = runTestOnFile(fp, mode);
    results.push({ filepath: fp, ...result });
  }

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const skipped = results.filter((r) => r.skipped).length;

  console.log();
  if (failed === 0) {
    console.log(`all passed (${passed} ok${skipped ? `, ${skipped} skipped` : ""})\n`);
  } else {
    console.log(`${failed} failed, ${passed} passed${skipped ? `, ${skipped} skipped` : ""}\n`);
  }

  return results;
}

// ════════════════════════════════════════════════════════════
// ─── FIX: Read broken code, send to AI, get fixed version ─
// ════════════════════════════════════════════════════════════

async function fixFile(filepath, instruction, rl = null) {
  const fullPath = path.resolve(WORK_DIR, filepath);

  if (!fs.existsSync(fullPath)) {
    console.log(`\nfile not found: ${filepath}\n`);
    return;
  }

  const code = fs.readFileSync(fullPath, "utf-8");
  const lineCount = code.split("\n").length;

  console.log(`\nreading ${filepath} (${lineCount} lines)`);
  console.log("sending to AI for analysis...\n");

  try {
    const res = await fetch(FIX_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filepath,
        code,
        instruction: instruction || null,
      }),
    });

    if (!res.ok) {
      console.error(`http error ${res.status}: ${res.statusText}`);
      return;
    }

    const data = await res.json();

    if (data.structured && data.data && data.data.type === "fix_response") {
      const fix = data.data;

      if (fix.issues_found && fix.issues_found.length > 0) {
        console.log(`${fix.issues_found.length} issue(s) found:\n`);
        for (const issue of fix.issues_found) {
          console.log(`  line ${issue.line || "?"}: ${issue.problem}`);
          console.log(`    fix: ${issue.fix}`);
          console.log();
        }
      }

      if (fix.summary) {
        console.log(`summary: ${fix.summary}\n`);
      }

      if (fix.fixed_code) {
        printCodeBlock(filepath, fix.fixed_code);
        console.log();

        lastCodeResponse = {
          type: "code_response",
          files: [
            {
              filepath: filepath,
              description: fix.summary || "Fixed code",
              code: fix.fixed_code,
            },
          ],
          explanation: fix.summary,
        };

        if (rl) {
          await writeFiles(rl, true);
        } else {
          console.log("type /write to save the fixed code, or keep chatting.\n");
        }
      }
    } else {
      const msg = data.data?.message || data.raw || "No response";
      console.log(`AI: ${msg}\n`);
    }
  } catch (err) {
    console.error(`connection error: ${err.message}\n`);
  }
}

// ════════════════════════════════════════════════════════════
// ─── RUN: Execute a file and show output ──────────────────
// ════════════════════════════════════════════════════════════

function runFile(filepath) {
  const fullPath = path.resolve(WORK_DIR, filepath);

  if (!fs.existsSync(fullPath)) {
    console.log(`\nfile not found: ${filepath}\n`);
    return;
  }

  const testCmd = getTestCommand(fullPath);
  if (!testCmd.run) {
    console.log(`\nno runner for ${path.extname(filepath)} files\n`);
    return;
  }

  console.log(`\nrunning ${filepath}...\n`);

  try {
    const output = execSync(testCmd.run, {
      cwd: WORK_DIR,
      encoding: "utf-8",
      timeout: 30000,
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (output.trim()) {
      console.log(output);
    }
    console.log("exited ok\n");
  } catch (err) {
    const errorOutput = (err.stderr || err.stdout || err.message || "").toString().trim();
    console.log("runtime error\n");
    if (errorOutput) {
      const lines = errorOutput.split("\n").slice(0, 20);
      for (const line of lines) {
        console.log(`  ${line}`);
      }
    }
    console.log();
  }
}

// ════════════════════════════════════════════════════════════
// ─── NETWORK: Send queries to server ──────────────────────
// ════════════════════════════════════════════════════════════

async function sendAgentQuery(promptText, rl = null) {
  try {
    const res = await fetch(AGENT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: promptText,
        history: conversationHistory,
      }),
    });

    if (!res.ok) {
      console.error(`\nhttp error ${res.status}: ${res.statusText}`);
      const text = await res.text();
      console.error(text.substring(0, 200));
      return;
    }

    const data = await res.json();

    conversationHistory.push({ role: "user", text: promptText });

    if (data.structured && data.data) {
      const aiResponse = data.data;

      if (aiResponse.type === "code_response" && aiResponse.files) {
        lastCodeResponse = aiResponse;

        if (aiResponse.explanation) {
          console.log(`\nAI: ${aiResponse.explanation}\n`);
        }

        console.log(`${aiResponse.files.length} file(s) ready to write:\n`);

        for (const file of aiResponse.files) {
          if (file.description) {
            console.log(`  > ${file.filepath} - ${file.description}`);
          }
          printCodeBlock(file.filepath, file.code);
          console.log();
        }

        conversationHistory.push({
          role: "model",
          text: `[Code response with ${aiResponse.files.length} file(s): ${aiResponse.files.map((f) => f.filepath).join(", ")}] ${aiResponse.explanation || ""}`,
        });

        if (rl) {
          await writeFiles(rl, true);
        } else {
          console.log("type /write to save, /write test to save & test.\n");
        }
      } else if (aiResponse.type === "chat_response") {
        console.log(`\nAI: ${aiResponse.message}\n`);
        conversationHistory.push({ role: "model", text: aiResponse.message });
        lastCodeResponse = null;
      } else {
        console.log(`\nAI: ${data.raw || JSON.stringify(aiResponse)}\n`);
        conversationHistory.push({ role: "model", text: data.raw || JSON.stringify(aiResponse) });
      }
    } else if (data.answer) {
      console.log(`\nAI: ${data.answer}\n`);
      conversationHistory.push({ role: "model", text: data.answer });
    } else {
      console.error(`\nerror: ${data.error || "Unknown server response"}\n`);
    }
  } catch (err) {
    console.error(`\nconnection error: ${err.message}\n`);
  }
}

async function sendBasicQuery(promptText) {
  try {
    const res = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: promptText }),
    });

    if (!res.ok) {
      console.error(`\nhttp error ${res.status}: ${res.statusText}`);
      const text = await res.text();
      console.error(text.substring(0, 200));
      return;
    }

    const data = await res.json();
    if (data.answer) {
      console.log(`\nAI: ${data.answer}\n`);
    } else {
      console.error(`\nerror: ${data.error || "Unknown server response"}\n`);
    }
  } catch (err) {
    console.error(`\nconnection error: ${err.message}\n`);
  }
}

// ════════════════════════════════════════════════════════════
// ─── WRITE: Save AI code to files with optional auto-test ─
// ════════════════════════════════════════════════════════════

async function writeFiles(rl, autoTest = false) {
  if (!lastCodeResponse || !lastCodeResponse.files || lastCodeResponse.files.length === 0) {
    console.log("\nno code files pending. ask the AI to write some code first.\n");
    return;
  }

  const files = lastCodeResponse.files;

  console.log("\nfiles to write:");
  files.forEach((f, i) => {
    const fullPath = path.resolve(WORK_DIR, f.filepath);
    const exists = fs.existsSync(fullPath);
    const status = exists ? "overwrite" : "create";
    console.log(`  ${i + 1}. ${f.filepath} [${status}]`);
  });
  console.log();

  const targetLabel = files.length === 1 ? files[0].filepath : `${files.length} file(s)`;
  return new Promise((resolve) => {
    rl.question(
      `autocomplete / write to ${targetLabel}? (y/n/file numbers) [y]: `,
      (answer) => {
        const input = answer.trim().toLowerCase();

        if (input === "n" || input === "no") {
          console.log("cancelled. (type /write to apply later)\n");
          resolve();
          return;
        }

        let filesToWrite = files;

        if (input !== "y" && input !== "yes" && input !== "") {
          const indices = input
            .split(/[,\s]+/)
            .map((n) => parseInt(n, 10) - 1)
            .filter((n) => n >= 0 && n < files.length);
          if (indices.length > 0) {
            filesToWrite = indices.map((i) => files[i]);
          } else {
            console.log("cancelled.\n");
            resolve();
            return;
          }
        }

        const writtenPaths = [];
        for (const file of filesToWrite) {
          try {
            const fullPath = path.resolve(WORK_DIR, file.filepath);
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(fullPath, file.code, "utf-8");
            console.log(`  [ok] written: ${file.filepath}`);
            writtenPaths.push(file.filepath);
          } catch (err) {
            console.log(`  [x] failed: ${file.filepath} - ${err.message}`);
          }
        }

        console.log();
        lastWrittenFiles = writtenPaths;
        lastCodeResponse = null;

        if (autoTest && writtenPaths.length > 0) {
          testFiles(writtenPaths, "syntax");
        }

        resolve();
      }
    );
  });
}

// ─── Show pending files ───
function showPendingFiles() {
  if (!lastCodeResponse || !lastCodeResponse.files) {
    console.log("\nno code files pending.\n");
    return;
  }
  console.log("\npending files:");
  lastCodeResponse.files.forEach((f, i) => {
    console.log(`  ${i + 1}. ${f.filepath} - ${f.description || ""}`);
  });
  console.log("\ntype /write to save them.\n");
}

// ─── Show conversation history ───
function showHistory() {
  if (conversationHistory.length === 0) {
    console.log("\nno conversation history yet.\n");
    return;
  }
  console.log("\nconversation history:");
  conversationHistory.forEach((msg, i) => {
    const who = msg.role === "user" ? "You" : "AI";
    const preview = msg.text.length > 80 ? msg.text.substring(0, 80) + "..." : msg.text;
    console.log(`  ${i + 1}. ${who}: ${preview}`);
  });
  console.log();
}

// ════════════════════════════════════════════════════════════
// ─── MAIN: Interactive prompt loop ────────────────────────
// ════════════════════════════════════════════════════════════

const promptFromArgs = process.argv.slice(2).join(" ");

if (promptFromArgs.trim().length > 0) {
  sendAgentQuery(promptFromArgs);
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promptUser = () => {
    const mode = agentMode ? "agent" : "basic";

    rl.question(`You [${mode}]: `, async (input) => {
      const trimmed = input.trim();

      if (trimmed.toLowerCase() === "exit") {
        console.log("\ngoodbye.\n");
        rl.close();
        return;
      }

      // ─── /write [test] ───
      if (trimmed === "/write" || trimmed === "/write test") {
        const autoTest = trimmed === "/write test";
        await writeFiles(rl, autoTest);
        promptUser();
        return;
      }

      // ─── /test [file] ───
      if (trimmed.startsWith("/test")) {
        const arg = trimmed.slice(5).trim();
        if (arg) {
          testFiles([arg], "syntax");
        } else if (lastWrittenFiles.length > 0) {
          testFiles(lastWrittenFiles, "syntax");
        } else {
          console.log("\nno files to test. use /test myfile.js or write some files first.\n");
        }
        promptUser();
        return;
      }

      // ─── /fix <file> [instruction] ───
      if (trimmed.startsWith("/fix")) {
        const arg = trimmed.slice(4).trim();
        if (!arg) {
          console.log("\nusage: /fix <filepath> [optional instruction]");
          console.log("  example: /fix server.js");
          console.log("  example: /fix app.py add error handling\n");
          promptUser();
          return;
        }

        const parts = arg.split(/\s+/);
        const filepath = parts[0];
        const instruction = parts.slice(1).join(" ") || null;

        await fixFile(filepath, instruction, rl);
        promptUser();
        return;
      }

      // ─── /run <file> ───
      if (trimmed.startsWith("/run")) {
        const arg = trimmed.slice(4).trim();
        if (!arg) {
          console.log("\nusage: /run <filepath>\n");
          promptUser();
          return;
        }
        runFile(arg);
        promptUser();
        return;
      }

      // ─── /files ───
      if (trimmed === "/files") {
        showPendingFiles();
        promptUser();
        return;
      }

      // ─── /history ───
      if (trimmed === "/history") {
        showHistory();
        promptUser();
        return;
      }

      // ─── /clear ───
      if (trimmed === "/clear") {
        conversationHistory.length = 0;
        lastCodeResponse = null;
        lastWrittenFiles = [];
        console.log("\nconversation cleared.\n");
        promptUser();
        return;
      }

      // ─── /mode ───
      if (trimmed === "/mode") {
        agentMode = !agentMode;
        const label = agentMode ? "agent (structured)" : "basic (plain)";
        console.log(`\nswitched to ${label} mode.\n`);
        promptUser();
        return;
      }

      // ─── /help ───
      if (trimmed === "/help") {
        printHelp();
        promptUser();
        return;
      }

      if (!trimmed) {
        promptUser();
        return;
      }

      // ─── Send query ───
      if (agentMode) {
        await sendAgentQuery(trimmed, rl);
      } else {
        await sendBasicQuery(trimmed);
      }

      promptUser();
    });
  };

  const startAgent = async () => {
    const activeUrl = await resolveServerUrl();
    console.log();
    console.log("+------------------------------------------+");
    console.log("|  ai agent ready                          |");
    console.log("|  type /help for available commands       |");
    console.log("+------------------------------------------+");
    console.log(`[connected: ${activeUrl}]\n`);
    promptUser();
  };

  startAgent();
}
