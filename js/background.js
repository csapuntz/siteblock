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



function block(id, tab_url)
{
   chrome.tabs.update(id,
           { "url" : chrome.runtime.getURL("../html/blocked.html") + "?url=" + escape(tab_url) });
}

function processTab(tab)
{
   if(sb.blockThisTabChange(tab.id, tab.url))
     block(tab.id, tab.url);
}

chrome.tabs.onUpdated.addListener(
        function(tabid, changeinfo, tab) {
           processTab(tab);
        });

chrome.tabs.onRemoved.addListener(
        function(tabid) {
           sb.blockThisTabChange(tabid, null);
        });

chrome.tabs.onActivated.addListener(
        function(activeInfo) {
            chrome.tabs.get(activeInfo.tabId, processTab);
        });

async function checkBlockedTabs() {
  var a = sb.getBlockedTabs();

  for (var i = 0; i < a.length; i++)
    block(a[i].id, a[i].url);

  await chrome.storage.local.set({
    "state": JSON.stringify(sb.getState())
  });
}


function onWindows(arrayWin) {
  for (var i = 0; i < arrayWin.length; i++) {
    var w = arrayWin[i];
    for (var ti = 0; ti < w.tabs.length; ti++) {
      processTab(w.tabs[ti]);
    }
  }
}

chrome.storage.onChanged.addListener(async function(changes, namespace) {
  if ("settings" in changes) {
    var items = await chrome.storage.local.get(null);
    var opts = csapuntz.siteblock.read_options(items);
    sb.updatePaths(opts.rules);
    sb.setAllowedUsage(opts.allowed, opts.period);
    chrome.windows.getAll( { populate: true }, onWindows );
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
  }
  const opts = csapuntz.siteblock.read_options(items);
  sb.updatePaths(opts.rules);
  sb.setAllowedUsage(opts.allowed, opts.period);

  chrome.windows.getAll( { populate: true }, onWindows );

  const alarm = await chrome.alarms.get("checkBlockedTabs");
  if (!alarm) {
    chrome.alarms.create("checkBlockedTabs", {
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
