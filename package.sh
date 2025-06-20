#!/bin/bash

# Script to package the Chrome extension into a ZIP file for distribution.

# Define the name of the output ZIP file
ZIP_FILE_NAME="dark_mode_brightness_extension.zip"

# List of files and directories to include in the ZIP file
# Ensure this list matches the actual files of your extension.
FILES_TO_ZIP=(
  "manifest.json"
  "popup.html"
  "popup.js"
  "content.js"
  "dark_mode.css"
  "background.js"
  "icons/" # Include the entire icons directory
)

# Check if a previous ZIP file exists and remove it
if [ -f "$ZIP_FILE_NAME" ]; then
  echo "Removing existing $ZIP_FILE_NAME..."
  rm "$ZIP_FILE_NAME"
fi

echo "Creating $ZIP_FILE_NAME..."

# Create the ZIP file
# The -r flag is used to recursively include directories (for the icons folder)
zip -r "$ZIP_FILE_NAME" "${FILES_TO_ZIP[@]}"

# Check if the zip command was successful
if [ $? -eq 0 ]; then
  echo ""
  echo "Extension successfully packaged into $ZIP_FILE_NAME"
  echo "This file is ready for distribution or uploading to the Chrome Web Store."
else
  echo ""
  echo "An error occurred during packaging."
  exit 1
fi

exit 0
