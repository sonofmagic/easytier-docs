import { defineProject } from 'vitest/config'

export default defineProject({
  test: { name: 'nimbus-docs', include: ['test/**/*.test.ts'], environment: 'node' },
})
