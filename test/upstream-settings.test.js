import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { AsyncLocalStorage } from 'node:async_hooks'
import { Context, resolveConfig } from '@deepseek-ai/cordis'
import { SettingsForms } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { updateVolatile } from '@deepseek-ai/cosmokit'
import * as plugin from '../index.js'

// Exercise the real upstream service with an in-memory ConfigEditor seam.
// The full profile Loader and its persistence are outside this offline fixture.
test('real DSH 0.2 SettingsForms projects the plugin Config and preserves redacted model secrets', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'mcc-settings-'))
  const ctx = new Context()
  const entries = []
  const writes = []
  // Match DSH 0.2 HMR's transaction guard, including async context inheritance.
  const executing = new AsyncLocalStorage()
  let operations = Promise.resolve()
  const runExclusive = (operation) => {
    if (executing.getStore()) return Promise.reject(new Error('HMR transactions cannot be nested'))
    const task = operations.then(() => executing.run(true, operation))
    operations = task.catch(() => {})
    return task
  }
  ctx.provide('hmr', { executing })
  ctx.provide('profileContext', { home })
  ctx.provide('loader', { await: async () => {} })
  ctx.provide('configEditor', {
    configuration: () => entries.map((entry) => ({ entry, inherited: {}, override: entry.options.config })),
    entries: () => entries,
    edit: async (entry, change) => runExclusive(async () => {
      const next = change(entry.options.config, {})
      writes.push({ ns: entry.options.id, next })
      entry.options.config = next
      // Reconcile volatile values in place, as the Loader does.
      const parsed = resolveConfig(entry.fiber.runtime, next)
      for (const key of ['entries', 'providers']) {
        if (parsed[key]) updateVolatile(entry.fiber.config[key], parsed[key])
      }
      const eventContext = Object.create(entry.fiber.ctx)
      eventContext[Context.filter] = (owner) => owner.fiber === entry.fiber
      entry.fiber.ctx.emit(eventContext, 'loader/volatile-update', [['providers']])
    }),
  })
  try {
    const settings = new SettingsForms(ctx)
    const piPlugin = {
      name: 'fixture-pi',
      Config: z.object({ providers: z.dict(z.object({
        models: z.array(z.object({ id: z.string().required(), contextWindow: z.number(), maxTokens: z.number(), secret: z.string().role('secret') })),
      })).volatile() }),
      apply: () => {},
    }
    const raw = { providers: { dmx: { models: [{ id: 'alias', maxTokens: 1234, secret: 'fixture-secret' }] } } }
    const piFiber = await ctx.plugin(piPlugin, raw)
    entries.push({ id: 'fixture-pi', options: { id: 'llm-pi-ai', config: raw }, fiber: piFiber })
    const rawCatalog = { entries: { 'dmx::alias': { provider: 'dmx', model: 'alias', contextWindow: 64000 } } }
    const catalogFiber = await ctx.plugin(plugin, rawCatalog)
    entries.push({ id: 'fixture-catalog', options: { id: 'model-context-catalog', config: rawCatalog }, fiber: catalogFiber })
    ctx.emit('settings/document-updated', 'llm-pi-ai')
    await new Promise((resolve) => setImmediate(resolve))
    const described = settings.describe({ redactSecrets: true })
    const catalog = described.find((d) => d.ns === 'model-context-catalog')
    const pi = described.find((d) => d.ns === 'llm-pi-ai')
    assert.equal(catalog.autoGenerate, false)
    assert.equal(catalog.value.entries['dmx::alias'].enabled, true)
    assert.equal(pi.value.providers.dmx.models[0].secret, undefined)
    assert.equal(pi.value.providers.dmx.models[0].contextWindow, 64000)
    assert.equal(piFiber.config.providers.get().dmx.models[0].secret, 'fixture-secret')
    assert.equal(piFiber.config.providers.get().dmx.models[0].maxTokens, 1234)
    assert.equal(writes.filter((w) => w.ns === 'llm-pi-ai').length, 1)
    // A native model edit emits a Loader event scoped to the PI fiber. Do not
    // call SettingsForms.describe(): that would mask a missed Loader event.
    const nextPi = structuredClone(entries[0].options.config)
    delete nextPi.providers.dmx.models[0].contextWindow
    await ctx.configEditor.edit(entries[0], () => nextPi)
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(piFiber.config.providers.get().dmx.models[0].contextWindow, 64000)
    await settings.mutate('model-context-catalog', [{ op: 'set', path: ['entries', 'dmx::alias', 'contextWindow'], value: 96000 }], catalog.revision)
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(piFiber.config.providers.get().dmx.models[0].contextWindow, 96000)
    await assert.rejects(settings.mutate('model-context-catalog', [{ op: 'set', path: ['entries', 'dmx::alias', 'contextWindow'], value: 1 }], catalog.revision), { code: 'SETTINGS_CONFLICT' })
  } finally {
    await ctx.fiber.dispose()
    await rm(home, { recursive: true, force: true })
  }
})
