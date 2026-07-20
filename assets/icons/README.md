# nothingSports vector assets

The asset registry in `config/vector-assets.js` classifies every visual asset:

- `open-use`: generic Sporticon sport silhouettes (Apache 2.0) and Lucide UI
  glyphs (ISC, with Feather-derived glyphs also covered by MIT).
- `official-permitted`: first-party nothingSports brand assets, or third-party
  marks only when an explicit permission basis is recorded.
- `custom-semantic`: original neutral sport fallbacks and status glyphs.

Team, league, event, and broadcaster marks must fall back to the generic sport
or semantic glyph unless permission metadata is added to the registry. No
commercial music or artist recording is bundled.

Licence notices live in `assets/licenses/`.
