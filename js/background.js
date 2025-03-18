// Copyright 2010-2012 Constantine Sapuntzakis

import csapuntz from "./siteblock.js";

var sb = csapuntz.siteblock.newSiteBlock();

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

chrome.tabs.onUpdated.addListener(
        async function(tabid, changeinfo, tab) {
           await processTab(tab);
        });

chrome.tabs.onRemoved.addListener(
        function(tabid) {
           sb.blockThisTabChange(tabid, null);
        });

chrome.tabs.onActivated.addListener(
        async function(activeInfo) {
            const tab = await chrome.tabs.get(activeInfo.tabId);
            await processTab(tab);
        });

async function checkBlockedTabs() {
  var a = sb.getBlockedTabs();

  for (var i = 0; i < a.length; i++)
    await block(a[i].id, a[i].url);

  console.log("Saving state");
  console.log(sb.getState());
  await chrome.storage.local.set({
    "state": JSON.stringify(sb.getState())
  });
}

async function processWindows(arrayWin) {
  for (var i = 0; i < arrayWin.length; i++) {
    var w = arrayWin[i];
    for (var ti = 0; ti < w.tabs.length; ti++) {
      await processTab(w.tabs[ti]);
    }
  }
}

chrome.storage.onChanged.addListener(async function(changes, namespace) {
  if ("settings" in changes) {
    var items = await chrome.storage.local.get(null);
    var opts = csapuntz.siteblock.read_options(items);
    sb.updatePaths(opts.rules);
    sb.setAllowedUsage(opts.allowed, opts.period);
    const arrayWin = await chrome.windows.getAll( { populate: true });
    await processWindows(arrayWin);
  }
});

async function init() {

  var items = await chrome.storage.local.get(null);
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
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name == "checkBlockedTabs") {
    await checkBlockedTabs();
  }
});

init();
