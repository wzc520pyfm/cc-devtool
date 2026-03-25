import { Command } from 'commander'
import { startServer } from '../server/index.js'

const program = new Command()

program
  .name('cc-devtool')
  .description('AI Agent Execution Debugger')
  .version('0.1.0')

program
  .command('serve')
  .description('Start the cc-devtool dashboard server')
  .option('-p, --port <number>', 'Port to listen on', '4173')
  .option('--no-open', 'Do not open browser automatically')
  .action(async (opts) => {
    const port = parseInt(opts.port, 10)
    await startServer(port)

    if (opts.open !== false) {
      try {
        const { default: open } = await import('open')
        await open(`http://localhost:${port}`)
      } catch { /* open is optional */ }
    }
  })

program
  .command('start', { isDefault: true })
  .description('Start the cc-devtool dashboard (alias for serve)')
  .action(async () => {
    await startServer(4173)
    try {
      const { default: open } = await import('open')
      await open('http://localhost:4173')
    } catch { /* */ }
  })

program.parse()
