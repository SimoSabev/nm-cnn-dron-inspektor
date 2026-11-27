# Concept: Drone Inspector with camera and ultrasound

> Bulgarian version (the main one): [koncepciya.md](koncepciya.md)

## 1. The idea

A drone photographs a facade from exactly 3 m. A neural network finds the tiles with cracks, recursion groups them into zones, and a genetic algorithm plans a re-flight over those zones only, never going below 20 % battery. An engineer then measures how deep the cracks are with a hand-held ultrasonic tester, and the website brings everything together in a report.

Full diagram: the **How it works** page (`web/how.html`).

## 2. Ultrasound: two different jobs

| | On the drone | On site, in the engineer's hands |
|---|---|---|
| Device | Ultrasonic rangefinder, e.g. MaxBotix MB1242 | Ultrasonic pulse velocity (UPV) tester with two probes |
| Measures | Distance to the wall | Time for sound to travel through concrete |
| Used for | Holding 3 m; firing the camera **only** at a steady distance; knowing the real size of a tile | Crack depth (BS 1881-203, Tc–Ts method) and concrete grade by velocity (IS 13311-1) |
| Code | `src/ultrasound.py`: `median_filter`, `is_stable`, `standoff_correction`, `tile_size_m`, `distance_for_tile` | `src/ultrasound.py`: `crack_depth_mm`, `pulse_velocity_kms`, `concrete_quality`, `crack_severity`, `FieldCheck` |
| Website | **Monitor**: raw and filtered readings, "shooting / holding" | **On-site check**: enter Tc, Ts, x; get depth, grade, rating, CSV |

Why not ultrasound through the air to find cracks? Nearly all the sound energy reflects at the air–concrete boundary, so a probe in the air only "sees" the surface. To look inside, the probe has to touch the concrete. That is why depth is measured on site, not from the drone.

Formulas: depth `h = x · √(Tc² − Ts²) / Ts`; velocity `v = L / t` (mm / µs = km/s); grade > 4.5 km/s excellent · 3.5–4.5 good · 3.0–3.5 medium · < 3.0 doubtful.

Limits to state at the defence: the formula assumes an open, dry crack perpendicular to the surface; moisture, rebar near the crack or a slanted crack distort it. Surface velocity is 5–20 % lower than through the member. "Reaches rebar" is a project rule (compared with concrete cover), not a standard; the final call belongs to an engineer.

## 3. What is done (branch `feature/web-ultrazvuk`)

- `src/ultrasound.py` + 19 tests. Existing code is unchanged.
- A bilingual BG/EN website in `web/` with no server and no build: Monitor, Analysis, Route (with a NN vs GA race), On-site check, Sandbox, How it works.
- `web/js/core.js` ports the algorithms from `src/`; `web/tests/parity.test.mjs` checks the results match Python.
- GitHub Actions: tests on every push and deployment to GitHub Pages.

Details: [web.md](web.md).

## 4. Drone proposal (after the presentation)

A self-built quadcopter running **ArduPilot**: it supports ultrasonic rangefinders, waypoint missions and MAVLink telemetry the website can display.

| Part | Proposal | Why |
|---|---|---|
| Frame | 450 mm class | room for camera, computer and a forward rangefinder |
| Flight controller | Pixhawk-compatible (ArduPilot Copter) | missions, geofence, return to launch, MAVLink |
| GPS + compass | module with external compass | position hold next to the wall |
| Rangefinder | MaxBotix MB1242, facing forward | supported by ArduPilot: `RNGFND1_TYPE = 2`, `RNGFND1_MAX = 7`, `RNGFND1_ORIENT = 0` |
| Camera + computer | Raspberry Pi + camera module | shoots on the "steady" signal, sends frames and telemetry |
| Telemetry radio | SiK radio | link to the laptop at base |
| Battery | 4S LiPo | B in the model = measured range from test flights |

Risks: ArduPilot forum users report MaxBotix is less reliable outdoors than indoors. The code has a median filter and a "shoot only after 5 steady readings" rule. If that is still not enough, the fallback is a Benewake TF-Luna lidar, also supported by ArduPilot; `src/ultrasound.py` works with any distance reading.

## 5. Law: what we can legally fly

Bulgaria applies Regulation (EU) 2019/947. Operator registration: <https://drones.caa.bg>.

- A privately built drone **under 250 g** flies in subcategory A1.
- A privately built drone **from 250 g to 25 kg** flies only in **A3**: at least **150 m from residential, commercial, industrial and recreational areas**.

Consequence: a drone with a Pixhawk, camera and rangefinder weighs more than 250 g, so it **cannot legally inspect a facade in town in the open category**. A real inspection in town needs the specific category with an authorisation from the Bulgarian CAA. For the presentation:

1. **A hand-held rig instead of flying**: camera + rangefinder + Raspberry Pi on a pole held in front of a wall. Real photos, real filtering, real tiles, no flight and no permit.
2. **A test flight in an open area** far from buildings and people, with a registered operator and a pilot who passed the exam.
3. **The website simulation** for the whole mission.

## 6. Who does what

The team has 4 people with the four roles from the assignment. The website and design are an **extra** task for one of the four, not a fifth role.

| Role (assignment) | Responsible for (assignment) | New in this project | After the presentation (drone) |
|---|---|---|---|
| Lead / integrator | README, schedule, connecting the pipeline, final demo | review the PR; GitHub Pages; demo script below | operator registration; permits; safety |
| Data and CNN | data, model, training, metrics | after transfer learning: real ŷ in the site (format in [web.md](web.md)) | model on the Pi or the base laptop |
| Algorithms | data structures, algorithms, complexity, tests | nothing required | speed on large walls |
| Heuristics | at least two heuristics, comparison, charts | optional: battery reserve parameter (below) | MAVLink mission from the trips |
| + website and design (one of the four) | | team names in `web/js/strings.js`; phone testing; rig photos | telemetry bridge to the site |

**Suggestion for Heuristics** (not done here because that file is yours and contributions are graded): add `reserve: float = 0.0` to `InspectionConfig` and use `cfg.battery * (1 - cfg.reserve)` in `zones_to_problem`. Default results stay the same; the website already uses 20 %.

**AI-generated code.** The assignment allows it *if the team can explain it line by line*, and everyone is questioned at the defence. The website code is AI-generated: `web/js/core.js` is the same algorithms as `src/`, and `src/ultrasound.py` is commented where it matters. Whoever presents the website should go through these two files before the defence.

## 7. Plan until the defence

The assignment's deadlines (§8) do not move. New tasks are placed so they neither get ahead of them nor get in their way.

| Due | Assignment | Extra (website, ultrasound) |
|---|---|---|
| by 02.12.2026 | teams, roles, topic, repo with README | another team member reviews and merges this PR; GitHub Pages |
| by 09.12.2026 | data downloaded and split; licence and citation | hand-held rig: camera + rangefinder, first own photos of a wall |
| by 16.12.2026 | own baseline CNN with learning curves | team names in the site; phone test |
| by 08.01.2027 | transfer learning; exact algorithm (ALGO); first heuristic (HEUR) | |
| by 15.01.2027 | connected pipeline; second heuristic; test-set metrics | real ŷ in the site; own photos through the whole pipeline; dress rehearsal |
| 19–25.01.2027 | defence: HEUR 19.01 (group 2) / 22.01 (group 1); ALGO 25.01; NN the same week | the website is shown in the integrator's demo |

**Demo script (5 minutes):** Home → Monitor (run at ×4) → Analysis (raise the threshold to 0.6 and show the missed-cracks warning) → Route (the race) → On-site check ("Example" button) → How it works.

## 8. What is not real yet, and should be said honestly

- The demo wall and its ŷ are synthetic. Real ŷ come after the network is trained.
- The Monitor telemetry is simulated. The format for real data is described, but the bridge from the drone does not exist yet.
- Drone numbers (B, speed, range) come from the model, not from measurements.
