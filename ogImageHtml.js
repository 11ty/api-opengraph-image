import * as cheerio from 'cheerio';
import EleventyImage from "@11ty/eleventy-img";

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";

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
      headers: {
        "User-Agent": USER_AGENT,
      }
    });
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
    let results = new Set();

    let cases = [
      ["meta[name='og:image:secure_url']", "content"],
      ["meta[name='og:image']", "content"],
      ["meta[property='og:image']", "content"], // not sure if this is standardized
      ["meta[name='twitter:image']", "content"],

      // YouTube specific: https://github.com/11ty/api-opengraph-image/issues/6
      ["link[rel='image_src']", "href"],
      ["link[itemprop='thumbnailUrl']", "href"],
    ];

    for(let [selector, attribute] of cases) {
      let imageUrl = this.$(selector).attr(attribute);
      if(imageUrl) {
        results.add(imageUrl);
        continue;
      }
    }

    // More YouTube specific stuff: https://github.com/11ty/api-opengraph-image/issues/6
    let u = new URL(this.url);
    if(u.host.endsWith(".youtube.com") || u.host === "youtube.com") {
      // Sizes borrowed from https://paulirish.github.io/lite-youtube-embed/testpage/poster-image-availability.html
      // let sizes = ["maxresdefault", "sddefault", "hqdefault", "mqdefault", "default"];
      let videoId = u.searchParams.get("v");
      if(videoId) {
        results.add(`https://i.ytimg.com/vi_webp/${videoId}/maxresdefault.webp`);
        results.add(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);
        // results.add(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
      }
    }
    // TODO youtu.be style https://github.com/11ty/api-opengraph-image/issues/8

    console.log( "Found urls:", Array.from(results) );

    return Array.from(results);
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
      cacheOptions: {
        headers: {
          "User-Agent": USER_AGENT,
        }
      }
    });

    return stats;
  }
}

export default OgImageHtml;
