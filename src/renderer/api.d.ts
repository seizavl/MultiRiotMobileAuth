interface Account {
  name: string;
  seed: string;
}

interface Window {
  riot2fa: {
    listAccounts: () => Promise<Account[]>;
    addManualAccount: (name: string, seed: string) => Promise<Account[]>;
    addViaLogin: () => Promise<Account[]>;
    removeAccount: (name: string, seed: string) => Promise<Account[]>;
    getCode: (seed: string) => Promise<string>;
    getPeriod: () => Promise<number>;
    getOtpAuthUrl: (account: Account) => Promise<string>;
    getOtpAuthQr: (account: Account) => Promise<string>;
    copyText: (text: string) => Promise<void>;
    getStoragePath: () => Promise<string>;
    minimizeWindow: () => Promise<void>;
    closeWindow: () => Promise<void>;
  };
}
