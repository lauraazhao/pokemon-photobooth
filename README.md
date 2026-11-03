# Card Photobooth

Take a photo with your webcam and frame it as a trading card with editable text and backgrounds.

## Run locally

```bash
npm install
npm run dev
```

Open the printed localhost URL. The camera only works on `localhost` or over HTTPS.

`npm install` also copies the MediaPipe runtime into `public/mediapipe` (used for the person cutout).

## How the card photo works

- `src/lib/segmenter.ts`: MediaPipe selfie segmentation cuts the person out of each camera frame, in the browser.
- `src/lib/photoArea.ts`: draws the "photobooth picture" layer: water background at 75%, blue-to-white overlay at 50%, and the metallic 4px frame, then the person on top.
- `src/lib/dither.ts`: a port of the Figma Dither shader (Bayer 16×16, 2 levels), applied to the background and frame only, so the person stays sharp. Set `DITHER = false` in `App.tsx` to turn it off.
- `src/components/Card.tsx`: the rest of the card, built from the Figma frame. Download uses `html-to-image`.

Fonts: see `public/fonts/README.md`.

## Roadmap

1. ✅ Webcam preview + capture (3-second countdown, retake, download)
2. ✅ Card from Figma ("basic water") with live person cutout on the card background, dithered like the Figma shader
3. ✅ Side panel to edit the name, attack name and description after the photo (long text shrinks to fit)
4. ✅ Opening screen: a sealed card pack from Figma; swipe across the seam under the hole punch to rip it open (the strip peels as you drag), then the pack fades out and the card fades in
5. Background picker + upload
6. Download polish + mobile layout
7. Deploy (Vercel / Netlify)
