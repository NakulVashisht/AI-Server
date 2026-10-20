const fs = require('fs');
const pkg = {
  name: 'ai-server',
  version: '1.0.0',
  type: 'module',
  description: '',
  main: 'server.js',
  scripts: {
    start: 'node server.js',
    ask: 'node ask.js',
    agent: 'node ask.js',
    dev: 'concurrently -n "SERVER,TUNNEL" -c "green,cyan" "node server.js" "node tunnel-sync.js"',
    pm2: 'pm2 start ecosystem.config.cjs',
    'pm2:stop': 'pm2 stop ecosystem.config.cjs',
    'pm2:restart': 'pm2 restart ecosystem.config.cjs',
    'pm2:logs': 'pm2 logs',
    'pm2:status': 'pm2 status',
    build: 'tsc',
    'build:watch': 'tsc --watch',
    'ask:dev': 'tsx src/cli.ts',
    'ask:build': 'node dist/cli.js',
    test: 'vitest run',
    'test:watch': 'vitest',
    'test:coverage': 'vitest run --coverage',
    lint: 'eslint src --ext .ts'
  },
  keywords: [],
  author: '',
  license: 'ISC',
  dependencies: {
    '@google/genai': '^2.19.0',
    dotenv: '^17.4.2',
    express: '^5.2.1'
  },
  devDependencies: {
    '@types/node': '^20.12.0',
    concurrently: '^10.0.5',
    tsx: '^4.7.0',
    typescript: '^5.4.0',
    vitest: '^1.4.0',
    '@vitest/coverage-v8': '^1.4.0',
    eslint: '^8.57.0',
    '@typescript-eslint/eslint-plugin': '^7.0.0',
    '@typescript-eslint/parser': '^7.0.0'
  }
};
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
console.log('done');