You are the lead software engineer for our Technothlon bridge-building game.

IMPORTANT:
We are rebuilding the game as a CLEAN NEW PROJECT inside this repository.

You are operating as an AGENT directly inside the repository.

You have permission to:
- inspect files
- create files
- modify files
- delete files when necessary
- run commands
- run tests
- run the local development server
- inspect build/runtime errors
- iterate on implementation

Do NOT merely tell me what code I should write.
When implementation is approved, make the changes DIRECTLY in the repository.

Do NOT blindly patch or copy the old project's physics.js/loadtest.js.
The old project is a reference for requirements, UI flow, and useful ideas only.

The reference material is located inside:

reference/

The expected structure is:

reference/
    old-project/
    wireframe.png

Treat everything inside reference/ as READ-ONLY.

Do NOT modify files inside reference/ unless I explicitly ask you to.

The old project is NOT the architecture for the new game.

If the old project conflicts with this specification:
THIS SPECIFICATION WINS.

You must inspect the previous project before making architectural decisions.

Before declaring the project complete, perform a fresh end-to-end
verification from a clean browser session.

Do not declare completion based solely on unit tests.

The final verification must include actual gameplay:
LOGIN → STAGE → BUILD → FINALIZE → TEST → LOAD STAGES → RESULT.

 The reference project remains unmodified.
 No known console/runtime errors remain.
 The application can be started from the documented command.
 The game can be played by a user without developer/debug controls.

==================================================
SOURCE OF TRUTH HIERARCHY
==================================================

When requirements conflict, use this priority:

1. Explicit instructions in the current user message
2. This CLAUDE.md
3. Approved architectural decisions made during development
4. Supplied wireframe
5. Existing/reference project
6. External reference implementations

Never allow the old project or external reference implementation
to override this specification.


When working in the repository:

- inspect only relevant files
- use targeted searches
- do not repeatedly reread unchanged files
- do not print entire large files unless necessary
- do not explain code that was not changed
- do not produce large conversational code dumps
- make changes directly in files
- keep progress reports concise

Before modifying a file, understand its relevant dependencies.

Prefer small, verifiable changes over large speculative rewrites.

When working in the repository:

- inspect only relevant files
- use targeted searches
- do not repeatedly reread unchanged files
- do not print entire large files unless necessary
- do not explain code that was not changed
- do not produce large conversational code dumps
- make changes directly in files
- keep progress reports concise

Before modifying a file, understand its relevant dependencies.

Prefer small, verifiable changes over large speculative rewrites.

==================================================
BROWSER VERIFICATION
==================================================

Whenever the phase affects browser behaviour:

1. Start/use the local development server.
2. Open the game in a browser using the available browser tooling.
3. Check the relevant UI interaction.
4. Check the browser console for errors.
5. Verify the expected state transition.
6. Report anything that could not be browser-tested.

Do not consider a browser-facing phase fully verified from static
code inspection alone when browser testing is available.

==================================================
REFERENCE DIRECTORY SAFETY
==================================================

The directory:

reference/

contains source material only.

NEVER:
- modify it
- refactor it
- rename files inside it
- delete files inside it
- "fix" bugs inside it

All implementation belongs outside reference/.

If useful code is identified, reimplement or deliberately port the
necessary logic into the new architecture rather than modifying the
reference copy.



==================================================
1. TECHNOLOGY CONSTRAINT
==================================================

The final game MUST run directly in a modern browser.

Use:
- HTML
- CSS
- JavaScript ES modules
- Canvas/SVG/DOM as appropriate
- A browser-compatible physics solution

Do NOT convert the project to C#.

The C# BridgeBuilder repository:

https://github.com/kukas/BridgeBuilder

is ONLY a reference for understanding bridge-building gameplay,
structural behaviour, and physics concepts.

It is NOT the codebase for this project.

Do NOT port the C# implementation directly.

Do NOT convert this project to C#.

The final game MUST remain a browser-based JavaScript application.

If external repository access is unavailable, use the local reference
material and do not invent details about the C# implementation.

Our final game must remain a JavaScript/browser game.

If a physics library is used, it must work completely in the browser.

Prefer a simple, deterministic architecture over unnecessary frameworks.

Do NOT introduce React/Vite/TypeScript/etc. unless there is a compelling
reason and I explicitly approve it.

==================================================
2. CORE GAME CONCEPT
==================================================

This is an engineering/bridge-building competition game for Technothlon.

The player is given a predefined environment:
- two cliffs/ground supports
- fixed support vertices
- a gap between them
- potentially different cliff heights/depths depending on the round
- a construction budget
- a construction time limit

The player constructs a bridge by entering mathematical equations.

The game is NOT a freehand drawing game.

The game board is a coordinate system.

The player enters an equation representing a bridge piece.

Example:

y = 0.01*x^2 + 5

with a specified domain/range.

The equation is plotted on the coordinate system.

The continuous curve is then sampled at a configurable resolution.

Those sampled points become the logical vertices of the bridge piece.

Adjacent sampled vertices are connected by logical edges.

The same equation-based system must work for:
- structural pieces
- road pieces

The player therefore builds the entire bridge mathematically.

==================================================
3. VERY IMPORTANT: BUILD PHASE VS PHYSICS PHASE
==================================================

THIS IS A CORE ARCHITECTURAL REQUIREMENT.

There must be a strict separation between:

A. BUILD PHASE
B. PHYSICS/TEST PHASE

During BUILD PHASE:

THERE IS NO PHYSICS WORLD.

Do NOT create physics bodies, constraints, Matter.js bodies,
or simulation objects while the player is constructing the bridge.

During BUILD PHASE we only maintain:

Equation
    ↓
Validated Piece
    ↓
Sampled Geometry
    ↓
Logical Graph

The player can:
- add pieces
- connect pieces
- create road
- delete pieces
- modify the bridge
- see the graph
- spend budget

without any physics simulation running.

Only when construction is complete and the player starts testing:

Logical Graph
    ↓
Physics World Creation
    ↓
Physics Bodies
    ↓
Constraints
    ↓
Gravity
    ↓
Load Test

This means the entire bridge is finalized BEFORE physics bodies are created.

This is intentional and must not be changed without discussion.

==================================================
4. LOGICAL GRAPH IS THE SOURCE OF TRUTH
==================================================

The bridge must have a logical graph independent of physics.

The logical graph contains:

- canonical vertices
- edges
- pieces
- piece types
- connections
- fixed/support vertices
- road information

The sampled points of an equation are NOT themselves the physics bodies.

They are geometric/logical vertices.

Example:

Equation Piece A:

P0 -- P1 -- P2 -- P3 -- P4

If another piece connects to P3:

                 Q1 -- Q2
                      |
P0 -- P1 -- P2 -- P3 -- P4
                      |
                    Piece B

P3 must exist as ONE canonical logical vertex.

Do NOT create:

P3_A
P3_B

when they represent the same physical connection.

Instead:

P3 = one canonical vertex
    ↓
one eventual physics body

==================================================
5. CONNECTIVITY / CANONICAL VERTEX SYSTEM
==================================================

This is extremely important.

Different equation pieces may meet at the same point.

If two piece endpoints are sufficiently close, they must be resolved
to the SAME canonical logical vertex.

Use a configurable SNAP_TOLERANCE.

For example:

distance(A, B) <= SNAP_TOLERANCE

means A and B can represent the same connection vertex.

Do NOT rely on exact floating-point equality.

The graph must maintain a canonical vertex registry.

Conceptually:

Piece A endpoint
       ↓
connection resolver
       ↓
canonical vertex V7
       ↑
connection resolver
       ↑
Piece B endpoint

Both pieces reference V7.

The canonical vertex has ONE identity.

==================================================
6. PHYSICS BODY CREATION
==================================================

PHYSICS BODIES ARE CREATED ONLY ONCE,
AFTER THE ENTIRE BRIDGE HAS BEEN BUILT.

When TEST begins:

For every unique canonical logical vertex:

    create exactly ONE physics body.

Therefore:

1 logical vertex
        =
1 physics body

Never create one physics body per piece endpoint.

Never create duplicate physics bodies for connected pieces.

For example:

Logical graph:

       Piece A
P0 ─ P1 ─ P2 ─ P3 ─ P4
              │
              │
              P5 ─ P6
                 Piece B

Physics:

Body(P0)
Body(P1)
Body(P2)
Body(P3)
Body(P4)
Body(P5)
Body(P6)

There is ONE Body(P3).

All logical edges connected to P3 reference the same physical body.

This should be implemented centrally in the physics bridge builder.

==================================================
7. FIXED ENVIRONMENT / ROUND CONFIG
==================================================

There is a module called:

round-config.js

This module is the SINGLE SOURCE OF TRUTH for round-specific configuration.

It must define:

- round ID
- cliff positions
- cliff heights/depths
- fixed support locations
- bridge span
- allowed construction region
- budget
- build time
- sample resolution if round-specific
- allowed piece/material types if required
- load-test configuration if round-specific
- any other difficulty parameter

Example conceptual configuration:

{
    id: 1,

    leftCliff: {
        x: ...,
        y: ...
    },

    rightCliff: {
        x: ...,
        y: ...
    },

    fixedVertices: [
        { x: ..., y: ... },
        { x: ..., y: ... }
    ],

    budget: ...,

    buildTimeSeconds: ...,

    sampleResolution: ...,

    loadTest: [...]
}

The exact numerical values will be finalized separately.

Do NOT hardcode round-specific values inside:
- graph.js
- physics.js
- loadtest.js
- UI modules

==================================================
8. THREE ROUNDS
==================================================

There are exactly THREE competition rounds.

Difficulty increases between rounds.

Difficulty can change through:
- different cliff gaps
- different cliff depths/heights
- increasingly difficult geometry
- stricter budget and/or time constraints
- harder load tests

All numerical values must be configurable in round-config.js.

Do NOT invent final competition values without clearly marking them
as placeholders.

==================================================
9. BUILDING A PIECE
==================================================

A player enters an equation.

The equation must be safely parsed/validated.

NEVER execute arbitrary JavaScript from user input.

The player specifies:
- equation
- variable/orientation if necessary
- domain/range
- piece type

For example:

y = f(x)

or, where supported:

x = f(y)

The equation is sampled at a defined resolution.

Example:

resolution = 0.5

produces:

P0, P1, P2, ... Pn

These become logical geometry vertices.

Adjacent sampled vertices form logical edges.

IMPORTANT:

Rendering and logical geometry MUST use the SAME sampled points.

Do not create one geometry for rendering and another geometry
for the bridge graph.

==================================================
10. X/Y ORIENTATION
==================================================

The wireframe indicates that the user should be able to switch
between x and y based equation orientation.

The UI should support the appropriate orientation control.

For example:

y = f(x)

OR

x = f(y)

The visual equation input should make the current orientation clear.

Switching orientation should be handled as a proper UI state change,
not as an unrelated duplicate implementation.

The exact animation/visual transition can follow the wireframe.

==================================================
11. ROAD
==================================================

Road is ALSO equation-defined.

There must NOT be a separate freehand road-building system.

A road is another equation-defined piece with a different gameplay
and physics role.

The road:
- is plotted on the graph
- is sampled
- creates logical nodes/edges
- connects to the bridge structure
- provides the path for vehicles

During BUILD PHASE, road geometry is purely logical/rendered.

During TEST PHASE, the finalized road geometry is converted into
physics objects.

Do not fake the road visually while using a different invisible
path for vehicle movement.

The vehicle must interact with the actual finalized road geometry.

==================================================
12. LOGICAL GRAPH STRUCTURE
==================================================

Use a clear data model.

Conceptually:

Graph
 ├── canonicalVertices
 ├── edges
 ├── pieces
 └── fixedVertices

Piece:

{
    id,
    type,
    equation,
    orientation,
    domain,
    sampledPoints,
    vertexIds,
    edgeIds,
    cost
}

Canonical Vertex:

{
    id,
    x,
    y,
    fixed,
    connectedEdges
}

The exact implementation may differ,
but the separation must remain.

==================================================
13. PHYSICS ARCHITECTURE
==================================================

The physics system must consume the FINAL logical graph.

Suggested flow:

FINAL GRAPH
    ↓
PhysicsBridgeBuilder
    ↓
Create one physics body per canonical vertex
    ↓
Create one constraint/member per logical edge
    ↓
Create road physics
    ↓
Create load/vehicle
    ↓
Run simulation

Physics-specific code should be isolated.

Possible structure:

physics/
    physics-world.js
    physics-bridge-builder.js
    physics-body-factory.js
    physics-constraints.js
    physics-load.js
    physics-simulation.js
    failure-detector.js

Do not allow UI code to directly manipulate physics internals.

Do not allow equation parser code to directly create physics bodies.

==================================================
14. PHYSICS
==================================================

Required physics behaviour:

- gravity
- fixed/static support vertices
- movable bridge vertices
- structural constraints/elements
- road elements
- load/vehicle bodies
- collision handling where necessary
- deformation
- failure/break detection
- deterministic simulation
- resettable simulation
- ability to inspect simulation state

==================================================
PHYSICS LIBRARY DECISION
==================================================

Do NOT automatically choose Matter.js or another physics engine
just because it is familiar.

During PHASE 0, evaluate the physics requirements and determine
whether the game should use:

A. an existing browser physics engine, OR
B. a small custom structural simulation/constraint solver.

The decision must consider:
- bridge structure as a graph of connected nodes
- deformation
- structural failure
- fixed support vertices
- road physics
- vehicle loads
- deterministic simulation
- browser performance
- implementation complexity
- controllability for competition gameplay

Do NOT implement the physics engine during the audit.

Document the recommended approach in:

docs/PROJECT_AUDIT.md

The recommendation must include:
- chosen approach
- why it is appropriate
- major alternatives considered
- risks
- how it satisfies the one-logical-vertex = one-physics-body
  requirement

Do not introduce a large physics dependency without justification.
==================================================
15. FIXED SUPPORTS
==================================================

Round configuration provides fixed support vertices.

These are ground/cliff anchor points.

When physics begins:

fixed logical vertex
        ↓
static/fixed physics body

A fixed vertex MUST remain fixed throughout the simulation.

The fixed status belongs to the logical vertex/configuration.

It must not depend on UI state.

==================================================
16. BRIDGE FAILURE
==================================================

Bridge failure must be explicit and deterministic.

Possible failure conditions include:
- structural member exceeding allowable stress/strain
- constraint exceeding breaking extension
- critical road failure
- bridge disconnecting from required supports
- vehicle falling
- excessive deformation if configured

Create a central failure detector.

Example:

{
    failed: true,
    reason: "BEAM_BREAK",
    pieceId: ...,
    edgeId: ...,
    time: ...
}

Physics reports failure to game logic.

Game logic decides what happens next.

==================================================
17. LOAD TEST
==================================================

After the BUILD PHASE ends, the complete logical bridge is converted
into physics and enters TEST MODE.

There are EXACTLY FIVE load-test stages.

Each stage contains a configured set of cars/vehicles.

Different stages can vary:
- number of cars
- vehicle weight
- spacing
- speed
- timing
- vehicle arrangement
- other difficulty parameters

The exact values belong in configuration.

Example:

loadStages: [
    {
        id: 1,
        vehicles: [
            { weight: ..., ... },
            { weight: ..., ... }
        ]
    },
    ...
]

Stage 1 is easiest.

Stage 5 is hardest.

If the bridge fails during a stage:
- stop the load test
- mark that stage as failed
- do not continue to later stages
- final result = number of successfully completed stages

If all five pass:

5/5

==================================================
18. LOAD TEST STAGE PROGRESSION
==================================================

The load test is sequential.

Stage 1
   ↓
Stage 2
   ↓
Stage 3
   ↓
Stage 4
   ↓
Stage 5

A successful stage must complete before the next begins.

The bridge should NOT be rebuilt between stages unless explicitly
specified by configuration.

The accumulated state/deformation must be handled consistently
according to the chosen physics model.

If the bridge fails:

TEST STOPPED

and the result is the number of stages passed before failure.

==================================================
19. LOAD TEST RESULT
==================================================

Primary result:

NUMBER OF STAGES PASSED / 5

Examples:

0/5
1/5
2/5
3/5
4/5
5/5

Additional diagnostics may be displayed:
- failed stage
- failure reason
- time of failure
- budget used
- remaining budget
- deformation/stress diagnostics where useful

But the primary competition result is stages passed.

==================================================
20. BUDGET
==================================================

The player has a finite construction budget.

Unlimited construction is NOT allowed.

Every piece has a deterministic cost.

A configurable default may be:

piece cost = costPerUnit × geometric piece length

The exact formula must be centralized.

Budget must be checked BEFORE committing a piece.

If unaffordable:
- do not add the piece
- do not partially add it
- show an error
- leave the existing bridge unchanged

Deleting a piece must correctly update budget according to the
chosen game rule.

Avoid floating-point accumulation errors.

==================================================
21. BUILD TIMER
==================================================

Each round has a build-time limit.

The timer starts when the BUILD PHASE starts.

The timer stops when:
- player starts testing
OR
- time expires

If time expires:
- disable construction
- apply the configured round rule for submission/testing

Only ONE timer may exist for the active round.

Resetting/restarting a round must not create duplicate timers.

==================================================
22. UI / WIREFRAME
==================================================

I have provided a wireframe for the game screen.

The wireframe is the visual/interaction reference.

Do NOT reproduce the old C# BridgeBuilder developer UI.

The final player-facing UI should be based on the supplied wireframe.

The wireframe shows approximately this flow:

INITIAL GAME SCREEN:

- round indicator
- time remaining
- total budget
- budget used
- budget remaining
- coordinate/grid background
- left cliff/ground
- right cliff/ground
- bridge construction gap
- vehicle/load visual context
- game environment

The grid should extend throughout the map/background.

When the player begins the construction interaction:

1. left ground/cliff opacity changes/decreases
2. construction controls appear on/near the left ground
3. build timer starts

The equation/piece controls should visually belong to the construction
area rather than looking like developer/debug controls.

The wireframe shows controls conceptually such as:

Equation:
y = f(x)

orientation switch:
x / y

piece/material selection:
- Steel
- Wood
- Concrete

[Plot]

The exact visual design can be improved while preserving the intended
wireframe interaction and hierarchy.

Do not expose internal controls such as:
- gravity checkbox
- pause simulation checkbox
- show stress checkbox
- physics solver settings

Those are internal systems.

==================================================
23. WIRE FRAME INTERACTION DETAILS
==================================================

The supplied wireframe also indicates:

- construction UI appears from the left side/ground
- equation input is the main interaction
- x/y orientation can be switched
- material/piece selection is visible
- Plot commits the equation-defined piece
- the bridge is drawn onto the coordinate system
- vehicles/load-testing occurs after construction
- the right-side character/environment can provide feedback/dialogue
- the expression/character becomes happier as stages are successfully
  completed

The character/dialogue system should be implemented in a modular way
so dialogue can be changed without modifying bridge physics.

Do not overengineer dialogue at the beginning.

==================================================
24. CHARACTER / FEEDBACK
==================================================

The wireframe contains a character referred to as:

Brij Bhushan

This character can provide contextual feedback/dialogue.

The character may change expression/state as the player progresses.

For example:

Build start
    ↓
neutral expression

Stage passed
    ↓
happier expression

More stages passed
    ↓
progressively happier expression

The exact artwork/dialogue can be added after core gameplay works.

Do NOT let the character system become coupled to physics internals.

It should receive high-level game events such as:

ROUND_STARTED
PIECE_ADDED
TEST_STARTED
STAGE_PASSED
STAGE_FAILED
ROUND_COMPLETED

==================================================
25. GAME FLOW
==================================================

The existing project already has:

LOGIN PAGE
      ↓
STAGE PAGE
      ↓
GAME PAGE

Preserve this overall flow.

New flow:

Login
  ↓
Stage/Round Selection
  ↓
Round Intro
  ↓
Build Phase
  ↓
Test Phase
  ↓
Round Result
  ↓
Next Round
  ↓
Final Result

The game page begins after stage selection.

Do not destroy working login/stage functionality unless necessary.

==================================================
26. BUILD PHASE STATE
==================================================

BUILDING means:

- equations can be entered
- pieces can be added/deleted
- graph is editable
- budget is active
- timer is active
- logical graph is active
- NO physics simulation is running
- NO physics bodies have been created

This state is purely construction.

==================================================
27. TEST PHASE STATE
==================================================

TESTING means:

- construction is locked
- logical graph is finalized
- physics world is created exactly once for this test
- one physics body exists for each canonical logical vertex
- constraints are created from logical edges
- gravity begins
- load test begins
- bridge is no longer editable

Do not allow equation editing while testing.

==================================================
28. STATE MANAGEMENT
==================================================

Use one central game state.

Example:

BUILDING
TESTING
ROUND_RESULT
GAME_COMPLETE

GameController/GameState owns transitions.

UI modules must NOT independently decide game state.

Example:

BUILDING
    ↓
TESTING
    ↓
ROUND_RESULT
    ↓
BUILDING / next round

Invalid transitions must be prevented.

==================================================
29. BUILD TRANSACTION
==================================================

Adding a piece is an atomic operation.

Order:

1. validate equation
2. validate orientation
3. validate domain/range
4. sample geometry
5. validate sampled points
6. validate construction bounds
7. resolve endpoint connectivity
8. determine canonical vertices
9. calculate cost
10. check budget
11. commit logical piece
12. update graph
13. update rendering
14. update budget

If ANY validation fails:

NOTHING is committed.

There must be no partially-created piece.

==================================================
30. IMPORTANT: NO PHYSICS DURING BUILD TRANSACTION
==================================================

The build transaction MUST NOT:
- create Matter.js bodies
- create physics constraints
- run gravity
- run collision detection
- modify the physics world

Physics is completely separate.

After the final bridge is submitted:

logical graph
    ↓
validate complete bridge
    ↓
create physics world
    ↓
create bodies once
    ↓
create constraints
    ↓
start simulation

==================================================
31. COMPLETE BRIDGE FINALIZATION
==================================================

Before physics creation, run a final validation.

Check:
- required supports connected
- road exists
- road reaches required locations
- no invalid geometry
- no disconnected critical structure
- budget valid
- all canonical vertices valid
- all edges valid

If validation fails:
- do not create physics
- show the exact problem
- return to BUILDING

Only a valid finalized graph enters TESTING.

==================================================
32. EQUATION SAFETY
==================================================

NEVER use:

eval(userInput)

or unrestricted:

new Function(...)

for arbitrary player equations.

Use a safe mathematical-expression parser or controlled grammar.

Allowed operations can include:

+
-
*
/
^
sqrt
sin
cos
tan
abs
log
exp

and constants:

pi
e

Only allow known identifiers.

Reject:
- JavaScript statements
- arbitrary code
- object access
- global variables
- function definitions
- malicious expressions

Handle:
- NaN
- Infinity
- discontinuities
- undefined regions
- huge values
- excessive sample counts

Provide user-friendly errors.

==================================================
33. COORDINATE SYSTEM
==================================================

The game uses WORLD COORDINATES.

Physics and logical graph operate in world coordinates.

Rendering converts:

WORLD
  ↓
camera/viewport transformation
  ↓
SCREEN

Do NOT use screen pixels as physics coordinates.

This is necessary because rounds have different spans/depths.

The coordinate grid should visually match the wireframe.

==================================================
34. SAMPLING
==================================================

Sampling must be deterministic.

Given:

equation
orientation
range
resolution

the same input must always generate the same points.

Handle:
- NaN
- Infinity
- discontinuities
- extreme values
- out-of-bounds values

Set configurable:
- maximum samples
- minimum resolution
- maximum resolution
- coordinate bounds

Do not allow a pathological equation to freeze the browser.

==================================================
35. PERFORMANCE
==================================================

Keep the game responsive.

Avoid thousands of DOM elements.

Use Canvas/SVG appropriately.

Do not create physics bodies during every render frame.

Do not rebuild the physics world every frame.

Separate:

rendering
game logic
physics

Use requestAnimationFrame appropriately.

==================================================
36. PHYSICS CALIBRATION
==================================================

The C# BridgeBuilder physics is only a behavioural reference.

Do NOT assume its numerical parameters should be copied.

The new physics must be stable and game-friendly.

Centralize:

- gravity
- stiffness
- damping
- breaking threshold
- vehicle mass
- vehicle radius
- solver iterations
- fixed timestep
- road properties

Avoid magic numbers.

==================================================
37. DETERMINISTIC PHYSICS
==================================================

Use a fixed physics timestep.

Do not make simulation behaviour depend directly on frame rate.

Conceptually:

real time
   ↓
accumulator
   ↓
fixed physics steps
   ↓
render

The same bridge and load test should produce substantially the
same result on repeated runs.

==================================================
38. OLD PROJECT
==================================================

The previous project exists only under:

reference/old-project/

It is READ-ONLY.

It must never be modified as part of implementation.

Use it to understand:
- existing gameplay
- login/stage/game flow
- useful UI
- equation concepts
- budget concepts
- round concepts
- load-test concepts

Do not copy its architecture automatically.

Especially do not copy its physics.js or loadtest.js implementation
without first understanding and addressing the problems identified
during the audit..

Inspect it to understand:
- login/stage/game flow
- graph concepts
- equation pieces
- budget
- round configuration
- load testing
- useful UI

Especially inspect:
- physics.js
- loadtest.js

Identify their problems before reusing anything.

If old code conflicts with this prompt:

THIS PROMPT WINS.

Do not copy old physics bugs.

==================================================
39. TESTING REQUIREMENT — CRITICAL
==================================================

We previously made the mistake of implementing one feature on top of
another feature that already contained a bug.

That caused debugging to become extremely difficult.

DO NOT DO THIS.

Development MUST happen incrementally.

PHASE 0
Audit old project.

TEST.

PHASE 1
Create clean project skeleton.

TEST.

PHASE 2
Equation parser.

TEST.

PHASE 3
Equation sampler.

TEST.

PHASE 4
Logical graph + canonical vertex connectivity.

TEST.

PHASE 5
Graph rendering.

TEST.

PHASE 6
Piece add/delete/budget.

TEST.

PHASE 7
Build-phase UI integration.

TEST.

PHASE 8
Final graph validation/finalization.

TEST.

PHASE 9
Convert finalized graph into physics:
- one body per canonical vertex
- one constraint/member per logical edge

TEST.

PHASE 10
Basic gravity simulation.

TEST.

PHASE 11
Road physics.

TEST.

PHASE 12
Vehicle/load.

TEST.

PHASE 13
Five-stage load test.

TEST.

PHASE 14
Timer.

TEST.

PHASE 15
Round progression.

TEST.

PHASE 16
Character/dialogue feedback.

TEST.

PHASE 17
Complete UI polish.

TEST.

PHASE 18
Login → stage → game integration.

TEST.

PHASE 19
Full end-to-end test.

==================================================
40. TEST GATE RULE
==================================================
The codebase must make this separation explicit.

There must be no code path in the BUILDING state that creates a
physics body or physics constraint.

A build operation must be possible even if the physics engine has
not been initialized.

The logical graph must be fully usable and testable without a
physics world.

This separation is mandatory because physics is created only after
the bridge construction is finalized.
After EVERY phase:

1. Explain what was implemented.
2. Give exact files changed.
3. Run available tests.
4. Check browser console.
5. Check module/import errors.
6. Check runtime errors.
7. Verify relevant gameplay behaviour.
8. Only then proceed.

If a test fails:

STOP.

Fix the failure before implementing the next phase.

Never knowingly build on top of a failing phase.

==================================================
41. REQUIRED AUTOMATED TESTS
==================================================

EQUATION PARSER:
- valid equation
- invalid syntax
- malicious input
- unknown function
- division by zero

SAMPLER:
- y=x
- constant function
- negative coordinates
- x=f(y)
- invalid range
- discontinuity
- maximum sample limit

GEOMETRY:
- distance
- length
- endpoint detection
- snapping
- near-equal floating-point coordinates

GRAPH:
- fixed vertex
- piece connection
- piece-to-piece connection
- shared endpoint
- canonical vertex merging
- duplicate connection
- disconnected piece

CRITICAL CONNECTIVITY TEST:

If:

Piece A ends at (10,5)
Piece B starts at (10.000001,5)

and the difference is within SNAP_TOLERANCE:

EXPECTED:

one canonical logical vertex

NOT:

two logical vertices

and later:

one physics body

NOT:

two physics bodies.

PHYSICS:

- fixed vertices remain fixed
- each canonical vertex creates exactly one body
- connected pieces share the same body at a junction
- bridge deforms
- beam failure is detected
- physics reset works

BUILD/PHYSICS SEPARATION:

During BUILDING:

EXPECTED:
physics body count = 0

After TEST begins:

EXPECTED:
physics body count = number of canonical logical vertices

This is a mandatory architectural test.

BUDGET:
- cost
- affordable piece
- unaffordable piece
- deletion/refund
- round reset

LOAD TEST:
- stage 1 pass
- stage failure
- stop after failure
- all 5 pass
- multiple vehicles
- different weights

TIMER:
- starts once
- decrements
- expires once
- stops
- reset does not duplicate timers

ROUND FLOW:
- round 1
- round 2
- round 3
- final result
- restart/reset

==================================================
42. ERROR HANDLING
==================================================

Never allow:
- uncaught runtime errors
- undefined imports
- NaN propagation
- duplicate vertices
- duplicate physics bodies
- duplicate event listeners
- invalid budget
- duplicate timers
- invalid physics constraints

During development errors must be visible and descriptive.

==================================================
43. CODE ORGANIZATION
==================================================

Use a clean modular structure.

Suggested:

/project
    index.html

    /css
        base.css
        game.css
        components.css

    /js
        main.js

        /core
            game-state.js
            game-controller.js
            event-bus.js

        /config
            round-config.js
            load-config.js

        /builder
            equation-parser.js
            sampler.js
            piece.js
            piece-manager.js
            graph-model.js
            connection-manager.js
            graph-validator.js

        /physics
            physics-world.js
            physics-bridge-builder.js
            physics-body-factory.js
            physics-constraints.js
            physics-load.js
            physics-simulation.js
            failure-detector.js

        /testing
            load-test.js
            stage-runner.js

        /economy
            budget.js
            cost-calculator.js

        /ui
            hud.js
            equation-panel.js
            game-screen.js
            result-panel.js
            character.js
            notifications.js

        /utils
            geometry.js
            math.js
            constants.js

Do not follow this structure blindly if a better architecture is justified.

But maintain clear separation of responsibility.

==================================================
44. TOKEN EFFICIENCY
==================================================

Use targeted searches, don't reread unchanged files, don't dump code into chat, etc

Therefore:

- Do not repeatedly restate requirements.
- Do not explain obvious code line-by-line unless asked.
- Keep progress reports concise.
- Inspect only relevant files.
- Do not repeatedly read the entire repository.
- Make targeted changes.
- Do not rewrite files unnecessarily.
- Do not generate speculative alternatives.
- Prefer one correct implementation.

Use concise progress reports:

PASS:
- equation parser
- sampler
- graph connectivity

FAIL:
- canonical vertex test

NEXT:
- fix connectivity before physics integration

==================================================
45. DO NOT PRETEND SOMETHING WORKS
==================================================

If something was not actually tested, say so.

Never say:

"Everything works"

unless it was actually verified.

Distinguish:

TESTED AND PASSED

from:

IMPLEMENTED BUT NOT VERIFIED

If browser execution/testing is available, use it.

If not, provide reproducible test instructions and clearly state
what remains unverified.

==================================================
==================================================
46. AGENTIC DEVELOPMENT WORKFLOW
==================================================

You are working directly inside the repository.

When a phase is approved, YOU make the changes directly.

Do not respond with large code blocks for me to manually copy.

Do not ask me to create files that you are capable of creating.

Do not ask me to manually modify code that you can modify yourself.

Use the repository as the working environment.

However, development is strictly PHASE-GATED.

Never implement future phases before the current phase has passed
its tests.

==================================================
PHASE 0 — AUDIT
==================================================

The first task is AUDIT ONLY.

DO NOT implement the game yet.

Inspect:

1. reference/old-project/
2. reference/wireframe.png
3. existing repository files
4. relevant external reference material where available

Specifically inspect the old:
- physics.js
- loadtest.js
- graph-related code
- equation-related code
- piece/material code
- round configuration
- login page
- stage page
- game page
- budget system
- timer
- load-test logic

Determine:

1. Existing architecture
2. Reusable concepts
3. Code that should NOT be reused
4. Problems in old physics.js
5. Problems in old loadtest.js
6. New architecture
7. Build-phase architecture
8. Physics-phase architecture
9. Logical graph architecture
10. Canonical vertex/connectivity strategy
11. Logical graph → physics conversion
12. UI architecture based on wireframe
13. Physics-engine recommendation
14. Testing strategy
15. Implementation phases

Create:

docs/PROJECT_AUDIT.md

Do not modify reference/old-project/.

Do not build the game yet.

After the audit is complete:
STOP and report the audit summary.

Wait for explicit approval:

"Start Phase 1."

==================================================
PHASE APPROVAL RULE
==================================================

When I say:

"Start Phase N"

implement ONLY that phase.

After implementation:

1. Run relevant automated tests.
2. Run the application where applicable.
3. Check browser console/runtime errors where possible.
4. Verify the phase's acceptance criteria.
5. Fix failures before reporting completion.
6. Report:
   - files created/modified
   - tests run
   - tests passed
   - tests failed
   - anything not verified

Then STOP.

Do NOT automatically start the next phase.

==================================================
FAILURE RULE
==================================================

If a test fails:

STOP progression.

Fix the problem.

Run the relevant tests again.

Do not implement the next phase while the current phase is failing.

Never knowingly build new functionality on top of a failing foundation.



==================================================
GIT WORKFLOW
==================================================

Use Git to maintain safe checkpoints.

Before making major changes:
- inspect git status
- do not overwrite unrelated user changes

After a phase has passed its required tests:

Create a Git commit with a concise message.

Example:

feat: implement canonical bridge graph

Do NOT commit known-broken work as a completed phase.

Never reset, delete, or overwrite unrelated user changes without
explicit permission.

If the repository does not have Git initialized, do not initialize
or alter Git configuration unless necessary and safe.


==================================================
47. FINAL ACCEPTANCE CRITERIA
==================================================

The final game is complete only when:

1. Browser opens the game.
2. Login page works.
3. Stage page works.
4. Correct round configuration loads.
5. Correct cliffs/fixed vertices appear.
6. Coordinate grid works.
7. Build UI follows the wireframe.
8. Equation can be entered.
9. Equation is safely parsed.
10. Equation is sampled.
11. Sampled geometry becomes logical graph geometry.
12. Pieces connect through canonical vertices.
13. Connected pieces share ONE canonical vertex.
14. No physics bodies exist during BUILDING.
15. Budget works.
16. Build timer works.
17. Bridge finalization works.
18. Final logical graph is converted into physics.
19. Exactly one physics body is created per canonical vertex.
20. Fixed support bodies remain fixed.
21. Bridge deforms correctly.
22. Bridge failure is detected.
23. Road participates in physics/load testing.
24. Five load-test stages work.
25. Vehicle weights work.
26. Testing stops on bridge failure.
27. Correct stages-passed result is shown.
28. Round 2 works.
29. Round 3 works.
30. Difficulty increases correctly.
31. Character feedback works.
32. Final result works.
33. No console errors.
34. No duplicate event listeners.
35. No duplicate physics bodies.
36. No duplicate timers.
37. Game survives page refresh/restart.
38. Complete flow works:

LOGIN
  ↓
STAGE
  ↓
ROUND 1
  ↓
BUILD
  ↓
FINALIZE
  ↓
PHYSICS
  ↓
5-STAGE LOAD TEST
  ↓
ROUND RESULT
  ↓
ROUND 2
  ↓
ROUND 3
  ↓
FINAL RESULT

The goal is NOT to make a quick demo.

The goal is a stable, complete, browser-running Technothlon
competition game.