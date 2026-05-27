// ==UserScript==
// @name         Evolve Hourly Local Backups
// @namespace    local.evolve.backups
// @version      0.4.0
// @description  Hourly Evolve backups with local restore, keeping the latest 10 files.
// @match        https://pmotschmann.github.io/Evolve/
// @grant        unsafeWindow
// ==/UserScript==

(function () {
  "use strict";

  const BACKUP_EVERY_MS = 60 * 60 * 1000;
  const KEEP_COUNT = 10;
  const DB_NAME = "evolve-hourly-backups";
  const STORE_NAME = "handles";
  const HANDLE_KEY = "backup-folder";

  let folderHandlePromise = null;
  let lastBackupAt = null;
  let startupTimer = null;
  let hourlyTimer = null;
  let setupButton = null;
  const pageWindow = unsafeWindow || window;

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = pageWindow.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getStoredFolderHandle() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function storeFolderHandle(handle) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getUsableStoredFolderHandle() {
    const handle = await getStoredFolderHandle();
    if (!handle) return null;

    const permission = await handle.queryPermission({ mode: "readwrite" });
    if (permission === "granted") return handle;

    return null;
  }

  async function chooseFolder() {
    if (!pageWindow.showDirectoryPicker) {
      throw new Error("This browser does not support folder access. Use Chrome or Edge.");
    }

    const handle = await pageWindow.showDirectoryPicker({
      id: "evolve-backups",
      mode: "readwrite"
    });

    const permission = await handle.requestPermission({ mode: "readwrite" });
    if (permission !== "granted") {
      throw new Error("Folder permission was not granted.");
    }

    await storeFolderHandle(handle);
    folderHandlePromise = Promise.resolve(handle);
    return handle;
  }

  async function getFolderForAutomaticBackup() {
    if (!folderHandlePromise) {
      folderHandlePromise = getUsableStoredFolderHandle();
    }

    const handle = await folderHandlePromise;
    return handle || null;
  }

  async function getFolderForUserAction() {
    const folder = await getFolderForAutomaticBackup();
    if (folder) return folder;
    return chooseFolder();
  }

  function timestamp() {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    return [
      d.getFullYear(),
      pad(d.getMonth() + 1),
      pad(d.getDate())
    ].join("-") + "_" + [
      pad(d.getHours()),
      pad(d.getMinutes()),
      pad(d.getSeconds())
    ].join("-");
  }

  function parseBackupName(name) {
    const match = name.match(
      /^evolve-backup-(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.txt$/
    );
    if (!match) return null;

    const [, year, month, day, hour, minute, second] = match;
    return {
      name,
      label: `${year}-${month}-${day} ${hour}:${minute}:${second}`
    };
  }

  async function listBackupFiles(folder) {
    const files = [];
    for await (const [name, handle] of folder.entries()) {
      const parsed = parseBackupName(name);
      if (handle.kind === "file" && parsed) {
        files.push(parsed);
      }
    }
    return files.sort((a, b) => a.name.localeCompare(b.name));
  }

  async function pruneOldBackups(folder) {
    const files = await listBackupFiles(folder);
    const oldFiles = files.slice(0, Math.max(0, files.length - KEEP_COUNT));

    for (const file of oldFiles) {
      await folder.removeEntry(file.name);
    }
  }

  function formatElapsed(ms) {
    if (ms < 60 * 1000) return "Saved just now";

    const minutes = Math.floor(ms / (60 * 1000));
    if (minutes < 60) return `Saved ${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    const leftoverMinutes = minutes % 60;
    if (leftoverMinutes === 0) return `Saved ${hours}h ago`;

    return `Saved ${hours}h ${leftoverMinutes}m ago`;
  }

  async function refreshSetupButton() {
    if (!setupButton) return;

    const folder = await getFolderForAutomaticBackup();

    if (!folder) {
      setupButton.textContent = "Set Backup Folder";
      setupButton.title = "Choose the folder where Evolve backups are saved.";
      setupButton.style.background = "#2f855a";
      return;
    }

    setupButton.style.background = "#334e68";
    setupButton.title = "Click to change the Evolve backup folder.";

    if (!lastBackupAt) {
      setupButton.textContent = "Backups Active";
      return;
    }

    setupButton.textContent = formatElapsed(Date.now() - lastBackupAt);
  }

  async function makeBackup({ allowFolderPrompt = false } = {}) {
    const gameWindow = pageWindow;

    if (typeof gameWindow.exportGame !== "function") {
      console.warn("[Evolve Backup] exportGame() is not available yet.");
      return false;
    }

    const folder = allowFolderPrompt
      ? await chooseFolder()
      : await getFolderForAutomaticBackup();

    if (!folder) {
      console.info("[Evolve Backup] No backup folder selected yet. Click the setup button once.");
      await refreshSetupButton();
      return false;
    }

    const save = gameWindow.exportGame();
    if (!save || typeof save !== "string") {
      console.warn("[Evolve Backup] exportGame() returned no save data.");
      return false;
    }

    const fileName = `evolve-backup-${timestamp()}.txt`;
    const fileHandle = await folder.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();

    await writable.write(save);
    await writable.close();

    await pruneOldBackups(folder);

    lastBackupAt = Date.now();
    await refreshSetupButton();

    console.info(`[Evolve Backup] Wrote ${fileName}`);
    return true;
  }

  async function restoreBackup(fileName) {
    const gameWindow = pageWindow;

    if (typeof gameWindow.importGame !== "function") {
      throw new Error("importGame() is not available.");
    }

    const folder = await getFolderForUserAction();
    const fileHandle = await folder.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const save = (await file.text()).trim();

    if (!save) {
      throw new Error(`${fileName} is empty.`);
    }

    const confirmed = pageWindow.confirm(
      `Import backup ${fileName}?\n\nThis will replace the currently loaded Evolve save.`
    );
    if (!confirmed) return false;

    gameWindow.importGame(save, false);
    console.info(`[Evolve Backup] Imported ${fileName}`);
    return true;
  }

  function closeRestorePanel() {
    const existing = document.getElementById("evolve-backup-restore-panel");
    if (existing) existing.remove();
  }

  async function openRestorePanel() {
    closeRestorePanel();

    const folder = await getFolderForUserAction();
    const files = (await listBackupFiles(folder)).reverse();

    const panel = document.createElement("div");
    panel.id = "evolve-backup-restore-panel";
    panel.style.position = "fixed";
    panel.style.right = "12px";
    panel.style.bottom = "58px";
    panel.style.zIndex = "999999";
    panel.style.width = "320px";
    panel.style.maxHeight = "420px";
    panel.style.overflow = "auto";
    panel.style.background = "#1f2933";
    panel.style.color = "white";
    panel.style.border = "1px solid #52616b";
    panel.style.borderRadius = "6px";
    panel.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.35)";
    panel.style.font = "13px system-ui, sans-serif";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.padding = "10px";
    header.style.borderBottom = "1px solid #52616b";

    const title = document.createElement("strong");
    title.textContent = "Restore Evolve Backup";

    const close = document.createElement("button");
    close.textContent = "X";
    close.style.background = "transparent";
    close.style.color = "white";
    close.style.border = "0";
    close.style.cursor = "pointer";
    close.style.fontSize = "14px";
    close.addEventListener("click", closeRestorePanel);

    header.append(title, close);
    panel.appendChild(header);

    if (files.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "No backups found in this folder.";
      empty.style.padding = "10px";
      panel.appendChild(empty);
    } else {
      for (const file of files) {
        const row = document.createElement("button");
        row.type = "button";
        row.textContent = file.label;
        row.title = file.name;
        row.style.display = "block";
        row.style.width = "100%";
        row.style.padding = "9px 10px";
        row.style.textAlign = "left";
        row.style.background = "transparent";
        row.style.color = "white";
        row.style.border = "0";
        row.style.borderBottom = "1px solid rgba(255,255,255,0.12)";
        row.style.cursor = "pointer";

        row.addEventListener("mouseenter", () => {
          row.style.background = "#334e68";
        });
        row.addEventListener("mouseleave", () => {
          row.style.background = "transparent";
        });
        row.addEventListener("click", async () => {
          try {
            row.disabled = true;
            row.textContent = `Importing ${file.label}...`;
            const restored = await restoreBackup(file.name);
            if (restored) closeRestorePanel();
          } catch (err) {
            console.error("[Evolve Backup]", err);
            row.disabled = false;
            row.textContent = `Failed: ${file.label}`;
          }
        });

        panel.appendChild(row);
      }
    }

    document.body.appendChild(panel);
  }

  function makeButton(text, rightPx, background) {
    const button = document.createElement("button");
    button.textContent = text;
    button.style.position = "fixed";
    button.style.right = `${rightPx}px`;
    button.style.bottom = "12px";
    button.style.zIndex = "999999";
    button.style.padding = "8px 10px";
    button.style.background = background;
    button.style.color = "white";
    button.style.border = "1px solid rgba(0,0,0,0.35)";
    button.style.borderRadius = "4px";
    button.style.cursor = "pointer";
    return button;
  }

  function addControls() {
    setupButton = makeButton("Set Backup Folder", 12, "#2f855a");

    setupButton.addEventListener("click", async () => {
      try {
        setupButton.disabled = true;
        setupButton.textContent = "Choosing...";
        await makeBackup({ allowFolderPrompt: true });
      } catch (err) {
        console.error("[Evolve Backup]", err);
        setupButton.textContent = "Folder Failed";
      } finally {
        setupButton.disabled = false;
        await refreshSetupButton();
      }
    });

    const restoreButton = makeButton("Restore Backup", 154, "#2b6cb0");
    restoreButton.addEventListener("click", async () => {
      try {
        await openRestorePanel();
      } catch (err) {
        console.error("[Evolve Backup]", err);
        pageWindow.alert(`Could not open backups: ${err.message}`);
      }
    });

    document.body.append(setupButton, restoreButton);
    refreshSetupButton();

    setInterval(refreshSetupButton, 30 * 1000);
  }

  unsafeWindow.evolveHourlyBackup = {
    backupNow: () => makeBackup(),
    chooseFolderAgain: () => chooseFolder(),
    backupNowWithPrompt: () => makeBackup({ allowFolderPrompt: true }),
    listBackups: async () => listBackupFiles(await getFolderForUserAction()),
    restoreBackup
  };

  addControls();

  startupTimer = setTimeout(() => makeBackup(), 30 * 1000);
  hourlyTimer = setInterval(() => makeBackup(), BACKUP_EVERY_MS);

  unsafeWindow.evolveHourlyBackup.startupTimer = startupTimer;
  unsafeWindow.evolveHourlyBackup.hourlyTimer = hourlyTimer;

  console.info("[Evolve Backup] Loaded. Use Set Backup Folder, Restore Backup, or evolveHourlyBackup.* from console.");
})();
