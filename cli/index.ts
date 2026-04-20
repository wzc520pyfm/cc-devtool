import { Command } from 'commander'
import { startServer } from '../server/index.js'
import { startProxyServer } from '../server/proxy/index.js'

const program = new Command()

program
  .name('cc-devtool')
  .description('AI Agent Execution Debugger')
  .version('0.1.4')

program
  .command('serve')
  .description('Start the cc-devtool dashboard server')
  .option('-p, --port <number>', 'Port to listen on', '4173')
  .option('--no-open', 'Do not open browser automatically')
  .option('--with-proxy', 'Also start the transparent logging proxy')
  .option('--proxy-port <number>', 'Proxy port (default: 4174)', '4174')
  .option('--anthropic-upstream <url>', 'Anthropic API upstream URL')
  .option('--openai-upstream <url>', 'OpenAI API upstream URL')
  .action(async (opts) => {
    const port = parseInt(opts.port, 10)
    await startServer(port)

    if (opts.withProxy) {
      await startProxyServer({
        port: parseInt(opts.proxyPort, 10),
        anthropicUpstream: opts.anthropicUpstream,
        openaiUpstream: opts.openaiUpstream,
      })
    }

    if (opts.open !== false) {
      try {
        const { default: open } = await import('open')
        await open(`http://localhost:${port}`)
      } catch { /* open is optional */ }
    }
  })

program
  .command('proxy')
  .description('Start only the transparent logging proxy (no dashboard)')
  .option('-p, --port <number>', 'Proxy port', '4174')
  .option('--anthropic-upstream <url>', 'Anthropic API upstream URL (default: https://api.anthropic.com)')
  .option('--openai-upstream <url>', 'OpenAI API upstream URL (default: https://api.openai.com)')
  .action(async (opts) => {
    await startProxyServer({
      port: parseInt(opts.port, 10),
      anthropicUpstream: opts.anthropicUpstream,
      openaiUpstream: opts.openaiUpstream,
    })
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
