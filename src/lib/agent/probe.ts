import { safeFetch, hostOf } from "./web";
import type { Emit } from "./events";

export type Probe = { check: string; target: string; result: string; ok: boolean; at: string };

type Discovery = { issuer?: string; authorization_endpoint?: string; token_endpoint?: string; registration_endpoint?: string; code_challenge_methods_supported?: string[]; scopes_supported?: string[] };

/**
 * Live, credential-free checks against the provider's OAuth endpoints:
 * discovery documents, PKCE and dynamic-registration support, and whether the authorize endpoint answers.
 */
export async function probeOAuth(domains: string[], emit: Emit): Promise<Probe[]> {
  const at = new Date().toISOString().slice(0, 10);
  const apexes = [...new Set(domains.map((d) => hostOf(d.startsWith("http") ? d : `https://${d}`)).filter(Boolean))].slice(0, 3);
  const hosts = [...new Set(apexes.flatMap((h) => [h, `www.${h}`, `accounts.${h}`, `auth.${h}`, `login.${h}`, `api.${h}`, `id.${h}`]))];
  const targets = hosts.flatMap((h) => [`https://${h}/.well-known/openid-configuration`, `https://${h}/.well-known/oauth-authorization-server`]);
  const found = (
    await Promise.all(
      targets.map(async (t) => {
        try {
          const r = await safeFetch(t, { timeoutMs: 4000, maxBytes: 200_000, accept: "application/json" });
          if (r.status !== 200) return null;
          const doc = JSON.parse(r.body) as Discovery;
          return doc.authorization_endpoint || doc.token_endpoint ? { target: t, doc } : null;
        } catch {
          return null;
        }
      }),
    )
  ).filter((x): x is { target: string; doc: Discovery } => !!x);

  const probes: Probe[] = [];
  const push = (p: Omit<Probe, "at">) => {
    probes.push({ ...p, at });
    emit({ type: "probe", check: p.check, ok: p.ok, result: p.result });
  };

  if (!found.length) {
    push({ check: "OAuth discovery document", target: apexes.map((a) => `${a} and common subdomains`).join(", "), result: "No discovery document at the standard locations. Endpoints must be taken from the documentation.", ok: false });
    return probes;
  }
  const { target, doc } = found[0];
  push({ check: "OAuth discovery document", target, result: `Found. Authorization endpoint: ${doc.authorization_endpoint ?? "not listed"}. Token endpoint: ${doc.token_endpoint ?? "not listed"}.`, ok: true });
  const pkce = doc.code_challenge_methods_supported;
  push({ check: "PKCE support", target, result: pkce?.length ? `Advertised: ${pkce.join(", ")}` : "Not advertised in the discovery document", ok: !!pkce?.length });
  push({
    check: "Dynamic client registration",
    target,
    result: doc.registration_endpoint ? `Advertised at ${doc.registration_endpoint}. Client registration may be automatable.` : "Not advertised. The OAuth client must be created manually in the provider's console.",
    ok: !!doc.registration_endpoint,
  });
  if (doc.authorization_endpoint) {
    try {
      const u = new URL(doc.authorization_endpoint);
      u.searchParams.set("client_id", "oauth-ready-probe-invalid-client");
      u.searchParams.set("redirect_uri", "https://example.com/callback");
      u.searchParams.set("response_type", "code");
      const r = await safeFetch(u.toString(), { timeoutMs: 5000, maxBytes: 50_000, followRedirects: 0 });
      push({ check: "Authorization endpoint responds", target: doc.authorization_endpoint, result: `HTTP ${r.status} for an invalid client ID. The endpoint is live and rejects unknown clients.`, ok: r.status < 500 });
    } catch (e) {
      push({ check: "Authorization endpoint responds", target: doc.authorization_endpoint, result: `Request failed: ${(e as Error).message}`, ok: false });
    }
  }
  return probes;
}
