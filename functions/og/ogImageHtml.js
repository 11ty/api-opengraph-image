const fetch = require("node-fetch");
const cheerio = require("cheerio");
const EleventyImage = require("@11ty/eleventy-img");
const EleventyCache = require("@11ty/eleventy-cache-assets");

class OgImageHtml {
  constructor(url) {
    this.url = url;

    if(!this.isFullUrl(url)) {
      throw new Error(`Invalid \`url\`: ${url}`);
    }
  }

  isFullUrl(url) {
    try {
      new URL(url);
      return true;
    } catch(e) {
      // invalid url OR local path
      return false;
    }
  }

  async fetch() {
    let response = await fetch(this.url);
    let body = await response.text();
    this.body = body;

    this.$ = cheerio.load(body);
    return body;
  }

  normalizePath(path) {
    let u = new URL(path, this.url);
    return u.href;
  }

  findImageUrls() {
    let results = [];
    let ogImageSecure = this.$("meta[name='og:image:secure_url']").attr("content");

    if(ogImageSecure) {
      results.push(ogImageSecure);
    }

    let ogImage = this.$("meta[name='og:image']").attr("content");
    if(ogImage) {
      results.push(ogImage);
    }

    // not sure if this is standardized or not
    let ogImageProp = this.$("meta[property='og:image']").attr("content");
    if(ogImageProp) {
      results.push(ogImageProp);
    }

    let twitterImage = this.$("meta[name='twitter:image']").attr("content");
    if(twitterImage) {
      results.push(twitterImage);
    }

    return results;
  }

  async getImage(fallbackImageFormat) {
    let images = this.findImageUrls();
    if(images.length) {
      return this.optimizeImage(images[0], fallbackImageFormat)
    }
  }

  async optimizeImage(sharpInput, imageFormat) {
    // normalize format
    if(imageFormat && imageFormat === "svg+xml") {
      imageFormat = "svg";
    }

    let stats = await EleventyImage(sharpInput, {
      formats: [imageFormat],
      dryRun: true,
    });

    return stats;
  }
}

module.exports = OgImageHtml;
