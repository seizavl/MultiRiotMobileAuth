import { contextBridge, ipcRenderer } from "electron";

export interface Account {
  name: string;
  seed: string;
}

const api = {
  listAccounts: () => ipcRenderer.invoke("accounts:list") as Promise<Account[]>,
  addManualAccount: (name: string, seed: string) =>
    ipcRenderer.invoke("accounts:add-manual", name, seed) as Promise<Account[]>,
  addViaLogin: () => ipcRenderer.invoke("accounts:add-via-login") as Promise<Account[]>,
  removeAccount: (name: string, seed: string) =>
    ipcRenderer.invoke("accounts:remove", name, seed) as Promise<Account[]>,
  getCode: (seed: string) => ipcRenderer.invoke("totp:code", seed) as Promise<string>,
  getPeriod: () => ipcRenderer.invoke("totp:period") as Promise<number>,
  getOtpAuthUrl: (account: Account) =>
    ipcRenderer.invoke("otpauth:url", account) as Promise<string>,
  getOtpAuthQr: (account: Account) =>
    ipcRenderer.invoke("otpauth:qr", account) as Promise<string>,
  copyText: (text: string) => ipcRenderer.invoke("clipboard:write", text) as Promise<void>,
  getStoragePath: () => ipcRenderer.invoke("storage:path") as Promise<string>,
  minimizeWindow: () => ipcRenderer.invoke("window:minimize") as Promise<void>,
  closeWindow: () => ipcRenderer.invoke("window:close") as Promise<void>,
};

contextBridge.exposeInMainWorld("riot2fa", api);

declare global {
  interface Window {
    riot2fa: typeof api;
  }
}
