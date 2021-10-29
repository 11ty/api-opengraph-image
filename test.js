const OgImageHtml = require("./functions/og/ogImageHtml");

async function fetch(url) {
  console.log( { url } );
  let og = new OgImageHtml(url);
  let html = await og.fetch();

  let stats = await og.getImage("png", 600);
  let format = Object.keys(stats).pop();
  console.log( format, stats );

  // console.log( stats[format][0].buffer.toString() );
}

(async function() {
  // fetch("https://lynnandtonic.com");
  fetch("https://www.netlify.com");
  fetch("https://www.zachleat.com");
  fetch("https://www.11ty.dev");
  // fetch("https://samtan.dev/");

})();