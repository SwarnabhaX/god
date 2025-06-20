// Get UI elements
const darkModeToggle = document.getElementById('darkModeToggle');
const brightnessSlider = document.getElementById('brightnessSlider');
const brightnessValueDisplay = document.getElementById('brightnessValue');

// Initialize UI from storage
document.addEventListener('DOMContentLoaded', () => {
  // Load dark mode state
  chrome.storage.sync.get(['darkModeEnabled', 'brightnessLevel'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Error retrieving settings:', chrome.runtime.lastError);
      // Set default values if error or no settings found
      darkModeToggle.checked = false;
      brightnessSlider.value = 100;
      brightnessValueDisplay.textContent = '100';
      // Optionally save these defaults
      chrome.storage.sync.set({ darkModeEnabled: false, brightnessLevel: 100 });
    } else {
      darkModeToggle.checked = !!result.darkModeEnabled; // Ensure boolean
      brightnessSlider.value = result.brightnessLevel === undefined ? 100 : result.brightnessLevel;
      brightnessValueDisplay.textContent = brightnessSlider.value;
    }
    // Initial application of settings to the page when popup opens
    // This is important if the content script was not active or lost state
    applySettingsToPage(darkModeToggle.checked, parseInt(brightnessSlider.value, 10));
  });
});

// Dark mode toggle event listener
darkModeToggle.addEventListener('change', () => {
  const enabled = darkModeToggle.checked;
  chrome.storage.sync.set({ darkModeEnabled: enabled }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error saving dark mode state:', chrome.runtime.lastError);
    } else {
      console.log('Dark mode state saved:', enabled);
      applySettingsToPage(enabled, parseInt(brightnessSlider.value, 10));
    }
  });
});

// Brightness slider event listener
brightnessSlider.addEventListener('input', () => {
  const level = parseInt(brightnessSlider.value, 10);
  brightnessValueDisplay.textContent = level;
  // Debounce or use 'change' event if performance is an issue for frequent updates
});

brightnessSlider.addEventListener('change', () => { // Saves when user releases slider
    const level = parseInt(brightnessSlider.value, 10);
    chrome.storage.sync.set({ brightnessLevel: level }, () => {
        if (chrome.runtime.lastError) {
            console.error('Error saving brightness level:', chrome.runtime.lastError);
        } else {
            console.log('Brightness level saved:', level);
            applySettingsToPage(darkModeToggle.checked, level);
        }
    });
});

// Function to send settings to the content script
function applySettingsToPage(darkModeEnabled, brightnessLevel) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) {
        console.log("No active tab found to apply settings.");
        return;
    }
    const activeTab = tabs[0];
    if (activeTab.id === undefined) {
        console.log("Active tab has no ID, cannot send message.");
        return;
    }

    // Check if the URL is a chrome:// URL, which content scripts cannot access
    if (activeTab.url && (activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('edge://'))) {
        console.log(`Cannot apply settings to Chrome internal page: ${activeTab.url}`);
        // Optionally disable controls or show a message in the popup
        darkModeToggle.disabled = true;
        brightnessSlider.disabled = true;
        // Update popup to inform user
        const statusMessage = document.createElement('p');
        statusMessage.textContent = 'Extension cannot modify this page.';
        statusMessage.style.color = 'red';
        statusMessage.style.textAlign = 'center';
        // Clear previous messages
        const existingMessage = document.getElementById('statusMessage');
        if (existingMessage) {
            existingMessage.remove();
        }
        statusMessage.id = 'statusMessage';
        document.body.appendChild(statusMessage);
        return;
    } else {
         // Re-enable controls if previously disabled
        darkModeToggle.disabled = false;
        brightnessSlider.disabled = false;
        const existingMessage = document.getElementById('statusMessage');
        if (existingMessage) {
            existingMessage.remove();
        }
    }


    chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: (isDarkMode, brightness) => {
        // This function will be executed in the content script's context (or a similar isolated world)
        // It does NOT have access to the content.js's scope directly.
        // We need to use messages or rely on content.js to already be there.
        // For simplicity, let's assume content.js is loaded and listening.
        // The best way is to send a message.
        chrome.runtime.sendMessage({
          type: 'APPLY_SETTINGS',
          darkMode: isDarkMode,
          brightness: brightness
        });

        // Fallback or direct manipulation if content script messaging is tricky:
        // This is less ideal as it duplicates logic and might not have access to content.js functions.
        // For direct manipulation (example, not recommended for complex scripts):
        // if (isDarkMode) {
        //   document.documentElement.setAttribute('data-theme', 'dark');
        // } else {
        //   document.documentElement.removeAttribute('data-theme');
        // }
        // document.documentElement.style.filter = `brightness(${brightness}%)`;
      },
      args: [darkModeEnabled, brightnessLevel]
    }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error executing script:", chrome.runtime.lastError.message);
        } else {
            console.log("Settings applied via executeScript to tab:", activeTab.id);
        }
    });

    // Send message to content script (preferred way if content.js has listeners)
    chrome.tabs.sendMessage(activeTab.id, {
        type: 'APPLY_SETTINGS',
        darkMode: darkModeEnabled,
        brightness: brightnessLevel
    }, response => {
        if (chrome.runtime.lastError) {
            console.warn("Error sending message to content script, or content script not ready:", chrome.runtime.lastError.message);
            // This can happen if the content script hasn't loaded yet,
            // or if the page is a type that doesn't allow content scripts (e.g., new tab page, chrome web store)
        } else {
            console.log("Message sent to content script and received response:", response);
        }
    });
  });
}
