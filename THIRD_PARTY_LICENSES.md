# Third-party components and model terms

EchoForge 3D combines source code with open-source libraries, vendored code,
and separately downloaded machine-learning models. This file is a notice and
inventory, not a replacement for the license text shipped by each component.

## Important boundary

**Model weights are not redistributed by this repository.** Users who download
weights are responsible for reviewing and complying with the model card,
license, usage restrictions, attribution requirements, acceptable-use terms,
and any authentication or click-through terms for that model. This includes,
at minimum, TripoSR, Hunyuan3D/Hunyuan3D-2GP, SDXL-Turbo, AudioGen, SmolVLM,
Distil-Whisper, Depth-Anything, and Kokoro weights.

Hunyuan3D-2 and Hunyuan3D-2GP are available only through an optional,
separately managed local sidecar. Their Tencent Hunyuan community/non-commercial
terms must be reviewed before any use beyond personal evaluation. The sidecar
is not bundled, mirrored, or redistributed here.

## Source and vendored components

- The main runtime uses dependencies declared in `package.json` and
  `backend/requirements.txt`. Each dependency retains its own license; consult
  its upstream distribution for the authoritative notice.
- `backend/vendor/tsr/` contains vendored TripoSR inference code. Its upstream
  Apache-2.0 notice and provenance are documented in
  [`backend/vendor/README.md`](backend/vendor/README.md), with the upstream
  license text at [`backend/vendor/tsr/LICENSE`](backend/vendor/tsr/LICENSE).
- `public/vendor/three.core.min.js` is a vendored/minified third-party runtime;
  its upstream license and notices must be preserved when redistributed.
- Browser and backend model caches are local runtime state and are intentionally
  excluded from source distribution. Do not commit `.hf-cache`, downloaded
  checkpoints, or credentials.

## Practical compliance checklist

Before making a build public or commercial:

1. Generate an exact dependency inventory from the lockfiles and Python
   environment.
2. Read and retain each dependency's license and required attribution.
3. Review every model card and weight license for the intended use, including
   Hunyuan's restrictions.
4. Confirm that no model cache, secret, or separately licensed sidecar has been
   included in the release artifact.
5. Add any required notices or attribution files to the distribution.
