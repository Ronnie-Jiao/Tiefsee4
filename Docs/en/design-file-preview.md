# AI, PSD, and PSB preview development plan

This document tracks work in the fork on the `feature/ai-psd-preview` branch.
It is a plan for incremental changes, not a claim that all files are supported.

## Current architecture and existing behavior

- `Www/ts/Config.ts` registers `.ai` and `.pdf` in the PDF group.
  AI files are therefore passed to the existing PDF viewer. This only works
  when the Illustrator file has usable PDF-compatible content.
- `Www/ts/Config.ts` registers `.psd` and `.psb` as images using
  `vipsType: "magick"`.
- `Www/ts/MainWindow/Script.ts` selects the decoder and requests
  `/api/images/vips/init`.
- `Tiefsee/Features/Image/Http/ImageHttpEndpoints.cs` forwards those
  requests to `ImageProcessingService.GetImgInitInfo()`.
- `Tiefsee/Features/Image/Application/ImageProcessingService.cs` handles
  the Magick.NET-to-image conversion and the existing preview/cache pipeline.
- `Tiefsee/Features/File/Application/FileTypeHelper.cs` examines file
  signatures. PSD and PSB both begin with `8BPS`; the version field
  identifies PSD (1) or PSB (2). The fork now distinguishes the two.

## Scope and priorities

### Stage 1: recognize existing capabilities and fix correctness issues

- [x] Establish an isolated development branch.
- [x] Distinguish PSB from PSD by the two-byte file format version.
- [ ] Validate file-type detection and viewer routing on Windows.
- [ ] Collect reproducible samples and record what currently fails.

### Stage 2: reliable AI preview

- [ ] Detect PDF-compatible AI documents without relying on extension alone.
- [ ] Show a clear unsupported-preview message for AI files that do not
  contain usable PDF data, rather than misrepresenting them as successfully
  rendered.
- [ ] Investigate a safe fallback preview strategy for non-PDF AI and
  legacy Illustrator/EPS documents, with separate dependency and license
  review before integration.
- [ ] Support multi-artboard/page navigation when available.

### Stage 3: PSD/PSB speed and fidelity

- [ ] Benchmark opening and navigating large files, cold and warm cache.
- [ ] Prefer the composite/merged preview where valid, instead of decoding
  every layer merely to display a flattened view.
- [ ] Verify ICC/CMYK conversion, alpha, color fidelity, and dimensions.
- [ ] Add cancellation and memory-budget tests for oversized documents.
- [ ] Reuse the existing image cache and renderer; do not rebuild the UI.

## Compatibility test matrix

| Sample | Expected result |
| --- | --- |
| PSD, `8BPS\x00\x01`, RGB | Detect as PSD; show merged result |
| PSB, `8BPS\x00\x02`, RGB | Detect as PSB; show merged result |
| PSD/PSB with many layers | Correct composite; acceptable memory use |
| PSD in CMYK with ICC profile | Correct colors or documented limitation |
| AI saved with PDF compatibility | PDF preview opens; multiple pages if present |
| AI saved without PDF compatibility | Clear unsupported message / approved fallback |
| Legacy AI/EPS | Clearly documented behavior; no false success |
| Damaged or truncated file | Graceful error, no crash |
| Huge file; rapid switching | Cancellation, usable UI, bounded resources |

## Validation

Follow `AGENTS.md` and `Docs/zh-TW/ai-automated-testing.md`.
Build and test on a compatible Windows 10/11 x64 development machine.
Do not claim that the format works based on filename registration alone.
For any TypeScript changes, run the repository-wide `tsc --noEmit` check.
Use existing UI test infrastructure for end-to-end verification.

No third-party renderer should be added before verifying its license,
security posture, distribution constraints, and performance.
