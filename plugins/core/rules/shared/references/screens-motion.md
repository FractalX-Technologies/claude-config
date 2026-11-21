---
paths:
  - "**/composeApp/**"
  - "**/androidApp/**"
  - "**/iosApp/**"
  - "**/iosCore/**"
  - "**/core-ui/**"
---

# Screen edges and screen transitions (mobile)

How a screen meets its edges (top, sides) and how it opens from a card. Same result on Android and iOS; the mechanism
differs, and each difference has a comment in the code.

## Horizontal rows run edge to edge

A row that scrolls sideways (filter chips, a carousel of cards) spans the whole screen width; the page's side gutter
goes inside it, as content padding. At rest its first item lines up with the column; scrolled, items slide out at the
screen's edge, never at an invisible line one gutter in.

- Never pad a section from outside when it holds such a row: pad its other children (titles, cards, dots) and give the
  row the gutter inside.
- **Android:** `LazyRow(contentPadding = PaddingValues(horizontal = gutter))`, no `padding` modifier on the row.
- **iOS:** `ScrollView(.horizontal)` with `.padding(.horizontal, gutter)` on its content stack, not on the scroll view.
- A row inside a card with its own edge (a reel in a bordered box) ends at the card's edge instead.
- Check it by scrolling the row to its end on a narrow phone: the last item reaches the screen's edge.

## A picture header stays glued to the top

A header with a background picture (a cover, a photo, a brand gradient) that sits at the top of a scroll view never
comes away from the top edge: pulled down past the top, no page background shows above it.

- **iOS:** the scroll view bounces, so the picture stretches from its bottom edge as it's pulled (`visualEffect`
  reading the frame in `.scrollView`, scaled with the bottom as anchor). Only the picture stretches: the buttons over
  it stay their size.
- **Android:** the system's stretch overscroll already keeps it in place. Add nothing.
- Check it by pulling the screen down at rest, on a screen opened without a zoom transition (see below).

## Pinned bars read as one pane

When a header pins under the top bar (filter chips, tabs, a segmented control), the top bar and the pinned header
share one backing once it pins: no strip of list shows between them, and no band of a different color shows while
it rests in the page.

- At rest the pinned-to-be header sits on the page color itself, not on glass or material.
- **iOS 26:** the top bar has no backing of its own (only the scroll edge effect), so the pinned header's glass reaches
  up behind it to the top edge. Before 26 the bar already sits on material: don't stack a second one.
- **Android:** top bar and pinned header use the same surface color.
- Check it with a screenshot at rest and one scrolled until the header pins.

## A card opens its screen in place

Where tapping a card pushes the screen about that thing (a person, a brand, an event), the screen grows out of the
card and shrinks back into it on back.

- Key the pair by the route's path, from the shared navigation code, so both platforms use the same key.
- One source per key on a screen. With two (a card and a pill for the same item), the tapped one must win, or the
  transition starts from the wrong place.
- **Only when that card opened it.** The same screen also opens from a link, a pill or a notification: there it uses
  the plain push. iOS's zoom transition (iOS 18+, behind `if #available`) adds a pull-down-to-close that swallows a
  stretching header's pull, and has no source to return to. A shared helper records the tapped card and the push
  takes it once, with a short window so a tap that opened nothing goes stale.
- **iOS:** `matchedTransitionSource` on the card, `navigationTransition(.zoom)` on the pushed screen.
  **Android:** `SharedTransitionLayout` around the nav host, `sharedBounds` on the card and on the screen's root, both
  through one helper that does nothing outside the host.
- Not for tabs, sheets or lists of plain rows: the default push or presentation is right there.
- Check it on both platforms with a recording: open from the card, go back, and open the same screen another way.
