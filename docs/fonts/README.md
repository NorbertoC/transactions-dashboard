# Bundled dashboard fonts

Inter, DM Sans and Manrope are bundled from `src/app/fonts`. The 15 WOFF2 files
are byte-identical to the fonts in the previous successful Next.js build.
`manifest.json` records their official Google Fonts URLs and SHA-256 hashes.
The corresponding SIL Open Font License files are included here, downloaded
from the pinned Google Fonts repository commit recorded in the manifest.

`src/app/fonts.css` preserves the previous weights, Unicode subsets,
`font-display: swap`, fallback metrics and font variables. The three Latin
subsets retain their preload links. Webpack emits content-addressed assets under
`/_next/static/media/`, retaining Next's public static delivery and immutable
caching without changing the authentication middleware. Japanese uses the existing system fallback
for characters outside these fonts' coverage.

This removes the build-time `next/font/google` request. Next.js 15.5.27's Google
font loader assumes every returned font URL ends with a recognized extension
before reading the regex match. The failed deployment hit a null match at
`google/loader.js:122`. Its logs did not identify the URL; fresh requests using
the same user agent currently return valid WOFF2 URLs. No dependency or cache
change is needed to make the bundled assets independent of that response.

To update a font, obtain it from its official source, retain its license,
record its hash and update the CSS and preload URL together. A filename contains
the first 16 characters of its SHA-256 hash. Tests verify the binary signatures,
hashes, subset coverage, weights and preload references.
