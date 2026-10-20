/**
 * File system utilities
 */

import fs from 'fs';
import path from 'path';
import { WORK_DIR } from '../config';
import { print } from './print';

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

/**
 * Resolve a file path relative to the working directory
 */
export function resolvePath(filepath: string): string {
  return path.resolve(WORK_DIR, filepath);
}

/**
 * Check if a file exists
 */
export function fileExists(filepath: string): boolean {
  return fs.existsSync(resolvePath(filepath));
}

/**
 * Read a file safely
 */
export function readFile(filepath: string): FileReadResult {
  const fullPath = resolvePath(filepath);
  
  if (!fs.existsSync(fullPath)) {
    return { filepath, success: false, error: 'File not found' };
  }
  
  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    return { filepath, content, success: true };
  } catch (err) {
    return { filepath, success: false, error: (err as Error).message };
  }
}

/**
 * Write a file, creating directories as needed
 */
export function writeFile(filepath: string, content: string): FileWriteResult {
  const fullPath = resolvePath(filepath);
  const dir = path.dirname(fullPath);
  
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf-8');
    print.success(`Written: ${filepath}`);
    return { filepath, success: true };
  } catch (err) {
    print.failure(`Failed to write ${filepath}: ${(err as Error).message}`);
    return { filepath, success: false, error: (err as Error).message };
  }
}

/**
 * Write multiple files
 */
export function writeFiles(files: Array<{ filepath: string; code: string }>): FileWriteResult[] {
  return files.map(f => writeFile(f.filepath, f.code));
}

/**
 * Delete a file
 */
export function deleteFile(filepath: string): FileWriteResult {
  const fullPath = resolvePath(filepath);
  
  try {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      print.success(`Deleted: ${filepath}`);
    }
    return { filepath, success: true };
  } catch (err) {
    return { filepath, success: false, error: (err as Error).message };
  }
}

/**
 * List files in a directory
 */
export function listFiles(dirPath = '.', recursive = false): string[] {
  const fullPath = resolvePath(dirPath);
  
  if (!fs.existsSync(fullPath)) {
    return [];
  }
  
  const files: string[] = [];
  
  function walk(currentPath: string, relativePath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const entryRelative = path.join(relativePath, entry.name);
      
      if (entry.isDirectory()) {
        if (recursive) {
          walk(path.join(currentPath, entry.name), entryRelative);
        }
      } else {
        files.push(entryRelative);
      }
    }
  }
  
  walk(fullPath, '');
  return files.sort();
}

/**
 * Get file extension
 */
export function getExtension(filepath: string): string {
  return path.extname(filepath).toLowerCase();
}

/**
 * Check if a file is a code file (has syntax checking available)
 */
export function isCodeFile(filepath: string): boolean {
  const codeExtensions = [
    '.js', '.mjs', '.ts', '.tsx', '.py', '.json', 
    '.html', '.css', '.sh', '.bat', '.ps1', '.rs', '.go', '.java'
  ];
  return codeExtensions.includes(getExtension(filepath));
}

/**
 * Backup a file before modifying
 */
export function backupFile(filepath: string): string | null {
  const fullPath = resolvePath(filepath);
  
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  
  const backupPath = `${fullPath}.backup.${Date.now()}`;
  
  try {
    fs.copyFileSync(fullPath, backupPath);
    return backupPath;
  } catch {
    return null;
  }
}

/**
 * Restore a file from backup
 */
export function restoreBackup(backupPath: string, originalPath: string): boolean {
  try {
    fs.copyFileSync(backupPath, resolvePath(originalPath));
    fs.unlinkSync(backupPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file stats
 */
export function getFileStats(filepath: string): fs.Stats | null {
  try {
    return fs.statSync(resolvePath(filepath));
  } catch {
    return null;
  }
}