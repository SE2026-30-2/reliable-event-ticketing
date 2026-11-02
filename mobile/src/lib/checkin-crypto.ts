// Forge's browser mappings disable Node built-ins in Metro/Hermes.
import forge from "node-forge";

export interface Certificate {
  jwks: {
    keys: { kid: string; kty: string; n: string; e: string; alg?: string }[];
  };
  updatedAt: string;
}
export interface Verification {
  outcome: string;
  ticketId?: string;
  eventId?: string;
  maxEntries?: number;
  entryNo?: number;
}
const decode = (value: string) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return forge.util.decode64(
    base64.padEnd(Math.ceil(base64.length / 4) * 4, "="),
  );
};
export function verifyOffline(
  payload: string,
  certificate: Certificate | null,
  eventId: string,
  now = Date.now(),
): Verification {
  try {
    if (payload.length > 16384) return { outcome: "INVALID_SIGNATURE" };
    const parts = payload.split(".");
    if (parts.length !== 3) return { outcome: "INVALID_SIGNATURE" };
    const [kid, data, signature] = parts;
    const jwk = certificate?.jwks.keys.find(
      (key) =>
        key.kid === kid &&
        key.kty === "RSA" &&
        (!key.alg || key.alg === "RS256"),
    );
    if (!jwk) return { outcome: "PENDING" };
    const integer = (value: string) =>
      new forge.jsbn.BigInteger(forge.util.bytesToHex(decode(value)), 16);
    const key = forge.pki.setRsaPublicKey(integer(jwk.n), integer(jwk.e));
    const digest = forge.md.sha256.create();
    digest.update(data, "utf8");
    if (!key.verify(digest.digest().getBytes(), decode(signature)))
      return { outcome: "INVALID_SIGNATURE" };
    const claims = JSON.parse(forge.util.decodeUtf8(decode(data)));
    const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
    if (
      ![claims.tid, claims.eid, claims.tt].every(
        (value) => typeof value === "string" && uuid.test(value),
      ) ||
      !Number.isFinite(claims.vf) ||
      !Number.isFinite(claims.vu)
    )
      return { outcome: "INVALID_SIGNATURE" };
    const result = {
      ticketId: claims.tid as string,
      eventId: claims.eid as string,
      maxEntries:
        Number.isInteger(claims.me) && claims.me > 0
          ? (claims.me as number)
          : 1,
    };
    if (eventId && claims.eid !== eventId)
      return { ...result, outcome: "WRONG_EVENT" };
    if (now / 1000 < claims.vf || Math.floor(now / 1000) > claims.vu)
      return { ...result, outcome: "EXPIRED_WINDOW" };
    return { ...result, outcome: "ACCEPTED" };
  } catch {
    return { outcome: "INVALID_SIGNATURE" };
  }
}
