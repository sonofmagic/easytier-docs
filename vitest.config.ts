import { defineConfig } from 'vitest/config'
import { defineVitestConfig } from 'repoctl/tooling'

export default defineConfig(async () => await defineVitestConfig())
