# Dark Mode & Brightness Control - Chrome Extension

## Description

This Chrome extension allows users to enhance their browsing experience by enabling a customizable dark mode and adjusting the brightness of any webpage. It's designed to reduce eye strain, especially in low-light environments, and provide a more comfortable viewing experience.

## Key Features

-   **Instant Dark Mode**: Transform light-themed websites into a dark theme with a single click.
-   **Brightness Adjustment**: Fine-tune the brightness of web pages (from 30% to 100%) to suit your environment and preference.
-   **Persistent Settings**: Your preferred dark mode state and brightness level are saved and automatically applied across browser sessions and to newly opened tabs.
-   **User-Friendly Popup**: A simple and clean interface to easily toggle dark mode and control brightness.
-   **Selective Application**: The extension attempts to intelligently apply dark mode, aiming to keep images and videos in their original state while theming the rest of the page.
-   **Restricted Page Handling**: The extension UI indicates when it cannot modify restricted pages (e.g., `chrome://` URLs, Chrome Web Store).

## Installation

Since this extension is not yet on the Chrome Web Store, you can install it manually by following these steps:

1.  **Download the Extension Files**:
    *   You can download the repository as a ZIP file from GitHub (`Code` button -> `Download ZIP`) and unzip it.
    *   Alternatively, if you have `git` installed, clone the repository:
        ```bash
        git clone <repository_url>
        ```
    *   The extension files are now in a local directory. You can also use the `package.sh` script (if available in the repository) to create a clean `dark_mode_brightness_extension.zip` file containing only the necessary extension files.

2.  **Open Chrome Extensions Page**:
    *   Open your Chrome browser (or any Chromium-based browser like Edge, Brave, Vivaldi).
    *   Type `chrome://extensions` in the address bar and press Enter.

3.  **Enable Developer Mode**:
    *   In the top right corner of the Extensions page, toggle the "Developer mode" switch to the ON position.

4.  **Load Unpacked Extension**:
    *   Click the "Load unpacked" button that appears (usually on the top left).
    *   In the file dialog, navigate to the directory where you unzipped or cloned the extension files (this directory should directly contain the `manifest.json` file).
    *   Select the directory and click "Open" or "Select Folder".

5.  **Done!**
    *   The "Dark Mode & Brightness Control" extension should now appear in your list of extensions and its icon should be visible in the Chrome toolbar (you might need to pin it).

## How to Use

1.  **Click the Extension Icon**: Find the extension's icon (a "DM" on a dark background) in your Chrome toolbar and click it. This will open a small popup window.
2.  **Toggle Dark Mode**:
    *   Click the "Dark Mode" toggle switch to enable or disable dark mode for the current active tab. The changes should apply instantly.
3.  **Adjust Brightness**:
    *   Use the "Brightness" slider to change the brightness of the current page. Slide it left to decrease brightness (down to 30%) or right to increase it (up to 100%). The percentage will update next to the label.
4.  **Automatic Application**: Your last used settings for dark mode and brightness will be saved and automatically applied to new tabs and when you restart your browser.

## Packaging the Extension (for developers)

The repository includes a `package.sh` script (for Linux/macOS users with bash). You can run this script from the root directory of the repository to create a `dark_mode_brightness_extension.zip` file. This ZIP file contains only the essential extension files and is suitable for distribution or for uploading to the Chrome Web Store.

To run it:
```bash
chmod +x package.sh
./package.sh
```

---

Enjoy a more comfortable browsing experience!
```
