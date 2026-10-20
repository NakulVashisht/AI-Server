/**
 * Tests for command parsing
 */

import { describe, it, expect } from 'vitest';
import { parseCommand, getCommandNames, isCommand, getCommand } from './index';

describe('Command Parser', () => {
  describe('parseCommand', () => {
    it('should parse simple commands', () => {
      const result = parseCommand('/help');
      expect(result).toEqual({ name: 'help', args: [] });
    });

    it('should parse commands with arguments', () => {
      const result = parseCommand('/fix server.js');
      expect(result).toEqual({ name: 'fix', args: ['server.js'] });
    });

    it('should parse commands with multiple arguments', () => {
      const result = parseCommand('/fix server.js add error handling');
      expect(result).toEqual({ name: 'fix', args: ['server.js', 'add', 'error', 'handling'] });
    });

    it('should return null for non-commands', () => {
      expect(parseCommand('hello')).toBeNull();
      expect(parseCommand('help')).toBeNull();
    });

    it('should return null for unknown commands', () => {
      expect(parseCommand('/unknown')).toBeNull();
    });

    it('should be case insensitive', () => {
      const result = parseCommand('/HELP');
      expect(result).toEqual({ name: 'help', args: [] });
    });
  });

  describe('getCommandNames', () => {
    it('should return all command names', () => {
      const names = getCommandNames();
      expect(names).toContain('help');
      expect(names).toContain('write');
      expect(names).toContain('test');
      expect(names).toContain('run');
      expect(names).toContain('fix');
      expect(names).toContain('files');
      expect(names).toContain('history');
      expect(names).toContain('clear');
      expect(names).toContain('mode');
      expect(names).toContain('exit');
    });
  });

  describe('isCommand', () => {
    it('should return true for valid commands', () => {
      expect(isCommand('/help')).toBe(true);
      expect(isCommand('/write')).toBe(true);
      expect(isCommand('/test file.js')).toBe(true);
    });

    it('should return false for non-commands', () => {
      expect(isCommand('help')).toBe(false);
      expect(isCommand('hello world')).toBe(false);
    });
  });

  describe('getCommand', () => {
    it('should return handler for valid commands', () => {
      const handler = getCommand('help');
      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');
    });

    it('should return undefined for invalid commands', () => {
      const handler = getCommand('unknown');
      expect(handler).toBeUndefined();
    });
  });
});