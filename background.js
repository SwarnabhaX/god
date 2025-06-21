// background.js (Service Worker)

const ALARM_PREFIX = "brightnessScheduleAlarm_";

// --- Initial Setup and Listeners ---
chrome.runtime.onInstalled.addListener(handleInstallation);
chrome.runtime.onStartup.addListener(handleStartup);
chrome.storage.onChanged.addListener(handleStorageChange);
chrome.alarms.onAlarm.addListener(handleAlarm);

console.log('Background service worker started and listeners attached.');
initializeAlarms(); // Initial setup of alarms when SW starts

// --- Event Handler Functions ---

function handleInstallation(details) {
    console.log('Background: onInstalled event, reason:', details.reason);
    // Initialize default settings
    chrome.storage.sync.get(['darkModeEnabled', 'brightnessLevel', 'timeSchedulesEnabled', 'brightnessSchedules'], (result) => {
        const defaults = {};
        if (result.darkModeEnabled === undefined) defaults.darkModeEnabled = false;
        if (result.brightnessLevel === undefined) defaults.brightnessLevel = 100;
        if (result.timeSchedulesEnabled === undefined) defaults.timeSchedulesEnabled = false;
        if (result.brightnessSchedules === undefined) defaults.brightnessSchedules = [];

        if (Object.keys(defaults).length > 0) {
            chrome.storage.sync.set(defaults, () => {
                console.log('Background: Default settings initialized/ensured in storage.');
                initializeAlarms(); // Initialize alarms after ensuring defaults
            });
        } else {
            // If all settings already exist, still ensure alarms are set up
            initializeAlarms();
        }
    });

    if (details.reason === 'update') {
        console.log('Background: Extension updated to version', chrome.runtime.getManifest().version);
    }
}

function handleStartup() {
    console.log('Background: onStartup event. Re-initializing alarms.');
    initializeAlarms();
}

function handleStorageChange(changes, areaName) {
    if (areaName === 'sync') {
        let reinitialize = false;
        if (changes.timeSchedulesEnabled || changes.brightnessSchedules) {
            console.log('Background: Time schedule settings changed, will re-initialize alarms.');
            reinitialize = true;
        }

        if (reinitialize) {
            initializeAlarms();
        }

        // Handle application of general dark mode/brightness if changed by another context (less common)
        // This part is mostly for the tabs.onUpdated logic to pick up latest general settings
        if (changes.darkModeEnabled || changes.brightnessLevel) {
             console.log('Background: darkModeEnabled or brightnessLevel changed. Future tab updates will use new values.');
        }
    }
}

function handleAlarm(alarm) {
    console.log('Background: Alarm triggered:', alarm.name);
    if (alarm.name && alarm.name.startsWith(ALARM_PREFIX)) {
        const scheduleId = alarm.name.substring(ALARM_PREFIX.length);
        if (!scheduleId) {
            console.warn('Background: Alarm triggered with no valid schedule ID:', alarm.name);
            return;
        }

        chrome.storage.sync.get(['brightnessSchedules', 'darkModeEnabled', 'timeSchedulesEnabled'], (result) => {
            if (chrome.runtime.lastError) {
                console.error('Background: Error getting storage for alarm:', chrome.runtime.lastError.message);
                return;
            }

            if (!result.timeSchedulesEnabled) {
                console.log('Background: Time schedules are disabled, ignoring alarm:', alarm.name);
                return;
            }

            const schedules = Array.isArray(result.brightnessSchedules) ? result.brightnessSchedules : [];
            const triggeredSchedule = schedules.find(s => s.id === scheduleId);
            const currentDarkMode = !!result.darkModeEnabled;

            if (triggeredSchedule) {
                console.log(`Background: Applying scheduled brightness: ${triggeredSchedule.brightness}% for schedule ID ${scheduleId}. Current dark mode: ${currentDarkMode}`);
                applyScheduledBrightnessToTabs(currentDarkMode, triggeredSchedule.brightness);
            } else {
                console.warn(`Background: Triggered schedule ID ${scheduleId} not found in storage.`);
            }
        });
    }
}

// --- Alarm Management ---

async function initializeAlarms() {
    console.log('Background: Initializing alarms...');
    try {
        const items = await chrome.storage.sync.get(['timeSchedulesEnabled', 'brightnessSchedules']);
        const enabled = !!items.timeSchedulesEnabled;
        const schedules = Array.isArray(items.brightnessSchedules) ? items.brightnessSchedules : [];

        // Clear existing alarms first
        const allAlarms = await chrome.alarms.getAll();
        let clearedCount = 0;
        for (const alarm of allAlarms) {
            if (alarm.name.startsWith(ALARM_PREFIX)) {
                await chrome.alarms.clear(alarm.name);
                clearedCount++;
            }
        }
        console.log(`Background: Cleared ${clearedCount} existing schedule alarms.`);

        if (!enabled || schedules.length === 0) {
            console.log('Background: Time-based brightness is disabled or no schedules. No new alarms created.');
            return;
        }

        let createdCount = 0;
        for (const schedule of schedules) {
            const [hours, minutes] = schedule.time.split(':').map(Number);

            // Calculate next occurrence
            let now = new Date();
            let nextRun = new Date();
            nextRun.setHours(hours, minutes, 0, 0); // Set to today's schedule time

            if (now.getTime() > nextRun.getTime()) { // If time has passed for today
                nextRun.setDate(now.getDate() + 1); // Schedule for tomorrow
            }
            // else: it's for today, later

            const alarmName = `${ALARM_PREFIX}${schedule.id}`;
            chrome.alarms.create(alarmName, {
                when: nextRun.getTime(),
                periodInMinutes: 24 * 60 // Repeat daily
            });
            createdCount++;
            console.log(`Background: Created alarm '${alarmName}' for schedule ID ${schedule.id} at ${nextRun.toLocaleString()}`);
        }
        console.log(`Background: Created ${createdCount} new schedule alarms.`);

    } catch (error) {
        console.error('Background: Error during alarm initialization:', error.message, error.stack);
    }
}


// --- Utility Functions ---

function applyScheduledBrightnessToTabs(darkModeState, brightnessLevel) {
    chrome.tabs.query({}, (tabs) => { // Query all tabs
        if (chrome.runtime.lastError) {
            console.error("Background: Error querying tabs to apply scheduled brightness:", chrome.runtime.lastError.message);
            return;
        }
        for (const tab of tabs) {
            if (tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://') && !tab.url.startsWith('about:') && !tab.url.startsWith('https://chrome.google.com/webstore')) {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'APPLY_SETTINGS',
                    darkMode: darkModeState, // Send current dark mode state
                    brightness: brightnessLevel
                }, response => {
                    if (chrome.runtime.lastError) {
                        // console.warn(`Background: Could not apply scheduled brightness to tab ${tab.id}:`, chrome.runtime.lastError.message);
                    } else {
                        // console.log(`Background: Applied scheduled brightness to tab ${tab.id}. Response:`, response?.status);
                    }
                });
            }
        }
    });
}


// --- Tab Update Listener (for manual settings, not scheduled) ---
// This remains to apply general settings on tab updates.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url &&
        !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://') &&
        !tab.url.startsWith('about:') && !tab.url.startsWith('https://chrome.google.com/webstore')) {

        chrome.storage.sync.get(['darkModeEnabled', 'brightnessLevel', 'timeSchedulesEnabled'], (result) => {
            if (chrome.runtime.lastError) {
                console.error('Background: Error getting settings for tab update:', chrome.runtime.lastError.message);
                return;
            }

            // If time schedules are enabled, let alarms handle brightness primarily.
            // This onUpdated logic should only apply general manual settings.
            // Or, if a scheduled brightness was just missed, it could apply it here too,
            // but that might get complex. Let's keep it simple: apply manual settings.
            if (result.timeSchedulesEnabled) {
                 console.log(`Background: Tab ${tabId} updated. Time schedules are ON. Manual dark mode: ${!!result.darkModeEnabled}. Brightness will be handled by alarms or manual changes.`);
                 // We could potentially check if the current time *should* have a scheduled brightness
                 // and apply it if it's very close to a schedule time, but alarms are better.
                 // For now, just apply the global dark mode state. Brightness from alarms.
                 // If user manually changed brightness, that will be the 'brightnessLevel'.
                 applyScheduledBrightnessToTabs(!!result.darkModeEnabled, result.brightnessLevel);

            } else {
                console.log(`Background: Tab ${tabId} updated. Time schedules OFF. Applying manual settings.`);
                applyScheduledBrightnessToTabs(!!result.darkModeEnabled, result.brightnessLevel === undefined ? 100 : result.brightnessLevel);
            }
        });
    }
});
