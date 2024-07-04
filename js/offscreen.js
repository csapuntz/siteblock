chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action == "getLocalStorage") {
        sendResponse({
            "state": localStorage["state"],
            "settings": localStorage["settings"],
        })
    }
})
