chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "getLocalStorage") {
    sendResponse({
      state: localStorage.state,
      settings: localStorage.settings,
    });
  }
});
