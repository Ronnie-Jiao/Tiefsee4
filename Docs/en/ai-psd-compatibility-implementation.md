# AI / PSD / PSB preview implementation (fork)

This change adds **practical preview fallbacks** to Tiefsee 4 while keeping the
original PDF viewer, thumbnail UI, renderer, cache eviction, and image pipeline.

## Illustrator (.ai)

The caller now checks `/api/files/ai-preview-status`, rather than always
sending an `.ai` to the PDF iframe.

| Kind | Detection | Viewer behavior |
| --- | --- | --- |
| `pdf` | PDF header in the first 32 bytes | Existing PDF viewer, preserving page navigation |
| `preview` | Embedded EPSI bitmap in legacy PostScript AI, or a real Windows Shell thumbnail | Show cached bitmap with a visible low-resolution preview notice |
| `unsupported` | No compatible PDF data and no actual bitmap preview | Explicit explanation rather than an Illustrator file icon or blank PDF iframe |

EPSI decoding is bounded by a 12 MiB input scan and a 4-megapixel output
budget. It never executes PostScript. Windows thumbnails are requested with
`ThumbnailOptions.ThumbnailOnly`—not `IconOnly`—to avoid false success.

**Limitations:** Modern AI documents saved without PDF compatibility may not
contain a usable embedded preview. Their proprietary native object streams
cannot be losslessly reconstructed by a PDF viewer or by extracting a
thumbnail. Some users may have a suitable Windows Shell thumbnail handler
installed and others may not. Preview bitmaps are not full vector renderings.

A future native Illustrator interpreter or sandboxed EPS/PostScript renderer
would be a separate, security- and license-reviewed project. Do not silently
invoke arbitrary Ghostscript executables as a fallback.

## Photoshop (.psd / .psb)

- Header detection uses the `8BPS` version (1=PSD, 2=PSB) in both frontend
  and backend, preventing accidental PSD routing for PSB files.
- The file/directory thumbnail endpoint first reads image-resource
  **1036** (or older **1033**) and caches the already-compressed JPEG.
  The cache key is derived from source path, size and modification time.
- The full viewer still uses the original Magick.NET → VIPS pipeline, but
  requests frame 0/count 1. When the PSD coder provides a merged image,
  it can skip decoding the layer frames.
- Embedded ICC profiles are transformed to sRGB for display. A CMYK file
  lacking a profile is converted with US Web Coated SWOP as an **approximate
  fallback**, not a claim of colorimetric accuracy.
- Existing processed-image and tile caches remain unchanged.

**Limitations:** Not every Photoshop file stores resource 1036 or a merged
composite. Files missing both may still require an expensive decode or fail.
The thumbnail extractor is intentionally a fast path and is not an image
editor. Full fidelity still requires comparing output against Adobe on
representative CMYK/16-bit/transparency samples.

## Build and regression coverage

GitHub Actions `Validate design previews` runs on Windows:

1. `npx tsc --noEmit` for frontend type correctness.
2. `dotnet build Tiefsee/Tiefsee.csproj` with native-host build disabled.
3. An isolated `DesignFilePreviewTests` harness with generated sample PDFs,
   legacy EPSI previews, oversized invalid headers, and resource-1036
   JPEGs in both PSD and PSB envelopes.

There is no automated assertion of actual Windows Shell thumbnail-provider
availability (it varies by installed software). Test at least:

- AI with/without PDF compatibility, EPSI preview, no preview and corrupt data.
- A PDF-compatible AI with multiple artboards.
- Large PSD and PSB with many layers, no merged data, transparency and ICC.
- Repeated folder browsing (warm cache), after edits (invalidated cache),
  quick switching, and file deletion.
- Cold/warm opening time, peak RAM and visual comparison against Adobe.

Do not merge until the Windows desktop app has passed smoke tests.
