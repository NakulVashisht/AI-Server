/**
 * Command Registry - Maps command names to handlers
 */

import { CommandHandler, CommandContext } from '../types';
import { helpCommand } from './help';
import { writeCommand } from './write';
import { testCommand } from './test';
import { runCommand } from './run';
import { fixCommand } from './fix';
import { filesCommand } from './files';
import { historyCommand } from './history';
import { clearCommand } from './clear';
import { modeCommand } from './mode';
import { exitCommand } from './exit';

export const commands: Record<string, CommandHandler> = {
  help: helpCommand,
  write: writeCommand,
  test: testCommand,
  run: runCommand,
  fix: fixCommand,
  files: filesCommand,
  history: historyCommand,
  clear: clearCommand,
  mode: modeCommand,
  exit: exitCommand,
};

export function getCommand(name: string): CommandHandler | undefined {
  return commands[name];
}

export function getCommandNames(): string[] {
  return Object.keys(commands);
}

export function isCommand(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) {
    return false;
  }
  const parts = trimmed.slice(1).split(/\s+/);
  const name = parts[0].toLowerCase();
  return getCommand(name) !== undefined;
}

export function parseCommand(input: string): { name: string; args: string[] } | null {
  const trimmed = input.trim();

  if (!trimmed.startsWith('/')) {
    return null;
  }

  const parts = trimmed.slice(1).split(/\s+/);
  const name = parts[0].toLowerCase();
  const args = parts.slice(1);

  if (!getCommand(name)) {
    return null;
  }

  return { name, args };
}