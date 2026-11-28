---
name: flow-video
description: Make a short video with words and motion from real clips or photos (a reel, a story, a promo) as an HTML page rendered to MP4 with HyperFrames - ask the music, pick the shots, cut them, build the page, lint, render, look at the frames, show the file. Use when the user asks for a reel, a short video or a clip with text on it ("make a reel", "a video for the story", "animate these clips"), or to change one already made this way.
---

# Make a short video

The video is **one HTML page**: the clips and the words are elements with a start and a length, and one paused GSAP
timeline moves them. HyperFrames (Apache-2.0, `npx hyperframes`) seeks that timeline frame by frame and writes the
MP4. Nothing leaves the machine: no account, no cloud.

Motion choices (timing, easing, what moves and why) come from the `motion-design` skill. This one is the process.

## Never break these

1. **Real material only.** The shots are the user's own clips and photos; never a stock picture, never a generated one
   passed off as theirs.
2. **Show before it goes anywhere.** Render, open the file, write its full path, and wait for the yes before it is
   uploaded or posted.
3. **The brand's own files.** A logo or a store badge is the owner's or the store's file, never redrawn or recoloured.
4. **Turn telemetry off first**, once per machine: `npx --yes hyperframes@<version> telemetry disable`.
5. **Look at frames, not at the code.** A render that linted clean can still be wrong: pull frames and read them.

## Steps

1. **Ask what it is for**, unless said: where it goes out (that fixes the size: a vertical reel or story is 1080 by
   1920), how long, the line it says, the brand's colours and logo. Read the product's own content notes when it has
   them. Done when each of the five has an answer.
2. **Ask which music**, every time, and never choose it yourself. Offer the tracks of the product's media in HQ
   (`show_music` opens a page to listen to them; a post with the video then names the track in `musicChoice`) and the
   owner's library in `~/FractalX/media/music` (its README lists each track's style, tempo and drop), or none. Done
   when the user named one track, or none, and you know the second its drop lands on.
3. **Pick the shots.** Watch every candidate as a contact sheet (`ffmpeg -vf "fps=2,scale=320:-1,tile=8x1"`) and note,
   per shot, the file, the seconds to keep and where the action sits. Five or six shots of about 2 seconds make 15
   seconds. Done when every shot has in, out and a crop.
4. **Cut them** into the project's `assets/`, one file a shot, already at the page's size and in standard range (see
   Traps). Done when each file plays, is the right size and looks like the original's colours.
5. **Build the page** from [`assets/reel.html`](assets/reel.html): set the lengths, the words and the brand. Keep its
   structure rules (below). Done when `hyperframes lint` reports 0 errors.
6. **Render**: `npx --yes hyperframes@<version> render --output <file>.mp4`, from the project folder.
   With a track, lay it under the render with the project's `mix.sh`, copied from [`assets/mix.sh`](assets/mix.sh):
   `start` is the drop's second minus the first cut's, so the drop lands on that cut; `length` is the video's. The
   track stays where it is, named by its path, never copied into the project. Done when the drop is heard on the
   first cut (pull the audio at that second: `ffmpeg -ss <cut> -t 2`).
7. **Check the frames**: one frame of every shot and three of the closing card, tiled into one picture
   (`select='eq(n,20)+eq(n,100)…',tile=Nx1`). Done when no word is cut, covers a face or wraps, nothing sits in the
   platform's bands, and the first frame already shows the hook.
8. **Show it**: open the file, say its full path and what is in it, and what you did not check (sound, motion at
   speed). A change is a new render shown again.
9. **Keep the look.** When the user approves a look they will reuse, keep the page without its shots as a template
   beside the brand's files, and write the look down where the product's content notes live.

Pin `<version>` in the project's `package.json` scripts, to a release at least 14 days old. Proven on 0.9.7, node 24.

## The page's structure

- The root has `data-composition-id`, `data-start="0"`, `data-duration`, `data-width`, `data-height`.
- Every timed element has `class="clip"`, `data-start`, `data-duration` and a `data-track-index`; elements on one
  track never overlap in time. A `<video>` with sound says `data-has-audio="true"`; a silent one is `muted`.
- One timeline: `gsap.timeline({ paused: true })`, registered as `window.__timelines["<composition id>"]`.
- Animate transforms and opacity only (`x`, `y`, `scale`, `xPercent`, `opacity`). Layout properties (letter spacing,
  width, top) snap to whole pixels and stutter frame by frame; the linter calls it an error.
- Fixed pixel positions, no flow layout that depends on font loading: a word is `white-space: nowrap` at a size
  that fits its longest case.

## Where things sit (vertical, 1080 by 1920)

- Nothing in the top 168 px. Words stay above 1330 px: the networks draw their buttons and the caption below it.
- The header (logo and name) is small and has no plate; a soft dark gradient on the top of the frame makes white type
  read over a bright wall. The same at the foot for the words.
- A closing card sits a little above the middle, for the same reason.

## Traps

- **Phone clips are HDR (HLG).** Cut straight with ffmpeg they come out washed or purple unless it has `zscale`. On a
  Mac, convert first: `avconvert --source in.MOV --preset Preset1920x1080 --output out.mov --replace`, then cut.
- **Landscape to vertical**: `crop=608:1080:<x>:0,scale=1080:1920`, with `<x>` chosen per shot so the action stays in
  frame. A 4:3 photo or a 16:9 clip loses its sides: pick shots with the action in the middle.
- **A later `fromTo` on the same target paints its start at time 0.** A flash that starts at 0.55 opacity washes the
  first frame white. Every `fromTo` after a target's first one takes `immediateRender: false`.
- **Slow motion** is cut into its own file (`setpts=2.5*PTS`, no audio) and placed as a muted clip.
- **ffmpeg's `-vsync` is gone**: `-fps_mode passthrough` when selecting single frames.
- **A store badge file carries its own clear margin**, and the two stores' differ: match them by the height of the
  drawn badge, not of the file.
- **A font the renderer does not supply** falls back to a generic one without a word in the render: the linter
  names it (`font_family_without_font_face`). Declare its `@font-face`, or pick one it supplies.
- The linter's warnings about a dense track or a missing sub-composition are advice; its errors are not.

## What reads as professional

- One idea a screen: one word a shot beats a sentence over six shots.
- Two typefaces: a heavy one for the big words, a plain one for everything else. Two colours and the logo's own.
- The closing card is quiet: the mark, the name spaced wide, one line in sentence case, the call to action small.
  Parts fade up one after the other; nothing bounces.
- Hard cuts on the action, a short punch-in on each, and the words leave before the cut.

**Done when** the user has seen the rendered file by its full path, every frame checked reads clean, and the
project folder renders the same file again from one command.
