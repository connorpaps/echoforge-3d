/**
 * Live viewport camera position (world space), written by <CameraProbe>
 * every frame and read by generation spawn logic when a mesh drops in.
 *
 * Module-level mutable on purpose: per-frame writes must not trigger React
 * re-renders (a zustand field would re-render every subscriber at 60 fps).
 * Defaults to the R3F camera start position (12, 10, 12) so reads before the
 * first frame still face the default view.
 */
export const cameraRef = { x: 12, y: 10, z: 12 };
