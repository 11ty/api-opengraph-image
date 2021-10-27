const OgImageHtml = require("./functions/og/ogImageHtml");

(async function() {
  // let url = "https://lynnandtonic.com";
  let url = "https://www.netlify.com";
  // let url = "https://www.zachleat.com";
  // let url = "https://www.11ty.dev";
  console.log( url );

  let og = new OgImageHtml(url);
  let html = await og.fetch();

  let stats = await og.getImage("png", 600);
  let format = Object.keys(stats).pop();
  console.log( format, stats );

  // console.log( stats[format][0].buffer.toString() );
})();