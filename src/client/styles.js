import CSS from './styles.css'
export { CSS }

export function installStyles() {
  // Hot reload may activate the replacement before disposing the old instance.
  // Each instance owns its node so old cleanup cannot remove the new styles.
  const node = document.createElement('style')
  node.dataset.plugin = 'dsh-model-context-catalog'
  node.textContent = CSS
  document.head.append(node)
  return () => node.remove()
}
