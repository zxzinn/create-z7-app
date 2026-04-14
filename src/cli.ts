#!/usr/bin/env node

import * as p from '@clack/prompts'
import pc from 'picocolors'
import { addFeature, ADDABLE_FEATURES } from './add.js'

async function main() {
  const [command, ...args] = process.argv.slice(2)

  if (!command || command === 'help' || command === '--help') {
    console.log(`
${pc.cyan('z7')} — Z7 project toolkit

${pc.bold('Commands:')}
  ${pc.cyan('z7 add <feature>')}   Add a feature to your project

${pc.bold('Available features:')}
  ${ADDABLE_FEATURES.map(f => `  ${pc.cyan(f.name.padEnd(12))} ${f.description}`).join('\n')}

${pc.bold('Examples:')}
  z7 add postgres
  z7 add redis rabbitmq
`)
    return
  }

  if (command === 'add') {
    if (args.length === 0) {
      // Interactive mode
      const features = await p.multiselect({
        message: 'Which features would you like to add?',
        options: ADDABLE_FEATURES.map(f => ({
          value: f.name,
          label: f.name,
          hint: f.description,
        })),
        required: true,
      })

      if (p.isCancel(features)) {
        p.cancel('Cancelled.')
        process.exit(0)
      }

      args.push(...(features as string[]))
    }

    for (const feature of args) {
      const match = ADDABLE_FEATURES.find(f => f.name === feature)
      if (!match) {
        p.log.error(`Unknown feature: ${pc.red(feature)}`)
        p.log.info(`Available: ${ADDABLE_FEATURES.map(f => pc.cyan(f.name)).join(', ')}`)
        process.exit(1)
      }
    }

    p.intro(pc.bgCyan(pc.black(' z7 add ')))

    for (const feature of args) {
      await addFeature(feature)
      p.log.step(`${pc.green('✔')} Added ${pc.cyan(feature)}`)
    }

    p.log.info('Run `pnpm install` to install new dependencies.')
    p.outro(pc.green('Done!'))
    return
  }

  console.log(`Unknown command: ${command}. Run ${pc.cyan('z7 help')} for usage.`)
  process.exit(1)
}

main()
