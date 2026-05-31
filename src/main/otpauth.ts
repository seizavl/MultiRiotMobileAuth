import QRCode from "qrcode";
import type { Account } from "./types";

const ISSUER = "Riot";

function encodeLabelPart(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

export function createOtpAuthUrl(account: Account): string {
  const label = `${encodeLabelPart(ISSUER)}:${encodeLabelPart(account.name)}`;
  const params = new URLSearchParams({
    secret: account.seed,
    issuer: ISSUER,
    algorithm: "SHA256",
    digits: "6",
    period: "30",
  });

  return `otpauth://totp/${label}?${params.toString()}`;
}

export async function createOtpAuthQrDataUrl(account: Account): Promise<string> {
  return QRCode.toDataURL(createOtpAuthUrl(account), {
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 7,
    color: {
      dark: "#0a0d12",
      light: "#ffffff",
    },
  });
}
