// background.js (Service Worker)

// 1. Set default settings on installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Only set initial values if they aren't already set (e.g., by a previous version or sync)
    chrome.storage.sync.get(['darkModeEnabled', 'brightnessLevel'], (result) => {
      const defaults = {};
      if (result.darkModeEnabled === undefined) {
        defaults.darkModeEnabled = false;
      }
      if (result.brightnessLevel === undefined) {
        defaults.brightnessLevel = 100;
      }
      if (Object.keys(defaults).length > 0) {
        chrome.storage.sync.set(defaults, () => {
          console.log('Default settings initialized.');
        });
      }
    });
    console.log('Extension installed. Default settings checked/applied.');
  } else if (details.reason === 'update') {
    // Handle updates if necessary, e.g., migrating settings
    console.log('Extension updated to version', chrome.runtime.getManifest().version);
  }
});

// 2. Listener for messages (e.g., from popup or content scripts if needed for centralized logic)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_SETTINGS') {
    chrome.storage.sync.get(['darkModeEnabled', 'brightnessLevel'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error retrieving settings in background:', chrome.runtime.lastError.message);
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        const settings = {
          darkMode: !!result.darkModeEnabled,
          brightness: result.brightnessLevel === undefined ? 100 : result.brightnessLevel
        };
        sendResponse(settings);
      }
    });
    return true; // Indicates asynchronous response
  }
  // Add other message handlers if needed
});

// 3. Listen for tab updates to re-apply settings
// This helps ensure styles are applied on navigations within SPAs or if content script injection is delayed.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if the tab has finished loading and has a URL (to avoid acting on empty new tabs etc.)
  if (changeInfo.status === 'complete' &&
      tab.url &&
      !tab.url.startsWith('chrome://') &&
      !tab.url.startsWith('edge://') &&
      !tab.url.startsWith('about:') &&
      !tab.url.startsWith('https://chrome.google.com/webstore')) {

    console.log(`Background: Tab ${tabId} updated and completed: ${tab.url}. Re-evaluating settings.`);
    chrome.storage.sync.get(['darkModeEnabled', 'brightnessLevel'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Background: Error retrieving settings for tab update:', chrome.runtime.lastError.message);
        return;
      }

      const darkModeEnabled = !!result.darkModeEnabled;
      const brightnessLevel = result.brightnessLevel === undefined ? 100 : result.brightnessLevel;

      console.log(`Background: Sending APPLY_SETTINGS to tab ${tabId}. DarkMode: ${darkModeEnabled}, Brightness: ${brightnessLevel}`);
      chrome.tabs.sendMessage(tabId, {
        type: 'APPLY_SETTINGS',
        darkMode: darkModeEnabled,
        brightness: brightnessLevel
      }, response => {
        if (chrome.runtime.lastError) {
          console.warn(`Background: Could not send APPLY_SETTINGS to tab ${tabId} (might be a restricted page or content script not ready): ${chrome.runtime.lastError.message}`);
        } else {
          if (response && response.status) {
            console.log(`Background: Settings re-applied to tab ${tabId} after update. Response: ${response.status}`);
          } else {
            console.warn(`Background: Settings re-applied to tab ${tabId} after update, but no/invalid response status received.`);
          }
        }
      });
    });
  }
});

console.log('Background service worker started.');
