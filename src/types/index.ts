/**
 * Core type definitions for the AI CLI Agent
 */

// ─── Server Communication Types ───
export interface ServerConfig {
  url: string;
  agentEndpoint: string;
  chatEndpoint: string;
  fixEndpoint: string;
}

export interface AIResponse {
  type: 'code_response' | 'chat_response' | 'fix_response';
  files?: CodeFile[];
  explanation?: string;
  message?: string;
  filepath?: string;
  issues_found?: Issue[];
  fixed_code?: string;
  summary?: string;
  raw?: string;
  structured?: boolean;
  data?: AIResponse;
}

export interface CodeFile {
  filepath: string;
  description: string;
  code: string;
}

export interface Issue {
  line: string;
  problem: string;
  fix: string;
}

// ─── File Result Types ───
export interface FileWriteResult {
  filepath: string;
  success: boolean;
  error?: string;
}

export interface FileReadResult {
  filepath: string;
  content?: string;
  success: boolean;
  error?: string;
}

// ─── CLI State Types ───
export interface ConversationMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export interface CLIState {
  serverConfig: ServerConfig;
  conversationHistory: ConversationMessage[];
  lastCodeResponse: AIResponse | null;
  lastWrittenFiles: string[];
  agentMode: boolean;
  workDir: string;
}

// ─── Command Types ───
export type CommandHandler = (args: string[], context: CommandContext) => Promise<void>;

export interface CommandContext {
  state: CLIState;
  rl: ReadlineInterface;
  services: {
    api: any;
    file: any;
    test: any;
    fix: any;
  };
  utils: {
    print: any;
    prompt: any;
  };
}

// ─── Readline Interface ───
export interface ReadlineInterface {
  question(prompt: string, callback: (answer: string) => void): void;
  close(): void;
  on(event: string, listener: (...args: unknown[]) => void): this;
}

// ─── Test Types ───
export interface TestResult {
  filepath: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
}

export interface TestCommand {
  syntax: string | null;
  run: string | null;
}

// ─── Configuration Types ───
export interface AgentConfig {
  defaultModel: string;
  fallbackModel: string;
  timeout: number;
  maxHistoryLength: number;
  workDir: string;
}

export interface NTfyConfig {
  syncEndpoint: string;
  pollTimeout: number;
}

export interface TunnelConfig {
  command: string;
  args: string[];
  urlPattern: RegExp;
}