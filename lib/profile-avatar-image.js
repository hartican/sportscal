'use strict';
const sharp = require('sharp');
const MAX_BYTES = 6000000, MAX_PIXELS = 60_000_000;
function invalid(message, status=415) { return Object.assign(new Error(message), {status, code:'invalid_profile_avatar'}); }
async function processImage(bytes) {
 if (!bytes?.length || bytes.length > MAX_BYTES) throw invalid('Choose a picture up to 6 MB.',413);
 let source, options = {limitInputPixels:MAX_PIXELS, animated:false, page:0, pages:1, failOn:'error'};
 try {
  const brand=bytes.subarray(8,12).toString();
  if(bytes.subarray(4,8).toString()==='ftyp' && /^(heic|heix|hevc|hevx|mif1|msf1)$/.test(brand)) {
   const images=await require('heic-decode').all({buffer:bytes});
   try {
    const image=images[0];
    if(!image || image.width*image.height>MAX_PIXELS) throw invalid('That picture has too many pixels. Choose one under 60 megapixels.');
    const decoded=await image.decode();
    source=Buffer.from(decoded.data);options={raw:{width:decoded.width,height:decoded.height,channels:4},limitInputPixels:MAX_PIXELS};
   } finally { images.dispose(); }
  } else {
   const metadata=await sharp(bytes,options).metadata();
   if(!['jpeg','png','webp','tiff','gif','heif'].includes(metadata.format)) throw invalid('Choose a JPG, PNG, HEIC, TIFF, WebP, AVIF or GIF picture.');
   source=bytes;
  }
  // Decode once, honour EXIF orientation, discard metadata, and cap working memory.
  const square=await sharp(source,options).rotate().resize(512,512,{fit:'cover',position:'centre'}).toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
  async function encode(size,target,ceiling) {
   let output;
   for(const quality of [82,72,62,52,42]) {
    output=await sharp(square.data,{raw:{width:square.info.width,height:square.info.height,channels:square.info.channels}}).resize(size,size).webp({quality,effort:4}).toBuffer();
    if(output.length<=target) break;
   }
   if(output.length>ceiling) throw invalid('That picture could not be compressed. Please choose another image.');
   return output;
  }
  return {thumbnail:await encode(128,20000,32000),expanded:await encode(512,150000,200000)};
 } catch(error) {
  if(error.code==='invalid_profile_avatar') throw error;
  throw invalid('This picture could not be decoded. It may be damaged or use an unsupported image variant.');
 }
}
module.exports={processImage,MAX_BYTES,MAX_PIXELS};
