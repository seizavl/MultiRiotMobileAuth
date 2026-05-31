const accountsEl = document.querySelector<HTMLDivElement>("#accounts");
const statusEl = document.querySelector<HTMLParagraphElement>("#status");
const addLoginBtn = document.querySelector<HTMLButtonElement>("#add-login");
const addManualBtn = document.querySelector<HTMLButtonElement>("#add-manual");
const manualDialog = document.querySelector<HTMLDialogElement>("#manual-dialog");
const manualForm = document.querySelector<HTMLFormElement>("#manual-form");
const manualName = document.querySelector<HTMLInputElement>("#manual-name");
const manualSeed = document.querySelector<HTMLInputElement>("#manual-seed");
const manualCancel = document.querySelector<HTMLButtonElement>("#manual-cancel");
const winCloseBtn = document.querySelector<HTMLButtonElement>("#win-close");
const qrDialog = document.querySelector<HTMLDialogElement>("#qr-dialog");
const qrTitle = document.querySelector<HTMLHeadingElement>("#qr-title");
const qrImage = document.querySelector<HTMLImageElement>("#qr-image");
const qrClose = document.querySelector<HTMLButtonElement>("#qr-close");
const qrCopyUrl = document.querySelector<HTMLButtonElement>("#qr-copy-url");
const qrCopySeed = document.querySelector<HTMLButtonElement>("#qr-copy-seed");

let accounts: Account[] = [];
let period = 30;
let lastStep = -1;
let renderTicket = 0;
let activeQrAccount: Account | null = null;
let activeOtpAuthUrl = "";

function requireElement<T>(value: T | null, name: string): T {
  if (!value) {
    throw new Error(`Missing element: ${name}`);
  }
  return value;
}

const ui = {
  accounts: requireElement(accountsEl, "accounts"),
  status: requireElement(statusEl, "status"),
  addLogin: requireElement(addLoginBtn, "add-login"),
  addManual: requireElement(addManualBtn, "add-manual"),
  manualDialog: requireElement(manualDialog, "manual-dialog"),
  manualForm: requireElement(manualForm, "manual-form"),
  manualName: requireElement(manualName, "manual-name"),
  manualSeed: requireElement(manualSeed, "manual-seed"),
  manualCancel: requireElement(manualCancel, "manual-cancel"),
  winClose: requireElement(winCloseBtn, "win-close"),
  qrDialog: requireElement(qrDialog, "qr-dialog"),
  qrTitle: requireElement(qrTitle, "qr-title"),
  qrImage: requireElement(qrImage, "qr-image"),
  qrClose: requireElement(qrClose, "qr-close"),
  qrCopyUrl: requireElement(qrCopyUrl, "qr-copy-url"),
  qrCopySeed: requireElement(qrCopySeed, "qr-copy-seed"),
};

ui.winClose.addEventListener("click", () => {
  void window.riot2fa.closeWindow();
});

async function showQr(account: Account): Promise<void> {
  activeQrAccount = account;
  ui.qrTitle.textContent = account.name;
  ui.qrImage.removeAttribute("src");
  ui.qrImage.alt = `${account.name} の認証用QRコード`;
  activeOtpAuthUrl = await window.riot2fa.getOtpAuthUrl(account);
  ui.qrImage.src = await window.riot2fa.getOtpAuthQr(account);
  ui.qrDialog.showModal();
}

function setStatus(message: string, kind: "idle" | "ok" | "error" = "idle"): void {
  ui.status.textContent = message;
  ui.status.dataset.kind = kind;
  if (message) {
    window.setTimeout(() => {
      if (ui.status.textContent === message) {
        ui.status.textContent = "";
        ui.status.dataset.kind = "idle";
      }
    }, 2200);
  }
}

function secondsRemaining(): number {
  const elapsed = (Date.now() / 1000) % period;
  return Math.max(1, Math.ceil(period - elapsed));
}

async function renderAccounts(force = false): Promise<void> {
  const step = Math.floor(Date.now() / 1000 / period);
  if (!force && step === lastStep) {
    updateTimers();
    return;
  }

  lastStep = step;
  const ticket = ++renderTicket;
  const rows = await Promise.all(
    accounts.map(async (account) => ({
      account,
      code: await window.riot2fa.getCode(account.seed).catch(() => "エラー"),
    })),
  );

  if (ticket !== renderTicket) {
    return;
  }

  closeMenu();
  ui.accounts.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "アカウントがまだありません。\n上のボタンから追加してください。";
    ui.accounts.append(empty);
    return;
  }

  for (const row of rows) {
    ui.accounts.append(createAccountCard(row.account, row.code));
  }
  updateTimers();
}

const RING_RADIUS = 11;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function urgencyClass(remaining: number): "" | "low" | "critical" {
  if (remaining <= 5) return "critical";
  if (remaining <= 10) return "low";
  return "";
}

function formatCode(code: string): string {
  if (code === "エラー") return code;
  const digits = code.replace(/\s+/g, "");
  if (digits.length === 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length === 8) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return code;
}

function updateTimers(): void {
  const remaining = secondsRemaining();
  const elapsed = (Date.now() / 1000) % period;
  const offset = RING_CIRCUMFERENCE * (elapsed / period);
  const urgency = urgencyClass(remaining);

  document.querySelectorAll<HTMLElement>("[data-timer]").forEach((timer) => {
    timer.textContent = `${remaining}`;
  });
  document.querySelectorAll<HTMLElement>("[data-code]").forEach((code) => {
    code.classList.toggle("low", urgency === "low");
    code.classList.toggle("critical", urgency === "critical");
  });
  document.querySelectorAll<SVGElement>("[data-ring]").forEach((ring) => {
    ring.classList.toggle("low", urgency === "low");
    ring.classList.toggle("critical", urgency === "critical");
  });
  document.querySelectorAll<SVGElement>("[data-ring-fill]").forEach((fill) => {
    fill.style.strokeDashoffset = `${offset}`;
  });
}

const SVG_NS = "http://www.w3.org/2000/svg";

function createRing(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "ring");
  svg.setAttribute("viewBox", "0 0 28 28");
  svg.dataset.ring = "true";

  const track = document.createElementNS(SVG_NS, "circle");
  track.setAttribute("class", "ring-track");
  track.setAttribute("cx", "14");
  track.setAttribute("cy", "14");
  track.setAttribute("r", `${RING_RADIUS}`);

  const fill = document.createElementNS(SVG_NS, "circle");
  fill.setAttribute("class", "ring-fill");
  fill.setAttribute("cx", "14");
  fill.setAttribute("cy", "14");
  fill.setAttribute("r", `${RING_RADIUS}`);
  fill.setAttribute("stroke-dasharray", `${RING_CIRCUMFERENCE}`);
  fill.dataset.ringFill = "true";

  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("class", "ring-text");
  text.setAttribute("x", "14");
  text.setAttribute("y", "14");
  text.dataset.timer = "true";

  svg.append(track, fill, text);
  return svg;
}

let openPopover: HTMLElement | null = null;
let openAnchor: HTMLElement | null = null;

function closeMenu(): void {
  if (openPopover) {
    openPopover.remove();
    openPopover = null;
    openAnchor = null;
  }
}

function positionMenu(popover: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  popover.style.visibility = "hidden";
  document.body.append(popover);
  const width = popover.offsetWidth;
  const height = popover.offsetHeight;
  const margin = 8;

  let left = rect.right - width;
  if (left < margin) left = margin;
  if (left + width > window.innerWidth - margin) {
    left = window.innerWidth - margin - width;
  }

  let top = rect.bottom + 6;
  if (top + height > window.innerHeight - margin) {
    top = rect.top - height - 6;
  }
  if (top < margin) top = margin;

  popover.style.left = `${Math.round(left)}px`;
  popover.style.top = `${Math.round(top)}px`;
  popover.style.visibility = "visible";
}

function buildPopover(account: Account): HTMLElement {
  const popover = document.createElement("div");
  popover.className = "popover";

  const addItem = (
    label: string,
    handler: () => void | Promise<void>,
    danger = false,
  ): void => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    if (danger) button.className = "danger";
    button.addEventListener("click", async () => {
      closeMenu();
      await handler();
    });
    popover.append(button);
  };

  const addDivider = (): void => {
    const divider = document.createElement("div");
    divider.className = "divider";
    popover.append(divider);
  };

  addItem("QRコードを表示", async () => {
    try {
      await showQr(account);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), "error");
    }
  });
  addItem("認証URLをコピー", async () => {
    const url = await window.riot2fa.getOtpAuthUrl(account);
    await window.riot2fa.copyText(url);
    setStatus("認証URLをコピーしました", "ok");
  });
  addItem("シードをコピー", async () => {
    await window.riot2fa.copyText(account.seed);
    setStatus("シードをコピーしました", "ok");
  });
  addItem("シードを表示", () => {
    window.alert(`${account.name}\n\n${account.seed}`);
  });
  addDivider();
  addItem(
    "アカウントを削除",
    async () => {
      if (!window.confirm(`"${account.name}" の2FAを削除しますか？`)) {
        return;
      }
      accounts = await window.riot2fa.removeAccount(account.name, account.seed);
      await renderAccounts(true);
    },
    true,
  );

  return popover;
}

function createAccountCard(account: Account, code: string): HTMLElement {
  const card = document.createElement("article");
  card.className = "account-card";

  const info = document.createElement("div");
  info.className = "account-info";

  const name = document.createElement("div");
  name.className = "account-name";
  name.textContent = account.name;

  const codeButton = document.createElement("button");
  codeButton.className = "code-button";
  codeButton.type = "button";
  codeButton.dataset.code = "true";
  codeButton.textContent = formatCode(code);
  codeButton.title = "コードをコピー";
  codeButton.addEventListener("click", async () => {
    if (code !== "エラー") {
      await window.riot2fa.copyText(code);
      codeButton.classList.remove("copied");
      void codeButton.offsetWidth;
      codeButton.classList.add("copied");
      setStatus("クリップボードにコピーしました", "ok");
    }
  });

  info.append(name, codeButton);

  const right = document.createElement("div");
  right.className = "account-right";

  const ring = createRing();

  const menu = document.createElement("button");
  menu.className = "menu-button";
  menu.type = "button";
  menu.textContent = "⋯";
  menu.title = "アカウント操作";
  menu.addEventListener("click", (event) => {
    event.stopPropagation();
    const wasOpen = openAnchor === menu;
    closeMenu();
    if (wasOpen) return;
    const popover = buildPopover(account);
    positionMenu(popover, menu);
    openPopover = popover;
    openAnchor = menu;
  });

  right.append(ring, menu);
  card.append(info, right);
  return card;
}

document.addEventListener("click", () => closeMenu());
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});
window.addEventListener("resize", () => closeMenu());
ui.accounts.addEventListener("scroll", () => closeMenu());

async function load(): Promise<void> {
  period = await window.riot2fa.getPeriod();
  accounts = await window.riot2fa.listAccounts();
  await renderAccounts(true);
  window.setInterval(() => {
    void renderAccounts();
  }, 250);
}

ui.addManual.addEventListener("click", () => {
  ui.manualName.value = "";
  ui.manualSeed.value = "";
  ui.manualDialog.showModal();
  ui.manualName.focus();
});

ui.manualCancel.addEventListener("click", () => {
  ui.manualDialog.close();
});

ui.manualForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    accounts = await window.riot2fa.addManualAccount(ui.manualName.value, ui.manualSeed.value);
    ui.manualDialog.close();
    await renderAccounts(true);
    setStatus("アカウントを追加しました", "ok");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  }
});

ui.qrClose.addEventListener("click", () => {
  ui.qrDialog.close();
});

ui.qrCopyUrl.addEventListener("click", async () => {
  if (!activeOtpAuthUrl) {
    return;
  }
  await window.riot2fa.copyText(activeOtpAuthUrl);
  setStatus("認証URLをコピーしました", "ok");
});

ui.qrCopySeed.addEventListener("click", async () => {
  if (!activeQrAccount) {
    return;
  }
  await window.riot2fa.copyText(activeQrAccount.seed);
  setStatus("シードをコピーしました", "ok");
});

ui.addLogin.addEventListener("click", async () => {
  ui.addLogin.disabled = true;
  setStatus("Riotのログインを待っています…");
  try {
    accounts = await window.riot2fa.addViaLogin();
    await renderAccounts(true);
    setStatus("アカウントを追加しました", "ok");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally {
    ui.addLogin.disabled = false;
  }
});

void load().catch((error) => {
  setStatus(error instanceof Error ? error.message : String(error), "error");
});
