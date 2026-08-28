IMPORTANT WIREFRAME CLARIFICATION

I have provided the actual game wireframe in:

reference/wireframe.png

Treat this as the primary visual/interaction reference, while the existing
CLAUDE.md remains the technical source of truth.

Before implementing UI, inspect the wireframe carefully.

WIRE FRAME BEHAVIOUR:

1. INITIAL GAME STATE

When the game page first loads:

- Show the round/environment.
- Show the coordinate grid across the map background.
- Show the left and right cliffs/ground.
- Show the top HUD:
  - round
  - time remaining
  - total budget
  - budget used
  - budget remaining
- Do NOT show the construction controls initially.
- Do NOT start the build timer initially.

2. START OF CONSTRUCTION

When the player first initiates construction:

- reduce/animate the opacity of the left construction ground/cliff area
- reveal the construction controls near/on the left ground
- start the build timer exactly once

The timer must NOT start simply because the game page loaded.

3. CONSTRUCTION UI

The construction UI should be player-facing and visually integrated into the
left cliff/ground area.

It should contain, according to the wireframe:

- equation input
- x/y orientation switch
- material/piece selection
- Plot button

The exact styling should follow the wireframe and may be polished,
but the interaction hierarchy must remain.

4. EQUATION BUILDING

The player enters an equation and plots it.

The equation is sampled into points.

Those SAME sampled points are used for:

- displayed geometry
- logical graph vertices
- logical graph edges
- eventual physics conversion

There must never be a separate invisible geometry for physics.

5. ROAD

Road uses the same equation-based construction mechanism.

There is no freehand road drawing.

6. ENVIRONMENT

The cliffs and fixed support points come from round-config.js.

Do not hardcode their positions in UI/rendering code.

7. LOAD TEST VISUAL FLOW

After construction is finalized:

BUILDING
  ↓
TESTING
  ↓
vehicles/cars travel across the actual road
  ↓
5 sequential load stages
  ↓
result

Do not expose developer physics controls.

8. BRIJ BHUSHAN

The right-side character is Brij Bhushan.

Use a modular character/feedback system.

The character can react to high-level events:

ROUND_STARTED
BUILD_STARTED
PIECE_ADDED
TEST_STARTED
STAGE_PASSED
STAGE_FAILED
ROUND_COMPLETED

The character/expression should become progressively happier as the player
successfully completes load-test stages.

Do not couple character code directly to physics internals.

9. VISUAL PRIORITY

The game should feel like a polished competition game, NOT like a physics
debugging tool.

The old C# BridgeBuilder UI must NOT be reproduced.

Before implementing the UI, create a concise wireframe-to-component mapping
and then proceed only when the relevant implementation phase is approved.

Do not implement unrelated phases.
Do not modify reference/wireframe.png.