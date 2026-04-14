#!/usr/bin/env node

import * as p from '@clack/prompts'
import pc from 'picocolors'
import { scaffold } from './scaffold.js'

const LOGO = `
  ____  _____      _    ____  ____
 |_  / |___  |    / \\  |  _ \\|  _ \\
  / /     / /    / _ \\ | |_) | |_) |
 / /__   / /    / ___ \\|  __/|  __/
/____|  /_/    /_/   \\_\\_|   |_|
`

async function main() {
  console.log(pc.cyan(LOGO))

  p.intro(pc.bgCyan(pc.black(' create-z7-app ')))

  const argName = process.argv[2]

  const projectName = argName || await p.text({
    message: 'What will your project be called?',
    placeholder: 'my-app',
    validate: (value) => {
      if (!value) return 'Project name is required'
      if (!/^[a-z0-9-]+$/.test(value)) return 'Only lowercase letters, numbers, and hyphens'
    },
  })

  if (p.isCancel(projectName)) {
    p.cancel('Cancelled.')
    process.exit(0)
  }

  const scope = await p.text({
    message: 'What package scope would you like to use?',
    initialValue: `@${projectName}`,
  })

  if (p.isCancel(scope)) {
    p.cancel('Cancelled.')
    process.exit(0)
  }

  const useWorkers = await p.confirm({
    message: 'Would you like to use Background Workers?',
    initialValue: true,
  })
  if (p.isCancel(useWorkers)) { p.cancel('Cancelled.'); process.exit(0) }

  const useWebSocket = await p.confirm({
    message: 'Would you like to use WebSocket?',
    initialValue: true,
  })
  if (p.isCancel(useWebSocket)) { p.cancel('Cancelled.'); process.exit(0) }

  const useS3 = await p.confirm({
    message: 'Would you like to use S3 Storage?',
    initialValue: true,
  })
  if (p.isCancel(useS3)) { p.cancel('Cancelled.'); process.exit(0) }

  const shouldInstall = await p.confirm({
    message: `Should we run ${pc.cyan("'pnpm install'")} for you?`,
    initialValue: true,
  })
  if (p.isCancel(shouldInstall)) { p.cancel('Cancelled.'); process.exit(0) }

  const shouldGitInit = await p.confirm({
    message: 'Should we initialize a Git repository?',
    initialValue: true,
  })
  if (p.isCancel(shouldGitInit)) { p.cancel('Cancelled.'); process.exit(0) }

  // Build features list
  const features: string[] = []
  if (useWorkers) features.push('workers')
  if (useWebSocket) features.push('websocket')
  if (useS3) features.push('s3')

  // Scaffold
  const s = p.spinner()
  s.start('Scaffolding project...')

  try {
    await scaffold({
      projectName: projectName as string,
      scope: scope as string,
      features,
      gitInit: shouldGitInit as boolean,
    })
    s.stop(`${pc.green('✔')} ${pc.cyan(projectName as string)} scaffolded successfully!`)
  }
  catch (err) {
    s.stop('Failed to scaffold project.')
    p.log.error(String(err))
    process.exit(1)
  }

  // Show what was added
  p.log.success('Adding boilerplate...')
  const allFeatures = ['React + Vite + TanStack Router', 'oRPC', 'Drizzle + PostgreSQL', 'Redis', 'Pino', 'Tailwind', 'Sentry', 'ESLint']
  if (useWorkers) allFeatures.push('RabbitMQ Workers')
  if (useWebSocket) allFeatures.push('WebSocket')
  if (useS3) allFeatures.push('S3 Storage')
  for (const f of allFeatures) {
    p.log.step(`${pc.green('✔')} Successfully setup boilerplate for ${pc.cyan(f)}`)
  }

  // Install
  if (shouldInstall) {
    p.log.step('Installing dependencies...')
    try {
      const { execSync } = await import('node:child_process')
      const targetDir = await import('node:path').then(p => p.resolve(process.cwd(), projectName as string))
      execSync('pnpm install', { cwd: targetDir, stdio: 'inherit' })
      p.log.success(`${pc.green('✔')} Successfully installed dependencies!`)

      // Generate TanStack Router route tree (needed for IDE type checking)
      execSync('pnpm --filter frontend generate-routes', { cwd: targetDir, stdio: 'ignore' })
      p.log.step(`${pc.green('✔')} Generated route tree`)

      // Auto-format all generated code
      execSync('pnpm lint:fix', { cwd: targetDir, stdio: 'ignore' })
      p.log.step(`${pc.green('✔')} Formatted project`)

      // Acknowledge known warnings
      p.log.info(pc.dim([
        '',
        'Note: You may see deprecation warnings above. These are known upstream issues:',
        `  ${pc.yellow('●')} @esbuild-kit/* — drizzle-kit dep, fixed in drizzle-kit 1.0 (currently beta)`,
        `  ${pc.yellow('●')} glob@10        — transitive dep, waiting on upstream fix`,
        'None of these affect functionality.',
        '',
      ].join('\n')))
    }
    catch {
      p.log.warn(`Failed to install dependencies. Run ${pc.cyan("'pnpm install'")} manually.`)
    }
  }

  // Git commit (after install so pnpm-lock.yaml is included)
  if (shouldGitInit) {
    try {
      const { execSync } = await import('node:child_process')
      const targetDir = await import('node:path').then(p => p.resolve(process.cwd(), projectName as string))
      execSync('git add -A', { cwd: targetDir, stdio: 'ignore' })
      execSync('git commit -m "initial commit from create-z7-app"', { cwd: targetDir, stdio: 'ignore' })
      p.log.step(`${pc.green('✔')} Created initial commit`)
    }
    catch {
      // git commit can fail if git user not configured — not critical
    }
  }

  // Next steps
  const steps = [`cd ${projectName}`]
  if (!shouldInstall) steps.push('pnpm install')
  steps.push("Start up your infrastructure, if needed using './start-docker.sh'")
  steps.push('pnpm db:generate')
  steps.push('pnpm db:migrate')
  steps.push('pnpm dev')

  p.note(steps.join('\n'), 'Next steps')

  p.outro(pc.green('Done!'))
}

main()
