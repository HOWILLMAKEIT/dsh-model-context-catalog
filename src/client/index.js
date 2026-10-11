import { CLIENT_ID } from '../shared/contracts.js'
import { createClientPlugin } from './plugin.js'

// React is supplied by DSH's module loader, not bundled into the plugin.
window.__ModuleLoader__.load({
  id: CLIENT_ID,
  factory: (require) => createClientPlugin(require('react')),
})
