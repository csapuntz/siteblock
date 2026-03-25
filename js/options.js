import csapuntz from "./siteblock.js";

/**
 * Returns settings items from the active storage (sync if enabled, otherwise local).
 * @param {{ [key: string]: unknown }} localItems
 * @returns {Promise<{ [key: string]: unknown }>}
 */
async function getStorageItems(localItems) {
  if (localItems.use_sync) {
    return (await chrome.storage.sync.get(null)) ?? {};
  }
  return localItems;
}

async function save_options() {
  const localItems = await chrome.storage.local.get(null);
  console.log(localItems);

  const items = await getStorageItems(localItems);
  const opts = csapuntz.siteblock.read_options(items);

  opts.rules = /** @type {HTMLInputElement} */ (
    document.getElementById("rules")
  ).value;
  opts.allowed = Number(
    /** @type {HTMLInputElement} */ (document.getElementById("allowed")).value,
  );
  opts.period =
    Number(
      /** @type {HTMLInputElement} */ (document.getElementById("period")).value,
    ) * 60;

  const use_sync =
    /** @type {HTMLSelectElement} */ (document.getElementById("use_sync"))
      .value === "sync";
  const settingsJson = JSON.stringify(opts);

  const status = /** @type {HTMLElement} */ (document.getElementById("status"));
  try {
    if (use_sync) {
      await chrome.storage.sync.set({ settings: settingsJson });
    } else {
      await chrome.storage.local.set({ settings: settingsJson });
    }
    await chrome.storage.local.set({ use_sync: use_sync });
  } catch (e) {
    status.textContent = `Error saving options: ${e instanceof Error ? e.message : String(e)}`;
    return;
  }

  // Update status to let user know options were saved.
  status.textContent = "Options Saved.";
  setTimeout(() => {
    status.textContent = "";
  }, 750);
}

/** @param {{ rules: string, allowed: number, period: number }} opts */
function apply_opts_to_form(opts) {
  /** @type {HTMLInputElement} */ (document.getElementById("rules")).value =
    opts.rules;
  /** @type {HTMLInputElement} */ (document.getElementById("allowed")).value =
    String(opts.allowed);
  /** @type {HTMLInputElement} */ (document.getElementById("period")).value =
    String(opts.period / 60);
}

/**
 * @param {{ [key: string]: unknown }} items
 * @param {boolean} use_sync
 */
function restore_options(items, use_sync) {
  apply_opts_to_form(csapuntz.siteblock.read_options(items));
  /** @type {HTMLSelectElement} */ (document.getElementById("use_sync")).value =
    use_sync ? "sync" : "local";
}

// Reload the settings fields from whichever storage the selector now points at,
// so the user sees the correct values before hitting Save.
async function on_use_sync_changed() {
  const use_sync =
    /** @type {HTMLSelectElement} */ (document.getElementById("use_sync"))
      .value === "sync";
  const items = use_sync
    ? ((await chrome.storage.sync.get(null)) ?? {})
    : await chrome.storage.local.get(null);
  apply_opts_to_form(csapuntz.siteblock.read_options(items));
}

async function on_load() {
  const localItems = await chrome.storage.local.get(null);
  const use_sync = /** @type {boolean} */ (localItems.use_sync ?? false);
  const items = await getStorageItems(localItems);
  restore_options(items, use_sync);

  /** @type {HTMLElement} */ (
    document.querySelector("#submit")
  ).addEventListener("click", save_options);
  /** @type {HTMLSelectElement} */ (
    document.getElementById("use_sync")
  ).addEventListener("change", on_use_sync_changed);
}

document.addEventListener("DOMContentLoaded", on_load);

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

export {
  getStorageItems,
  apply_opts_to_form,
  restore_options,
  save_options,
  on_use_sync_changed,
  on_load,
  resolveUseSyncDefault,
};
