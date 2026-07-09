**Next Session Plan**

1. **Establish App State Layer**
   Add a small preference/state section above `EVENTS` in `index.html`:
   - `SPORTS_LIBRARY`
   - `BROADCASTER_LIBRARY`
   - `FILTER_SCHEMAS`
   - `ATHLETE_LIBRARY`
   - `userPreferences`
   - helper functions for sport/provider/filter matching

   Keep persistence in-memory for now, but wrap it behind functions like `loadPreferences()` / `savePreferences()` so `localStorage` or backend persistence can be added later.

2. **Normalise Event Metadata**
   Keep the current `EVENTS` array, but enrich each event progressively:
   - `sportId`
   - `broadcasters`
   - `expectedSpectacle`
   - optional metadata for filters: `gender`, `eventType`, `round`, `teams`, `athletes`, `nationalities`, `specialTags`

   Current fields like `sport`, `key`, `expected`, and `broadcaster` can remain initially to avoid a risky rewrite.

3. **Add Onboarding Flow**
   Build a first-run full-screen modal/overlay with a stepper:
   - Step 1: pick favourite sports
   - Step 2: pick available broadcasters
   - Step 3: optional sport-specific filters
   - Step 4: enter calendar

   Add a settings button in the existing header so the same flow can be reopened later.

4. **Sports Picker**
   Use supported sport cards:
   - Tennis
   - Rugby
   - Football / Soccer World Cup
   - F1
   - Le Tour de France
   - Masters Golf
   - Cricket
   - NBA Finals
   - Superbowl
   - Le Mans
   - Rugby League
   - Alpine Skiing
   - Freestyle Skiing

   Include broadcaster chips per sport where currently evidenced. Add disabled “Coming Soon...” cards for future sports.

5. **Broadcaster Picker**
   Add AU providers as selectable chips:
   - Kayo Sports
   - Stan Sport
   - SBS On Demand
   - Nine / 9Now
   - Foxtel
   - ABC
   - 7plus
   - 10

   Model international providers as disabled/future-ready entries:
   - Sky Sports
   - Canal+
   - Eurosport
   - VPN / international access

   Important: only existing event-provider evidence should affect filtering.

6. **Sport-Specific Filters**
   Implement schema-driven filter rendering, with tennis as the first fully working example:
   - Men / Women / Both
   - Singles / Doubles / Both
   - Nationality
   - Knockout round
   - Wheelchair / special tags
   - athlete search only when lists reach 50+ entries

   Scaffold schemas for other sports without pretending full metadata exists yet.

7. **Filtering Pipeline**
   Replace direct `EVENTS.slice()` filtering with:
   - followed sport filter
   - broadcaster availability filter
   - sport-specific filter
   - existing tab/view filter
   - must-watch derivation

   Missing deep metadata should not silently wipe out the calendar. The fallback should be conservative and visible in code.

8. **Must-Watch Formalisation**
   Keep spoiler-free logic:
   - pre-event: expected spectacle
   - post-event: actual spectacle only
   - promoted replay when actual `> 8` or actual is `>= expected + 2`

   I’d update the current code because it currently promotes upgrades only when actual `>= 8` and actual exceeds expected by 2. Your new rule is slightly broader.

9. **Duplicate File Cleanup**
   Use `index.html` as canonical. Delete `sports_calendar.html` during implementation, but first confirm Vercel/static hosting is using `index.html` and nothing links directly to `sports_calendar.html`.

10. **Verification**
   Manual checks:
   - first-run onboarding appears
   - sports selection controls visible events
   - broadcaster selection controls visible events
   - tennis filters work
   - settings reopens preferences
   - must-watch stays spoiler-free
   - ICS export still works or is explicitly left unchanged if out of scope

Sources
[1] winter_finals_calendar_aest.md https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_b8c45127-1644-4692-aa90-d4b29958a70e/ab8c5c9c-47f3-4395-b9b8-9fbe03c58ad8/winter_finals_calendar_aest.md?AWSAccessKeyId=ASIA2F3EMEYEQXLW3YP2&Signature=sD8FAumrPrneJlpHfegZRrWeI%2Fg%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEJ7%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLWVhc3QtMSJHMEUCIQDL5bNd6wOSsYeBxLntucHCE4oIl16pa0z5o3fnvf2bbgIgOJYv%2F%2FboR%2B50zGnF6zV%2FIuEF7m%2B6Tyt9R79Q2vQejWsq8wQIZxABGgw2OTk3NTMzMDk3MDUiDEorQBiw6itxPA6xlSrQBCjthf5jbTj4Nx5BE5QHYXDFGYysCgiasZwe1NYCnm8IPuu6cgIib7OezYigwBDPVU8xfCKWNnm%2FBF%2BfJAFSi6ALsIvGHhIzeswgpJ1%2BmWozjWoi3psy4CaDj41C%2BeWcZ5cToIAnj3SB8KRYrbh2eTntHGtc5FOZ%2B%2FyKSFZTLJKTC0%2F0uoUtpX%2BbRnVjDmLoGdugeFAYvoRw2jCgtQ0ZtOu0T2s40YsVockVUC1n480WHm7OFSXtiRY%2BRJUUJpI4Eh1MeCNgOqsydX5fVzOxvj1pf%2FFCjwsZMD1R768q6O5PRJpxHiFvPnKX6nABMy1rhh1mAzuQal9SD1qMFLIJkujCmDNAP3ap6%2FkjSu%2Bgaxxd96UEXo0AufwD7bEctkz%2B6MQgGaMqYdyWlFN0pElwGuZKTBGf%2F4TxgbNCnTDIq3Fqao1Qr3dzY9IgU2ogSbtOwBhZEFgFTUsd3Td9v%2BINdFH4v737fIVuUNL8Z1jIOH0A8Ufhqgjykzip%2FYkpqO%2BrymuBp5%2FfuTSLsXf8oDfuDIh%2BISBZBf6055%2BXQA4NT8dYkpreEdSsr6MjA%2B6eBShhansMGF%2BbTg%2F%2BiIGg5%2FwYRZnKgeH5ivhg%2BXd78tQ%2BdBww7TvKU6anPcyMODHVmlUWEC%2FaGrNs%2BZZJSm60za4F9LrQGJdNux99HNS5ez4ifMN1vs167c%2B0%2F17u3QFl1pF%2Bx2F04mO7mgyBmkJm%2BLUKb6RZy6zz2mpMl6MmnJ%2Fr9Moj3z0JGLFsdbInPxBOCT219n8uxEetfEOwYqqqYXI%2FNgow8Kuy0gY6mAHw9sP6Kfpq%2FyaVb8TSpJpo4BbVJ3z%2FHDViwMP9EWkdv1YH74y1%2BkK1yyoemyyaeQ%2BDSIpzU09kknA%2FIh2r1vAkr9%2F%2Fek1N6aJNHyUP0KktGAhGJkrS6U0bq1GBm8ahPcYorlhi5NmazQguGlC47sqi4K0rdeEau3WBJ7IRHspCCJSyVKLlyhxf0IkqXjX9%2BtyKRlL5gpMtrg%3D%3D&Expires=1783407555
[3] sports_calendar_2026.md https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_b8c45127-1644-4692-aa90-d4b29958a70e/746047d8-647e-4dba-862c-e147e6a044ca/sports_calendar_2026.md?AWSAccessKeyId=ASIA2F3EMEYEQXLW3YP2&Signature=yfe02Jn43KKC8BnHgFNlURZU0%2Fg%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEJ7%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLWVhc3QtMSJHMEUCIQDL5bNd6wOSsYeBxLntucHCE4oIl16pa0z5o3fnvf2bbgIgOJYv%2F%2FboR%2B50zGnF6zV%2FIuEF7m%2B6Tyt9R79Q2vQejWsq8wQIZxABGgw2OTk3NTMzMDk3MDUiDEorQBiw6itxPA6xlSrQBCjthf5jbTj4Nx5BE5QHYXDFGYysCgiasZwe1NYCnm8IPuu6cgIib7OezYigwBDPVU8xfCKWNnm%2FBF%2BfJAFSi6ALsIvGHhIzeswgpJ1%2BmWozjWoi3psy4CaDj41C%2BeWcZ5cToIAnj3SB8KRYrbh2eTntHGtc5FOZ%2B%2FyKSFZTLJKTC0%2F0uoUtpX%2BbRnVjDmLoGdugeFAYvoRw2jCgtQ0ZtOu0T2s40YsVockVUC1n480WHm7OFSXtiRY%2BRJUUJpI4Eh1MeCNgOqsydX5fVzOxvj1pf%2FFCjwsZMD1R768q6O5PRJpxHiFvPnKX6nABMy1rhh1mAzuQal9SD1qMFLIJkujCmDNAP3ap6%2FkjSu%2Bgaxxd96UEXo0AufwD7bEctkz%2B6MQgGaMqYdyWlFN0pElwGuZKTBGf%2F4TxgbNCnTDIq3Fqao1Qr3dzY9IgU2ogSbtOwBhZEFgFTUsd3Td9v%2BINdFH4v737fIVuUNL8Z1jIOH0A8Ufhqgjykzip%2FYkpqO%2BrymuBp5%2FfuTSLsXf8oDfuDIh%2BISBZBf6055%2BXQA4NT8dYkpreEdSsr6MjA%2B6eBShhansMGF%2BbTg%2F%2BiIGg5%2FwYRZnKgeH5ivhg%2BXd78tQ%2BdBww7TvKU6anPcyMODHVmlUWEC%2FaGrNs%2BZZJSm60za4F9LrQGJdNux99HNS5ez4ifMN1vs167c%2B0%2F17u3QFl1pF%2Bx2F04mO7mgyBmkJm%2BLUKb6RZy6zz2mpMl6MmnJ%2Fr9Moj3z0JGLFsdbInPxBOCT219n8uxEetfEOwYqqqYXI%2FNgow8Kuy0gY6mAHw9sP6Kfpq%2FyaVb8TSpJpo4BbVJ3z%2FHDViwMP9EWkdv1YH74y1%2BkK1yyoemyyaeQ%2BDSIpzU09kknA%2FIh2r1vAkr9%2F%2Fek1N6aJNHyUP0KktGAhGJkrS6U0bq1GBm8ahPcYorlhi5NmazQguGlC47sqi4K0rdeEau3WBJ7IRHspCCJSyVKLlyhxf0IkqXjX9%2BtyKRlL5gpMtrg%3D%3D&Expires=1783407555
[4] sports-calendar-one-pager.md https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_b8c45127-1644-4692-aa90-d4b29958a70e/1c862306-a720-42bb-b790-bab55c722537/sports-calendar-one-pager.md?AWSAccessKeyId=ASIA2F3EMEYEQXLW3YP2&Signature=0IJkMoy9Nnnp3kpp354WlmCh%2FfE%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEJ7%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLWVhc3QtMSJHMEUCIQDL5bNd6wOSsYeBxLntucHCE4oIl16pa0z5o3fnvf2bbgIgOJYv%2F%2FboR%2B50zGnF6zV%2FIuEF7m%2B6Tyt9R79Q2vQejWsq8wQIZxABGgw2OTk3NTMzMDk3MDUiDEorQBiw6itxPA6xlSrQBCjthf5jbTj4Nx5BE5QHYXDFGYysCgiasZwe1NYCnm8IPuu6cgIib7OezYigwBDPVU8xfCKWNnm%2FBF%2BfJAFSi6ALsIvGHhIzeswgpJ1%2BmWozjWoi3psy4CaDj41C%2BeWcZ5cToIAnj3SB8KRYrbh2eTntHGtc5FOZ%2B%2FyKSFZTLJKTC0%2F0uoUtpX%2BbRnVjDmLoGdugeFAYvoRw2jCgtQ0ZtOu0T2s40YsVockVUC1n480WHm7OFSXtiRY%2BRJUUJpI4Eh1MeCNgOqsydX5fVzOxvj1pf%2FFCjwsZMD1R768q6O5PRJpxHiFvPnKX6nABMy1rhh1mAzuQal9SD1qMFLIJkujCmDNAP3ap6%2FkjSu%2Bgaxxd96UEXo0AufwD7bEctkz%2B6MQgGaMqYdyWlFN0pElwGuZKTBGf%2F4TxgbNCnTDIq3Fqao1Qr3dzY9IgU2ogSbtOwBhZEFgFTUsd3Td9v%2BINdFH4v737fIVuUNL8Z1jIOH0A8Ufhqgjykzip%2FYkpqO%2BrymuBp5%2FfuTSLsXf8oDfuDIh%2BISBZBf6055%2BXQA4NT8dYkpreEdSsr6MjA%2B6eBShhansMGF%2BbTg%2F%2BiIGg5%2FwYRZnKgeH5ivhg%2BXd78tQ%2BdBww7TvKU6anPcyMODHVmlUWEC%2FaGrNs%2BZZJSm60za4F9LrQGJdNux99HNS5ez4ifMN1vs167c%2B0%2F17u3QFl1pF%2Bx2F04mO7mgyBmkJm%2BLUKb6RZy6zz2mpMl6MmnJ%2Fr9Moj3z0JGLFsdbInPxBOCT219n8uxEetfEOwYqqqYXI%2FNgow8Kuy0gY6mAHw9sP6Kfpq%2FyaVb8TSpJpo4BbVJ3z%2FHDViwMP9EWkdv1YH74y1%2BkK1yyoemyyaeQ%2BDSIpzU09kknA%2FIh2r1vAkr9%2F%2Fek1N6aJNHyUP0KktGAhGJkrS6U0bq1GBm8ahPcYorlhi5NmazQguGlC47sqi4K0rdeEau3WBJ7IRHspCCJSyVKLlyhxf0IkqXjX9%2BtyKRlL5gpMtrg%3D%3D&Expires=1783407555
