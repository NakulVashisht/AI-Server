/**
 * AI CLI Agent - Main Entry Point
 * 
 * A modular, TypeScript-based CLI for interacting with the AI server.
 */

import { createReadlineInterface } from './utils/prompt';
import { resolveServerUrl } from './services/api';
import { FileService } from './services/file';
import { TestService } from './services/test';
import { FixService } from './services/fix';
import { commands, parseCommand } from './commands';
import { CLIState, ReadlineInterface } from './types';
import { config } from './config';
import { print } from './utils/print';
import { sendAgentQuery, sendBasicQuery } from './services/api';

// ─── Service Instances ───
const fileService = new FileService();
const testService = new TestService();
const fixService = new FixService();

// ─── CLI State ───
const state: CLIState = {
  serverConfig: { url: '', agentEndpoint: '', chatEndpoint: '', fixEndpoint: '' },
  conversationHistory: [],
  lastCodeResponse: null,
  lastWrittenFiles: [],
  agentMode: true,
  workDir: config.workDir,
};

// ─── Command Context ───
const commandContext = {
  state,
  rl: null as ReadlineInterface | null,
  services: {
    file: fileService,
    test: testService,
    fix: fixService,
  },
  utils: { print },
};

// ─── Helper Functions ───
async function sendAgentQueryWrapper(prompt: string, rl: ReadlineInterface): Promise<void> {
  print.pending('Thinking...');
  
  try {
    const response = await sendAgentQuery(prompt, state.conversationHistory);
    
    // Add to history
    state.conversationHistory.push(
      { role: 'user', text: prompt, timestamp: new Date() },
      { role: 'assistant', text: response.raw || JSON.stringify(response), timestamp: new Date() }
    );
    
    // Trim history if too long
    if (state.conversationHistory.length > config.maxHistoryLength * 2) {
      state.conversationHistory.splice(0, state.conversationHistory.length - config.maxHistoryLength * 2);
    }
    
    // Handle response
    if (response.type === 'code_response') {
      state.lastCodeResponse = response;
      print.success('AI generated code response');
      
      if (response.files && response.files.length > 0) {
        print.subHeader('Generated Files');
        response.files.forEach((f, i) => {
          print.listItem(`${f.filepath} - ${f.description || '(no description)'}`, i + 1);
        });
        
        if (response.explanation) {
          print.log();
          print.info(response.explanation);
        }
        
        print.log('\nType "/write" to save these files.');
      }
    } else if (response.type === 'chat_response') {
      print.log();
      print.log(response.message || response.raw || '(empty response)');
      print.log();
    } else if (response.type === 'fix_response') {
      state.lastCodeResponse = response;
      print.success('AI returned fixed code');
      
      if (response.fixed_code) {
        print.subHeader(`Fixed: ${response.filepath || 'unknown'}`);
        
        if (response.issues_found && response.issues_found.length > 0) {
          response.issues_found.forEach((issue, i) => {
            print.listItem(`${issue.line}: ${issue.problem}`, i + 1);
            console.log(`    Fix: ${issue.fix}`);
          });
        }
        
        if (response.summary) {
          print.log();
          print.info(response.summary);
        }
        
        // Ask to write
        const shouldWrite = await new Promise<boolean>(resolve => {
          rl.question('Write fixed code? (y/n) [y]: ', answer => {
            resolve(answer.trim().toLowerCase() !== 'n');
          });
        });
        
        if (shouldWrite && response.fixed_code && response.filepath) {
          fileService.backup(response.filepath);
          fileService.write(response.filepath, response.fixed_code);
          print.success(`Fixed code written to ${response.filepath}`);
        }
      }
    }
  } catch (error) {
    print.error(`Agent query failed: ${(error as Error).message}`);
  }
}

async function sendBasicQueryWrapper(prompt: string): Promise<void> {
  print.pending('Thinking...');
  
  try {
    const response = await sendBasicQuery(prompt);
    
    state.conversationHistory.push(
      { role: 'user', text: prompt, timestamp: new Date() },
      { role: 'assistant', text: response, timestamp: new Date() }
    );
    
    print.log();
    print.log(response);
    print.log();
  } catch (error) {
    print.error(`Basic query failed: ${(error as Error).message}`);
  }
}

// ─── Main Prompt Loop ───
async function promptUser(rl: ReadlineInterface): Promise<void> {
  const modeLabel = state.agentMode ? 'agent' : 'basic';
  const prompt = `You [${modeLabel}]: `;
  
  rl.question(prompt, async (input) => {
    const trimmed = input.trim();
    
    if (trimmed.toLowerCase() === 'exit') {
      print.log();
      print.success('Goodbye!');
      print.log();
      rl.close();
      process.exit(0);
      return;
    }
    
    // Check for commands
    const parsed = parseCommand(trimmed);
    
    if (parsed) {
      const handler = commands[parsed.name];
      if (handler) {
        try {
          await handler(parsed.args, {
            ...commandContext,
            rl,
          } as any);
        } catch (error) {
          print.error(`Command failed: ${(error as Error).message}`);
        }
      }
      promptUser(rl);
      return;
    }
    
    if (!trimmed) {
      promptUser(rl);
      return;
    }
    
    // Send query based on mode
    if (state.agentMode) {
      await sendAgentQueryWrapper(trimmed, rl);
    } else {
      await sendBasicQueryWrapper(trimmed);
    }
    
    promptUser(rl);
  });
}

// ─── Startup ───
async function startAgent(): Promise<void> {
  print.header('AI Agent Starting');
  
  // Resolve server URL
  print.pending('Discovering server...');
  const serverConfig = await resolveServerUrl();
  state.serverConfig = serverConfig;
  
  print.success(`Connected to ${serverConfig.url}`);
  
  // Create readline interface
  const rl = createReadlineInterface();
  commandContext.rl = rl;
  
  // Show welcome
  print.header('AI Agent Ready');
  print.log(`Mode: ${state.agentMode ? 'Agent (structured)' : 'Basic (plain)'}`);
  print.log(`Server: ${serverConfig.url}`);
  print.log('Type "/help" for available commands');
  print.log();
  
  // Handle CLI args (one-shot query)
  const args = process.argv.slice(2).join(' ').trim();
  if (args) {
    if (state.agentMode) {
      await sendAgentQueryWrapper(args, rl);
    } else {
      await sendBasicQueryWrapper(args);
    }
    rl.close();
    process.exit(0);
  }
  
  // Start interactive loop
  promptUser(rl);
}

// ─── Error Handling ───
process.on('unhandledRejection', (reason) => {
  print.error(`Unhandled rejection: ${reason}`);
});

process.on('uncaughtException', (error) => {
  print.error(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

// ─── Start ───
startAgent().catch(error => {
  print.error(`Failed to start: ${error.message}`);
  process.exit(1);
});