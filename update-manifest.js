// update-manifest.js
// This script generates the latest.json file for GitHub releases
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read the current version from package.json
const packageJson = require('./package.json');
const version = packageJson.version;

// Get the current date in RFC 3339 format
const pubDate = new Date().toISOString();

// Define the platforms we want to support
const platforms = {
  'windows-x86_64': {
    url: `https://github.com/zerojacks/EmbedTalk/releases/download/v${version}/EmbedTalk_${version}_x64-setup.exe`,
    signature: '' // This will be filled by Tauri Action in GitHub workflow
  },
  'darwin-x86_64': {
    url: `https://github.com/zerojacks/EmbedTalk/releases/download/v${version}/EmbedTalk_${version}_x64.dmg`,
    signature: '' // This will be filled by Tauri Action in GitHub workflow
  },
  'linux-x86_64': {
    url: `https://github.com/zerojacks/EmbedTalk/releases/download/v${version}/embedtalk_${version}_amd64.AppImage`,
    signature: '' // This will be filled by Tauri Action in GitHub workflow
  }
};

// Create the update manifest
const updateManifest = {
  version,
  notes: `EmbedTalk v${version} 更新说明`,
  pub_date: pubDate,
  platforms
};

// Write the manifest to a file
fs.writeFileSync(
  path.join(__dirname, 'latest.json'),
  JSON.stringify(updateManifest, null, 2)
);

console.log(`Generated latest.json for version ${version}`);
