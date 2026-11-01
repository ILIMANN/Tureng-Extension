#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT_DIR = __dirname;
const SRC_DIR = path.join(ROOT_DIR, "Tureng");

function transformForChrome(dir) {
  // 1. manifest.json: remove Firefox-only keys and switch background to service_worker
  const manifestPath = path.join(dir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  delete manifest.developer;
  delete manifest.browser_specific_settings;
  manifest.background = {
    service_worker: "scripts/background.js",
  };
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8"
  );

  // 2. scripts/background.js: adapt browser.* APIs, callback-based onMessage, and ArrayBuffer serialization for Chrome MV3
  const bgPath = path.join(dir, "scripts", "background.js");
  let bgCode = fs.readFileSync(bgPath, "utf8");
  bgCode = bgCode.replace(/\bbrowser\./g, "chrome.");
  bgCode = bgCode.replace(
    "chrome.runtime.onMessage.addListener((message) => {",
    "chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {"
  );
  bgCode = bgCode.replace(
    /return fetch\(url\)([\s\S]*?)\.catch\(\(error\) => \(\{([\s\S]*?)\}\)\);/,
    "fetch(url)$1.catch((error) => ({$2})).then(sendResponse);\n\n    return true;"
  );
  bgCode = bgCode.replace(
    "buffer: response.ok ? await response.arrayBuffer() : null,",
    "buffer: response.ok\n          ? Array.from(new Uint8Array(await response.arrayBuffer()))\n          : null,"
  );
  bgCode = bgCode.replace(
    /return fetch\(url, \{ credentials: "omit" \}\)([\s\S]*?)\.catch\(\(error\) => \(\{([\s\S]*?)\}\)\);/,
    'fetch(url, { credentials: "omit" })$1.catch((error) => ({$2})).then(sendResponse);\n\n    return true;'
  );
  fs.writeFileSync(bgPath, bgCode, "utf8");

  // 3. scripts/popup.js: replace browser.* with chrome.* and reconstruct Uint8Array from serialized buffer
  const popupPath = path.join(dir, "scripts", "popup.js");
  let popupCode = fs.readFileSync(popupPath, "utf8");
  popupCode = popupCode.replace(/\bbrowser\./g, "chrome.");
  popupCode = popupCode.replace(
    'new Blob([response.buffer], { type: "audio/mpeg" })',
    'new Blob([new Uint8Array(response.buffer)], { type: "audio/mpeg" })'
  );
  fs.writeFileSync(popupPath, popupCode, "utf8");

  // 4. styles/main.css: hide Chrome's native search input cancel button
  const cssPath = path.join(dir, "styles", "main.css");
  let cssCode = fs.readFileSync(cssPath, "utf8");
  cssCode += `
#search-input::-webkit-search-decoration,
#search-input::-webkit-search-cancel-button,
#search-input::-webkit-search-results-button,
#search-input::-webkit-search-results-decoration {
  -webkit-appearance: none;
  appearance: none;
  display: none;
}
`;
  fs.writeFileSync(cssPath, cssCode, "utf8");

  // 5. info.html: replace Firefox-specific URLs with Chrome equivalents
  const infoPath = path.join(dir, "info.html");
  let infoHtml = fs.readFileSync(infoPath, "utf8");
  infoHtml = infoHtml.replace(
    "Eklenti kısayolları menüsüne erişmek için buradaki adımları\n                takip edin: <b>https://mzl.la/3Qwp5QQ</b>",
    "Eklenti kısayolları menüsüne erişmek için tarayıcınızın adres\n                satırına <b>chrome://extensions/shortcuts</b> yazın."
  );
  infoHtml = infoHtml.replace("<b>about:addons</b>", "<b>chrome://extensions</b>");
  fs.writeFileSync(infoPath, infoHtml, "utf8");
}

function packageExtension(target) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `tureng-${target}-`));
  const outZip = path.join(ROOT_DIR, `tureng-${target}.zip`);

  try {
    fs.cpSync(SRC_DIR, tmpDir, {
      recursive: true,
      filter: (src) => !path.basename(src).startsWith("."),
    });

    if (target === "chrome") {
      transformForChrome(tmpDir);
    }

    if (fs.existsSync(outZip)) {
      fs.unlinkSync(outZip);
    }

    execFileSync("zip", ["-r", "-q", "-X", outZip, "."], {
      cwd: tmpDir,
    });

    console.log(`Built ${path.basename(outZip)}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

packageExtension("chrome");
packageExtension("firefox");
