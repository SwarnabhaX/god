document.addEventListener('DOMContentLoaded', () => {
    // --- Original Elements ---
    const darkModeToggle = document.getElementById('darkModeToggle');
    const brightnessSlider = document.getElementById('brightnessSlider');
    const brightnessValueDisplay = document.getElementById('brightnessValue');

    // --- Time-Based Brightness Elements ---
    const timeBasedBrightnessToggle = document.getElementById('timeBasedBrightnessToggle');
    const schedulesContainer = document.getElementById('schedulesContainer');
    const schedulesList = document.getElementById('schedulesList');
    const addScheduleForm = document.getElementById('addScheduleForm');
    const scheduleTimeInput = document.getElementById('scheduleTime');
    const scheduleBrightnessInput = document.getElementById('scheduleBrightness');
    const addScheduleButton = document.getElementById('addScheduleButton');

    // --- Initial Load from Storage ---
    loadAndApplyInitialSettings();

    // --- Event Listeners for Original Controls ---
    darkModeToggle.addEventListener('change', handleDarkModeToggle);
    brightnessSlider.addEventListener('input', () => { brightnessValueDisplay.textContent = brightnessSlider.value; });
    brightnessSlider.addEventListener('change', handleBrightnessSliderChange);

    // --- Event Listeners for Time-Based Brightness ---
    timeBasedBrightnessToggle.addEventListener('change', handleTimeBasedToggle);
    addScheduleButton.addEventListener('click', handleAddSchedule);
    schedulesList.addEventListener('click', handleDeleteSchedule); // Event delegation for delete buttons

    // --- Storage Change Listener ---
    chrome.storage.onChanged.addListener(handleStorageChange);

    // --- Functions ---
    function loadAndApplyInitialSettings() {
        console.log("Popup: Loading all settings.");
        chrome.storage.sync.get(['darkModeEnabled', 'brightnessLevel', 'timeSchedulesEnabled', 'brightnessSchedules'], (result) => {
            if (chrome.runtime.lastError) {
                console.error('Popup: Error retrieving settings:', chrome.runtime.lastError.message);
                // Apply defaults for core features
                darkModeToggle.checked = false;
                brightnessSlider.value = 100;
                brightnessValueDisplay.textContent = '100';
                applySettingsToPage(false, 100, "initErrorFallback");

                // Apply defaults for time-based features
                timeBasedBrightnessToggle.checked = false;
                updateSchedulesUI([], false); // Empty list, feature disabled
                return;
            }

            // Core settings
            const dmEnabled = !!result.darkModeEnabled;
            const bLevel = result.brightnessLevel === undefined ? 100 : result.brightnessLevel;
            darkModeToggle.checked = dmEnabled;
            brightnessSlider.value = bLevel;
            brightnessValueDisplay.textContent = bLevel;
            applySettingsToPage(dmEnabled, bLevel, "initSuccess");

            // Time-based brightness settings
            const tsEnabled = !!result.timeSchedulesEnabled;
            const bSchedules = Array.isArray(result.brightnessSchedules) ? result.brightnessSchedules : [];
            timeBasedBrightnessToggle.checked = tsEnabled;
            updateSchedulesUI(bSchedules, tsEnabled);
        });
    }

    function handleDarkModeToggle() {
        const enabled = darkModeToggle.checked;
        console.log(`Popup: Dark mode toggled to ${enabled}.`);
        chrome.storage.sync.set({ darkModeEnabled: enabled }, () => {
            if (chrome.runtime.lastError) console.error('Popup: Error saving dark mode:', chrome.runtime.lastError.message);
            else applySettingsToPage(enabled, parseInt(brightnessSlider.value, 10), "darkModeToggle");
        });
    }

    function handleBrightnessSliderChange() {
        const level = parseInt(brightnessSlider.value, 10);
        console.log(`Popup: Brightness changed to ${level}.`);
        chrome.storage.sync.set({ brightnessLevel: level }, () => {
            if (chrome.runtime.lastError) console.error('Popup: Error saving brightness:', chrome.runtime.lastError.message);
            else applySettingsToPage(darkModeToggle.checked, level, "brightnessChange");
        });
    }

    function applySettingsToPage(darkModeEnabled, brightnessLevel, source = "Unknown") {
        console.log(`Popup: applySettingsToPage from ${source}. DM: ${darkModeEnabled}, B: ${brightnessLevel}. Applying to ALL relevant tabs.`);

        // Query for all tabs in all windows
        chrome.tabs.query({}, (tabs) => {
            if (chrome.runtime.lastError) {
                console.error("Popup: Error querying all tabs:", chrome.runtime.lastError.message);
                return;
            }
            if (!tabs || tabs.length === 0) {
                console.warn("Popup: No tabs found. Cannot send settings.");
                return;
            }

            let activeTabRestricted = false;

            for (const tab of tabs) {
                if (!tab.id) {
                    console.warn(`Popup: Tab ID missing for a tab, skipping. URL: ${tab.url || 'N/A'}`);
                    continue;
                }

                const tabUrl = tab.url;
                const isRestricted = tabUrl && (tabUrl.startsWith('chrome://') || tabUrl.startsWith('edge://') || tabUrl.startsWith('https://chrome.google.com/webstore'));

                if (tab.active && tabs.find(t => t.windowId === chrome.windows.WINDOW_ID_CURRENT && t.id === tab.id)) { // Check if it's the active tab in current window
                    if (isRestricted) {
                        activeTabRestricted = true;
                        console.warn(`Popup: Active tab is a restricted page: ${tabUrl}. UI controls will be disabled.`);
                    }
                }

                if (isRestricted) {
                    // console.log(`Popup: Skipping restricted page: ${tabUrl} (Tab ID: ${tab.id})`);
                    continue; // Skip sending message to restricted pages
                }

                // console.log(`Popup: Sending APPLY_SETTINGS to tab ${tab.id} (${tabUrl || 'N/A'}). DM: ${darkModeEnabled}, B: ${brightnessLevel}`);
                chrome.tabs.sendMessage(tab.id, {
                    type: 'APPLY_SETTINGS',
                    darkMode: darkModeEnabled,
                    brightness: brightnessLevel
                }, response => {
                    if (chrome.runtime.lastError) {
                        // This warning is common for tabs that don't have the content script (e.g., special browser pages, closed tabs)
                        // console.warn(`Popup: Error sending message to tab ${tab.id}. Error: ${chrome.runtime.lastError.message}.`);
                    } else {
                        // console.log(`Popup: Message sent to tab ${tab.id}. Response: ${response?.status}`);
                    }
                });
            }

            // Update UI controls based on whether the *actually active* tab (where popup was opened) is restricted
            const currentWindowActiveTab = tabs.find(t => t.active && t.windowId === chrome.windows.WINDOW_ID_CURRENT);
            const isCurrentActiveTabRestricted = currentWindowActiveTab && currentWindowActiveTab.url &&
                                               (currentWindowActiveTab.url.startsWith('chrome://') ||
                                                currentWindowActiveTab.url.startsWith('edge://') ||
                                                currentWindowActiveTab.url.startsWith('https://chrome.google.com/webstore'));

            if (isCurrentActiveTabRestricted) {
                // This query is just to ensure we have the active tab of the *current window*
                // The main loop already iterated over it, this is for UI update.
                console.warn(`Popup: Active tab in current window is restricted. Disabling controls.`);
                darkModeToggle.disabled = true;
                brightnessSlider.disabled = true;
                let statusMessage = document.getElementById('statusMessage');
                if (!statusMessage) {
                    statusMessage = document.createElement('p');
                    statusMessage.id = 'statusMessage';
                    statusMessage.style.color = 'orange'; // Using existing style
                    statusMessage.style.textAlign = 'center';
                    // Insert after h3, or at a defined place
                    const heading = document.querySelector('h3');
                    if(heading && heading.parentNode) {
                        heading.parentNode.insertBefore(statusMessage, heading.nextSibling);
                    } else {
                        document.body.appendChild(statusMessage);
                    }
                }
                statusMessage.textContent = 'Extension cannot modify this page.';
            } else {
                darkModeToggle.disabled = false;
                brightnessSlider.disabled = false;
                const existingMessage = document.getElementById('statusMessage');
                if (existingMessage) {
                    existingMessage.remove();
                }
            }
        });
    }

    function handleTimeBasedToggle() {
        const enabled = timeBasedBrightnessToggle.checked;
        console.log(`Popup: Time-based brightness toggled to ${enabled}.`);
        chrome.storage.sync.set({ timeSchedulesEnabled: enabled }, () => {
            if (chrome.runtime.lastError) console.error('Popup: Error saving timeSchedulesEnabled:', chrome.runtime.lastError.message);
            // UI update will be handled by storage change listener or directly
             updateSchedulesUI(null, enabled); // Pass null to use current schedules from storage if needed, or re-fetch
        });
    }

    function renderSchedulesList(schedules = []) {
        schedulesList.innerHTML = ''; // Clear existing items
        if (schedules.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No schedules yet.';
            li.style.textAlign = 'center';
            li.style.color = '#a0a8b4';
            li.style.padding = '10px 0';
            schedulesList.appendChild(li);
            return;
        }
        schedules.forEach(schedule => {
            const li = document.createElement('li');
            li.dataset.scheduleId = schedule.id;
            // Format time for display (e.g., 10:00 PM from "22:00")
            const timeParts = schedule.time.split(':');
            const hours = parseInt(timeParts[0], 10);
            const minutes = timeParts[1];
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours % 12 || 12; // Convert 0 or 12 to 12 for display
            const displayTime = `${displayHours}:${minutes} ${ampm}`;

            li.innerHTML = `<span>${displayTime} - ${schedule.brightness}%</span> <button class="delete-schedule-btn" data-id="${schedule.id}">×</button>`;
            schedulesList.appendChild(li);
        });
    }

    function updateSchedulesUI(schedules, enabled) {
        // If schedules is null, it means we only need to update the enabled state of form
        // Fetch schedules if not provided to ensure list is current
        if (schedules === null) {
            chrome.storage.sync.get('brightnessSchedules', (result) => {
                const currentSchedules = Array.isArray(result.brightnessSchedules) ? result.brightnessSchedules : [];
                renderSchedulesList(currentSchedules);
                toggleScheduleFormEnabledState(enabled && currentSchedules.length < 5); // Example: limit to 5 schedules
            });
        } else {
            renderSchedulesList(schedules);
            toggleScheduleFormEnabledState(enabled && schedules.length < 5); // Example: limit to 5 schedules
        }

        // Also enable/disable the schedules list interaction based on the master toggle
        schedulesContainer.style.opacity = enabled ? '1' : '0.6';
        const scheduleButtons = schedulesContainer.querySelectorAll('.delete-schedule-btn');
        scheduleButtons.forEach(button => button.disabled = !enabled);
    }

    function toggleScheduleFormEnabledState(formShouldBeEnabled) {
        addScheduleForm.disabled = !formShouldBeEnabled;
        scheduleTimeInput.disabled = !formShouldBeEnabled;
        scheduleBrightnessInput.disabled = !formShouldBeEnabled;
        addScheduleButton.disabled = !formShouldBeEnabled;
        addScheduleForm.style.opacity = formShouldBeEnabled ? '1' : '0.6';
        if(!formShouldBeEnabled && addScheduleForm.disabled) { // If form is disabled due to schedule limit
            const scheduleLimitMsg = document.getElementById('scheduleLimitMsg');
            if(chrome.storage.sync.get('brightnessSchedules', r => r.brightnessSchedules && r.brightnessSchedules.length >=5 && !scheduleLimitMsg)){
                 const p = document.createElement('p');
                 p.id = 'scheduleLimitMsg';
                 p.textContent = "Max 5 schedules allowed.";
                 p.style.fontSize = "12px"; p.style.color="orange";p.style.textAlign="center";
                 addScheduleForm.appendChild(p);
            }
        } else {
            const scheduleLimitMsg = document.getElementById('scheduleLimitMsg');
            if(scheduleLimitMsg) scheduleLimitMsg.remove();
        }
    }


    function handleAddSchedule() {
        const time = scheduleTimeInput.value;
        const brightness = parseInt(scheduleBrightnessInput.value, 10);

        if (!time) {
            alert('Please select a time.');
            return;
        }
        if (brightness < 30 || brightness > 100) {
            alert('Brightness must be between 30 and 100.');
            return;
        }

        const newSchedule = {
            id: `schedule_${Date.now()}`, // Simple unique ID
            time: time,
            brightness: brightness
        };

        chrome.storage.sync.get('brightnessSchedules', (result) => {
            const schedules = Array.isArray(result.brightnessSchedules) ? result.brightnessSchedules : [];
            if (schedules.length >= 5) { // Max 5 schedules
                alert('You can add a maximum of 5 schedules.');
                return;
            }
            schedules.push(newSchedule);
            schedules.sort((a,b) => a.time.localeCompare(b.time)); // Keep sorted
            chrome.storage.sync.set({ brightnessSchedules: schedules }, () => {
                if (chrome.runtime.lastError) console.error('Popup: Error saving new schedule:', chrome.runtime.lastError.message);
                else {
                    console.log('Popup: New schedule added and saved.');
                    // UI update will be handled by storage change listener, or call updateSchedulesUI directly
                    // updateSchedulesUI(schedules, timeBasedBrightnessToggle.checked);
                    scheduleTimeInput.value = ''; // Clear input
                }
            });
        });
    }

    function handleDeleteSchedule(event) {
        if (event.target.classList.contains('delete-schedule-btn')) {
            const scheduleIdToDelete = event.target.dataset.id;
            if (!scheduleIdToDelete) return;

            console.log(`Popup: Attempting to delete schedule ID: ${scheduleIdToDelete}`);
            chrome.storage.sync.get('brightnessSchedules', (result) => {
                let schedules = Array.isArray(result.brightnessSchedules) ? result.brightnessSchedules : [];
                schedules = schedules.filter(s => s.id !== scheduleIdToDelete);
                chrome.storage.sync.set({ brightnessSchedules: schedules }, () => {
                    if (chrome.runtime.lastError) console.error('Popup: Error deleting schedule:', chrome.runtime.lastError.message);
                    else {
                         console.log('Popup: Schedule deleted.');
                        // UI update will be handled by storage change listener, or call updateSchedulesUI directly
                        // updateSchedulesUI(schedules, timeBasedBrightnessToggle.checked);
                    }
                });
            });
        }
    }

    function handleStorageChange(changes, areaName) {
        if (areaName === 'sync') {
            console.log('Popup: Detected storage change.', changes);
            let needsFullUIRefresh = false;
            let newSchedules = null;
            let newTimeSchedulesEnabled = null;

            if (changes.timeSchedulesEnabled) {
                timeBasedBrightnessToggle.checked = !!changes.timeSchedulesEnabled.newValue;
                newTimeSchedulesEnabled = !!changes.timeSchedulesEnabled.newValue;
                needsFullUIRefresh = true;
            }
            if (changes.brightnessSchedules) {
                newSchedules = Array.isArray(changes.brightnessSchedules.newValue) ? changes.brightnessSchedules.newValue : [];
                needsFullUIRefresh = true;
            }

            if (needsFullUIRefresh) {
                 // If one is null, fetch from current state or storage to ensure consistency
                if (newSchedules === null) {
                     chrome.storage.sync.get('brightnessSchedules', (res) => {
                        newSchedules = Array.isArray(res.brightnessSchedules) ? res.brightnessSchedules : [];
                        if (newTimeSchedulesEnabled === null) newTimeSchedulesEnabled = timeBasedBrightnessToggle.checked;
                        updateSchedulesUI(newSchedules, newTimeSchedulesEnabled);
                     });
                } else if (newTimeSchedulesEnabled === null) {
                    newTimeSchedulesEnabled = timeBasedBrightnessToggle.checked;
                    updateSchedulesUI(newSchedules, newTimeSchedulesEnabled);
                } else {
                     updateSchedulesUI(newSchedules, newTimeSchedulesEnabled);
                }
            }

            // For dark mode and brightness, update UI if changed elsewhere (though less likely for these specific ones)
            if (changes.darkModeEnabled) {
                darkModeToggle.checked = !!changes.darkModeEnabled.newValue;
            }
            if (changes.brightnessLevel) {
                const newLevel = changes.brightnessLevel.newValue === undefined ? 100 : changes.brightnessLevel.newValue;
                brightnessSlider.value = newLevel;
                brightnessValueDisplay.textContent = newLevel;
            }
        }
    }
});
