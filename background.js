var sb = csapuntz.siteblock.newSiteBlock();

function block(id, tab_url)
{
   chrome.tabs.update(id, 
           { "url" : chrome.extension.getURL("blocked.html") + "?url=" + escape(tab_url) });
}

chrome.tabs.onUpdated.addListener(
        function(tabid, changeinfo, tab) {
           sb.onTabUpdate(tabid, tab.url);
           if (sb.isTabBlocked(tabid)) {
             block(tabid, tab.url);
           }
        });

function checkBlockedTabs() {
  var a = sb.getBlockedTabs();

  for (var i = 0; i < a.length; i++)
    block(a[i].id, a[i].url);
}


function onWindows(arrayWin) {
  for (var i = 0; i < arrayWin.length; i++) {
    var w = arrayWin[i];
    for (var ti = 0; ti < w.tabs.length; ti++) {
      sb.onTabUpdate(w.tabs[ti].id, w.tabs[ti].url);
    }
  }

  setInterval(checkBlockedTabs, 30000);
  checkBlockedTabs();
}

function onOptionsChanged() {
    sb.updatePaths(localStorage[csapuntz.siteblock.LIST]);
    if(localStorage[csapuntz.siteblock.ALLOWED] !== undefined) {
      sb.setAllowedUsage(Number(localStorage[csapuntz.siteblock.ALLOWED]),
            Number(localStorage[csapuntz.siteblock.PERIOD]));
    }
}

onOptionsChanged();

chrome.windows.getAll( { populate: true }, onWindows );

