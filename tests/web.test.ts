import { afterEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { excerpt, htmlToText, quoteInText, safeFetch } from "@/lib/agent/web";

afterEach(() => vi.unstubAllGlobals());

describe("safeFetch SSRF guard", () => {
  const blocked = [
    "https://127.0.0.1/",
    "https://10.0.0.5/x",
    "https://172.16.0.1/",
    "https://192.168.1.1/",
    "https://169.254.169.254/latest/meta-data/", // cloud metadata
    "https://0.0.0.0/",
    "https://2130706433/", // decimal form of 127.0.0.1
    "https://0x7f000001/", // hex form of 127.0.0.1
    "https://localhost/",
    "https://[::1]/",
    "https://[::ffff:127.0.0.1]/",
    "https://[fd00::1]/",
  ];
  for (const url of blocked) {
    it(`refuses ${url} without making a request`, async () => {
      const spy = vi.fn();
      vi.stubGlobal("fetch", spy);
      await expect(safeFetch(url)).rejects.toThrow();
      expect(spy).not.toHaveBeenCalled();
    });
  }

  it("refuses plain http", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(safeFetch("http://93.184.215.14/")).rejects.toThrow(/https/);
  });

  it("re-checks every redirect hop and refuses a redirect to a private address", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data/" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(safeFetch("https://93.184.215.14/start")).rejects.toThrow(/Blocked/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caps the response body at maxBytes", async () => {
    // 50 chunks of 1 KB; reading must stop shortly after the cap.
    const chunk = new TextEncoder().encode("a".repeat(1024));
    const body = new ReadableStream({ start(c) { for (let i = 0; i < 50; i++) c.enqueue(chunk); c.close(); } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200, headers: { "content-type": "text/plain" } })));
    const r = await safeFetch("https://93.184.215.14/big", { maxBytes: 10_000 });
    expect(r.body.length).toBeLessThanOrEqual(10_000 + 1024);
  });
});

describe("htmlToText", () => {
  it("drops scripts, styles and comments and decodes entities", () => {
    const t = htmlToText(`<html><head><title>x</title></head><body><script>alert("no")</script><style>p{}</style><!-- hidden --><p>Tom &amp; Jerry &#8212; &quot;ok&quot;</p></body></html>`);
    expect(t).toBe('Tom & Jerry — "ok"');
  });
  it("keeps block boundaries as line breaks", () => {
    expect(htmlToText("<p>one</p><p>two</p>").split("\n").map((l) => l.trim())).toEqual(["one", "two"]);
  });
  it("does not leak attribute text when an attribute contains '>'", () => {
    expect(htmlToText(`<a title="a>b" href="/x">link</a>`)).toBe("link");
  });
});

describe("quoteInText", () => {
  const page = "Before you start, make sure you have a sandbox account (more info about it [here](https://x.dev/sandbox)). Reviews take **5 to 10** business days. Developer must submit the Marketplace App for approval by Pipedrive, as more particularly described in the listing rules.";
  it("matches through markdown links, emphasis and ellipses", () => {
    expect(quoteInText("make sure you have a sandbox account (more info about it here).", page)).toBe(true);
    expect(quoteInText("Reviews take 5 to 10 business days.", page)).toBe(true);
    expect(quoteInText("Before you start … Reviews take 5 to 10 business days.", page)).toBe(true);
  });
  it("rejects paraphrases, inventions and trivial quotes", () => {
    expect(quoteInText("Reviews usually take about two weeks for most developers.", page)).toBe(false);
    expect(quoteInText("Pipedrive approves all apps within 24 hours of submission, guaranteed.", page)).toBe(false);
    expect(quoteInText("", page)).toBe(false);
    expect(quoteInText("...", page)).toBe(false);
    expect(quoteInText("days", page)).toBe(false);
  });
  it("rejects a quote that is half copied from the page and half invented", () => {
    const real = "Developer must submit the Marketplace App for approval by Pipedrive";
    expect(quoteInText(`${real} and approval is guaranteed within one single business day always`, page)).toBe(false);
  });
  it("property: any run of 8+ consecutive words from the page matches", () => {
    fc.assert(
      fc.property(fc.array(fc.stringMatching(/^[a-z]{3,9}$/), { minLength: 30, maxLength: 80 }), fc.nat(), fc.integer({ min: 8, max: 20 }), (words, start, len) => {
        const text = words.join(" ");
        const s = start % (words.length - len);
        return quoteInText(words.slice(s, s + len).join(" "), text);
      }),
      { numRuns: 300 },
    );
  });
  it("property: a quote whose words are absent from the page never matches", () => {
    fc.assert(
      fc.property(fc.array(fc.stringMatching(/^[a-m]{4,8}$/), { minLength: 20, maxLength: 60 }), fc.array(fc.stringMatching(/^[n-z]{4,8}$/), { minLength: 8, maxLength: 20 }), (pageWords, quoteWords) => !quoteInText(quoteWords.join(" "), pageWords.join(" "))),
      { numRuns: 300 },
    );
  });
  it("stays fast on a large page", () => {
    const text = Array.from({ length: 15_000 }, (_, i) => `word${i}`).join(" ");
    const t0 = performance.now();
    quoteInText("this quote does not appear anywhere in the page at all", text);
    expect(performance.now() - t0).toBeLessThan(500);
  });
});

describe("excerpt", () => {
  it("never exceeds the budget (plus separators)", () => {
    fc.assert(
      fc.property(fc.array(fc.string({ minLength: 40, maxLength: 900 }), { minLength: 1, maxLength: 60 }), fc.integer({ min: 1200, max: 6000 }), (paras, budget) => {
        const out = excerpt(paras.join("\n"), budget);
        const seps = (out.match(/\n\[…\]\n/g) ?? []).length * 5;
        return out.length - seps <= budget;
      }),
      { numRuns: 200 },
    );
  });
  it("prefers the passage with concrete review timelines", () => {
    const filler = Array.from({ length: 40 }, (_, i) => `General marketing paragraph number ${i} about our great product and its many features for everyone.`).join("\n");
    const key = "App review: submissions are reviewed within 10 business days. Production approval requires a privacy policy and a demo video.";
    expect(excerpt(`${filler}\n${key}\n${filler}`, 1200)).toContain("10 business days");
  });
  it("keeps content from a page that has no line breaks", () => {
    // Some extracted pages arrive as one long line; the key fact sits late in it.
    const text = "Intro text. ".repeat(400) + "Apps must pass security review, which takes 6 weeks. " + "More text. ".repeat(50);
    expect(excerpt(text, 4200)).toContain("6 weeks");
  });
});

describe("connect-time address check (F13, DNS rebinding)", () => {
  it("blocks a connection to a private address even when the URL check is skipped", async () => {
    const http = await import("node:http");
    const { guardedAgent } = await import("@/lib/agent/web");
    const server = http.createServer((_q, r) => r.end("internal")).listen(0);
    const port = (server.address() as { port: number }).port;
    try {
      // A rebinding DNS answer would reach exactly this: a hostname that resolves to a private address.
      await expect(fetch(`http://localhost:${port}/`, { dispatcher: guardedAgent } as RequestInit)).rejects.toThrow();
    } finally {
      server.close();
    }
  });
  it("guardedLookup refuses private answers and passes public ones", async () => {
    const { guardedLookup } = await import("@/lib/agent/web");
    const dns = await import("node:dns");
    const spy = vi.spyOn(dns.default, "lookup");
    const run = (addrs: { address: string; family: number }[], all: boolean) =>
      new Promise<unknown>((resolve) => {
        spy.mockImplementationOnce(((_h: string, _o: unknown, cb: (e: null, a: typeof addrs) => void) => cb(null, addrs)) as never);
        guardedLookup("rebind.test", { all }, (err, address) => resolve(err ? `error: ${err.message}` : address));
      });
    expect(await run([{ address: "93.184.215.14", family: 4 }, { address: "10.0.0.7", family: 4 }], false)).toMatch(/Blocked/);
    expect(await run([{ address: "169.254.169.254", family: 4 }], true)).toMatch(/Blocked/);
    expect(await run([{ address: "93.184.215.14", family: 4 }], false)).toBe("93.184.215.14");
    expect(await run([{ address: "93.184.215.14", family: 4 }], true)).toEqual([{ address: "93.184.215.14", family: 4 }]);
    spy.mockRestore();
  });
});
