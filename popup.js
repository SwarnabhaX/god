// Get UI elements
const darkModeToggle = document.getElementById('darkModeToggle');
const brightnessSlider = document.getElementById('brightnessSlider');
const brightnessValueDisplay = document.getElementById('brightnessValue');

// Initialize UI from storage
document.addEventListener('DOMContentLoaded', () => {
  console.log("Popup DOMContentLoaded: Loading settings and applying to page.");
  chrome.storage.sync.get(['darkModeEnabled', 'brightnessLevel'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Popup: Error retrieving settings during init:', chrome.runtime.lastError.message);
      darkModeToggle.checked = false;
      brightnessSlider.value = 100;
      brightnessValueDisplay.textContent = '100';
      // Optionally save these defaults if not already set
      chrome.storage.sync.set({ darkModeEnabled: false, brightnessLevel: 100 });
      // Even on error, try to apply defaults to the page
      applySettingsToPage(false, 100, "initErrorFallback");
    } else {
      const enabled = !!result.darkModeEnabled;
      const level = result.brightnessLevel === undefined ? 100 : result.brightnessLevel;
      darkModeToggle.checked = enabled;
      brightnessSlider.value = level;
      brightnessValueDisplay.textContent = level;
      console.log('Popup: Settings loaded:', { enabled, level });
      applySettingsToPage(enabled, level, "initSuccess");
    }
  });
});

// Dark mode toggle event listener
darkModeToggle.addEventListener('change', () => {
  const enabled = darkModeToggle.checked;
  console.log(`Popup: Dark mode toggled to ${enabled}. Saving and applying.`);
  chrome.storage.sync.set({ darkModeEnabled: enabled }, () => {
    if (chrome.runtime.lastError) {
      console.error('Popup: Error saving dark mode state:', chrome.runtime.lastError.message);
    } else {
      console.log('Popup: Dark mode state saved successfully.');
      applySettingsToPage(enabled, parseInt(brightnessSlider.value, 10), "darkModeToggle");
    }
  });
});

// Brightness slider 'input' event for live value display
brightnessSlider.addEventListener('input', () => {
  brightnessValueDisplay.textContent = brightnessSlider.value;
});

// Brightness slider 'change' event for saving and applying
brightnessSlider.addEventListener('change', () => {
  const level = parseInt(brightnessSlider.value, 10);
  console.log(`Popup: Brightness changed to ${level}. Saving and applying.`);
  chrome.storage.sync.set({ brightnessLevel: level }, () => {
    if (chrome.runtime.lastError) {
      console.error('Popup: Error saving brightness level:', chrome.runtime.lastError.message);
    } else {
      console.log('Popup: Brightness level saved successfully.');
      applySettingsToPage(darkModeToggle.checked, level, "brightnessChange");
    }
  });
});

// Function to send settings to the content script
function applySettingsToPage(darkModeEnabled, brightnessLevel, source = "Unknown") {
  console.log(`Popup: applySettingsToPage called from ${source}. DarkMode: ${darkModeEnabled}, Brightness: ${brightnessLevel}`);
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError) {
      console.error("Popup: Error querying tabs:", chrome.runtime.lastError.message);
      return;
    }
    if (!tabs || tabs.length === 0 || !tabs[0].id) {
      console.warn("Popup: No active tab found or active tab has no ID. Cannot send settings.");
      return;
    }
    const activeTabId = tabs[0].id;
    const activeTabUrl = tabs[0].url;

    // Check for restricted URLs where content scripts might not run
    if (activeTabUrl && (activeTabUrl.startsWith('chrome://') || activeTabUrl.startsWith('edge://') || activeTabUrl.startsWith('https://chrome.google.com/webstore'))) {
      console.warn(`Popup: Cannot apply settings to restricted page: ${activeTabUrl}.`);
      darkModeToggle.disabled = true;
      brightnessSlider.disabled = true;
      let statusMessage = document.getElementById('statusMessage');
      if (!statusMessage) {
        statusMessage = document.createElement('p');
        statusMessage.id = 'statusMessage';
        statusMessage.style.color = 'orange';
        statusMessage.style.textAlign = 'center';
        document.body.appendChild(statusMessage);
      }
      statusMessage.textContent = 'Extension cannot modify this page.';
      return;
    } else {
      darkModeToggle.disabled = false;
      brightnessSlider.disabled = false;
      const existingMessage = document.getElementById('statusMessage');
      if (existingMessage) {
        existingMessage.remove();
      }
    }

    console.log(`Popup: Sending APPLY_SETTINGS to tab ${activeTabId}. DarkMode: ${darkModeEnabled}, Brightness: ${brightnessLevel}`);
    chrome.tabs.sendMessage(activeTabId, {
      type: 'APPLY_SETTINGS',
      darkMode: darkModeEnabled,
      brightness: brightnessLevel
    }, response => {
      if (chrome.runtime.lastError) {
        console.warn(`Popup: Error sending message to content script for tab ${activeTabId}. Error: ${chrome.runtime.lastError.message}. This can happen if the content script is not injected or the tab is closed.`);
      } else {
        if (response && response.status) {
          console.log(`Popup: Message sent to content script for tab ${activeTabId}. Response: ${response.status}`);
        } else {
          // This case can happen if the content script does not send a response or an unexpected response format.
          console.warn(`Popup: Message sent to content script for tab ${activeTabId}, but no/invalid response status received. This may or may not be an issue.`);
        }
      }
    });
  });
}
