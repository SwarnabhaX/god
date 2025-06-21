const DYNAMIC_STYLE_ID = '__darkModeStyleSheet__'; // ID for our injected style tag

// Store the dark_mode.css content as a string literal
// CSS rules are adjusted: removing `.__dark-mode-activated__` and targeting `html` or `html body`
const darkModeCSS = `
  /* Global dark mode styles */
  html {
    background-color: #121212 !important;
    color: #e0e0e0 !important;
  }

  html body { /* Applied directly to body now */
    filter: invert(1) hue-rotate(180deg);
    background-color: #181818; /* This color will be inverted by the filter */
  }

  /* Revert media and specific elements */
  html body img,
  html body video,
  html body iframe,
  html body svg,
  html body canvas,
  html body [style*="background-image"],
  html body .icon,
  html body [class*="icon-"],
  html body [class*="Icon"] {
    filter: invert(1) hue-rotate(180deg) !important;
    background-color: transparent !important;
  }

  html body a {
    color: #66bfff !important;
    text-decoration-color: #66bfff !important;
  }
  html body a:visited {
    color: #c998ff !important;
    text-decoration-color: #c998ff !important;
  }

  html body p,
  html body span,
  html body div:not([style*="background"]):not([class*="bg-"]),
  html body li,
  html body th,
  html body td,
  html body article,
  html body section,
  html body header,
  html body footer,
  html body nav,
  html body aside {
    background-color: transparent !important;
  }

  html body button,
  html body input:not([type="checkbox"]):not([type="radio"]),
  html body select,
  html body textarea,
  html body .button {
    background-color: #333333 !important;
    color: #e0e0e0 !important;
    border: 1px solid #555555 !important;
    filter: none !important;
  }

  html body input[type="checkbox"],
  html body input[type="radio"] {
    filter: grayscale(1) invert(1) hue-rotate(180deg) contrast(80%) !important;
  }

  html body ::placeholder {
    color: #aaaaaa !important;
    filter: none !important;
  }

  html body pre,
  html body code {
    background-color: #282c34 !important;
    color: #abb2bf !important;
    border: 1px solid #444851 !important;
    filter: none !important;
  }

  /* Custom scrollbar styling (WebKit/Blink browsers) */
  html ::-webkit-scrollbar { /* Applied to html to avoid issues with body filter */
    width: 12px;
    height: 12px;
  }
  html ::-webkit-scrollbar-track {
    background: #2c2c2c;
  }
  html ::-webkit-scrollbar-thumb {
    background-color: #555;
    border-radius: 6px;
    border: 3px solid #2c2c2c;
  }
  html ::-webkit-scrollbar-thumb:hover {
    background-color: #777;
  }
`;


function applyStyles(darkMode, brightness, source = "Unknown") {
  console.log(`ContentJS: applyStyles called from ${source}. DarkMode: ${darkMode}, Brightness: ${brightness}`);

  // Apply/remove dark mode styles by injecting/removing the stylesheet
  let styleSheetElement = document.getElementById(DYNAMIC_STYLE_ID);

  if (darkMode) {
    if (!styleSheetElement) {
      styleSheetElement = document.createElement('style');
      styleSheetElement.id = DYNAMIC_STYLE_ID;
      styleSheetElement.textContent = darkModeCSS; // Use the CSS string
      (document.head || document.documentElement).appendChild(styleSheetElement);
      console.log('ContentJS: Dark mode stylesheet injected.');
    } else {
      // Ensure content is up-to-date if it could change (not in this version)
      // styleSheetElement.textContent = darkModeCSS;
      console.log('ContentJS: Dark mode stylesheet already exists.');
    }
  } else {
    if (styleSheetElement) {
      styleSheetElement.remove();
      console.log('ContentJS: Dark mode stylesheet removed.');
    } else {
      console.log('ContentJS: No dark mode stylesheet to remove.');
    }
  }

  // Adjust brightness
  // This filter will compose with the injected stylesheet's filter on the body.
  // Note: The brightness filter is applied to documentElement (html tag)
  // The inversion filter from CSS is applied to the body tag.
  // This separation is generally fine for filter composition.
  const effectiveBrightness = Math.max(30, Math.min(100, brightness));
  document.documentElement.style.filter = `brightness(${effectiveBrightness}%)`;
  console.log(`ContentJS: Brightness set to ${effectiveBrightness}% on documentElement.`);
}

// Listener for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'APPLY_SETTINGS') {
    applyStyles(request.darkMode, request.brightness, "onMessage");
    sendResponse({ status: 'Settings applied by content.js', settings: request });
    return true; // Indicates that the response will be sent asynchronously
  }
});

// Initial application of settings when the script loads
(function() {
  console.log('ContentJS: Initializing...');
  if (chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['darkModeEnabled', 'brightnessLevel'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('ContentJS: Error retrieving settings during initial load:', chrome.runtime.lastError.message);
        applyStyles(false, 100, "initialLoadErrorFallback");
      } else {
        const enabled = !!result.darkModeEnabled;
        const level = result.brightnessLevel === undefined ? 100 : result.brightnessLevel;
        applyStyles(enabled, level, "initialLoadSuccess");
      }
    });
  } else {
    console.warn('ContentJS: chrome.storage.sync not available. Applying default styles.');
    applyStyles(false, 100, "initialLoadNoStorageFallback");
  }
})();
