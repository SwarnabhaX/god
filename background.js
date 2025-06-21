// background.js (Service Worker)

const ALARM_PREFIX = "brightnessScheduleAlarm_";

// --- Initial Setup and Listeners ---
chrome.runtime.onInstalled.addListener(handleInstallation);
chrome.runtime.onStartup.addListener(handleStartup);
chrome.storage.onChanged.addListener(handleStorageChange);
chrome.alarms.onAlarm.addListener(handleAlarm);

console.log('Background: Service worker started. Listeners attached.');
// Call initializeAlarms after a brief delay to ensure storage is accessible,
// especially on first install or after browser start.
setTimeout(initializeAlarms, 1000);


// --- Event Handler Functions ---

function handleInstallation(details) {
    console.log('Background: onInstalled event. Reason:', details.reason);
    chrome.storage.sync.get(['darkModeEnabled', 'brightnessLevel', 'timeSchedulesEnabled', 'brightnessSchedules'], (result) => {
        const defaults = {};
        if (result.darkModeEnabled === undefined) defaults.darkModeEnabled = false;
        if (result.brightnessLevel === undefined) defaults.brightnessLevel = 100;
        if (result.timeSchedulesEnabled === undefined) defaults.timeSchedulesEnabled = false;
        if (result.brightnessSchedules === undefined) defaults.brightnessSchedules = [];

        if (Object.keys(defaults).length > 0) {
            chrome.storage.sync.set(defaults, () => {
                console.log('Background: Default settings initialized/ensured.');
                initializeAlarms();
            });
        } else {
            console.log('Background: All settings already exist.');
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
        let reinitializeScheduler = false;
        if (changes.timeSchedulesEnabled || changes.brightnessSchedules) {
            console.log('Background: Storage changed for timeSchedulesEnabled or brightnessSchedules. Re-initializing alarms.');
            reinitializeScheduler = true;
        }

        if (reinitializeScheduler) {
            initializeAlarms();
        }

        if (changes.darkModeEnabled || changes.brightnessLevel) {
             console.log('Background: Storage changed for darkModeEnabled or brightnessLevel. Active tabs will use new values on next update/load.');
        }
    }
}

function handleAlarm(alarm) {
    console.log(`Background: Alarm '${alarm.name}' triggered at ${new Date().toLocaleTimeString()}`);
    if (alarm.name && alarm.name.startsWith(ALARM_PREFIX)) {
        const scheduleId = alarm.name.substring(ALARM_PREFIX.length);
        if (!scheduleId) {
            console.warn('Background: Alarm triggered with no valid schedule ID in name:', alarm.name);
            return;
        }

        chrome.storage.sync.get(['brightnessSchedules', 'darkModeEnabled', 'timeSchedulesEnabled'], (result) => {
            if (chrome.runtime.lastError) {
                console.error('Background: Error getting storage for alarm handler:', chrome.runtime.lastError.message);
                return;
            }

            if (!result.timeSchedulesEnabled) {
                console.log(`Background: Time schedules are currently disabled. Ignoring alarm: ${alarm.name}`);
                return;
            }

            const schedules = Array.isArray(result.brightnessSchedules) ? result.brightnessSchedules : [];
            const triggeredSchedule = schedules.find(s => s.id === scheduleId);
            const currentDarkMode = !!result.darkModeEnabled; // Preserve user's manual dark mode setting

            if (triggeredSchedule) {
                console.log(`Background: Found schedule for alarm: ID=${scheduleId}, Time=${triggeredSchedule.time}, Brightness=${triggeredSchedule.brightness}%. Applying now. Current DM state: ${currentDarkMode}`);

                // Update brightnessLevel in storage to reflect the scheduled change
                chrome.storage.sync.set({ brightnessLevel: triggeredSchedule.brightness }, () => {
                    if (chrome.runtime.lastError) {
                        console.error(`Background: Error saving scheduled brightness ${triggeredSchedule.brightness}% to storage:`, chrome.runtime.lastError.message);
                    } else {
                        console.log(`Background: Successfully saved scheduled brightness ${triggeredSchedule.brightness}% to storage.`);
                    }
                });

                applyScheduledBrightnessToTabs(currentDarkMode, triggeredSchedule.brightness, `schedule_${triggeredSchedule.time}`);

                // --- START: New logic to remove executed schedule ---
                const remainingSchedules = schedules.filter(s => s.id !== scheduleId);
                chrome.storage.sync.set({ brightnessSchedules: remainingSchedules }, () => {
                    if (chrome.runtime.lastError) {
                        console.error(`Background: Error removing schedule ${scheduleId} from storage:`, chrome.runtime.lastError.message);
                    } else {
                        console.log(`Background: Successfully removed schedule ${scheduleId} from storage. Remaining schedules: ${remainingSchedules.length}`);
                        // No need to call initializeAlarms() here, as storage.onChanged will pick it up if needed,
                        // or if not, then the alarm for this schedule is gone and others remain.
                        // However, if removing a schedule should re-evaluate other alarms (e.g. if there was complex inter-dependency, not the case here),
                        // then a call to initializeAlarms() might be considered. For one-time daily alarms, it's fine.
                        // The specific alarm for this schedule is now gone and won't fire again.
                    }
                });
                // --- END: New logic to remove executed schedule ---

            } else {
                console.warn(`Background: Triggered schedule ID '${scheduleId}' not found in current schedules. Alarm name: ${alarm.name}`);
            }
        });
    } else {
        console.log(`Background: Alarm '${alarm.name}' is not a brightness schedule alarm. Ignoring.`);
    }
}

// --- Alarm Management ---

async function initializeAlarms() {
    console.log('Background: Starting initializeAlarms function.');
    try {
        const items = await chrome.storage.sync.get(['timeSchedulesEnabled', 'brightnessSchedules']);
        const enabled = !!items.timeSchedulesEnabled;
        const schedules = Array.isArray(items.brightnessSchedules) ? items.brightnessSchedules : [];

        console.log(`Background: Clearing existing alarms. Current state - Enabled: ${enabled}, Schedules count: ${schedules.length}`);

        const allAlarms = await chrome.alarms.getAll();
        let clearedCount = 0;
        for (const existingAlarm of allAlarms) {
            if (existingAlarm.name.startsWith(ALARM_PREFIX)) {
                await chrome.alarms.clear(existingAlarm.name);
                clearedCount++;
            }
        }
        console.log(`Background: Cleared ${clearedCount} existing schedule alarms.`);

        if (!enabled || schedules.length === 0) {
            console.log('Background: Time-based brightness is disabled or no schedules. No new alarms will be created.');
            return;
        }

        let createdCount = 0;
        for (const schedule of schedules) {
            const [hours, minutes] = schedule.time.split(':').map(Number);

            let now = new Date();
            let nextRun = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);

            if (now.getTime() > nextRun.getTime()) {
                nextRun.setDate(nextRun.getDate() + 1);
                console.log(`Background: Schedule time ${schedule.time} has passed for today. Scheduling for tomorrow.`);
            }

            const alarmName = `${ALARM_PREFIX}${schedule.id}`;
            const alarmInfo = { when: nextRun.getTime() }; // Make alarm non-repeating

            console.log(`Background: Preparing to create alarm: Name='${alarmName}', ID=${schedule.id}, Time=${schedule.time}, Calculated 'when'=${new Date(alarmInfo.when).toLocaleString()}`);

            try {
                await chrome.alarms.create(alarmName, alarmInfo);
                createdCount++;
                console.log(`Background: Successfully CREATED alarm '${alarmName}' for schedule ID ${schedule.id} to run at ${new Date(alarmInfo.when).toLocaleString()}`);
            } catch (createError) {
                console.error(`Background: FAILED to create alarm '${alarmName}'. Error:`, createError.message, createError.stack);
            }
        }
        console.log(`Background: Finished processing schedules. Created ${createdCount} new schedule alarms.`);

    } catch (error) {
        console.error('Background: CRITICAL error during alarm initialization process:', error.message, error.stack);
    }
}


// --- Utility Functions ---

function applyScheduledBrightnessToTabs(darkModeState, brightnessLevel, source = "schedule") {
    console.log(`Background: applyScheduledBrightnessToTabs called by ${source}. DM: ${darkModeState}, Brightness: ${brightnessLevel}. Applying to all relevant tabs.`);
    chrome.tabs.query({}, (tabs) => {
        if (chrome.runtime.lastError) {
            console.error("Background: Error querying tabs for scheduled brightness:", chrome.runtime.lastError.message);
            return;
        }
        let appliedCount = 0;
        for (const tab of tabs) {
            if (tab.id && tab.url &&
                !tab.url.startsWith('chrome://') &&
                !tab.url.startsWith('edge://') &&
                !tab.url.startsWith('about:') &&
                !tab.url.startsWith('https://chrome.google.com/webstore')) {

                chrome.tabs.sendMessage(tab.id, {
                    type: 'APPLY_SETTINGS',
                    darkMode: darkModeState,
                    brightness: brightnessLevel
                }, response => {
                    if (chrome.runtime.lastError) {
                        // console.warn(`Background: Tab ${tab.id} - Could not apply scheduled settings: ${chrome.runtime.lastError.message}`);
                    } else {
                        // console.log(`Background: Tab ${tab.id} - Applied scheduled settings. Response: ${response?.status}`);
                    }
                });
                appliedCount++;
            }
        }
        console.log(`Background: Sent APPLY_SETTINGS to ${appliedCount} tabs for source '${source}'.`);
    });
}


// --- Tab Update Listener (for ensuring settings on tab updates) ---
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url &&
        !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://') &&
        !tab.url.startsWith('about:') && !tab.url.startsWith('https://chrome.google.com/webstore')) {

        console.log(`Background: Tab ${tabId} updated: ${tab.url}. Checking settings to apply.`);
        chrome.storage.sync.get(['darkModeEnabled', 'brightnessLevel', 'timeSchedulesEnabled', 'brightnessSchedules'], (result) => {
            if (chrome.runtime.lastError) {
                console.error(`Background: Tab ${tabId} - Error getting settings for tab update:`, chrome.runtime.lastError.message);
                return;
            }

            const currentDarkMode = !!result.darkModeEnabled;
            let currentBrightness = result.brightnessLevel === undefined ? 100 : result.brightnessLevel; // Manual/last known brightness

            if (!!result.timeSchedulesEnabled && Array.isArray(result.brightnessSchedules) && result.brightnessSchedules.length > 0) {
                console.log(`Background: Tab ${tabId} - Time schedules ON. Determining appropriate brightness.`);
                // Find if any schedule *should* be active now or was the most recent one.
                // This logic can get complex if we try to perfectly match the "active" schedule.
                // For simplicity on tab updates, content.js initial load handles applying last *saved* brightness.
                // Alarms will override it when they fire.
                // So, for onUpdated, we apply the general brightnessLevel which reflects the last *user action or scheduled update*.
                console.log(`Background: Tab ${tabId} - Applying last known brightness: ${currentBrightness} with DM: ${currentDarkMode}. Alarms will adjust if a schedule is due.`);
            } else {
                console.log(`Background: Tab ${tabId} - Time schedules OFF or no schedules. Applying manual settings: DM=${currentDarkMode}, B=${currentBrightness}`);
            }
            // Send current dark mode and the last known (manual or scheduled) brightness.
            // content.js will apply this when it loads. Alarms will override brightness if a schedule hits.
             chrome.tabs.sendMessage(tabId, {
                    type: 'APPLY_SETTINGS',
                    darkMode: currentDarkMode,
                    brightness: currentBrightness
                }, response => {
                    if (chrome.runtime.lastError) {
                        // console.warn(`Background: Tab ${tabId} - Error sending initial settings on update: ${chrome.runtime.lastError.message}`);
                    }
                });
        });
    }
});
