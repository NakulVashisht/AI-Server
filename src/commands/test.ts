/**
 * Command: Test - Syntax check or run files
 */

import { CommandHandler, CommandContext } from '../types';
import { print } from '../utils/print';

export const testCommand: CommandHandler = async (args, context): Promise<void> => {
  const { state, services } = context;
  
  const fileArg = args.join(' ').trim();
  let filesToTest: string[] = [];
  
  if (fileArg) {
    filesToTest = [fileArg];
  } else if (state.lastWrittenFiles.length > 0) {
    filesToTest = state.lastWrittenFiles;
  } else {
    print.warn('No files to test. Use "/test <file>" or write some files first.');
    return;
  }
  
  await services.test.test(filesToTest, 'syntax');
};