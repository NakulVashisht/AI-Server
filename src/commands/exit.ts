/**
 * Command: Exit - Quit the agent
 */

import { CommandHandler, CommandContext } from '../types';
import { print } from '../utils/print';

export const exitCommand: CommandHandler = async (_args, context): Promise<void> => {
  const { rl } = context;
  
  print.log();
  print.success('Goodbye!');
  print.log();
  
  rl.close();
  process.exit(0);
};