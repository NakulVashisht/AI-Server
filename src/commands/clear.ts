/**
 * Command: Clear - Clear conversation history
 */

import { CommandHandler, CommandContext } from '../types';
import { print } from '../utils/print';

export const clearCommand: CommandHandler = async (_args, context): Promise<void> => {
  const { state } = context;
  
  state.conversationHistory.length = 0;
  state.lastCodeResponse = null;
  state.lastWrittenFiles = [];
  
  print.success('Conversation cleared.');
};