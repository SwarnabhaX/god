// Define a unique class name to apply for dark mode
const DARK_MODE_CLASS = '__dark-mode-activated__'; // More specific class name

// Function to apply styles based on settings
function applyStyles(darkMode, brightness, source = "Unknown") { // Added source for logging
  console.log(`applyStyles called from ${source}. DarkMode: ${darkMode}, Brightness: ${brightness}`);
  // Apply/remove dark mode class
  if (darkMode) {
    document.documentElement.classList.add(DARK_MODE_CLASS);
    // console.log('Dark mode applied.'); // Covered by new log
  } else {
    document.documentElement.classList.remove(DARK_MODE_CLASS);
    // console.log('Dark mode removed.'); // Covered by new log
  }

  // Adjust brightness
  const effectiveBrightness = Math.max(30, Math.min(100, brightness));
  document.documentElement.style.filter = `brightness(${effectiveBrightness}%)`;
  // console.log(`Brightness set to ${effectiveBrightness}%.`); // Covered by new log
}

// Listener for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'APPLY_SETTINGS') {
    // console.log('Content script received APPLY_SETTINGS:', request); // Redundant with new log
    applyStyles(request.darkMode, request.brightness, "onMessage");
    sendResponse({ status: 'Settings applied successfully via onMessage.', settings: request });
    return true; // Indicates that the response will be sent asynchronously
  }
});

// Initial application of settings when the script loads
(function() {
  console.log('Content script starting initial load...');
  if (chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['darkModeEnabled', 'brightnessLevel'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error retrieving settings in content script during initial load:', chrome.runtime.lastError.message);
        applyStyles(false, 100, "initialLoadErrorFallback"); // Default: dark mode off, brightness 100%
      } else {
        const enabled = !!result.darkModeEnabled;
        const level = result.brightnessLevel === undefined ? 100 : result.brightnessLevel;
        // console.log('Initial settings loaded by content script:', { enabled, level }); // Covered by new log
        applyStyles(enabled, level, "initialLoadSuccess");
      }
    });
  } else {
    console.warn('chrome.storage.sync not available in this context (e.g., sandboxed iframe). Applying default styles.');
    applyStyles(false, 100, "initialLoadNoStorageFallback"); // Default: dark mode off, brightness 100%
  }
})();
