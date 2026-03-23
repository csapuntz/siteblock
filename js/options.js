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

  const use_sync = /** @type {HTMLInputElement} */ (
    document.getElementById("use_sync")
  ).checked;
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
    status.textContent =
      "Error saving options: " + (e instanceof Error ? e.message : String(e));
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
  /** @type {HTMLInputElement} */ (
    document.getElementById("use_sync")
  ).checked = use_sync;
}

// Reload the settings fields from whichever storage the checkbox now points at,
// so the user sees the correct values before hitting Save.
async function on_use_sync_changed() {
  const use_sync = /** @type {HTMLInputElement} */ (
    document.getElementById("use_sync")
  ).checked;
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
  /** @type {HTMLInputElement} */ (
    document.getElementById("use_sync")
  ).addEventListener("change", on_use_sync_changed);
}

document.addEventListener("DOMContentLoaded", on_load);
