/**
 * Command: Write - Write pending AI code to files
 */

import { CommandHandler, CommandContext } from '../types';
import { print } from '../utils/print';

export const writeCommand: CommandHandler = async (args, context): Promise<void> => {
  const { state, services, rl } = context;
  const autoTest = args.includes('test');
  
  if (!state.lastCodeResponse || !state.lastCodeResponse.files || state.lastCodeResponse.files.length === 0) {
    print.warn('No code files pending. Ask the AI to generate some code first.');
    return;
  }
  
  const writtenPaths = await services.file.promptWrite(state.lastCodeResponse.files, rl, autoTest);
  
  if (writtenPaths.length > 0) {
    state.lastWrittenFiles = writtenPaths;
    state.lastCodeResponse = null;
    
    if (autoTest) {
      await services.test.test(writtenPaths, 'syntax');
    }
  }
};