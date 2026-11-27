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

| Role | Before the presentation | After (drone) |
|---|---|---|
| Lead / integrator | review and merge the PR; turn on GitHub Pages; fill in the team table; run the demo script | operator registration; permits; build and safety |
| Data and CNN | after training: export real ŷ for 2–3 walls to `web/data/` (format in [web.md](web.md)); test with photos from the rig | run the model on the Pi or the base laptop |
| Algorithms | nothing new; optionally a step-by-step recursion animation for the site | speed on large walls |
| Heuristics | battery reserve parameter in `src/pipeline.InspectionConfig` (see below); B from real measurements | turn trips into a MAVLink waypoint mission |
| Website and design | team names in `web/js/strings.js`; phone testing; rig photos in the site | telemetry bridge to the site (format in [web.md](web.md)) |

**Suggestion for Heuristics** (not done in this branch because that file is yours and contributions are graded): add `reserve: float = 0.0` to `InspectionConfig` and use `cfg.battery * (1 - cfg.reserve)` in `zones_to_problem`. Results stay the same by default; the website and the simulation already use 20 %.

## 7. Plan until the defence

| Due | What | Who |
|---|---|---|
| 01.12 | Review and merge the PR; GitHub Pages on; team names | Lead, Website |
| 08.12 | Hand-held rig: camera + rangefinder; first photos of a real wall | Website + Data |
| 15.12 | Battery reserve in `src/`; real ŷ for one wall in the site | Heuristics, Data |
| 08.01 | Real rig photos go through the whole pipeline | everyone |
| 15.01 | Dress rehearsal: site + slides + the questions in `docs/rabota_v_ekip.md` | everyone |
| 19–25.01 | Defence | everyone |

**Demo script (5 minutes):** Home → Monitor (run at ×4) → Analysis (raise the threshold to 0.6 and show the missed-cracks warning) → Route (the race) → On-site check ("Example" button) → How it works.

## 8. What is not real yet, and should be said honestly

- The demo wall and its ŷ are synthetic. Real ŷ come after the network is trained.
- The Monitor telemetry is simulated. The format for real data is described, but the bridge from the drone does not exist yet.
- Drone numbers (B, speed, range) come from the model, not from measurements.
