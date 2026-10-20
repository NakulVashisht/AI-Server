/**
 * File Service - Handles file operations for the CLI
 */

import { readFile, writeFile, writeFiles, deleteFile, listFiles, backupFile, restoreBackup, resolvePath } from '../utils/file';
import { CodeFile, FileWriteResult, FileReadResult } from '../types';
import { print } from '../utils/print';

export class FileService {
  /**
   * Read a file and return its content
   */
  read(filepath: string): FileReadResult {
    return readFile(filepath);
  }
  
  /**
   * Write a single file
   */
  write(filepath: string, content: string): FileWriteResult {
    return writeFile(filepath, content);
  }
  
  /**
   * Write multiple files from AI response
   */
  writeCodeFiles(files: CodeFile[]): FileWriteResult[] {
    return writeFiles(files.map(f => ({ filepath: f.filepath, code: f.code })));
  }
  
  /**
   * Delete a file
   */
  delete(filepath: string): FileWriteResult {
    return deleteFile(filepath);
  }
  
  /**
   * List files in working directory
   */
  list(dirPath = '.', recursive = false): string[] {
    return listFiles(dirPath, recursive);
  }
  
  /**
   * Create a backup before modifying
   */
  backup(filepath: string): string | null {
    return backupFile(filepath);
  }
  
  /**
   * Restore from backup
   */
  restore(backupPath: string, originalPath: string): boolean {
    return restoreBackup(backupPath, originalPath);
  }
  
  /**
   * Resolve a path relative to working directory
   */
  resolve(filepath: string): string {
    return resolvePath(filepath);
  }
  
  /**
   * Show pending files from AI response
   */
  showPending(response: { files?: CodeFile[] }): void {
    if (!response.files || response.files.length === 0) {
      print.info('No code files pending.');
      return;
    }
    
    print.subHeader('Pending Files');
    response.files.forEach((f, i) => {
      print.listItem(`${f.filepath} - ${f.description || '(no description)'}`, i + 1);
    });
    print.log('\nType "write" to save them.\n');
  }
  
  /**
   * Prompt user to write files interactively
   */
  async promptWrite(
    files: CodeFile[], 
    rl: { question: (prompt: string, callback: (answer: string) => void) => void },
    autoTest = false
  ): Promise<string[]> {
    if (files.length === 0) {
      print.info('No files to write.');
      return [];
    }
    
    print.subHeader('Files to Write');
    files.forEach((f, i) => {
      print.listItem(`${f.filepath} - ${f.description || '(no description)'}`, i + 1);
    });
    
    return new Promise(resolve => {
      const targetLabel = files.length === 1 ? files[0].filepath : `${files.length} file(s)`;
      
      rl.question(
        `Write ${targetLabel}? (y/n/file numbers) [y]: `,
        (answer) => {
          const input = answer.trim().toLowerCase();
          
          if (input === 'n' || input === 'no') {
            print.log('Cancelled. (type "write" to apply later)\n');
            resolve([]);
            return;
          }
          
          let filesToWrite = files;
          
          if (input !== 'y' && input !== 'yes' && input !== '') {
            const indices = input
              .split(/[,\s]+/)
              .map(n => parseInt(n, 10) - 1)
              .filter(n => n >= 0 && n < files.length);
            
            if (indices.length > 0) {
              filesToWrite = indices.map(i => files[i]);
            } else {
              print.log('Cancelled.\n');
              resolve([]);
              return;
            }
          }
          
          const writtenPaths: string[] = [];
          
          for (const file of filesToWrite) {
            const result = this.write(file.filepath, file.code);
            if (result.success) {
              writtenPaths.push(file.filepath);
            }
          }
          
          print.log();
          
          if (autoTest && writtenPaths.length > 0) {
            // Will be handled by caller
          }
          
          resolve(writtenPaths);
        }
      );
    });
  }
}