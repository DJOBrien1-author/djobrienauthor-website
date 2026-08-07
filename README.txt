HOMEPAGE DIRECT OVERRIDE PATCH V4

This is an actual code patch, not a mock-up.

It changes only the homepage:
- centres the original Wyvern-cover dragon,
- forces all three trilogy cover thumbnails into identical 220 x 352 px display boxes,
- removes the previous stagger/rotation,
- uses inline !important overrides in index.html so the existing shared stylesheet cannot override the fix,
- uses a new background filename to bypass cache.

Files:
index.html
assets/artwork/jesus-da-silva/home-wyvern-cover-dragon-centered-v4.webp

Apply by extracting into the website root and replacing matching files.
Then Ctrl+F5.
