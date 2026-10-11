export const compact = (value) =>
  String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
const undecorated = (value) =>
  String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/\s*\((?:agent plan|coding plan|coding|plan)\)\s*$/i, '')
export const baseName = (value) => {
  let text = undecorated(value),
    previous
  do {
    previous = text
    text = text
      .replace(/[-_ ](?:20\d{2}[-_]\d{2}[-_]\d{2}|20\d{6}|(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))$/, '')
      .replace(/[-_ ](?:latest|preview)$/, '')
    // Preserve a sole V-number such as DeepSeek-V3. Only strip an added
    // deployment V-number when the remaining model already has a version.
    const deploymentVersion = /^(.*)[-_ ]v\d+$/.exec(text)
    if (deploymentVersion && /\d/.test(deploymentVersion[1])) text = deploymentVersion[1]
  } while (text !== previous)
  return text
}
export const variants = (value) => {
  const text = undecorated(value)
  // Strip provider namespaces, never model family/size/semantic suffixes.
  return [...new Set([text, text.split('/').at(-1)].filter(Boolean))]
}
