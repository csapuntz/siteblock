// Copyright 2010-2012 Constantine Sapuntzakis

var sb = csapuntz.siteblock.newSiteBlock();

if ("state" in localStorage) {
    sb.setState(JSON.parse(localStorage['state']));
}

function block(id, tab_url)
{
   redirect(id, chrome.extension.getURL("../html/blocked.html") + "?url=" + escape(tab_url));
}

function redirect(id, url)
{
  chrome.tabs.update(id, {"url": url});
}

function processTab(tab) 
{
   var block_state = sb.blockThisTabChange(tab.id, tab.url);
   if (block_state['blocked'] && !block_state['redirect']) {
     block(tab.id, tab.url);
   } else if (block_state['blocked'] && block_state['redirect']) {
     redirect(tab.id, block_state['redirect']);
   }
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

function checkBlockedTabs() {
  var a = sb.getBlockedTabs();

  for (var i = 0; i < a.length; i++)
    block(a[i].id, a[i].url);

  localStorage['state'] = JSON.stringify(sb.getState());
}


function onWindows(arrayWin) {
  for (var i = 0; i < arrayWin.length; i++) {
    var w = arrayWin[i];
    for (var ti = 0; ti < w.tabs.length; ti++) {
      processTab(w.tabs[ti]);
    }
  }

  setInterval(checkBlockedTabs, 30000);
}

function onOptionsChanged(opts) {
    sb.updatePaths(opts.rules);
    sb.setAllowedUsage(opts.allowed, opts.period);
}

onOptionsChanged(csapuntz.siteblock.read_options());

chrome.windows.getAll( { populate: true }, onWindows );

