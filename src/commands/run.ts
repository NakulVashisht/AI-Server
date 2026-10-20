/**
 * Command: Run - Execute a file
 */

import { CommandHandler, CommandContext } from '../types';
import { print } from '../utils/print';

export const runCommand: CommandHandler = async (args, context): Promise<void> => {
  const { services } = context;
  
  const filepath = args.join(' ').trim();
  
  if (!filepath) {
    print.warn('Usage: /run <filepath>');
    return;
  }
  
  await services.test.test([filepath], 'run');
};