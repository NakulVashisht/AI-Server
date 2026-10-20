/**
 * Command: History - Show conversation history
 */

import { CommandHandler, CommandContext } from '../types';
import { print, colorize } from '../utils/print';

export const historyCommand: CommandHandler = async (_args, context): Promise<void> => {
  const { state } = context;
  
  if (state.conversationHistory.length === 0) {
    print.info('No conversation history yet.');
    return;
  }
  
  print.subHeader('Conversation History');
  
  state.conversationHistory.forEach((msg, i) => {
    const who = msg.role === 'user' ? 'You' : 'AI';
    const color = msg.role === 'user' ? 'cyan' : 'green';
    const preview = msg.text.length > 80 ? msg.text.substring(0, 80) + '...' : msg.text;
    const time = msg.timestamp.toLocaleTimeString();
    
    console.log(`  ${colorize(`${i + 1}.`, 'gray')} ${colorize(who, color as any)} [${time}]: ${preview}`);
  });
  
  print.log();
};