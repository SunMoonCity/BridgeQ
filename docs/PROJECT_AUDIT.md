# Bridge Building Game — Project Audit & Architectural Specification (Phase 0)

**Date**: 2026-08-28  
**Project**: Technothlon Bridge-Building Competition Game  
**Status**: Phase 0 Complete — Awaiting Approval for Phase 1  

---

## Executive Summary

This document fulfills the requirements of **Phase 0 (Audit)** as defined in `CLAUDE.md` and the accompanying `wire framework clarification.md`. The objective of this audit is to thoroughly examine the existing reference codebase (`reference/old-project/`), the visual specification in the wireframe (`reference/wireframe.png` / `wire framework bridge game.jpeg`), evaluate physics engine options, define the clean architecture for the new modular web application, and establish a strict verification and phase-gated implementation plan.

---

## 1. Existing Architecture Analysis

The reference project in `reference/old-project/spanfix/technothlongame/` consists of a vanilla JavaScript ES-module setup with JSXGraph (`jsxgraphcore.js`) and Matter.js (`matter.min.js`).

### Old Component Breakdown:
* **`index.html`**: Basic DOM structure with a JSXGraph container (`#jxgbox`), inline build controls (inputs, material dropdown, orientation dropdown), and a HUD.
* **`main.js`**: Functions as a conductor for round progression, wiring `graph.js`, `piece.js`, `budget.js`, `timer.js`, and `loadtest.js`.
* **`graph.js`**: Manages JSXGraph board rendering, curve plotting, selection, delete flow, and event listening. It couples UI events, JSXGraph object management, and budget charges.
* **`piece.js`**: Handles equation parsing via `new Function()`, sampling, and structure connectivity checks with an array-rebuilding mechanism upon piece deletion.
* **`materials.js`**: Data dictionary specifying elasticity, tensile/compression strength, brittleness, and cost per unit for plastic, steel, and iron.
* **`budget.js`**: Ledger tracking spent budget and per-piece arc length cost calculations.
* **`timer.js`**: Simple `setInterval` countdown timer with `onTick` and `onExpire` callbacks.
* **`physics.js`**: Wraps Matter.js. Creates static anchors for cliffs/ground and builds constraint networks by creating circle bodies for every sampled point.
* **`loadtest.js`**: Synchronously simulates 5 stages of car loads across the bridge in a blocking loop, forcibly overriding body velocities on each tick.

---

## 2. Reusable Concepts

From the reference project, the following core mathematical and game-design concepts are sound and will be adapted into the new architecture:

1. **Mathematical Bridge Definition**: Expressing bridge members and road decks via mathematical functions ($y = f(x)$ and $x = f(y)$) sampled over a bounded domain/range.
2. **Arc Length Cost Model**: Approximating piece cost via sampled Euclidean segment lengths:
   $$\text{Length} = \sum_{i=1}^{n} \sqrt{(x_i - x_{i-1})^2 + (y_i - y_{i-1})^2}, \quad \text{Cost} = \text{Length} \times \text{CostPerUnit}$$
3. **Sequential Staged Load Testing**: 5-stage progressive load test with escalating car counts, weights, and spawn frequencies.
4. **Three-Round Difficulty Progression**:
   * Round 1: Equal cliff heights, fixed material, generous/unlimited budget.
   * Round 2: Equal cliff heights, multiple materials, strict budget.
   * Round 3: Asymmetric cliff heights (differential elevation), strict budget.
5. **Separation of Timer Engine from DOM**: Keeping timer logic pure with event callbacks.

---

## 3. Code That Must NOT Be Reused

The following legacy patterns and implementations are fundamentally flawed and **MUST NOT** be used in the new project:

1. **`new Function(...)` Equation Parsing**:
   * *Problem*: Insecure, prone to code injection, lacks syntax tree inspection, fails on common mathematical notation (e.g., `^` for exponentiation, implicit multiplication like `2x`), and yields poor error reporting.
   * *Replacement*: A secure, sandboxed mathematical expression parser (Tokenizer + Abstract Syntax Tree / Shunting-yard evaluator) supporting standard operators (`+`, `-`, `*`, `/`, `^`), functions (`sin`, `cos`, `tan`, `sqrt`, `abs`, `log`, `exp`), and constants (`pi`, `e`).
2. **JSXGraph Coupling**:
   * *Problem*: JSXGraph is an external heavyweight charting library that interferes with custom gaming interactions, animated deformation, camera scaling, wireframe styling, and vehicle rendering.
   * *Replacement*: A clean, high-performance HTML5 2D Canvas rendering engine operating strictly on World Coordinates with a Viewport/Camera transformation matrix.
3. **Synchronous Blocking Simulation Loop in `loadtest.js`**:
   * *Problem*: The old `runLoadTest` executed up to 3,000 ticks in a single synchronous `for` loop, freezing the browser UI and making live visual simulation of vehicles crossing impossible.
   * *Replacement*: An asynchronous, tick-driven physics loop synchronized with `requestAnimationFrame` and a fixed-step accumulator, with live visual feedback and diagnostic event emission.
4. **Ad-hoc Piece Point Body Caching in `physics.js`**:
   * *Problem*: String-based keys (`"${x.toFixed(2)},${y.toFixed(2)}"`) with arbitrary circle bodies created on the fly during piece iteration. No formal graph representation prior to physics instantiation.

---

## 4. In-Depth Analysis of Problems in Old `physics.js`

1. **Geometric Overlap of Joint Bodies**:
   * Points are sampled at resolution $0.5$, and for every point a Matter.js circle of radius $3$ was created. This caused consecutive circles to overlap by $5.5$ units.
   * To prevent explosive solver repulsion, the old code hacked `collisionFilter: { group: -1 }`. This disabled structure-to-structure collisions but caused unpredictable drift, solver instabilities, and weird artifact forces.
2. **Inverted Gravity & Coordinate Confusion**:
   * Matter.js defaults to screen coordinates ($+y$ downwards). The old code set `gravity.y = -1` while creating static platform rectangles and circle anchors. This caused subtle coordinate misalignment between visual rendering and physics calculations.
3. **Arbitrary Break Threshold Formula**:
   * Old code: `constraint.breakThreshold = ((tensile + compression) / 2) * (1 - brittleness / 100)`.
   * Stretches were measured in raw unit displacement rather than engineering strain ($\Delta L / L_0$) or axial force ($F = k \Delta L$). This caused longer bridge segments to break much more easily than shorter segments with the same curvature.
4. **Lack of Road Contact Surface**:
   * The old code had no actual road surface or deck; vehicles simply bounced over an array of overlapping circular joint nodes, leading to rough, jittery motion.
5. **No Strict Separation from Build State**:
   * `initWorld` and body creation were coupled to piece arrays rather than an immutable, validated logical graph.

---

## 5. In-Depth Analysis of Problems in Old `loadtest.js`

1. **Velocity Override Hack**:
   * In each tick, the old code forcibly reset the horizontal velocity: `Matter.Body.setVelocity(car.body, { x: direction * CAR_SPEED / 60, y: car.body.velocity.y })`.
   * This completely overrode physics integration, momentum, traction, and slope resistance, making cars behave like kinematic sliders rather than physical loads exerting dynamic weight on the bridge.
2. **Brittle End-of-Span Detection**:
   * `hasCrossed` checked `car.body.position.x >= span.endX && car.body.position.y >= span.endY`. If a bridge sagged below `span.endY` at the landing point, the car would never be marked as crossed, resulting in an artificial timeout failure.
3. **Absence of Real-Time Animation**:
   * The entire 5-stage test ran inside a single Javascript call stack frame. The player could only see a post-test text summary, not the bridge deforming, groaning under stress, or collapsing dynamically.
4. **No Bridge State Continuity or Stress Reporting**:
   * If a stage passed, there was no real-time telemetry on max stress percentage, sag deflection, or vehicle status.

---

## 6. Target New System Architecture

The new architecture is organized into strict, decoupled layers:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                               UI LAYER                                  │
│  HUD (Budget, Timer, Round)  │  Equation Input & Orientation Panel     │
│  Canvas Viewport (Grid, World) │  Character System (Brij Bhushan)        │
│  Modal / Stage / Login Flow  │  Results & Telemetry Panel               │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Events / State Dispatches
┌────────────────────────────────────▼────────────────────────────────────┐
│                        CORE GAME STATE CONTROLLER                       │
│  State Machine: LOGIN → STAGE_SELECT → ROUND_INTRO → BUILDING           │
│                 → FINALIZING → TESTING → STAGE_RESULT → ROUND_SUMMARY   │
└──────────────┬───────────────────────────────────────────┬──────────────┘
               │                                           │
┌──────────────▼─────────────────────────┐  ┌──────────────▼──────────────┐
│          BUILD PHASE SUBSYSTEM         │  │    PHYSICS / TEST SUBSYSTEM │
│  - Equation Lexer & AST Parser         │  │  - Physics World & Bodies   │
│  - Adaptive / Fixed Sampler            │  │  - Structural Truss Solver  │
│  - Canonical Graph Model               │  │  - Road Contact Model       │
│  - Spatial Vertex Snapper (Snap Tol)   │  │  - Fixed Timestep Loop      │
│  - Cost & Budget Validator             │  │  - Failure Detector         │
│  - Graph Integrity Validator           │  │  - 5-Stage Load Test Runner │
└────────────────────────────────────────┘  └─────────────────────────────┘
```

---

## 7. Build-Phase Architecture

* **Strict Invariant**: During `BUILDING`, **ZERO physics bodies, constraints, or simulation worlds exist**.
* **Atomic Build Transaction**:
  1. **Parse**: Equation text $\to$ AST. Validate variables ($x$ or $y$), operators, and syntax.
  2. **Range Check**: Validate $\text{min} < \text{max}$, ensure interval falls within allowable round construction boundaries.
  3. **Sample**: Compute continuous $(x_i, y_i)$ sample points deterministically at configured resolution.
  4. **Snap & Canonicalize**: For each sampled point, query spatial registry within `SNAP_TOLERANCE`. If existing canonical vertex is found, bind to it; otherwise register a new canonical vertex.
  5. **Cost Calculation**: Compute total Euclidean arc length and multiply by material unit cost.
  6. **Budget Check**: If $\text{spent} + \text{cost} > \text{budgetLimit}$, abort transaction and return descriptive error.
  7. **Commit**: Add piece, update canonical vertex adjacency lists, add edges, deduct budget, trigger redraw.
* **Piece Deletion**:
  * Deleting a piece removes its associated edges and unreferenced non-fixed canonical vertices, refunds the exact cost from the ledger, and recalculates structural graph connectivity.

---

## 8. Physics-Phase Architecture

* **Activation Gate**: Physics world is instantiated **only** when the user completes construction and clicks "Test Bridge" (or timer expires) and the complete bridge passes graph finalization validation.
* **Input**: Immutable snapshot of the finalized `LogicalGraph`.
* **Execution**:
  * Fixed timestep integration ($\Delta t = 1/60\text{s} = 16.666\text{ms}$) with accumulator.
  * Real-time stress computation per member:
    $$\text{Stress Ratio} = \frac{|\Delta L / L_0|}{\text{Material Max Strain}}$$
  * Color-coded member stress visualization (green $\to$ yellow $\to$ red $\to$ break).
  * Asynchronous load stage runner yielding execution to `requestAnimationFrame` for smooth 60 FPS rendering.
  * Deterministic vehicle movement using physics contact/wheels over the sampled road mesh.
  * Immediate failure detection: if any structural member snaps or vehicle falls below threshold, test halts, records exact failure reason, and triggers failure sequence.

---

## 9. Logical Graph Architecture

The `LogicalGraph` is the single source of truth for the bridge structure:

```
LogicalGraph
├── canonicalVertices: Map<string, CanonicalVertex>
├── edges: Map<string, LogicalEdge>
├── pieces: Map<string, LogicalPiece>
└── fixedSupportIds: Set<string>
```

### Data Definitions:
* **`CanonicalVertex`**:
  * `id`: Unique identifier (e.g. `v_0`, `v_1`)
  * `x`: World X coordinate (float)
  * `y`: World Y coordinate (float)
  * `isFixed`: Boolean (true for cliff/ground support anchors)
  * `connectedEdgeIds`: Set of edge IDs
  * `connectedPieceIds`: Set of piece IDs
* **`LogicalEdge`**:
  * `id`: Unique identifier (e.g. `e_0_1`)
  * `vertexAId`: Source canonical vertex ID
  * `vertexBId`: Target canonical vertex ID
  * `pieceId`: Owning piece ID
  * `material`: Material identifier (`steel`, `wood`, `concrete`, etc.)
  * `isRoad`: Boolean (true if part of a road deck piece)
  * `restLength`: Initial Euclidean distance $L_0$
* **`LogicalPiece`**:
  * `id`: Integer piece ID
  * `equation`: Raw equation string
  * `orientation`: `'y-of-x'` | `'x-of-y'`
  * `domain`: `[min, max]`
  * `material`: Material key
  * `isRoad`: Boolean
  * `vertexIds`: Ordered array of canonical vertex IDs
  * `edgeIds`: Ordered array of edge IDs
  * `cost`: Number

---

## 10. Canonical Vertex & Connectivity Strategy

* **Snap Tolerance**: `SNAP_TOLERANCE = 0.05` (configurable in world units).
* **Canonical Merging Algorithm**:
  1. When a new point $P(x, y)$ is evaluated, search all existing canonical vertices:
     $$\text{dist}(P, V) = \sqrt{(x - V.x)^2 + (y - V.y)^2}$$
  2. If $\min(\text{dist}) \le \text{SNAP\_TOLERANCE}$, assign point $P$ directly to existing vertex $V$.
  3. If point is within tolerance of a cliff anchor or ground segment, bind to the fixed anchor vertex.
  4. Otherwise, generate a new `CanonicalVertex` and register in the spatial map.
* **Guarantees**:
  * No two canonical vertices exist within `SNAP_TOLERANCE` of each other.
  * Multiple intersecting or touching pieces share the exact same `CanonicalVertex` instance.
  * Eliminates floating-point duplicate vertices and solver seam explosions.

---

## 11. Logical Graph $\to$ Physics Conversion

When testing begins, `PhysicsBridgeBuilder` executes the 1-to-1 conversion:

1. **Vertices $\to$ Bodies**:
   $$\forall V \in \text{CanonicalVertices}: \quad \text{Create exactly ONE Physics Body / Node at } (V.x, V.y)$$
   * If $V.\text{isFixed} = \text{true} \implies \text{Body is Static Anchor}$.
   * If $V.\text{isFixed} = \text{false} \implies \text{Body is Dynamic Mass Node } (m = \sum \text{member masses} / 2)$.
2. **Edges $\to$ Constraints / Structural Members**:
   $$\forall E \in \text{Edges}: \quad \text{Create structural constraint between } \text{Body}(E.vertexAId) \text{ and } \text{Body}(E.vertexBId)$$
   * Elastic stiffness $k$ derived from material Young's modulus / elasticity.
   * Rest length $L_0 = E.\text{restLength}$.
   * Breaking limit derived from tensile/compression yield strength.
3. **Road Assembly**:
   * Sequential road edges are linked into a continuous 2D driveable surface mesh for vehicle wheel collision / contact normal calculation.

---

## 12. UI Architecture Based on Wireframe

Based on `reference/wireframe.png` (`wire framework bridge game.jpeg`) and `wire framework clarification.md`:

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ [Round 1]        Time Remaining: 05:41        Total Budget:    50,00,000      │
│                                               Budget Used:        50,000      │
│                                               Budget Remaining: 49,50,000     │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│        + · · · · · · · · · · · · · · · · · · · · · · · · · · · · · +          │
│        :                                                           :          │
│  [Car] :                                                           :          │
│  ───►  :                                                           :          │
│ ┌──────┴─────┐                                               ┌─────┴────────┐ │
│ │ ┌────────┐ │                                               │              │ │
│ │ │y = f(x)│ │ ◄── [y/x toggle]                             │              │ │
│ │ └────────┘ │                                               │     (◕‿◕)    │ │
│ │ [min][max] │                                               │              │ │
│ │ (o)Steel   │                                               │ Brij Bhushan │ │
│ │ ( )Wood    │                                               │ Dialogue Box │ │
│ │ [ Plot ]   │                                               │              │ │
│ └────────────┘                                               └──────────────┘ │
│ Left Cliff (Low Opacity during Build)                  Right Cliff / Platform │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Key UI Features:
1. **Full-Screen Coordinate Grid**: Seamless world coordinate grid rendered across the entire background canvas.
2. **Smooth Construction Reveal**:
   * Initial State: Landscape visible, construction controls hidden, timer stopped.
   * Start Build: Left cliff ground smoothly reduces opacity, construction input card appears on/near the left cliff, build timer initiates.
3. **Equation Input & Orientation Control**:
   * Interactive switch between $y = f(x)$ and $x = f(y)$ with visual indicator.
   * Clean domain/range inputs ($x_{\min}, x_{\max}$).
   * Material selector radio/cards (Steel, Wood, Concrete / per round config).
   * Action buttons: `[Plot]`, `[Delete Selected]`, `[Test Bridge]`.
4. **Brij Bhushan Character Feedback System**:
   * Right cliff character avatar with reactive facial expressions (Neutral $\to$ Happy $\to$ Cheerful $\to$ Victorious / Stressed $\to$ Crying on collapse).
   * Dialogue bubble displaying contextual hints, competition commentary, and encouragement on high-level game events.

---

## 13. Physics Engine Evaluation & Recommendation

### Comparison of Options:

| Feature / Criterion | Option A: Standard Matter.js | Option B: Custom 2D Structural PBD / Mass-Spring Truss Solver | Option C: Box2D / Rapier2D |
| :--- | :--- | :--- | :--- |
| **Exact 1:1 Vertex-Body Mapping** | Requires circle bodies with collision group hacks | **Native node-constraint graph model** | Rigid bodies with revolute joints (heavy setup) |
| **Beam Stress & Strain Accuracy** | Crude distance constraint stretch | **Direct calculation of Hooke's law / engineering strain** | Multi-body joint reaction calculation |
| **Determinism Across Browsers** | Moderate (iterative impulse solver) | **100% Deterministic (fixed-step Verlet / PBD)** | High, but WASM/JS bundle overhead |
| **Overlapping Joint Explosions** | Severe without collision filters | **Zero (nodes are point masses, not colliding circles)** | Requires filter masks on all joints |
| **Vehicle-Road Interaction** | Rigid body rolling over circle chain (bumpy) | **Smooth continuous segment contact & wheel traction** | Smooth polygon/edge chains |
| **Bundle Size & Dependencies** | ~80 KB minified | **~10 KB pure zero-dependency ES module** | 200 KB - 2 MB (WASM) |
| **Controllability & Debugging** | Black-box engine internals | **Full control over equations, damping, and breaks** | Complex debug pipeline |

### Final Recommendation:
**Option B: Custom 2D Structural Constraint Solver (Position-Based Dynamics / Verlet Mass-Spring with fixed-step integration)** complemented by a dedicated kinematic-dynamic wheel contact vehicle model.

#### Rationale:
1. **Perfect Architectural Alignment**: A truss bridge is fundamentally a network of nodes connected by axial structural members. A custom PBD/Verlet solver naturally maps $1 \text{ canonical vertex} = 1 \text{ mass node}$ and $1 \text{ edge} = 1 \text{ constraint}$, eliminating the collision-overlap bugs and hacks that plagued the old Matter.js implementation.
2. **Real Physical Stress Metrics**: Member strain $\epsilon = \frac{L - L_0}{L_0}$ and axial stress $\sigma = E \cdot \epsilon$ are computed analytically, allowing genuine material physics (yield strength, buckling in compression, snapping in tension, ductile deformation).
3. **Smooth Road Deck Simulation**: Vehicles ride along piecewise linear or spline road segments with continuous wheel-deck normal forces and friction, avoiding the jitter of bouncing over circular physics bodies.
4. **Zero External Dependencies**: Pure browser-compatible ES module with deterministic replay, effortless unit testing in Node/browser, and zero bundle bloat.

---

## 14. Testing Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AUTOMATED TEST SUITE                            │
├───────────────────┬───────────────────┬────────────────────────────────┤
│ 1. Unit Tests     │ 2. Physics Tests  │ 3. End-to-End Browser Tests    │
│ - Equation Lexer  │ - 1:1 Body Map    │ - Login Flow                   │
│ - AST Evaluator   │ - Anchor Fixity   │ - Stage Selection              │
│ - Sampler Bounds  │ - Strain & Break  │ - Equation Plotting            │
│ - Snap Snapping   │ - Vehicle Contact │ - Timer & Budget UI            │
│ - Budget Ledger   │ - 5-Stage Runner  │ - Test Run & 5-Stage Result    │
└───────────────────┴───────────────────┴────────────────────────────────┘
```

### Key Automated Verification Checks:
1. **Equation Safety**: Reject `eval`, `window`, malicious tokens; verify correct computation of polynomials, trigonometry, rational functions.
2. **Canonical Vertex Invariant**:
   * Test: If Piece 1 ends at $(10.0, 5.0)$ and Piece 2 starts at $(10.0001, 5.0)$ within tolerance, assert `canonicalVertices.size === expectedMergedCount`.
3. **Build vs Physics Isolation Invariant**:
   * During `BUILDING`: `physicsBodyCount === 0`.
   * On `TESTING`: `physicsNodeCount === logicalGraph.canonicalVertices.size`.
4. **Load Test Integrity**: Verify stages 1 through 5 execute sequentially, vehicle masses apply load, and any member failure terminates the test immediately with correct score.

---

## 15. Implementation Phase Roadmap

| Phase | Title | Key Deliverables & Test Gates |
| :---: | :--- | :--- |
| **0** | **Audit (Current)** | Complete repository audit, wireframe specification, architecture design, and physics recommendation in `docs/PROJECT_AUDIT.md`. |
| **1** | **Project Skeleton** | Clean ES module directory structure, HTML5 shell, CSS layout, event bus, base state machine. |
| **2** | **Equation Parser** | Safe AST mathematical parser, tokenizer, syntax validator, error formatter. |
| **3** | **Equation Sampler** | Deterministic domain sampling, $y=f(x)$ and $x=f(y)$ support, asymptote/discontinuity guards. |
| **4** | **Logical Graph & Canonical Registry** | Canonical vertex registry, spatial snap tolerance resolver, edge network data model. |
| **5** | **Graph & Canvas Renderer** | Viewport camera, world coordinate grid, crisp member rendering, cliff rendering. |
| **6** | **Piece Operations & Budget** | Add/delete piece transactions, arc length cost calculation, budget ledger, refund logic. |
| **7** | **Build-Phase UI Integration** | Left cliff construction reveal animation, equation input panel, orientation toggle, material picker. |
| **8** | **Graph Validation & Finalization** | Support connectivity check, road continuity validation, pre-flight test gate. |
| **9** | **Physics Conversion Pipeline** | 1:1 Canonical vertex $\to$ node conversion, edge $\to$ structural constraint builder. |
| **10** | **Structural Gravity Simulation** | Fixed timestep Verlet/PBD solver, member tension/compression, gravity, deformation. |
| **11** | **Road Physics & Contact Model** | Driveable road deck assembly, normal force calculation, vehicle wheel contact. |
| **12** | **Vehicle Dynamics** | Vehicle chassis, mass scaling, wheel traction, gravity load on bridge. |
| **13** | **Five-Stage Load Test** | Sequential 5-stage test runner, car spawns, break halt trigger, stages-passed scoring. |
| **14** | **Build Timer System** | Countdown timer, construction phase lock on expiration, UI tick synchronization. |
| **15** | **Round Progression** | Multi-round state progression (Round 1, 2, 3), differential cliff geometry, difficulty scaling. |
| **16** | **Character & Dialogue Feedback** | Brij Bhushan character component, reactive emotion states, contextual dialogue bubbles. |
| **17** | **UI Polish & Visual Polish** | HUD polish, stress heatmap visualization, failure diagnostics modal, responsive styling. |
| **18** | **App Flow Integration** | Login screen $\to$ Stage selection $\to$ Game board $\to$ Results screen. |
| **19** | **End-to-End Verification** | Comprehensive gameplay verification across all 3 rounds, 5 stages each, zero console errors. |

---

## 16. Conclusion & Request for Phase 1 Approval

Phase 0 Audit is complete. The problems of the legacy implementation have been identified, the wireframe interaction flow has been clarified, the logical graph data model and custom structural physics engine have been specified, and the implementation roadmap is defined.

**Current State**: Standing by for user instruction.  
**Next Action**: Upon receiving approval (`"Start Phase 1."`), create the clean project skeleton and test harness.
