/**
 * Fix Service - Handles code fixing operations
 */

import { readFile, writeFile, backupFile, resolvePath } from '../utils/file';
import { sendFixQuery } from './api';
import { AIResponse, CodeFile } from '../types';
import { print } from '../utils/print';

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  reset: '\x1b[0m',
};

function colorize(text: string, color: string): string {
  return `${colors[color] || ''}${text}${colors.reset}`;
}

export class FixService {
  /**
   * Fix a file by reading it, sending to AI, and optionally writing back
   */
  async fix(
    filepath: string,
    instruction?: string,
    rl?: { question: (prompt: string, callback: (answer: string) => void) => void }
  ): Promise<AIResponse | null> {
    // Read the file
    const readResult = readFile(filepath);
    if (!readResult.success || !readResult.content) {
      print.failure(`Failed to read ${filepath}: ${readResult.error}`);
      return null;
    }
    
    print.pending(`Sending ${filepath} to AI for fixing...`);
    
    // Send to AI
    const response = await sendFixQuery(filepath, readResult.content, instruction);
    
    if (response.type === 'fix_response' && response.fixed_code) {
      print.success('AI returned fixed code');
      
      // Show issues found
      if (response.issues_found && response.issues_found.length > 0) {
        print.subHeader('Issues Found & Fixed');
        response.issues_found.forEach((issue, i) => {
          print.listItem(`${issue.line}: ${issue.problem}`, i + 1);
          console.log(`    Fix: ${issue.fix}`);
        });
      }
      
      if (response.summary) {
        print.log();
        print.info(response.summary);
      }
      
      // Show diff preview
      this.showDiff(readResult.content, response.fixed_code, filepath);
      
      // Ask to write
      if (rl) {
        const shouldWrite = await this.promptWrite(filepath, response.fixed_code, rl);
        if (shouldWrite) {
          // Backup original
          backupFile(filepath);
          
          // Write fixed code
          writeFile(filepath, response.fixed_code);
          print.success(`Fixed code written to ${filepath}`);
        }
      }
      
      return response;
    } else if (response.type === 'chat_response') {
      print.info(response.message || response.raw || 'No response');
      return response;
    }
    
    return response;
  }
  
  /**
   * Show a simple diff between old and new code
   */
  private showDiff(oldCode: string, newCode: string, filepath: string): void {
    const oldLines = oldCode.split('\n');
    const newLines = newCode.split('\n');
    
    print.subHeader(`Diff: ${filepath}`);
    
    // Simple line-by-line diff
    const maxLines = Math.max(oldLines.length, newLines.length);
    let changes = 0;
    
    for (let i = 0; i < Math.min(maxLines, 50); i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];
      
      if (oldLine !== newLine) {
        changes++;
        if (oldLine !== undefined) {
          console.log(`  ${colorize('-', 'red')} ${oldLine}`);
        }
        if (newLine !== undefined) {
          console.log(`  ${colorize('+', 'green')} ${newLine}`);
        }
      }
    }
    
    if (changes === 0) {
      print.info('No changes detected');
    } else if (maxLines > 50) {
      print.log(`  ... (${maxLines - 50} more lines)`);
    }
    
    print.log();
  }
  
  /**
   * Prompt user to write fixed code
   */
  private async promptWrite(
    filepath: string,
    fixedCode: string,
    rl: { question: (prompt: string, callback: (answer: string) => void) => void }
  ): Promise<boolean> {
    return new Promise(resolve => {
      rl.question(`Write fixed code to ${filepath}? (y/n) [y]: `, answer => {
        const input = answer.trim().toLowerCase();
        resolve(input !== 'n' && input !== 'no');
      });
    });
  }
  
  /**
   * Fix multiple files at once
   */
  async fixMultiple(
    filepaths: string[],
    instruction?: string
  ): Promise<AIResponse[]> {
    const results: AIResponse[] = [];
    
    for (const fp of filepaths) {
      print.log();
      print.divider('=', 40);
      print.log(`Fixing: ${fp}`);
      print.divider('=', 40);
      
      const result = await this.fix(fp, instruction);
      if (result) {
        results.push(result);
      }
    }
    
    return results;
  }
}