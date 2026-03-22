// Copyright 2010-2012 Constantine Sapuntzakis

import csapuntz from "./siteblock.js";

const sb = csapuntz.siteblock.newSiteBlock();
let initializePromise = null;

let creating; // A global promise to avoid concurrency issues
async function setupOffscreenDocument(path) {
  // Check all windows controlled by the service worker to see if one
  // of them is the offscreen document with the given path
  const offscreenUrl = chrome.runtime.getURL(path);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
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
      reasons: ['LOCAL_STORAGE'],
      justification: 'Grab old settings from local storage',
    });
    await creating;
    creating = null;
  }
}

async function block(id, tab_url)
{
   await chrome.tabs.update(id,
           { "url" : chrome.runtime.getURL("../html/blocked.html") + "?url=" + escape(tab_url) });
}

async function processTab(tab)
{
   if(sb.blockThisTabChange(tab.id, tab.url))
     await block(tab.id, tab.url);
}

async function maybePersistState(details)
{
  const newState = JSON.stringify(sb.getState());
  const oldState = await chrome.storage.local.get("state");
  if (!("state" in oldState) || oldState.state !== newState) {
    console.log("Due to " + details + " saving state new state: " + newState);
    await chrome.storage.local.set({
      "state": newState,
    })
  }
}

chrome.tabs.onUpdated.addListener(
        async (tabid, changeinfo, tab) => {
           await init();
           await processTab(tab);
           maybePersistState("onUpdated");
        });

chrome.tabs.onRemoved.addListener(
        async (tabid) => {
           await init();
           sb.blockThisTabChange(tabid, null);
           maybePersistState("onRemoved");
        });

chrome.tabs.onActivated.addListener(
        async (activeInfo) => {
            await init();
            const tab = await chrome.tabs.get(activeInfo.tabId);
            await processTab(tab);
            maybePersistState("onActivated");
        });

async function checkBlockedTabs() {
  const a = sb.getBlockedTabs();

  for (const tabId of a) {
    const tab = await chrome.tabs.get(tabId);
    await block(tabId, tab.url);
  }

  sb.updateTimeUsed();

  maybePersistState("checkBlockedTabs");
}

async function processWindows(arrayWin) {
  const tabsSeen = {};

  for (const w of arrayWin) {
    for (const tab of w.tabs) {
      await processTab(tab);
      tabsSeen[tab.id] = true;
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

chrome.storage.onChanged.addListener(async (changes, _namespace) => {
  if ("settings" in changes) {
    await init();
    const items = await chrome.storage.local.get(null);
    const opts = csapuntz.siteblock.read_options(items);
    sb.updatePaths(opts.rules);
    sb.setAllowedUsage(opts.allowed, opts.period);
    const arrayWin = await chrome.windows.getAll( { populate: true });
    await processWindows(arrayWin);
  }
});

async function init() {
  if (initializePromise) {
    return initializePromise;
  }

  initializePromise = (async () => {
    try {
      let items = await chrome.storage.local.get(null);
      console.log(items);
      if (!("migrated" in items)) try {
        await setupOffscreenDocument("../html/offscreen.html");
  
        const migratedItems = await chrome.runtime.sendMessage({
          action: "getLocalStorage"
        });
        console.log("Migrated:");
        console.log(migratedItems);
        await chrome.storage.local.set({
          "state": migratedItems.state,
          "settings": migratedItems.settings,
        });
        await chrome.storage.local.set({
          "migrated": true
        });
        items = migratedItems;
      } catch (e) {
        console.log("Migration failed");
        console.log(e);
      }
  
      if ("state" in items) {
        sb.setState(JSON.parse(items['state']));
        console.log("Restored state");
        console.log(sb.getState());
      }
      const opts = csapuntz.siteblock.read_options(items);
      sb.updatePaths(opts.rules);
      sb.setAllowedUsage(opts.allowed, opts.period);
  
      const arrayWin = await chrome.windows.getAll( { populate: true });
      await processWindows(arrayWin);
  
      const alarm = await chrome.alarms.get("checkBlockedTabs");
      if (!alarm) {
        await chrome.alarms.create("checkBlockedTabs", {
          periodInMinutes: 1
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
