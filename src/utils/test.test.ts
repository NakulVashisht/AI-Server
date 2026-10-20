/**
 * Tests for test utilities
 */

import { describe, it, expect, vi } from 'vitest';
import { getTestCommand, getExtension } from './test';

// Mock fs and child_process
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

vi.mock('child_process', () => ({
  execSync: vi.fn().mockReturnValue('success'),
}));

describe('Test Utilities', () => {
  describe('getExtension', () => {
    it('should return the file extension', () => {
      // @ts-ignore - accessing private function
      expect(getExtension('test/file.js')).toBe('.js');
      // @ts-ignore
      expect(getExtension('test/file.ts')).toBe('.ts');
      // @ts-ignore
      expect(getExtension('test/file')).toBe('');
    });
  });

  describe('getTestCommand', () => {
    it('should return correct commands for JavaScript files', () => {
      const cmd = getTestCommand('test.js');
      expect(cmd.syntax).toContain('node -c');
      expect(cmd.run).toContain('node');
    });

    it('should return correct commands for TypeScript files', () => {
      const cmd = getTestCommand('test.ts');
      expect(cmd.syntax).toContain('tsc --noEmit');
      expect(cmd.run).toContain('tsx');
    });

    it('should return correct commands for Python files', () => {
      const cmd = getTestCommand('test.py');
      expect(cmd.syntax).toContain('py_compile');
      expect(cmd.run).toContain('python');
    });

    it('should return null for files without test commands', () => {
      const cmd = getTestCommand('test.html');
      expect(cmd.syntax).toBeNull();
      expect(cmd.run).toBeNull();
    });
  });
});