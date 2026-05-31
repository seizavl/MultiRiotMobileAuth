import path from "node:path";
import { app, BrowserWindow, clipboard, ipcMain, session } from "electron";
import { enableMfa, fetchRiotId, isValidJwt, verifyMfa } from "./riotApi";
import { decodeBase32, extractSeed, getCode, PERIOD } from "./totp";
import { loadAccounts, saveAccounts, accountsFilePath } from "./storage";
import { createOtpAuthQrDataUrl, createOtpAuthUrl } from "./otpauth";
import type { Account, LoginTokens } from "./types";

let mainWindow: BrowserWindow | null = null;

function rendererFilePath(): string {
  return path.join(app.getAppPath(), "src", "renderer", "index.html");
}

function preloadFilePath(): string {
  return path.join(__dirname, "..", "preload.js");
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 720,
    title: "Riot 2FA",
    backgroundColor: "#0a0d12",
    frame: false,
    titleBarStyle: "hidden",
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: preloadFilePath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  void mainWindow.loadFile(rendererFilePath());

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function baseUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return value.split("?")[0].split("#")[0].replace(/\/$/, "");
  }
}

function collectLoginTokens(parent: BrowserWindow): Promise<LoginTokens> {
  return new Promise((resolve, reject) => {
    const partition = `riot_2fa_login_${Date.now()}`;
    const loginSession = session.fromPartition(partition);
    const cookies: Record<string, string> = {};
    let detected = false;
    let timer: NodeJS.Timeout | null = null;

    const loginWindow = new BrowserWindow({
      parent,
      modal: true,
      width: 960,
      height: 720,
      title: "Riotアカウントでログイン",
      backgroundColor: "#0c0c10",
      webPreferences: {
        session: loginSession,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const cleanup = (): void => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const fail = (error: Error): void => {
      cleanup();
      if (!loginWindow.isDestroyed()) {
        loginWindow.close();
      }
      reject(error);
    };

    const tryDetect = async (): Promise<void> => {
      if (detected || loginWindow.isDestroyed()) {
        return;
      }

      const idToken = cookies.id_token;
      const csrfCookie = cookies["a12l-csrf-prod"];
      if (!idToken || !csrfCookie || !isValidJwt(idToken)) {
        return;
      }

      if (baseUrl(loginWindow.webContents.getURL()) !== "https://account.riotgames.com") {
        return;
      }

      detected = true;
      try {
        const csrfToken = (await loginWindow.webContents.executeJavaScript(
          "document.querySelector('meta[name=\"csrf-token\"]')?.content ?? null",
        )) as string | null;
        if (!csrfToken) {
          detected = false;
          scheduleDetect(2000);
          return;
        }

        cleanup();
        if (!loginWindow.isDestroyed()) {
          loginWindow.close();
        }
        resolve({ cookies, csrfToken, idToken });
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    };

    const scheduleDetect = (delay = 500): void => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        void tryDetect();
      }, delay);
    };

    loginSession.cookies.on("changed", (_event, cookie, _cause, removed) => {
      if (removed) {
        delete cookies[cookie.name];
      } else {
        cookies[cookie.name] = cookie.value;
      }

      if (cookie.name === "id_token" || cookie.name === "a12l-csrf-prod") {
        scheduleDetect(300);
      }
    });

    loginWindow.webContents.on("did-navigate", () => scheduleDetect());
    loginWindow.webContents.on("did-navigate-in-page", () => scheduleDetect());
    loginWindow.webContents.on("did-finish-load", () => scheduleDetect());
    loginWindow.on("closed", () => {
      cleanup();
      if (!detected) {
        reject(new Error("ログインがキャンセルされました。"));
      }
    });

    void loginSession.clearStorageData().then(() => {
      void loginWindow.loadURL("https://account.riotgames.com/");
    });
  });
}

function readAccounts(): Account[] {
  return loadAccounts();
}

function writeAccounts(accounts: Account[]): Account[] {
  saveAccounts(accounts);
  return accounts;
}

function registerIpc(): void {
  ipcMain.handle("accounts:list", () => readAccounts());

  ipcMain.handle("accounts:add-manual", (_event, name: string, rawSeed: string) => {
    const cleanName = name.trim();
    if (!cleanName) {
      throw new Error("アカウント名を入力してください。");
    }

    const seed = extractSeed(rawSeed);
    if (!seed) {
      throw new Error("入力からシードを解析できませんでした。");
    }

    decodeBase32(seed);
    const accounts = readAccounts();
    accounts.push({ name: cleanName, seed });
    return writeAccounts(accounts);
  });

  ipcMain.handle("accounts:remove", (_event, name: string, seed: string) => {
    const accounts = readAccounts().filter(
      (account) => !(account.name === name && account.seed === seed),
    );
    return writeAccounts(accounts);
  });

  ipcMain.handle("accounts:add-via-login", async () => {
    if (!mainWindow) {
      throw new Error("メインウィンドウの準備ができていません。");
    }

    const tokens = await collectLoginTokens(mainWindow);
    let name = "Unknown";
    try {
      name = await fetchRiotId(tokens.cookies, tokens.csrfToken);
    } catch {
      name = "Unknown";
    }

    const seed = await enableMfa(tokens.cookies, tokens.csrfToken);
    await verifyMfa(tokens.idToken, seed);
    const accounts = readAccounts();
    accounts.push({ name, seed });
    return writeAccounts(accounts);
  });

  ipcMain.handle("totp:code", (_event, seed: string) => getCode(seed));
  ipcMain.handle("totp:period", () => PERIOD);
  ipcMain.handle("otpauth:url", (_event, account: Account) => createOtpAuthUrl(account));
  ipcMain.handle("otpauth:qr", (_event, account: Account) => createOtpAuthQrDataUrl(account));
  ipcMain.handle("clipboard:write", (_event, text: string) => clipboard.writeText(text));
  ipcMain.handle("storage:path", () => accountsFilePath());

  ipcMain.handle("window:minimize", () => {
    mainWindow?.minimize();
  });
  ipcMain.handle("window:close", () => {
    mainWindow?.close();
  });
}

void app.whenReady().then(() => {
  registerIpc();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
