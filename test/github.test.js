import { before, after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";

import OgImageHtml from "../ogImageHtml.js";
import { GET } from "../api/og.js";

// GitHub’s images are 1200×600 PNGs.
const SOURCE_PNG = await sharp({
  create: { width: 1200, height: 600, channels: 3, background: "#0000cc" },
}).png().toBuffer();

// Stubbing `fetch` keeps these tests off the network (and runnable where binding a local server isn’t allowed).
let realFetch = globalThis.fetch;
let realLog = console.log;
let requested = [];
let respond;

// Unique per run so a stubbed image never lands in the disk cache under a real GitHub URL.
const RUN = `${Date.now()}-${process.pid}`;

async function request(url, size = "small") {
  let res = await GET(new Request(`https://og.test/${encodeURIComponent(url)}/${size}/`));
  return {
    contentType: res.headers.get("content-type"),
    error: res.headers.get("x-11ty-error-message"),
    maxAge: Number(res.headers.get("cache-control").match(/s-maxage=(\d+)/)[1]),
    body: Buffer.from(await res.arrayBuffer()),
  };
}

before(() => {
  console.log = () => {};
  globalThis.fetch = async (input) => {
    let url = `${input instanceof Request ? input.url : input}`;
    requested.push(url);
    return respond(url);
  };
});

after(() => {
  console.log = realLog;
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  requested = [];
  respond = () => new Response(SOURCE_PNG, { headers: { "content-type": "image/png" } });
});

describe("GitHub image urls", () => {
  it("passes the GitHub path through to the image host", () => {
    let cases = {
      "https://github.com/11ty/eleventy": "11ty/eleventy",
      "https://github.com/11ty/eleventy/": "11ty/eleventy",
      "https://www.github.com/react/react/issues/11347?foo=bar#top": "react/react/issues/11347",
      "https://github.com/11ty/eleventy/pull/1234": "11ty/eleventy/pull/1234",
      "https://github.com/11ty/eleventy/commit/abc123": "11ty/eleventy/commit/abc123",
    };

    for(let [url, path] of Object.entries(cases)) {
      assert.equal(new OgImageHtml(url).getGitHubImageUrl(), `https://opengraph.githubassets.com/1/${path}`);
    }
  });

  it("scrapes the page for anything that isn’t a repo", () => {
    for(let url of ["https://github.com/", "https://github.com/11ty", "https://gist.github.com/zachleat/abc", "https://example.com/11ty/eleventy"]) {
      assert.equal(new OgImageHtml(url).getGitHubImageUrl(), undefined, url);
    }
  });
});

describe("GitHub requests", () => {
  it("fetches the image directly without loading the page", async () => {
    let { contentType, error, body } = await request(`https://github.com/og-test/repo-${RUN}/issues/1`);

    assert.equal(contentType, "image/png");
    assert.equal(error, null);
    assert.deepEqual(requested, [`https://opengraph.githubassets.com/1/og-test/repo-${RUN}/issues/1`]);
    assert.equal((await sharp(body).metadata()).width, 375);
  });

  it("expires a rate-limited GitHub image quickly", async () => {
    respond = () => new Response("", { status: 429, statusText: "Too Many Requests" });
    let { maxAge, error } = await request(`https://github.com/og-test/rate-limited-${RUN}`);

    assert.equal(maxAge, 300);
    assert.match(error, /\(429\)/);
  });
});

describe("page status", () => {
  for(let status of [429, 503]) {
    it(`expires a ${status} page quickly`, async () => {
      respond = () => new Response("<html></html>", { status, headers: { "content-type": "text/html" } });
      let { maxAge, error } = await request(`https://example.com/page-${status}-${RUN}`);

      assert.equal(maxAge, 300);
      assert.match(error, new RegExp(`\\(${status}\\)`));
    });
  }

  it("holds on to a 404 page for a day", async () => {
    respond = () => new Response("<html></html>", { status: 404, headers: { "content-type": "text/html" } });
    let { maxAge, error } = await request(`https://example.com/missing-${RUN}`);

    assert.equal(maxAge, 86400);
    assert.match(error, /\(404\)/);
  });
});
