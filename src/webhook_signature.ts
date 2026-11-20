import { createHmac, timingSafeEqual } from "node:crypto";

export function signBody(rawBody: Buffer, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verifySignature(rawBody: Buffer, supplied: string | undefined, secret: string): boolean {
  if (!supplied || !/^[a-f0-9]{64}$/.test(supplied)) return false;
  const expected = Buffer.from(signBody(rawBody, secret), "hex");
  const actual = Buffer.from(supplied, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
