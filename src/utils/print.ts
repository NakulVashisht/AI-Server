/**
 * Console output utilities with colors and formatting
 */

// ─── Color Codes ───
export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  
  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

export type ColorKey = keyof typeof colors;

export function colorize(text: string, color: ColorKey): string {
  return `${colors[color]}${text}${colors.reset}`;
}

export function style(text: string, ...styles: ColorKey[]): string {
  return styles.map(s => colors[s]).join('') + text + colors.reset;
}

// ─── Print Utilities ───
export const print = {
  // Basic output
  log: (...args: unknown[]): void => console.log(...args),
  error: (...args: unknown[]): void => console.error(colorize('Error:', 'red'), ...args),
  warn: (...args: unknown[]): void => console.warn(colorize('Warning:', 'yellow'), ...args),
  info: (...args: unknown[]): void => console.log(colorize('Info:', 'blue'), ...args),
  debug: (...args: unknown[]): void => console.log(colorize('Debug:', 'gray'), ...args),
  
  // Success/Error states
  success: (msg: string): void => console.log(colorize('[✓]', 'green'), msg),
  failure: (msg: string): void => console.log(colorize('[✗]', 'red'), msg),
  skipped: (msg: string): void => console.log(colorize('[–]', 'yellow'), msg),
  pending: (msg: string): void => console.log(colorize('[⟳]', 'cyan'), msg),
  
  // Headers and sections
  header: (title: string): void => {
    console.log();
    console.log(style('═'.repeat(50), 'cyan'));
    console.log(style(`  ${title}`, 'cyan', 'bold'));
    console.log(style('═'.repeat(50), 'cyan'));
    console.log();
  },
  
  subHeader: (title: string): void => {
    console.log();
    console.log(style(`── ${title} ──`, 'blue'));
  },
  
  divider: (char = '─', length = 50, colorKey: ColorKey = 'gray'): void => {
    console.log(colorize(char.repeat(length), colorKey));
  },
  
  // Code blocks
  codeBlock: (filepath: string, code: string, maxLines = 25): void => {
    const ext = filepath.split('.').pop() || 'txt';
    console.log(colorize(`--- ${filepath} [${ext}] ---`, 'cyan'));
    
    const lines = code.split('\n');
    const showLines = lines.slice(0, maxLines);
    
    showLines.forEach((line, i) => {
      const lineNum = String(i + 1).padStart(3, ' ');
      console.log(`  ${colorize(lineNum, 'gray')} | ${line}`);
    });
    
    if (lines.length > maxLines) {
      console.log(`  ${colorize('...', 'gray')} (${lines.length - maxLines} more lines)`);
    }
    console.log(colorize('---', 'cyan'));
  },
  
  // Key-value pairs
  kv: (key: string, value: string, keyColor: ColorKey = 'cyan'): void => {
    console.log(`  ${colorize(key, keyColor)}: ${value}`);
  },
  
  // List items
  listItem: (text: string, index?: number, bulletColor: ColorKey = 'cyan'): void => {
    const prefix = index !== undefined ? `${index}.` : '•';
    console.log(`  ${colorize(prefix, bulletColor)} ${text}`);
  },
  
  // Spinner (simple text-based)
  spinner: {
    frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    intervalId: null as NodeJS.Timeout | null,
    
    start(message: string): void {
      let i = 0;
      this.intervalId = setInterval(() => {
        process.stdout.write(`\r${colorize(this.frames[i], 'cyan')} ${message}`);
        i = (i + 1) % this.frames.length;
      }, 80);
    },
    
    stop(success = true, finalMessage = ''): void {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      const icon = success ? colorize('[✓]', 'green') : colorize('[✗]', 'red');
      process.stdout.write(`\r${icon} ${finalMessage}\n`);
    },
  },
  
  // Progress bar
  progress: (current: number, total: number, label = ''): void => {
    const width = 30;
    const filled = Math.round((current / total) * width);
    const empty = width - filled;
    const bar = colorize('█'.repeat(filled), 'green') + colorize('░'.repeat(empty), 'gray');
    const percent = Math.round((current / total) * 100);
    process.stdout.write(`\r${bar} ${percent}% ${label}`);
    if (current === total) process.stdout.write('\n');
  },
  
  // Box drawing
  box: (lines: string[], title?: string): void => {
    const maxLen = Math.max(...lines.map(l => l.length), title?.length || 0);
    const width = maxLen + 4;
    
    console.log();
    if (title) {
      console.log(colorize(`┌${'─'.repeat(width - 2)}┐`, 'cyan'));
      console.log(colorize(`│ ${title.padEnd(width - 4)} │`, 'cyan'));
      console.log(colorize(`├${'─'.repeat(width - 2)}┤`, 'cyan'));
    } else {
      console.log(colorize(`┌${'─'.repeat(width - 2)}┐`, 'cyan'));
    }
    
    lines.forEach(line => {
      console.log(colorize(`│ ${line.padEnd(width - 4)} │`, 'cyan'));
    });
    
    console.log(colorize(`└${'─'.repeat(width - 2)}┘`, 'cyan'));
    console.log();
  },
};