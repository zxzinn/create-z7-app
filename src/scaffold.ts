import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { addFeature } from './add.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface ScaffoldOptions {
  projectName: string
  scope: string
  features: string[]
  gitInit?: boolean
}

export async function scaffold(options: ScaffoldOptions) {
  const { projectName, features } = options
  const targetDir = path.resolve(process.cwd(), projectName)

  if (fs.existsSync(targetDir)) {
    throw new Error(`Directory ${projectName} already exists`)
  }

  fs.mkdirSync(targetDir, { recursive: true })

  // Resolve templates directory (works in dev and published)
  const templatesDir = path.resolve(__dirname, '..', 'templates')

  // Always copy base + core packages
  copyTemplate(path.join(templatesDir, 'base'), targetDir, options)
  copyTemplate(path.join(templatesDir, 'shared'), path.join(targetDir, 'packages', 'shared'), options)
  copyTemplate(path.join(templatesDir, 'api'), path.join(targetDir, 'apps', 'api'), options)
  copyTemplate(path.join(templatesDir, 'frontend'), path.join(targetDir, 'apps', 'frontend'), options)
  copyTemplate(path.join(templatesDir, 'deploy'), path.join(targetDir, 'deploy'), options)

  // Copy .env.example → .env
  const envExample = path.join(targetDir, '.env.example')
  const envFile = path.join(targetDir, '.env')
  if (fs.existsSync(envExample) && !fs.existsSync(envFile)) {
    fs.copyFileSync(envExample, envFile)
  }

  // Make start-docker.sh executable
  const startDockerPath = path.join(targetDir, 'start-docker.sh')
  if (fs.existsSync(startDockerPath)) {
    fs.chmodSync(startDockerPath, 0o755)
  }

  // Add optional features using shared add logic
  const originalCwd = process.cwd()
  process.chdir(targetDir)
  for (const feature of features) {
    await addFeature(feature)
  }
  process.chdir(originalCwd)

  // Initialize git (commit happens later in CLI after install)
  if (options.gitInit !== false) {
    const { execSync } = await import('node:child_process')
    execSync('git init', { cwd: targetDir, stdio: 'ignore' })
  }
}

function copyTemplate(src: string, dest: string, options: ScaffoldOptions) {
  if (!fs.existsSync(src)) return

  fs.mkdirSync(dest, { recursive: true })

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    // _gitignore → .gitignore, _env.example → .env.example
    // (npm strips dotfiles from published packages, so we use _ prefix in templates)
    const DOTFILE_RENAMES: Record<string, string> = {
      '_gitignore': '.gitignore',
      '_env.example': '.env.example',
    }
    const destName = DOTFILE_RENAMES[entry.name] || entry.name
    const destPath = path.join(dest, destName)

    if (entry.isDirectory()) {
      copyTemplate(srcPath, destPath, options)
    }
    else {
      let content = fs.readFileSync(srcPath, 'utf-8')
      content = replaceVariables(content, options)
      fs.writeFileSync(destPath, content)
    }
  }
}

function replaceVariables(content: string, options: ScaffoldOptions): string {
  return content
    .replaceAll('{{projectName}}', options.projectName)
    .replaceAll('{{scope}}', options.scope)
}
