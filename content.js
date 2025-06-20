// Define a unique class name to apply for dark mode
const DARK_MODE_CLASS = '__dark-mode-activated__'; // More specific class name

// Function to apply styles based on settings
function applyStyles(darkMode, brightness) {
  // Apply/remove dark mode class
  if (darkMode) {
    document.documentElement.classList.add(DARK_MODE_CLASS);
    console.log('Dark mode applied.');
  } else {
    document.documentElement.classList.remove(DARK_MODE_CLASS);
    console.log('Dark mode removed.');
  }

  // Adjust brightness
  // Ensure brightness is within a reasonable range (e.g., 30% to 100%)
  const effectiveBrightness = Math.max(30, Math.min(100, brightness));
  document.documentElement.style.filter = `brightness(${effectiveBrightness}%)`;
  console.log(`Brightness set to ${effectiveBrightness}%.`);
}

// Listener for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'APPLY_SETTINGS') {
    console.log('Content script received APPLY_SETTINGS:', request);
    applyStyles(request.darkMode, request.brightness);
    sendResponse({ status: 'Settings applied', settings: request });
    return true; // Indicates that the response will be sent asynchronously
  }
});

// Initial application of settings when the script loads
(function() {
  // Check if running in a context where chrome.storage is available
  if (chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['darkModeEnabled', 'brightnessLevel'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error retrieving settings in content script:', chrome.runtime.lastError.message);
        // Apply default styles if there's an error
        applyStyles(false, 100); // Default: dark mode off, brightness 100%
      } else {
        const enabled = !!result.darkModeEnabled;
        const level = result.brightnessLevel === undefined ? 100 : result.brightnessLevel;
        console.log('Initial settings loaded by content script:', { enabled, level });
        applyStyles(enabled, level);
      }
    });
  } else {
    // Fallback or log if chrome.storage is not available (e.g. iframes with different security contexts)
    console.warn('chrome.storage.sync not available in this context. Applying default styles.');
    // Apply default styles if storage is unavailable
    applyStyles(false, 100); // Default: dark mode off, brightness 100%
  }

  console.log('Content script loaded and initial settings applied/attempted.');
})();

// It's good practice for content scripts to announce they've loaded,
// especially if other parts of the extension expect them.
// However, this is mainly for debugging or complex interactions.
