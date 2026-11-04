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
- `src/assets/cards/`: one PNG per card design, exported from the Figma "cards" section (node 854:17916) with the three "editable …" layers hidden (set them to 0% opacity rather than hiding, so auto-layout doesn't shift). Export at 2x.
- `src/assets/cards/*-front.png`: optional card-sized transparent layers (bows, characters) drawn in front of the person; set `front` on the card in `src/lib/cards.ts`.
- `src/lib/cards.ts`: the list of card designs and where the photo and editable text sit on each. To add a card, export its art and add one line here.
- `src/lib/photoArea.ts`: draws the person (sharp, not dithered) onto the card's "photobooth picture" area.
- `src/components/Card.tsx`: card art + person + editable text. Download uses `html-to-image`.
- `src/components/CardPicker.tsx`: after the pack is ripped open, deals 3 random designs to choose from.

Fonts: see `public/fonts/README.md`.

## Roadmap

1. ✅ Webcam preview + capture (3-second countdown, retake, download)
2. ✅ Card from Figma ("basic water") with live person cutout on the card background, dithered like the Figma shader
3. ✅ Side panel to edit the name, attack name and description after the photo (long text shrinks to fit)
4. ✅ Opening screen: a sealed card pack from Figma; swipe across the seam under the hole punch to rip it open (the strip peels as you drag), then the pack fades out and the card fades in
5. ✅ Pick 1 of 3 cards after opening the pack: 2 random basics + 1 rare in random order (1 in 10 chance the rare is the epic gold ex)
6. Background picker + upload
7. Download polish + mobile layout
8. Deploy (Vercel / Netlify)
