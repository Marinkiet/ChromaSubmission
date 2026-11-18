# ChromaSubmission

**CHROMA** is a hands-first VR puzzle game for Meta Quest, built with the Immersive Web SDK (IWSDK) and TypeScript. You move across an endless world of glowing coloured tiles, learn hidden colour rules by experimenting, and survive as the rules begin to deceive you.

Track: Gaming. Division: New Experience. Played seated, with hands only, no controllers.

## How it plays

- Point at a tile in the row in front of you and **pinch** to choose it.
- Five colours (red, blue, yellow, green, purple) follow hidden rules about what may follow what. Wrong picks always explain why.
- Open your palm for a clue. Hold both palms open for a future ability.
- A pause button floats low and close on your left.

Stages: **DISCOVER** (learn the rules), **DECEIVE** (colour shift, pattern illusions, mirror tiles, memory tiles, rule switches), then harder combinations.

## Run it

```sh
npm install
npm run dev        # dev server with the Immersive Web Emulator
npm run typecheck
npm test           # rule engine, world generator, deception, gestures
npm run build
```

Open the dev server in the emulator, press **Enter VR**, and use hand input. Outside VR a clearly labelled mouse fallback is available in dev (or with `?devinput`). It is never treated as hand tracking.

Useful URL flags: `?seed=123` (replay a world), `?deception=off`, `?no=memory,mirror`, `?deceive=0|1|2`.

## Architecture

- `src/game/` is pure TypeScript with no rendering: rule engine (`rules.ts`, `session.ts`), difficulty tiers and a seeded chunked world generator (`world/`), deception mechanics (`deception/`), and hand-gesture recognisers (`gestures.ts`).
- `src/*.ts` are IWSDK ECS components and systems: tile pool, input, HUD, gestures, view.
- The world is endless but cheap: a fixed pool of 84 tile entities is recycled while chunks of plain data are generated ahead of the player and dropped behind.
- Every generated row is guaranteed solvable: the generator tracks every colour state a player could be in and always offers a visible valid tile for each.

## Hand interaction

Pointing and pinching use IWSDK's hand ray (`RayInteractable`, `Hovered`, `Pressed`). Open-palm and two-hand gestures are recognised from the hand joint poses exposed by IWSDK's hand adapter. Input from a mouse or controller is ignored during a VR session.

## Status

Built for the Meta VR Start developer competition. Tested in unit tests and the Immersive Web Emulator. On-device testing on a Quest headset is still to do.
# ChromaSubmission
