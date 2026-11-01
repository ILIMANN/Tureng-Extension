#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT_DIR = __dirname;
const SRC_DIR = path.join(ROOT_DIR, "Tureng");
const BASE_MANIFEST = JSON.parse(
  fs.readFileSync(path.join(SRC_DIR, "manifest.json"), "utf8")
);

function buildManifest(target) {
  const manifest = structuredClone(BASE_MANIFEST);

  if (target === "chrome") {
    manifest.background = {
      service_worker: "scripts/background.js",
    };
    delete manifest.browser_specific_settings;
    delete manifest.developer;
  } else if (target === "firefox") {
    manifest.background = {
      scripts: ["scripts/background.js"],
    };
  }

  return JSON.stringify(manifest, null, 2) + "\n";
}

function packageExtension(target) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `tureng-${target}-`));
  const outZip = path.join(ROOT_DIR, `tureng-${target}.zip`);

  try {
    fs.cpSync(SRC_DIR, tmpDir, {
      recursive: true,
      filter: (src) => !path.basename(src).startsWith("."),
    });

    fs.writeFileSync(
      path.join(tmpDir, "manifest.json"),
      buildManifest(target),
      "utf8"
    );

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
