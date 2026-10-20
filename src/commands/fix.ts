/**
 * Command: Fix - AI fixes broken code in a file
 */

import { CommandHandler, CommandContext } from '../types';
import { print } from '../utils/print';

export const fixCommand: CommandHandler = async (args, context): Promise<void> => {
  const { services, rl } = context;
  
  const arg = args.join(' ').trim();
  
  if (!arg) {
    print.warn('Usage: /fix <filepath> [optional instruction]');
    print.log('  Example: /fix server.js');
    print.log('  Example: /fix app.py add error handling');
    return;
  }
  
  const parts = arg.split(/\s+/);
  const filepath = parts[0];
  const instruction = parts.slice(1).join(' ') || undefined;
  
  await services.fix.fix(filepath, instruction, rl);
};