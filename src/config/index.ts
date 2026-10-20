/**
 * Configuration management for the AI CLI Agent
 */

import { AgentConfig, NTfyConfig, TunnelConfig } from '../types';

export const WORK_DIR = process.cwd();

// Latest Gemini 2.0 models (as of 2025)
// Primary: gemini-2.0-flash - latest stable fast model
// Fallback: gemini-2.0-flash-lite - latest stable lite model (cheaper, higher quotas)
export const MODEL_CONFIG = {
  primary: {
    name: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    rpm: 1000,        // Requests per minute
    rpd: 10000,       // Requests per day
    tpm: 4000000,     // Tokens per minute
  },
  fallback: {
    name: 'gemini-2.0-flash-lite',
    displayName: 'Gemini 2.0 Flash Lite',
    rpm: 1000,
    rpd: 10000,
    tpm: 4000000,
  },
} as const;

export const config: AgentConfig = {
  defaultModel: MODEL_CONFIG.primary.name,
  fallbackModel: MODEL_CONFIG.fallback.name,
  timeout: 30000,
  maxHistoryLength: 50,
  workDir: WORK_DIR,
};

export const ntfyConfig: NTfyConfig = {
  syncEndpoint: 'https://ntfy.sh/ghosty001_ai_tunnel_sync',
  pollTimeout: 3000,
};

export const tunnelConfig: TunnelConfig = {
  command: 'cloudflared',
  args: ['tunnel', '--protocol', 'http2', '--url', 'http://127.0.0.1:3000'],
  urlPattern: /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/,
};

export const serverDefaults = {
  localUrl: 'http://127.0.0.1:3000',
  localCheckTimeout: 1000,
  localCheckEndpoint: '/chat',
};

export function getServerConfig(baseUrl: string) {
  return {
    url: baseUrl,
    agentEndpoint: `${baseUrl}/agent`,
    chatEndpoint: `${baseUrl}/chat`,
    fixEndpoint: `${baseUrl}/fix`,
  };
}