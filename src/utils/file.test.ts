/**
 * Tests for file utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { readFile, writeFile, writeFiles, resolvePath, getExtension, isCodeFile } from './file';

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    unlinkSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    copyFileSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  unlinkSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  copyFileSync: vi.fn(),
}));

const mockedFs = vi.mocked(fs);

describe('File Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolvePath', () => {
    it('should resolve relative paths to absolute', () => {
      const result = resolvePath('test/file.js');
      expect(result).toContain('test');
      expect(result).toContain('file.js');
    });
  });

  describe('getExtension', () => {
    it('should return the file extension', () => {
      expect(getExtension('test/file.js')).toBe('.js');
      expect(getExtension('test/file.ts')).toBe('.ts');
      expect(getExtension('test/file')).toBe('');
    });
  });

  describe('isCodeFile', () => {
    it('should return true for known code extensions', () => {
      expect(isCodeFile('test.js')).toBe(true);
      expect(isCodeFile('test.ts')).toBe(true);
      expect(isCodeFile('test.py')).toBe(true);
      expect(isCodeFile('test.json')).toBe(true);
    });

    it('should return false for unknown extensions', () => {
      expect(isCodeFile('test.txt')).toBe(false);
      expect(isCodeFile('test.md')).toBe(false);
    });
  });

  describe('readFile', () => {
    it('should return error when file does not exist', () => {
      mockedFs.existsSync.mockReturnValue(false);
      
      const result = readFile('nonexistent.js');
      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found');
    });

    it('should return content when file exists', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('const x = 1;');
      
      const result = readFile('test.js');
      expect(result.success).toBe(true);
      expect(result.content).toBe('const x = 1;');
    });
  });

  describe('writeFile', () => {
    it('should write file and create directories', () => {
      mockedFs.existsSync.mockReturnValue(false);
      
      const result = writeFile('new/test.js', 'const x = 1;');
      expect(result.success).toBe(true);
      expect(mockedFs.mkdirSync).toHaveBeenCalled();
      expect(mockedFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('writeFiles', () => {
    it('should write multiple files', () => {
      mockedFs.existsSync.mockReturnValue(true);
      
      const files = [
        { filepath: 'a.js', code: 'const a = 1;' },
        { filepath: 'b.js', code: 'const b = 2;' },
      ];
      
      const results = writeFiles(files);
      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });
  });
});