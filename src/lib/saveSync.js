export function saveDelta(localIds, remoteIds, previouslySeenIds) {
  const local = new Set(localIds.map(String))
  const remote = new Set(remoteIds.map(String))
  return {
    insert: localIds.filter(id => !remote.has(String(id))),
    remove: previouslySeenIds.filter(id => !local.has(String(id)) && remote.has(String(id))),
  }
}

export function shouldClearAccountData(previousOwner, nextOwner) {
  // Guest saves may be adopted at first sign-in. An account's saved data must
  // never be adopted by a different account or exposed after sign-out.
  return Boolean(previousOwner && previousOwner !== nextOwner)
}
