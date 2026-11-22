# Integration notes

## Integration performed
- Preserved the original MISSIONVERSE HTML pages, CSS, scripts, and image assets under `me/public/me/missionverse/`.
- Kept the React/Three.js lunar trajectory simulator as the Vite application.
- Connected the mission-detail page's **CHOOSE THIS CHALLENGE** button to the simulator using the selected mission ID.
- Added URL mission resolution in `me/App.tsx` so each of the six MISSIONVERSE mission keys loads the matching trajectory configuration.
- Added an always-visible **MISSIONS** link in the simulator header that returns directly to mission selection.
- Added a **Choose Another Mission** action to the mission debrief so completed or failed flights can return to the mission picker.

## Important technical clarification
The trajectory ZIP contains a client-side simulation engine and UI. It does not contain a separate backend API service, database, or server-side trajectory computation service. The current integration therefore creates a working browser-to-browser-app hand-off, not a network API integration.

## Files changed
- `me/App.tsx`
- `me/components/FlightHUD.tsx`
- `me/public/me/missionverse/mission-details.html`
- `README.md`

## Mission mapping
- Apollo 11 → `apollo-11`
- Apollo 17 → `apollo-17`
- Apollo 8 → `apollo-8`
- Lunar Orbiter 1 → `lunar-orbiter-1`
- Surveyor 3 → `surveyor-3`
- James Webb Space Telescope → `jwst`

## Verification
The HTML and URL wiring were inspected. A full Vite production build still needs to be run in an environment where npm dependencies can be installed.
