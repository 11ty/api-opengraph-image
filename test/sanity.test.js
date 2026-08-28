import { before, after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

import { GET } from "../api/og.js";

// Big enough that every width we ask for is a downscale.
const SOURCE_PNG = await sharp({
  create: { width: 1200, height: 630, channels: 3, background: "#cc0000" },
}).png().toBuffer();

// Directories eleventy-img would create if it ever stopped running in dryRun.
// Recorded up front so the suite only ever cleans up what it created itself.
const GENERATED_DIRS = ["img", ".cache"];

// Mirrors CACHE_DIRECTORY in ogImageHtml.js.
const CACHE_DIRECTORY = path.join(os.tmpdir(), "og-image-cache");
function cacheFileCount() {
  return fs.existsSync(CACHE_DIRECTORY) ? fs.readdirSync(CACHE_DIRECTORY).length : 0;
}
let baseline = {};

let server;
let origin;
let originHits = 0;
let pageCount = 0;

// Every test gets a unique image URL so the on-disk source cache can’t bleed between them.
function pageUrl(mode) {
  return `${origin}/page?mode=${mode}&n=${++pageCount}`;
}

async function request(url, size = "small") {
  let res = await GET(new Request(`https://og.test/${encodeURIComponent(url)}/${size}/`));
  return {
    contentType: res.headers.get("content-type"),
    error: res.headers.get("x-11ty-error-message"),
    maxAge: Number(res.headers.get("cache-control").match(/s-maxage=(\d+)/)[1]),
    body: Buffer.from(await res.arrayBuffer()),
  };
}

let realLog = console.log;

before(async () => {
  console.log = () => {}; // the handler logs every request

  for(let dir of GENERATED_DIRS) {
    baseline[dir] = fs.existsSync(dir);
  }

  server = http.createServer((req, res) => {
    let url = new URL(req.url, "http://localhost");
    let mode = url.searchParams.get("mode");

    if(url.pathname === "/page") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(mode === "no-image"
        ? `<html><head><title>no og image here</title></head></html>`
        : `<html><head><meta property="og:image" content="${origin}/image.png?${url.searchParams}"></head></html>`);
      return;
    }

    originHits++;

    if(mode === "ok") {
      res.writeHead(200, { "content-type": "image/png" });
      res.end(SOURCE_PNG);
    } else if(mode === "corrupt") {
      res.writeHead(200, { "content-type": "image/png" });
      res.end("plainly not a png");
    } else {
      res.writeHead(Number(mode), "Upstream Says No");
      res.end("");
    }
  });

  await new Promise(resolve => server.listen(0, resolve));
  origin = `http://localhost:${server.address().port}`;
});

after(() => {
  console.log = realLog;
  server.close();

  // Leave the tree exactly as we found it, so one failing run can’t poison the next.
  for(let dir of GENERATED_DIRS) {
    if(!baseline[dir] && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

beforeEach(() => {
  originHits = 0;
});

describe("open graph image handler", () => {
  it("returns a real image buffer at the requested width", async () => {
    let { contentType, error, body } = await request(pageUrl("ok"));

    assert.equal(contentType, "image/png");
    assert.equal(error, null, "a successful response carries no error header");

    // Regression guard: `dryRun: true` is what populates `stat.buffer`. Without it
    // eleventy-img writes a file instead and the response body is empty.
    let { width, format } = await sharp(body).metadata();
    assert.equal(format, "png");
    assert.equal(width, 375);
  });

  it("never writes image files into the project", async () => {
    await request(pageUrl("ok"));

    // Vercel’s filesystem is read-only apart from the temp dir, so eleventy-img has
    // to stay in dryRun and hand back a buffer rather than writing an output file.
    for(let dir of GENERATED_DIRS) {
      assert.equal(fs.existsSync(dir), baseline[dir], `${dir}/ should not be created`);
    }
  });

  it("writes the fetched source to the temp cache", async () => {
    let before = cacheFileCount();
    await request(pageUrl("ok"));

    // Without this a fresh invocation refetches from the origin every time, which is
    // how a rate-limited upstream turns into a served error.
    assert.ok(cacheFileCount() > before, "the source image should land in the temp cache");
  });

  it("reuses a single upstream fetch across size variants", async () => {
    let url = pageUrl("ok");

    for(let size of ["small", "medium", "auto"]) {
      let { contentType } = await request(url, size);
      assert.equal(contentType, "image/png");
    }

    assert.equal(originHits, 1, "every size variant should share one upstream fetch");
  });

  it("expires transient upstream failures quickly", async () => {
    for(let status of ["429", "503"]) {
      let { maxAge, error } = await request(pageUrl(status));

      assert.equal(maxAge, 300, `${status} should not be pinned for a day`);
      assert.match(error, new RegExp(`\\(${status}\\)`), "the real upstream status is reported");
    }
  });

  it("holds on to permanent failures for a day", async () => {
    let notFound = await request(pageUrl("404"));
    assert.equal(notFound.maxAge, 86400);
    assert.match(notFound.error, /\(404\)/);

    let corrupt = await request(pageUrl("corrupt"));
    assert.equal(corrupt.maxAge, 86400);
    assert.match(corrupt.error, /unsupported image format/);
  });

  it("falls back to the logo when a page has no open graph image", async () => {
    let { contentType, error } = await request(pageUrl("no-image"));

    assert.equal(contentType, "image/svg+xml");
    assert.match(error, /No Open Graph images found/);
  });

  it("only ever emits header-safe error messages", async () => {
    let { error } = await request(pageUrl("429"));

    // `x-11ty-error-message` must stay single-line ASCII or constructing the
    // Response throws and a useful message turns into a 500.
    assert.doesNotMatch(error, /[^\x20-\x7E]/);
    assert.ok(error.length <= 500);
  });
});
