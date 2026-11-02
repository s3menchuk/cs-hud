# Radar assets

Map images and overview calibration: copyright Valve Corporation.
Source: https://github.com/MurkyYT/cs2-map-icons
Pinned revision: 8366882e4c2a50aaa6920f033ab074e04e271952
World-to-image conversion uses the overview origin and scale, on the unrotated 1024-unit radar canvas. The overview rotate/zoom flags are spectator camera preferences, not an additional image transform.

Regenerate: node scripts/download-radars.mjs
