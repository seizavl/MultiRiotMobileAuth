"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountsFilePath = accountsFilePath;
exports.loadAccounts = loadAccounts;
exports.saveAccounts = saveAccounts;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const electron_1 = require("electron");
const ENCRYPTION = "electron-safe-storage";
function accountsFilePath() {
    return node_path_1.default.join(electron_1.app.getAppPath(), "accounts.json");
}
function requireEncryption() {
    if (!electron_1.safeStorage.isEncryptionAvailable()) {
        throw new Error("Electron safeStorage encryption is not available on this system.");
    }
}
function packAccounts(accounts) {
    requireEncryption();
    const plain = JSON.stringify(accounts);
    const encrypted = electron_1.safeStorage.encryptString(plain);
    return {
        version: 1,
        encryption: ENCRYPTION,
        payload: encrypted.toString("base64"),
    };
}
function unpackAccounts(data) {
    if (Array.isArray(data)) {
        const accounts = data;
        saveAccounts(accounts);
        return accounts;
    }
    if (!data || typeof data !== "object") {
        throw new Error("Invalid accounts file format.");
    }
    const encryptedFile = data;
    if (encryptedFile.encryption !== ENCRYPTION || typeof encryptedFile.payload !== "string") {
        throw new Error("Unsupported accounts file encryption.");
    }
    requireEncryption();
    const decrypted = electron_1.safeStorage.decryptString(Buffer.from(encryptedFile.payload, "base64"));
    return JSON.parse(decrypted);
}
function loadAccounts() {
    const filePath = accountsFilePath();
    if (!node_fs_1.default.existsSync(filePath)) {
        return [];
    }
    const data = JSON.parse(node_fs_1.default.readFileSync(filePath, "utf8"));
    return unpackAccounts(data);
}
function saveAccounts(accounts) {
    const filePath = accountsFilePath();
    const tmpPath = `${filePath}.tmp`;
    node_fs_1.default.writeFileSync(tmpPath, JSON.stringify(packAccounts(accounts), null, 2), "utf8");
    node_fs_1.default.renameSync(tmpPath, filePath);
}
