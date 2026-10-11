import { validContextWindow } from '../shared/contracts.js'

/** Keep adopting a route separate from replacing its already configured capacity. */
export function managementChoices(match, currentWindow, windowSource) {
  if (!validContextWindow(currentWindow)) return match
  const same = match.choices.find((choice) => choice.contextWindow === currentWindow)
  const current = same ?? {
    key: `configured:${currentWindow}`,
    contextWindow: currentWindow,
    kind: 'context',
    evidence: [{ scope: 'configured', windowSource }],
  }
  return {
    ...match,
    choices: same ? match.choices : [current, ...match.choices],
    recommended: current,
  }
}
