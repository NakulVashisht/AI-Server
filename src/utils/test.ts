/**
 * Test utilities for syntax checking and running files
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { WORK_DIR } from '../config';
import { print } from './print';
import { TestCommand, TestResult } from '../types';

/**
 * Get test commands for a file based on its extension
 */
export function getTestCommand(filepath: string): TestCommand {
  const ext = getExtension(filepath).toLowerCase();
  
  const commands: Record<string, TestCommand> = {
    '.js': { syntax: `node -c "${filepath}"`, run: `node "${filepath}"` },
    '.mjs': { syntax: `node -c "${filepath}"`, run: `node "${filepath}"` },
    '.ts': { syntax: `npx tsc --noEmit "${filepath}"`, run: `npx tsx "${filepath}"` },
    '.tsx': { syntax: `npx tsc --noEmit "${filepath}"`, run: `npx tsx "${filepath}"` },
    '.py': { syntax: `python -c "import py_compile; py_compile.compile('${filepath}', doraise=True)"`, run: `python "${filepath}"` },
    '.json': { syntax: `node -e "JSON.parse(require('fs').readFileSync('${filepath}','utf8'))"`, run: null },
    '.html': { syntax: null, run: null },
    '.css': { syntax: null, run: null },
    '.sh': { syntax: `bash -n "${filepath}"`, run: `bash "${filepath}"` },
    '.bat': { syntax: null, run: `"${filepath}"` },
    '.ps1': { syntax: null, run: `powershell -File "${filepath}"` },
    '.rs': { syntax: `rustc --emit=metadata -o /dev/null "${filepath}"`, run: `cargo run --example ${path.basename(filepath, '.rs')}` },
    '.go': { syntax: `go build -o /dev/null "${filepath}"`, run: `go run "${filepath}"` },
  };
  
  return commands[ext] || { syntax: null, run: null };
}

export function getExtension(filepath: string): string {
  const lastDot = filepath.lastIndexOf('.');
  return lastDot !== -1 ? filepath.slice(lastDot) : '';
}

/**
 * Run a test command on a file
 */
export function runTestOnFile(
  filepath: string, 
  mode: 'syntax' | 'run' = 'syntax',
  options: { timeout?: number } = {}
): TestResult {
  const fullPath = path.resolve(WORK_DIR, filepath);
  
  if (!fs.existsSync(fullPath)) {
    print.failure(`Not found: ${filepath}`);
    return { filepath, success: false, error: 'File not found' };
  }
  
  const testCmd = getTestCommand(fullPath);
  const cmd = mode === 'run' ? testCmd.run : testCmd.syntax;
  
  if (!cmd) {
    const ext = getExtension(filepath);
    print.skipped(`${filepath} (no ${mode} checker for ${ext})`);
    return { filepath, success: true, skipped: true };
  }
  
  try {
    const output = execSync(cmd, {
      cwd: WORK_DIR,
      encoding: 'utf-8',
      timeout: options.timeout || 15000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    
    const label = mode === 'run' ? 'ran ok' : 'syntax ok';
    print.success(`${label}: ${filepath}`);
    
    if (output.trim()) {
      const lines = output.trim().split('\n').slice(0, 5);
      lines.forEach(line => console.log(`       ${line}`));
    }
    
    return { filepath, success: true };
  } catch (err) {
    const label = mode === 'run' ? 'run failed' : 'syntax error';
    print.failure(`${label}: ${filepath}`);
    
    const errorOutput = (err as Error & { stdout?: string; stderr?: string }).stderr 
      || (err as Error & { stdout?: string; stderr?: string }).stdout 
      || (err as Error).message 
      || '';
    
    if (errorOutput.trim()) {
      const errorLines = errorOutput.trim().split('\n').slice(0, 10);
      errorLines.forEach(line => console.log(`       ${line}`));
    }
    
    return { filepath, success: false, error: errorOutput.trim() };
  }
}

/**
 * Test multiple files
 */
export function testFiles(
  filePaths: string[], 
  mode: 'syntax' | 'run' = 'syntax'
): TestResult[] {
  const label = mode === 'run' ? 'Running' : 'Testing';
  print.subHeader(`${label} ${filePaths.length} file(s)`);
  
  const results: TestResult[] = [];
  
  for (const fp of filePaths) {
    const result = runTestOnFile(fp, mode);
    results.push(result);
  }
  
  const passed = results.filter(r => r.success && !r.skipped).length;
  const failed = results.filter(r => !r.success).length;
  const skipped = results.filter(r => r.skipped).length;
  
  print.divider();
  
  if (failed === 0) {
    print.success(`All passed (${passed} ok${skipped ? `, ${skipped} skipped` : ''})`);
  } else {
    print.failure(`${failed} failed, ${passed} passed${skipped ? `, ${skipped} skipped` : ''}`);
  }
  
  console.log();
  return results;
}

/**
 * Test with a specific command (for custom test scripts)
 */
export function runCustomTest(
  filepath: string, 
  command: string, 
  options: { timeout?: number } = {}
): TestResult {
  const fullPath = path.resolve(WORK_DIR, filepath);
  
  try {
    const output = execSync(command, {
      cwd: WORK_DIR,
      encoding: 'utf-8',
      timeout: options.timeout || 30000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    
    print.success(`Custom test passed: ${filepath}`);
    if (output.trim()) {
      console.log(output.trim());
    }
    return { filepath, success: true };
  } catch (err) {
    print.failure(`Custom test failed: ${filepath}`);
    const errorOutput = (err as Error & { stdout?: string; stderr?: string }).stderr 
      || (err as Error & { stdout?: string; stderr?: string }).stdout 
      || (err as Error).message 
      || '';
    console.log(errorOutput);
    return { filepath, success: false, error: errorOutput.trim() };
  }
}