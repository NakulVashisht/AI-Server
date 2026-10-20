/**
 * Interactive prompt utilities
 */

import readline from 'readline';
import { ReadlineInterface, CommandContext } from '../types';
import { print } from './print';

// ─── Readline Wrapper ───
export function createReadlineInterface(): ReadlineInterface {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return {
    question: (prompt: string, callback: (answer: string) => void) => {
      rl.question(prompt, callback);
    },
    close: () => rl.close(),
    on: (event: string, listener: (...args: unknown[]) => void) => {
      rl.on(event, listener);
      return rl;
    },
  };
}

// ─── Prompt Utilities ───
export const prompt = {
  /**
   * Ask a yes/no question
   */
  async confirm(question: string, defaultYes = true): Promise<boolean> {
    const suffix = defaultYes ? ' [Y/n]' : ' [y/N]';
    return new Promise(resolve => {
      const rl = createReadlineInterface();
      rl.question(`${question}${suffix}: `, answer => {
        rl.close();
        const trimmed = answer.trim().toLowerCase();
        if (!trimmed) resolve(defaultYes);
        else resolve(trimmed === 'y' || trimmed === 'yes');
      });
    });
  },
  
  /**
   * Ask for text input with optional validation
   */
  async text(question: string, validate?: (input: string) => string | null): Promise<string> {
    return new Promise((resolve, reject) => {
      const rl = createReadlineInterface();
      const ask = () => {
        rl.question(`${question}: `, answer => {
          const trimmed = answer.trim();
          if (validate) {
            const error = validate(trimmed);
            if (error) {
              print.error(error);
              ask();
              return;
            }
          }
          rl.close();
          resolve(trimmed);
        });
      };
      ask();
    });
  },
  
  /**
   * Ask for a number
   */
  async number(question: string, min?: number, max?: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const rl = createReadlineInterface();
      const ask = () => {
        rl.question(`${question}: `, answer => {
          const num = Number(answer.trim());
          if (isNaN(num)) {
            print.error('Please enter a valid number');
            ask();
            return;
          }
          if (min !== undefined && num < min) {
            print.error(`Number must be at least ${min}`);
            ask();
            return;
          }
          if (max !== undefined && num > max) {
            print.error(`Number must be at most ${max}`);
            ask();
            return;
          }
          rl.close();
          resolve(num);
        });
      };
      ask();
    });
  },
  
  /**
   * Select from a list of options
   */
  async select<T>(question: string, options: Array<{ label: string; value: T }>): Promise<T> {
    console.log(`\n${question}`);
    options.forEach((opt, i) => {
      console.log(`  ${i + 1}. ${opt.label}`);
    });
    console.log();
    
    return new Promise((resolve, reject) => {
      const rl = createReadlineInterface();
      const ask = () => {
        rl.question('Select option: ', answer => {
          const idx = parseInt(answer.trim(), 10) - 1;
          if (isNaN(idx) || idx < 0 || idx >= options.length) {
            print.error('Invalid selection');
            ask();
            return;
          }
          rl.close();
          resolve(options[idx].value);
        });
      };
      ask();
    });
  },
  
  /**
   * Multi-select from a list (checkbox style)
   */
  async multiSelect<T>(question: string, options: Array<{ label: string; value: T }>): Promise<T[]> {
    console.log(`\n${question} (comma-separated numbers)`);
    options.forEach((opt, i) => {
      console.log(`  ${i + 1}. ${opt.label}`);
    });
    console.log();
    
    return new Promise((resolve, reject) => {
      const rl = createReadlineInterface();
      const ask = () => {
        rl.question('Select options: ', answer => {
          const indices = answer
            .split(/[,\s]+/)
            .map(s => parseInt(s.trim(), 10) - 1)
            .filter(i => i >= 0 && i < options.length);
          
          if (indices.length === 0) {
            print.error('No valid options selected');
            ask();
            return;
          }
          
          rl.close();
          resolve(indices.map(i => options[i].value));
        });
      };
      ask();
    });
  },
  
  /**
   * Show a menu and get selection
   */
  async menu(title: string, items: Array<{ key: string; label: string; description?: string }>): Promise<string> {
    print.header(title);
    items.forEach(item => {
      const desc = item.description ? ` ${colorize('→', 'gray')} ${item.description}` : '';
      console.log(`  ${colorize(item.key.padEnd(12), 'cyan')} ${item.label}${desc}`);
    });
    console.log();
    
    return new Promise((resolve, reject) => {
      const rl = createReadlineInterface();
      const validKeys = items.map(i => i.key);
      
      const ask = () => {
        rl.question('Enter command: ', answer => {
          const key = answer.trim().toLowerCase();
          if (!validKeys.includes(key)) {
            print.error(`Invalid command. Valid: ${validKeys.join(', ')}`);
            ask();
            return;
          }
          rl.close();
          resolve(key);
        });
      };
      ask();
    });
  },
};

// ─── Helper for colorize in this module ───
function colorize(text: string, color: string): string {
  const colors: Record<string, string> = {
    reset: '\x1b[0m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
  };
  return `${colors[color] || ''}${text}${colors.reset}`;
}