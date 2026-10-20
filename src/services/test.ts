/**
 * Test Service - Handles syntax checking and running files
 */

import { testFiles, runTestOnFile, runCustomTest, getTestCommand } from '../utils/test';
import { TestResult } from '../types';
import { print } from '../utils/print';

export class TestService {
  /**
   * Test multiple files (syntax check or run)
   */
  test(filePaths: string[], mode: 'syntax' | 'run' = 'syntax'): TestResult[] {
    return testFiles(filePaths, mode);
  }
  
  /**
   * Test a single file
   */
  testOne(filepath: string, mode: 'syntax' | 'run' = 'syntax'): TestResult {
    return runTestOnFile(filepath, mode);
  }
  
  /**
   * Run a custom test command
   */
  customTest(filepath: string, command: string): TestResult {
    return runCustomTest(filepath, command);
  }
  
  /**
   * Get the test command for a file (for display purposes)
   */
  getCommand(filepath: string): { syntax: string | null; run: string | null } {
    return getTestCommand(filepath);
  }
  
  /**
   * Test last written files
   */
  testLastWritten(filePaths: string[], mode: 'syntax' | 'run' = 'syntax'): TestResult[] {
    if (filePaths.length === 0) {
      print.warn('No files to test. Use "test <file>" or write some files first.');
      return [];
    }
    return this.test(filePaths, mode);
  }
}