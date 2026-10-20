/**
 * Command: Mode - Toggle between agent and basic mode
 */

import { CommandHandler, CommandContext } from '../types';
import { print } from '../utils/print';

export const modeCommand: CommandHandler = async (_args, context): Promise<void> => {
  const { state } = context;
  
  state.agentMode = !state.agentMode;
  const label = state.agentMode ? 'agent (structured)' : 'basic (plain)';
  
  print.success(`Switched to ${label} mode.`);
};