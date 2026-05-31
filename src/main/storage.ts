import fs from "node:fs";
import path from "node:path";
import { app, safeStorage } from "electron";
import type { Account } from "./types";

const ENCRYPTION = "electron-safe-storage";

interface EncryptedAccountsFile {
  version: 1;
  encryption: typeof ENCRYPTION;
  payload: string;
}

function storageDir(): string {
  const override = process.env.RIOT2FA_DATA_DIR;
  if (override) {
    return override;
  }

  if (app.isPackaged) {
    const exeDir = path.dirname(process.execPath);
    if (path.basename(exeDir).toLowerCase() === "win-unpacked") {
      const projectDir = path.resolve(exeDir, "..", "..");
      if (fs.existsSync(path.join(projectDir, "package.json"))) {
        return projectDir;
      }
    }
    return exeDir;
  }

  return app.getAppPath();
}

export function accountsFilePath(): string {
  return path.join(storageDir(), "accounts.json");
}

function legacyAccountsFilePaths(): string[] {
  return Array.from(
    new Set([
      path.join(app.getAppPath(), "accounts.json"),
      path.join(process.cwd(), "accounts.json"),
      path.join(path.dirname(process.execPath), "accounts.json"),
      path.join(path.dirname(process.execPath), "..", "..", "accounts.json"),
    ]),
  ).filter((filePath) => filePath !== accountsFilePath());
}

function requireEncryption(): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("このシステムでは暗号化(safeStorage)が利用できません。");
  }
}

function packAccounts(accounts: Account[]): EncryptedAccountsFile {
  requireEncryption();
  const plain = JSON.stringify(accounts);
  const encrypted = safeStorage.encryptString(plain);
  return {
    version: 1,
    encryption: ENCRYPTION,
    payload: encrypted.toString("base64"),
  };
}

function unpackAccounts(data: unknown): Account[] {
  if (Array.isArray(data)) {
    const accounts = data as Account[];
    saveAccounts(accounts);
    return accounts;
  }

  if (!data || typeof data !== "object") {
    throw new Error("アカウントファイルの形式が不正です。");
  }

  const encryptedFile = data as Partial<EncryptedAccountsFile>;
  if (encryptedFile.encryption !== ENCRYPTION || typeof encryptedFile.payload !== "string") {
    throw new Error("サポートされていないアカウントファイルの暗号化です。");
  }

  requireEncryption();
  const decrypted = safeStorage.decryptString(Buffer.from(encryptedFile.payload, "base64"));
  return JSON.parse(decrypted) as Account[];
}

export function loadAccounts(): Account[] {
  const filePath = accountsFilePath();
  const existingPath = fs.existsSync(filePath)
    ? filePath
    : legacyAccountsFilePaths().find((legacyPath) => fs.existsSync(legacyPath));

  if (!existingPath) {
    return [];
  }

  const data = JSON.parse(fs.readFileSync(existingPath, "utf8")) as unknown;
  const accounts = unpackAccounts(data);
  if (existingPath !== filePath) {
    saveAccounts(accounts);
  }
  return accounts;
}

export function saveAccounts(accounts: Account[]): void {
  const filePath = accountsFilePath();
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(packAccounts(accounts), null, 2), "utf8");
  fs.renameSync(tmpPath, filePath);
}
