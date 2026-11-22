# MISSIONVERSE

**Explore historic space missions, design a spacecraft, and fly a browser-based 3D mission simulator.**

MISSIONVERSE connects an animated mission menu and mission library to a React/Three.js flight simulator. Choose a crewed or robotic mission, review its history and hardware, configure a vehicle, then manage launch, flight, lunar operations, and mission debriefs.

> MISSIONVERSE is an independent educational game. It is not affiliated with or endorsed by NASA, and it is not flight-planning or engineering software. Mission costs, performance, scores, and simulated outcomes are simplified game estimates.

## Contents

- [Features](#features)
- [Missions](#missions)
- [Requirements](#requirements)
- [Install and run](#install-and-run)
- [How to play](#how-to-play)
- [Project structure](#project-structure)
- [Credits and asset sources](#credits-and-asset-sources)
- [Troubleshooting](#troubleshooting)
- [License and reuse](#license-and-reuse)

## Features

- Animated welcome screen, crewed and uncrewed mission browsing, mission details, and a NASA image gallery.
- Interactive 3D launch and trajectory simulation with telemetry, mission events, stage separation, orbit and landing phases, and a post-flight debrief.
- Mission design console with payload, propulsion, power, communications, trajectory, and difficulty choices.
- Historical hardware baselines and clearly identified hypothetical engine packages.
- Six connected mission profiles, plus a custom mission design option in the simulator.
- Browser-local mission log (up to 30 results) and saved audio preference.

## Missions

| Mission | Type | Simulator profile |
| --- | --- | --- |
| Apollo 11 | Crewed lunar landing | `apollo-11` |
| Apollo 8 | Crewed lunar orbit and return | `apollo-8` |
| Apollo 17 | Crewed lunar landing and rover operations | `apollo-17` |
| Lunar Orbiter 1 | Uncrewed lunar orbit | `lunar-orbiter-1` |
| Surveyor 3 | Uncrewed lunar landing | `surveyor-3` |
| James Webb Space Telescope | Uncrewed deep-space L2 transfer | `jwst` |

The mission pages pass the selected profile to the simulator through the `?mission=` URL parameter. Apollo 8 has no lunar lander or rover; Apollo 17 is the only rover mission among these profiles.

## Requirements

- Node.js **20.19+** or **22.12+**
- npm (included with Node.js)
- A current desktop browser with WebGL support
- Internet access for installing npm packages, loading Google Fonts, and searching NASA's image collection. The simulator's bundled models and core experience are served locally.

No API key or database is required for the documented local experience. `.env.example` is retained for the original hosting environment; the local app does not require those values to start.

## Install and run

1. Install Node.js from [nodejs.org](https://nodejs.org/) if it is not already installed.
2. Clone this repository, or download it from GitHub and extract the ZIP.
3. Open a terminal in the project root (the folder containing `package.json`).
4. Install dependencies:

   ```bash
   npm install
   ```

5. Start the Vite development server:

   ```bash
   npm run dev
   ```

6. Open the URL printed in the terminal. With the current Vite configuration, the animated experience is at:

   ```text
   http://localhost:3000/me/missionverse/Missionverse-animated.html
   ```

Keep the terminal running while using the app. Use **Ctrl+C** in that terminal to stop the server. Do not open the HTML page by double-clicking it: the pages need the local web server for their links, static assets, and simulator hand-off to work correctly.

### Production build

Create the static production bundle:

```bash
npm run build
```

Vite writes the output to `dist/`. To preview that build locally:

```bash
npm run preview
```

The preview URL will be printed in the terminal. Deploy the contents of `dist/` to a static host that serves the app at the site root and supports SPA fallback for `/` simulator routes. The public mission pages live under `/me/missionverse/`.

## How to play

1. Open the animated welcome page and select **Start Mission**.
2. Choose **Crewed** or **Uncrewed** and select a mission.
3. Read the mission overview, timeline, technical details, and gallery.
4. Select **CHOOSE THIS CHALLENGE** to open the simulator with that mission loaded.
5. Review the design console. Choose a difficulty and configure available mission systems and payloads; the panel shows estimated mass, budget, and mission metrics.
6. Start the flight and use the simulator's on-screen controls, telemetry, and event prompts to manage the mission. Use the controls help in the interface for the current keyboard and camera controls.
7. Complete or abort the mission to see the debrief. Choose another mission or return to **MISSIONS** to continue.
8. Return to the animated menu and open **Mission Log** to see up to 30 results saved in the current browser.

The configuration panel uses MissionVerse **M-credits**. They are game currency, not NASA or contractor prices. High-Thrust and High-Efficiency packages are what-if gameplay choices, not historical or proposed NASA engines.

## Project structure

```text
src/
  App.tsx                  React simulator and mission hand-off
  components/              Flight HUD, design panel, and simulator dialogs
  data/                    Mission profiles and event definitions
  engine/                  Flight simulation, 3D models, rendering, and audio
public/
  me/missionverse/         Animated menu and mission-library pages/assets
  you/                     Locally served 3D models and Draco decoder files
NASA_MODEL_SOURCES.md      Model provenance, mission references, and credits
INTEGRATION_NOTES.md       Notes on how the two experiences are connected
```

This is a client-side application. Mission simulation and rendering run in the browser; there is no project API server or database. Mission history is stored in the browser's local storage and is not synced between devices.

## Credits and asset sources

### NASA 3D models

The following bundled GLB models are credited to their NASA 3D Resources listings. NASA's 3D files are subject to the usage guidance on the relevant NASA pages; review that guidance before redistributing the assets.

- [Saturn V](https://science.nasa.gov/3d-resources/saturn-v/) — NASA / Michael D. Carbajal.
- [Apollo Lunar Module](https://science.nasa.gov/3d-resources/apollo-lunar-module/) — NASA / Michael D. Carbajal.
- [Apollo-Soyuz](https://science.nasa.gov/3d-resources/apollo-soyuz/) — NASA / Michael D. Carbajal. Used as a general Apollo CSM shape reference, not as an exact mission-specific spacecraft.
- [Atlas 6 (Friendship 7)](https://science.nasa.gov/3d-resources/atlas-6-friendship-7/) — NASA / Michael D. Carbajal. A Mercury-Atlas model used as an Atlas D-family visual reference.
- [Agena Target Vehicle](https://science.nasa.gov/3d-resources/agena-target-vehicle/) — NASA / Michael D. Carbajal. An Agena-family visual reference, not the exact Lunar Orbiter 1 launch stage.
- [James Webb Space Telescope (A)](https://science.nasa.gov/3d-resources/james-webb-space-telescope-a/) — NASA / Goddard Space Flight Center.
- [NASA 3D Resources usage guidance](https://science.nasa.gov/3d-resources/)

The shipped `saturn-v.glb`, `apollo-lm.glb`, `apollo-csm.glb`, `atlas.glb`, `agena.glb`, and `jwst-a.glb` were checked against the [NASA-3D-Resources repository](https://github.com/nasa/NASA-3D-Resources); see `NASA_MODEL_SOURCES.md` for the recorded check and provenance details.

### Reconstructions and related visual references

Not every vehicle in the simulator is an original NASA mesh. Mission-specific Lunar Orbiter 1 and Surveyor 3 spacecraft, the Apollo Lunar Roving Vehicle, the Ariane 5 ECA stack, and other missing stages are procedural or data-based reconstructions informed by public mission documentation. Related NASA meshes are labeled as visual references in the app and are not presented as exact flight configurations. The simulator does not use a later Lunar Reconnaissance Orbiter model in place of Lunar Orbiter 1.

Key source material includes:

- [Apollo 17 Press Kit](https://science.nasa.gov/wp-content/uploads/2023/09/Apollo_17.pdf) and [NASA's Apollo LRV overview](https://science.nasa.gov/wp-content/uploads/2024/01/exploring-the-moon-teachers-guide.pdf) — rover layout, dimensions, and context.
- [NASA Surveyor 3 mission page](https://science.nasa.gov/mission/surveyor-3/) and [Surveyor Project Final Report](https://ntrs.nasa.gov/citations/19690024480) — lander, launch, sampler, and mission details.
- [NASA Lunar Orbiter 1 mission page](https://science.nasa.gov/mission/lunar-orbiter-1/) and [Lunar Orbiter diagram](https://science.nasa.gov/resource/lunar-orbiter-diagram/) — spacecraft architecture and mission context.
- [NASA Webb fact sheet](https://science.nasa.gov/wp-content/uploads/2024/08/webbfactsheet.pdf) and [NASA Ariane 5 data sheet](https://sma.nasa.gov/LaunchVehicle/assets/ariane-5-data-sheet.pdf) — Webb and launcher reference data.

### Mission history and engineering references

Mission descriptions, historical baselines, propulsion, and payload groupings draw on sources including:

- [Apollo 11 Press Kit](https://science.nasa.gov/wp-content/uploads/2023/09/Apollo_11.pdf), [Apollo 11 Mission Report](https://www.nasa.gov/wp-content/uploads/static/apollo50th/pdf/A11_MissionReport.pdf), and [Apollo Service Propulsion System history](https://www.nasa.gov/history/60-years-ago-first-test-firing-of-the-apollo-service-propulsion-system/).
- [NASA Apollo 8 mission details](https://www.nasa.gov/missions/apollo/apollo-8-mission-details/) and [NASA Apollo 17 mission details](https://www.nasa.gov/missions/apollo/apollo-17-mission-details/).
- [NASA Saturn V gross liftoff mass report](https://ntrs.nasa.gov/api/citations/20080040680/downloads/20080040680.pdf), [NASA Atlas-Agena D characteristics](https://www.nasa.gov/wp-content/uploads/2023/04/sp-4012v2.pdf), and [NASA AC-12 Surveyor III launch report](https://ntrs.nasa.gov/api/citations/19690000964/downloads/19690000964.pdf).
- [ESA Ariane 5 ECA specifications](https://www.esa.int/es/articles/about-us/directorates/space-transportation/ariane/ariane-5-eca), [Webb fueling information](https://science.nasa.gov/blogs/webb/2021/12/06/nasas-james-webb-space-telescope-fully-fueled-for-launch/), and [ESA Webb fueling information](https://www.esa.int/media/webb-fuelled-for-launch).
- [NASA Webb fact sheet](https://science.nasa.gov/mission/webb/fact-sheet/), [telescope overview](https://science.nasa.gov/mission/webb/science-overview/science-explainers/telescope-overview/), and [scientific instruments](https://science.nasa.gov/mission/webb/science-overview/science-explainers/webbs-scientific-instruments/).
- [NASA Apollo Lunar Roving Vehicle reference](https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo_lrv.html), [NASA Lunar Orbiter 1](https://www.nasa.gov/mission/lunar-orbiter-1/), and [NASA Surveyor 3](https://science.nasa.gov/mission/surveyor-3/).

The app queries NASA's public [Image and Video Library API](https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf) for mission-gallery photographs. If the query is unavailable, the page uses its bundled NASA-hosted reference image when one is available. Individual images retain their source and usage terms; consult the NASA image record and usage guidance before reuse.

### Other project assets and software

The repository also includes the MISSIONVERSE interface artwork and page assets under `public/me/missionverse/`, and bundled environment/spacecraft assets under `public/you/`. The project notes identify the NASA models and reconstruction sources above; they do not establish separate creator or license metadata for every locally bundled illustration, texture, audio clip, or non-NASA model. Check each asset's embedded metadata and original source before reusing it independently.

The application is built with [React](https://react.dev/), [Three.js](https://threejs.org/), [Vite](https://vite.dev/), [Tailwind CSS](https://tailwindcss.com/), [Motion](https://motion.dev/), and [Lucide](https://lucide.dev/). Their respective projects retain their own names and licenses; see `package.json` and the installed package license files for details. The Draco decoder files in `public/you/draco/` are distributed with their upstream license notices where supplied.

For the full source inventory and additional technical references, see [NASA_MODEL_SOURCES.md](NASA_MODEL_SOURCES.md). NASA is not endorsing this project. NASA insignia and imagery remain subject to NASA's applicable usage guidance.

## Troubleshooting

- **`npm` is not recognized:** install Node.js (npm is included) and reopen the terminal.
- **The page is blank or assets fail to load:** ensure `npm run dev` is still running and open the exact local URL printed by Vite. Do not open the HTML file directly from disk.
- **Port 3000 is already in use:** stop the other process using that port, then run `npm run dev` again. This project configures Vite to use port 3000.
- **3D view does not render:** update your browser and enable hardware acceleration/WebGL. Try a desktop browser with a current graphics driver.
- **NASA gallery does not load:** gallery search requires internet access and NASA's image service to be available. The mission page may display its bundled reference image instead.
- **Want to reset local results/audio preference:** clear this site's local storage in your browser's developer tools. This also removes the local mission log.

## License and reuse

No single project-wide license is declared in this repository. Do not assume that all source code, artwork, photographs, or 3D assets share one license. Before publishing a fork or redistributing any bundled asset, establish the rights and attribution requirements for that specific item. NASA-produced materials also remain subject to NASA's usage guidance and trademark rules. This project is not endorsed by NASA.


WORK DONE BY 2 UNHINGED PEOPLES:
               VISMAI C RAJ