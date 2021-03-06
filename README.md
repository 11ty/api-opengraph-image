<p align="center"><img src="https://www.11ty.dev/img/logo-github.svg" width="200" height="200" alt="11ty Logo"></p>

# Open Graph Image API

A runtime service to return optimized Open Graph images from a URL. Works with:

1. `<meta name="og:image:secure_url">`
1. `<meta name="og:image">`
1. `<meta property="og:image">`
1. `<meta name="twitter:image">`

## Usage

URLs have the formats:

```
/:url/
/:url/:size/
/:url/:size/:format/
```

* `url` must be URI encoded.
* `size` (optional) can be `small` (375×_), `medium` (650×_), or `auto` (keep original width)
* `format` must by an output image format supported by [Eleventy Image](https://www.11ty.dev/docs/plugins/image/)

## Deploy your own

<a href="https://app.netlify.com/start/deploy?repository=https://github.com/11ty/api-opengraph-image"><img src="https://www.netlify.com/img/deploy/button.svg" alt="Deploy to Netlify"></a>

## Demos

<img src="https://v1.opengraph.11ty.dev/https%3A%2F%2Fwww.netlify.com/small/" alt="OpenGraph Image for netlify.com">

<img src="https://v1.opengraph.11ty.dev/https%3A%2F%2Fwww.11ty.dev/small/" alt="OpenGraph Image for 11ty.dev">

<img src="https://v1.opengraph.11ty.dev/https%3A%2F%2Fwww.zachleat.com/small/" alt="OpenGraph Image for zachleat.com">

### Advanced: Manual Cache Busting

If the images aren’t updating at a high enough frequency you can pass in your own cache busting key using an underscore prefix `_` after your URL.

This can be any arbitrary string tied to your unique build, here’s an example that uses today’s date.

```
/:url/_20210802/
/:url/:size/_20210802/
/:url/:size/:format/_20210802/
```
