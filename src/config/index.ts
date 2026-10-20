/**
 * Configuration management for the AI CLI Agent
 */

import { AgentConfig, NTfyConfig, TunnelConfig } from '../types';

export const WORK_DIR = process.cwd();

export const config: AgentConfig = {
  defaultModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  fallbackModel: 'gemini-3.5-flash-lite',
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