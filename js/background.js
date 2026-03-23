// Copyright 2010-2012 Constantine Sapuntzakis

import csapuntz from "./siteblock.js";

const sb = csapuntz.siteblock.newSiteBlock();
/** @type {Promise<void> | null} */
let initializePromise = null;

/** @type {Promise<void> | undefined} */
let creating; // A global promise to avoid concurrency issues
/** @param {string} path */
async function setupOffscreenDocument(path) {
  // Check all windows controlled by the service worker to see if one
  // of them is the offscreen document with the given path
  const offscreenUrl = chrome.runtime.getURL(path);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenUrl],
  });

  if (existingContexts.length > 0) {
    return;
  }

  // create offscreen document
  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: ["LOCAL_STORAGE"],
      justification: "Grab old settings from local storage",
    });
    await creating;
    creating = undefined;
  }
}

/**
 * @param {number} id
 * @param {string} tab_url
 */
async function block(id, tab_url) {
  await chrome.tabs.update(id, {
    url: `${chrome.runtime.getURL("../html/blocked.html")}?url=${escape(tab_url)}`,
  });
}

/** @param {chrome.tabs.Tab} tab */
async function processTab(tab) {
  if (tab.id === undefined) return;
  if (sb.blockThisTabChange(tab.id, tab.url ?? null))
    await block(tab.id, tab.url ?? "");
}

/**
 * Returns settings items from the active storage (sync if enabled, otherwise local).
 * @param {{ [key: string]: unknown }} [localItems] already-fetched local items (optional, only used when sync is disabled)
 * @returns {Promise<{ [key: string]: unknown }>}
 */
async function getStorageItems(localItems) {
  const local = localItems ?? (await chrome.storage.local.get(null)) ?? {};
  if (local.use_sync) {
    return (await chrome.storage.sync.get(null)) ?? {};
  }
  return local;
}

/** @param {string} details */
async function maybePersistState(details) {
  const newState = JSON.stringify(sb.getState());
  const oldState = await chrome.storage.local.get("state");
  if (!("state" in oldState) || oldState.state !== newState) {
    console.log(`Due to ${details} saving state new state: ${newState}`);
    await chrome.storage.local.set({
      state: newState,
    });
  }
}

chrome.tabs.onUpdated.addListener(async (_tabid, _changeinfo, tab) => {
  await init();
  await processTab(tab);
  maybePersistState("onUpdated");
});

chrome.tabs.onRemoved.addListener(async (tabid) => {
  await init();
  sb.blockThisTabChange(tabid, null);
  maybePersistState("onRemoved");
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await init();
  const tab = await chrome.tabs.get(activeInfo.tabId);
  await processTab(tab);
  maybePersistState("onActivated");
});

async function checkBlockedTabs() {
  const a = sb.getBlockedTabs();

  for (const tabId of a) {
    const tab = await chrome.tabs.get(tabId);
    await block(tabId, tab.url ?? "");
  }

  sb.updateTimeUsed();

  maybePersistState("checkBlockedTabs");
}

/** @param {chrome.windows.Window[]} arrayWin */
async function processWindows(arrayWin) {
  /** @type {{ [tabId: number]: boolean }} */
  const tabsSeen = {};

  for (const w of arrayWin) {
    for (const tab of w.tabs ?? []) {
      await processTab(tab);
      if (tab.id !== undefined) tabsSeen[tab.id] = true;
    }
  }

  const blockedTabs = sb.getBlockedTabs();
  for (const tabId of blockedTabs) {
    if (!(tabId in tabsSeen)) {
      sb.blockThisTabChange(tabId, null);
    }
  }

  maybePersistState("processWindows");
}

/**
 * Reload rules/usage from storage into the running SiteBlock instance and
 * re-evaluate all open windows.
 */
async function reloadSettings() {
  const localItems = await chrome.storage.local.get(null);
  const items = await getStorageItems(localItems);
  const opts = csapuntz.siteblock.read_options(items);
  sb.updatePaths(opts.rules);
  sb.setAllowedUsage(opts.allowed, opts.period);
  const arrayWin = await chrome.windows.getAll({ populate: true });
  await processWindows(arrayWin);
}

chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if ("settings" in changes) {
    await init();
    const localItems = await chrome.storage.local.get(null);
    const use_sync = localItems.use_sync ?? false;
    // Only react when the change is from the storage we're currently using.
    if (
      (use_sync && namespace === "sync") ||
      (!use_sync && namespace === "local")
    ) {
      await reloadSettings();
    }
  }
  // When the user toggles sync on/off, reload settings from the new location.
  if ("use_sync" in changes && namespace === "local") {
    await init();
    await reloadSettings();
  }
});

async function init() {
  if (initializePromise) {
    return initializePromise;
  }

  initializePromise = (async () => {
    try {
      let localItems = await chrome.storage.local.get(null);
      console.log(localItems);
      if (!("migrated" in localItems))
        try {
          await setupOffscreenDocument("../html/offscreen.html");

          const migratedItems = await chrome.runtime.sendMessage({
            action: "getLocalStorage",
          });
          console.log("Migrated:");
          console.log(migratedItems);
          await chrome.storage.local.set({
            state: migratedItems.state,
            settings: migratedItems.settings,
          });
          await chrome.storage.local.set({
            migrated: true,
          });
          // Re-fetch so localItems reflects what was just written.
          localItems = await chrome.storage.local.get(null);
        } catch (e) {
          console.log("Migration failed");
          console.log(e);
        }

      // Determine whether sync storage should be used.
      // This is only resolved once (first run / fresh install).
      // Fresh installs have no "settings" yet → default to sync enabled.
      // Users migrating from an older version already have "settings" in
      // local storage → default to sync disabled.
      if (!("use_sync" in localItems)) {
        const use_sync = !("settings" in localItems);
        await chrome.storage.local.set({ use_sync });
        localItems = { ...localItems, use_sync };
      }

      // Read settings from the active storage (sync or local).
      const items = await getStorageItems(localItems);

      if ("state" in localItems) {
        sb.setState(JSON.parse(/** @type {string} */ (localItems.state)));
        console.log("Restored state");
        console.log(sb.getState());
      }
      const opts = csapuntz.siteblock.read_options(items);
      sb.updatePaths(opts.rules);
      sb.setAllowedUsage(opts.allowed, opts.period);

      const arrayWin = await chrome.windows.getAll({ populate: true });
      await processWindows(arrayWin);

      const alarm = await chrome.alarms.get("checkBlockedTabs");
      if (!alarm) {
        await chrome.alarms.create("checkBlockedTabs", {
          periodInMinutes: 1,
        });
      }
    } catch (error) {
      console.error("Initialization failed:", error);
      // We don't expect Chrome to call handlers if init fails, but
      // if it does, don't keep throwing exceptions and don't rerun
      initializePromise = Promise.resolve();
      // Alternative: if init() fails return next time
      // initializePromise = null;
      throw error;
    }
  })();
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "checkBlockedTabs") {
    await init();
    await checkBlockedTabs();
  }
});

init();
