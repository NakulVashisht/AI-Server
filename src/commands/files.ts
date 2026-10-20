/**
 * Command: Files - Show pending code files
 */

import { CommandHandler, CommandContext } from '../types';
import { print } from '../utils/print';

export const filesCommand: CommandHandler = async (_args, context): Promise<void> => {
  const { state, services } = context;
  
  services.file.showPending(state.lastCodeResponse || {});
};