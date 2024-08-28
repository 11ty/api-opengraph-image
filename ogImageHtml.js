import * as cheerio from 'cheerio';
import EleventyImage from "@11ty/eleventy-img";

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
    let response = await fetch(this.url, {
      referrer: "",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
      }
    });
    let body = await response.text();
    console.log( body.split("<meta ").slice(1).map(line => `<meta ${line.slice(0, 200)}`) );
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

  async getImages() {
    return this.findImageUrls().map(url => {
      return ""+ (new URL(url, this.url));
    });
  }

  async optimizeImage(imageUrl, imageFormat, maxWidth) {
    let stats = await EleventyImage(imageUrl, {
      widths: [maxWidth || "auto"],
      formats: [imageFormat],
      dryRun: true,
      useCache: false,
    });

    return stats;
  }
}

export default OgImageHtml;
