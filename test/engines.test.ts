import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * homebridge-smarthq installs this library, and it supports Node 22, 24 and
 * 26. Leaving 26 out here made every install on Node 26 print an unsupported
 * engine warning, though nothing was wrong.
 */
describe('the supported node versions', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

  it('match the plugin that installs this library', () => {
    expect(pkg.engines.node).toBe('^22.12.0 || ^24.0.0 || ^26.0.0')
  })
})
