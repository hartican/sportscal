# F1 circuit display facts

Reviewed 25 September 2026. Display metadata lives in `config/feed-card-presentation.js`; it does not alter fixture times, results or Follow membership.

The [current official calendar](https://www.formula1.com/en/racing/2026) has 23 rounds, including Azerbaijan at 15 and Bahrain in Malaysia at 16. Use its current order rather than the original 24-round announcement. Race badges apply only to the main Race session. Unknown seasons/circuits omit the badge and dimensions rather than guessing from a partial feed. Re-review this season-specific registry when the calendar or circuit layout changes.

Distances come from the corresponding official 2026 race hub (`https://www.formula1.com/en/racing/2026/<calendar-slug>`). Keep published precision in metadata, round to one decimal for the caption. Bahrain's 2026 hub identifies Sepang, not Sakhir. Austria's current hub lists 4.326km; Madrid's hub lists 5.414km. Older guides can have different layouts or measurements.

Corner counts were checked against F1 circuit guides and official circuit information, including:

- [Baku: 6.003km, 20 turns](https://www.formula1.com/en/latest/article/circuit-guide-everything-you-need-to-know-about-the-baku-city-circuit.320UGBNQu2ALdgAtax1gRn)
- [Albert Park: 14 turns after reprofiling](https://www.formula1.com/en/latest/article/circuit-guide-2026-australian-grand-prix-albert-park.19zPlhKhMbTaVNFIPKAAMa)
- [Barcelona: current layout without the final chicane](https://www.formula1.com/en/latest/article/circuit-guide-everything-you-need-to-know-about-the-circuit-de-barcelona-catalunya.7i1UoRE8Za0Jk4LI0r68qk)
- [Madring: 22 corners](https://www.madring.com/en/press-releases/carlos-sainz-inaugurates-madring)
- [Sepang: 15 turns](https://www.gt-world-challenge-asia.com/event/80/sepang)
- [Singapore: reduction to 19 corners](https://www.formula1.com/en/latest/article/singapore-grand-prix-set-to-feature-revised-track-layout-in-2023.6KsrU6hQw3hxrVJ6zKeJ74)
- [COTA: turns 1–20](https://circuitoftheamericas.com/blog/2024/2/16/what-your-favorite-cota-turn-says-about-you/)
- [Yas Marina: revised 16-corner layout](https://www.astonmartinf1.com/en-GB/races/2025-abu-dhabi-gp)

Caption format: `Baku City Circuit • Baku • 6.0km • 20 turns`. The chequered flag is decorative; the race number remains readable text. Labels wrap safely on narrow cards.
