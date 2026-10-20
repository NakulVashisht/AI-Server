/**
 * Command: Help - Show available commands
 */

import { CommandHandler, CommandContext } from '../types';
import { print, colorize } from '../utils/print';

export const helpCommand: CommandHandler = async (_args, context): Promise<void> => {
  const { state } = context;
  
  print.header('AI Agent Commands');
  
  const commands = [
    { key: 'write', desc: 'Write last AI code to file(s)', args: '[test]' },
    { key: 'test', desc: 'Syntax-check a file (or last written)', args: '[file]' },
    { key: 'run', desc: 'Run a file', args: '<file>' },
    { key: 'fix', desc: 'AI reads and fixes broken code', args: '<file> [instruction]' },
    { key: 'files', desc: 'Show pending code files', args: '' },
    { key: 'history', desc: 'Show conversation history', args: '' },
    { key: 'clear', desc: 'Clear conversation history', args: '' },
    { key: 'mode', desc: `Toggle agent/basic mode (current: ${state.agentMode ? 'agent' : 'basic'})`, args: '' },
    { key: 'help', desc: 'Show this help message', args: '' },
    { key: 'exit', desc: 'Quit the agent', args: '' },
  ];
  
  console.log();
  commands.forEach(cmd => {
    const args = cmd.args ? ` ${cmd.args}` : '';
    console.log(`  ${colorize('/' + cmd.key.padEnd(12), 'cyan')} ${cmd.desc}${args}`);
  });
  console.log();
  
  print.subHeader('Agent Mode Features');
  console.log('  • Structured code responses with file operations');
  console.log('  • Conversation history for context');
  console.log('  • Automatic server discovery (local + tunnel)');
  console.log();
  
  print.subHeader('Basic Mode Features');
  console.log('  • Plain chat responses');
  console.log('  • Faster, simpler interaction');
  console.log();
};