/**
 * Resolves the initial value of use_sync for a fresh install or upgrade, and
 * persists it to chrome.storage.local if it was not already set.
 *
 * - Fresh install (no "settings" key present) → use_sync = true
 * - Upgrading from an older version ("settings" already in local storage) → use_sync = false
 * - use_sync already set → returns localItems unchanged without writing to storage
 *
 * @param {{ [key: string]: unknown }} localItems
 * @returns {Promise<{ [key: string]: unknown }>} updated localItems (with use_sync guaranteed to be set)
 */
async function resolveUseSyncDefault(localItems) {
  if ("use_sync" in localItems) return localItems;
  const use_sync = !("settings" in localItems);
  await chrome.storage.local.set({ use_sync });
  return { ...localItems, use_sync };
}

export { resolveUseSyncDefault };

