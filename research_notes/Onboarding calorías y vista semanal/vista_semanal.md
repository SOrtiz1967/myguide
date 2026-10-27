# Weekly overview home screens in fitness/nutrition apps: patterns, user sentiment, and non-shaming adherence display

Scope note: research run Oct 2026. Evidence quality varies. Primary sources (vendor docs, PubMed/PMC abstracts, W3C) are marked as such. Many app-store/Reddit-style claims come from secondary summaries; those are flagged. Items I could not verify are in "Gaps" of each section.

## 1. Existing week-at-a-glance patterns (Apple, Fitbit/Google, Whoop/Oura, MacroFactor, Cronometer, Lose It, MFP, Hevy/Fitbod, Strava, Garmin)

### Takeaway
Mainstream apps present a week mostly as (a) per-day binary "goal met" marks or rings with a streak layered on top (Apple, Hevy, Fitbod, Strava), or (b) a rolling trend/weekly-average view with no per-day verdict (MacroFactor). Only MacroFactor documents a deliberate neutral treatment of calorie overages. Most competitors' per-day layouts (Oura, Whoop, Garmin, Fitbit, Lose It, MFP) could not be verified from documentation.

### Cited Findings
- Apple Activity: three rings (red Move = active calories, green Exercise, blue Stand); an overlapping ring means the goal was exceeded; a Weekly Summary button gives "a daily average and weekly total of the progress you've made toward closing your rings"; a Calendar button on iPhone lets you tap a date to see past activity; Awards cover personal records, streaks and milestones — [Apple Watch User Guide: Track daily activity](https://support.apple.com/guide/watch/track-daily-activity-apd3bf6d85a6/watchos)
- Apple lets users pause rings for up to 90 days without breaking the award streak, set the Activity goal by day of week ("Schedule"), and receives a Monday notification about the previous week's achievements with a prompt to adjust next week's goals — [Apple Watch User Guide: Adjust your Activity ring goals](https://support.apple.com/en-bw/guide/watch/apd29b30023c/watchos) (as summarised by search; Macworld's launch coverage of watchOS 11 described a one-month pause limit, so the limit has apparently grown: [Macworld](https://www.macworld.com/article/2446605/how-to-pause-apple-watch-activity-rings.html))
- Apple added options to pause rings, set goals by weekday, and switch the watch face away from rings (attributed to watchOS 11); Apple declined to comment on the criticism — [Fortune, Jan 2025](https://www.fortune.com/well/2025/01/24/apple-watch-bullied-burn-calories-close-rings-obsession-fitness-trackers-notifications)
- MacroFactor: weekly check-in recommends calorie/macro changes from the *weight trend* and estimated expenditure; the trend (a moving average weighting recent weigh-ins, pale raw-weight line vs deep purple trend line) "strips away a lot of the noise inherent in body weight data"; gaps are linearly interpolated ("resilient to missing weight entries") — [MacroFactor help: weight trend](https://help.macrofactorapp.com/dashboard/weight_trend/); [MacroFactor help: weekly updates](https://help.macrofactorapp.com/en/articles/222-how-does-macrofactor-make-adjustments-for-a-weight-gain-or-weight-loss-goal)
- MacroFactor philosophy: "In the app's system for estimating energy expenditure, 'adherence' is irrelevant"; each week "is its own self-contained unit"; exceeding a target gives "just neutral information with no implied judgments attached"; "MacroFactor doesn't turn any numbers red"; "it's not an app's job to judge you for it" — [MacroFactor: Algorithms and Core Philosophy](https://macrofactor.com/macrofactors-algorithms-and-core-philosophy/)
- MacroFactor dashboard: "Habits" widget shows consistency of nutrition and weight *logging* over time; tapping any day lets you add/edit that day's data — [MacroFactor help: Consistency/Habits](https://help.macrofactorapp.com/dashboard/consistency) (the page does not describe the per-day visuals or what counts as "consistent")
- MacroFactor on carrying over under/overage between days: not recommended for most people, suggests staying "relatively close to your calorie targets most days"; warns that strict weekly budgeting could encourage binge-restrict patterns like undereating to "save up" for a weekend — [MacroFactor help: overages/rollover](https://help.macrofactorapp.com/en/articles/108-how-to-adjust-calorie-targets-to-account-for-overages-or-to-roll-over-unused-calories)
- MacroFactor bar behavior (SECONDARY, search-summary only, exact source page not confirmed): daily bars show a gray line at the target; the bar turns black (light mode) / white (dark mode) when target is reached or exceeded; tapping the selected day shows the week's intake vs targets. The App Store listing is reported to say there are no warnings, red numbers or shaming when over target — see search results at [MacroFactor smart nutrition coach](https://macrofactorapp.com/?p=4998) and [App Store listing](https://apps.apple.com/app/id1553503471).
- Cronometer: target bars turn green on reaching the minimum and red only past a user-set Maximum Threshold; calorie rings cannot show a custom fixed number (percentage of energy only) — [Cronometer forum: target range](https://forums.cronometer.com/discussion/4047/target-range-instead-of-single-value-for-fixed-macro-targets); [Cronometer forum: fixed calorie goal in diary](https://forums.cronometer.com/discussion/2555/how-to-show-fixed-calorie-goal-only-in-diary) (forum posts, including staff answers; not official docs)
- Cronometer (2018 thread): an update added a purple deficit/surplus scale with a red bold warning on hover ("you will gain weight") when above goal; a recovering user wrote "it makes me want to go back to not eating". Staff pointed to a profile setting ("Show Weight Goal in Diary") to hide the text, and an RD on staff said calories can be hidden in the profile and advised against calorie tracking in ED recovery — [Cronometer forum thread](https://forums.cronometer.com/discussion/1350/new-cronometer-update-isnt-great-if-youre-recovering-from-an-eating-disorder)
- Hevy: calendar (under Profile) marks workout days in blue and shows rest days elapsed since last workout; "weekly streak" = consecutive weeks with at least one logged workout; missed week can be repaired by logging a past workout dated within that week or logging another activity such as a walk; calendar cannot be used to plan workouts; user can pick week start day; home-screen widget shows weekly streak + rest days — [Hevy help: Calendar and Streak](https://help.hevyapp.com/hc/en-us/articles/35380117933207-Track-Your-Workout-Consistency-with-the-Calendar-and-Streak-Features) and [Hevy help: weekly streak](https://help.hevyapp.com/hc/en-us/articles/34467766576279) (read via search-result summaries; direct fetch returned 403)
- Fitbod: streak counts consecutive weeks in which the weekly workout goal was met — [Fitbod help](https://help.fitbod.me/hc/en-us/articles/360013245993) (search summary only)
- Fitbit/Google: weekly exercise goal default 5 days/week, adjustable 1-7; week starts Sunday by default and is user-changeable; weekly Active Zone Minutes goal default 150; Week toggle on the Zone Min tile — [Google Fitbit Help](https://support.google.com/fitbit/answer/14236510?hl=en), [AZM tile help](https://support.google.com/fitbit/answer/14236509) (day-level dots/checkmarks NOT confirmed)
- Whoop: goals are set per day, not week; a moderator acknowledged requests for weekly goal progress — [Whoop Community: Weekly Plan progress](https://www.community.whoop.com/t/weekly-plan-progress/11583)
- Garmin: Connect web dashboard caps step-goal at 100% (mobile reportedly does not); users request weekly summary widgets — [Garmin forum: step counter](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/128473/wrong-number-in-step-counter), [Garmin forum: weekly summary widgets](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-mobile-ios/441333/feature-add-weekly-summary-widgets-to-garmin-connect-ios)
- Strava Weekly Snapshot: top of Home feed, totals activities/time/distance for current week vs same point last week across all sports — [road.cc](https://road.cc/content/tech-news/stravas-weekly-snapshot-makes-me-feel-bad-307315)
- Gentler Streak replaces a binary streak with an "Activity Path" (horizontal bar showing load trend), treats rest as part of the model, lets users set an illness/injury/vacation status so the streak doesn't break (app-store copy and third-party reviews; no developer design document found) — [Apple App Store: Gentler Streak](https://apps.apple.com/us/app/gentler-streak-fitness-tracker/id1576857102); [Yahoo review](https://sg.news.yahoo.com/fitness-app-shows-apple-better-180000454.html); [Tapsmart](https://www.tapsmart.com/features/better-streaks-apps/)
- Lose It: a user blog says weekly under/over-budget display became "a record of my excesses" and they quit (anecdote); Lose It's official weekly layout/color rules NOT found — [Measure Mania](https://valthinks.substack.com/measure-mania)

### Inferences
- Two dominant paradigms: **per-day verdict + streak** (Apple, Hevy, Fitbod) vs **per-week unit + trend, adherence not graded** (MacroFactor). The product's constitution aligns with the second for calories; the first is appropriate only for workout "done" markers with soft, non-streak framing.
- A "day tap -> edit/see detail" interaction is common (MacroFactor, Apple calendar); it should be the default tap behavior for the product's strip.
- Apple's own retrofit (pause, per-weekday goals, hide-rings watch face) is evidence that fixed daily binary goals needed escape hatches; building those in from the start (schedule-aware, rest day not a miss) avoids the retrofit.

### Gaps
- Could not verify per-day layouts/colors for Oura, Whoop, Garmin Connect, Fitbit week view, Lose It, MyFitnessPal, Cronometer (only forums), Fitbod strip, or Strava's weekly goal UI; Reddit threads (r/MacroFactor, r/loseit etc.) were not retrievable via the search tool.
- MacroFactor's Habits per-day visuals and the black/white bar behavior are not confirmed against a primary page.

## 2. User preferences and complaints (streaks, red/green, over/under feedback, ring pressure, rest days, missed days)

### Takeaway
Complaints cluster around: late-night "close the ring" behavior, rest days feeling unrestful or counted as failure, streak loss causing abandonment, and red/over-goal warnings in calorie apps. Supporters say rings/streaks are motivating "tools or references". Evidence is mostly anecdotal; one RCT and one JCR paper offer controlled data.

### Cited Findings
- Reddit quote: "I feel ashamed but I've been taking a walk at 11:30 p.m. just to complete my ring before midnight."; trainer Katy Saltsman: "There's also this stress to hit these random numbers every single day, where even my rest days didn't feel restful."; counter-view (Reddit, Albert Lee): rings "are meant to be a tool or a reference, and not the end-all, be-all." — [Fortune, Jan 2025](https://www.fortune.com/well/2025/01/24/apple-watch-bullied-burn-calories-close-rings-obsession-fitness-trackers-notifications)
- Essays on fear of breaking streak while ill/grieving/on holiday — [TechRadar](https://techradar.com/health-fitness/smartwatches/my-apple-watch-is-going-to-hate-this-our-wearables-are-making-us-anxious-and-obsessive-heres-what-we-can-all-do-about-it); [Mostefinitely](https://mostefinitely.com/2021/05/03/im-breaking-up-with-my-apple-watch-rings/); [Close Your Rings Differently](https://nahumck.me/close-your-rings-differently/)
- Strava Weekly Snapshot: user "windrunner": "I do not enjoy how this serves almost entirely to make me feel bad about my effort so far in the current week" and asked for a toggle; others find it "a good reality check" and don't mind lower numbers — [road.cc](https://road.cc/content/tech-news/stravas-weekly-snapshot-makes-me-feel-bad-307315)
- Strava has no intuitive way to log a rest day; users add zero-duration activities — [Morning Shakeout](https://themorningshakeout.com/?p=5224) (blog)
- Freeletics forum: a "perfect week" streak that requires full volume pushes people to skip rest; request to ban the badge — [Freeletics forum](https://forum.freeletics.com/t/ban-the-perfect-week-streak-badge/6146)
- Gentler Streak App Store reviewer: "I no longer feel lazy if I don't work out on a given day" (reported via review article) — [Yahoo review](https://sg.news.yahoo.com/fitness-app-shows-apple-better-180000454.html)
- Streak research (JCR, 7 studies): highlighting an intact streak in a behavioral log increases later engagement versus highlighting a broken one; effect is bigger when people blame themselves for the break and smaller when the streak can be "repaired"; effect depends on how behavior is represented in the log, not actual past behavior — Silverman & Barasch, J Consumer Research 49(6), 2023 ([CU Boulder summary](https://www.colorado.edu/business/faculty-research/2023/04/19/or-track-how-broken-streaks-affect-consumer-decisions); abstract only, full text not read)
- Mobbin analysis of 859 streak designs: streaks drive app opens; cites "what-the-hell effect" (Polivy & Herman) and Lally's finding that missing one opportunity does not materially affect habit formation; repair/freeze/pause/reschedule patterns (Duolingo freezes, Alma 14-day pause, Runna reschedules missed workouts, Finch "repair" icon) — [Mobbin](https://mobbin.com/blog/streaks-are-about-losing-a-study-of-859-streak-designs) (design blog; secondary, claims of Duolingo numbers unverified)
- Randomized trial (n=162, 5 weeks): showing step counts 40% lower than true lowered self-esteem and activity-adequacy mindset, raised resting heart rate/MAP, and worsened diet, without changing actual steps; authors caution results are exploratory, small, unreplicated — Zahrt et al., JMIR 2023 ([PMC9909519](https://pmc.ncbi.nlm.nih.gov/articles/PMC9909519/))
- Limited causal evidence on streaks: a 2026 Northwestern working paper states there is little empirical evidence on streaks' causal effects — [Northwestern IPR WP-26-05](https://www.ipr.northwestern.edu/documents/working-papers/2026/wp-26-05.pdf) (via search summary)

### Inferences
- The same mechanism (loss aversion / self-blame) that makes streaks "work" for engagement is what produces anxiety; broken-streak salience is the harmful element. A display that never shows a "broken" state (only neutral blanks) avoids it.
- Rest days must be a first-class state, not an absence of data (Strava/Hevy complaints).
- Weekly-level framing ("N of M planned sessions this week") is less brittle than daily binary, but Strava's snapshot shows even weekly comparison to last week can feel bad; avoid week-over-week comparison against a past self by default.

### Gaps
- No direct Reddit/app-store review text retrieved for MacroFactor, Lose It, MFP, Cronometer, Hevy, Fitbod beyond those above; no quantitative survey on user preference for red/green.
- JCR full text not read; Duolingo figures are second-hand.

## 3. Research on tracking, gamification, streaks and eating-disorder risk; harm-reduction design

### Takeaway
Cross-sectional evidence consistently associates calorie/fitness-tracking app use with higher disordered-eating symptoms, and a clinical sample largely reported the app contributed to their illness, but causality is unestablished (people with symptoms may self-select into tracking). Design literature suggests limiting numeric/physiological metrics, avoiding confronting standard charts, and offering simple views with detail on request.

### Cited Findings
- Simpson & Mazzeo (2017, Eating Behaviors): undergraduates; regular calorie-tracking use associated with anxious food attitudes and greater likelihood of restrictive dieting; regular fitness-tracking use associated with ED-related behaviors and attitudes; reported prevalence 13.8% (calorie tracking) and 19.6% (fitness tracking); authors/commentators note users with existing symptoms may be more likely to track — summarised in [Psychology in Action](https://www.psychologyinaction.org/2018-4-29-calorie-counting-and-fitness-tracking-technology-associations-with-eating-disorder-symptomology/) (secondary source; PubMed page could not be fetched)
- Levinson, Fewell & Brosof (2017, Eating Behaviors 27:14-16): 105 adults recently discharged from residential/partial hospitalization (96.2% female, 74.3% anorexia nervosa); 74.3% used MyFitnessPal; 73.1% of users said it at least somewhat contributed to their ED, 30.3% "very much"; perceived contribution correlated with EDE-Q restraint, shape and weight concern; limitations: retrospective self-report, only MFP, yes/no usage, no causality; suggested apps add ED psychoeducation/screening beyond low-calorie warnings — [PMC5700836](https://pmc.ncbi.nlm.nih.gov/articles/PMC5700836/)
- Anderberg, Kemps & Prichard (2025, Body Image 52:101836), systematic review of 38 articles: young adult app users show more disordered eating than non-users, heavier users more; qualitative studies report pressure to meet goals and guilt; "No causal conclusions could be drawn" — [Flinders Research Now](https://researchnow.flinders.edu.au/en/publications/the-link-between-the-use-of-diet-and-fitness-monitoring-apps-body/)
- Linardon: I found only a citation of Linardon & Messer (2019, Eating Behaviors), MyFitnessPal use in men and ED symptoms/psychosocial impairment; findings not retrieved. No Linardon systematic review on this topic was found.
- Devakumar et al. (CHI 2021), review of ED apps: "It is essential to omit caloric intake and limit similar physiological metrics in these apps" (for ED-recovery apps); standardized visualizations can be "confronting" and cause distress or shame; start with a simple visualization and add complexity on request; logging burden causes abandonment — [PMC9128313](https://pmc.ncbi.nlm.nih.gov/articles/PMC9128313) (about ED-treatment apps, not general consumer nutrition apps; only first 100k chars read)
- Princeton student analysis argues MFP's single calorie threshold works against intuitive eating — [Tortoise (Princeton)](https://tortoise.princeton.edu/2021/05/02/4043) (student publication; low authority)
- Alliance for Eating Disorders suggests people in recovery may benefit from pausing trackers — [Alliance for Eating Disorders](https://www.allianceforeatingdisorders.com/fitness-trackers/)
- Cronometer precedent: hide-able weight-goal text and calories (see section 1 thread).
- MacroFactor precedent: no red, no warnings, adherence not graded (see section 1).

### Inferences
- Harm-reduction measures supported by this literature and by vendor precedents: (1) no red/alarm colors or "over" language; (2) user setting to hide calorie numbers/targets in the week strip (show only symbol or nothing); (3) no streaks or "perfect week" counters for calories; (4) no automatic comparison to previous week; (5) pointer to professional help/psychoeducation for low-intake patterns (Levinson recommendation); (6) default to simplest view, numbers on tap.
- The Simpson/Levinson data cannot tell us a weekly strip is harmful; they justify caution and opt-out controls, not a ban.

### Gaps
- Original abstracts of Simpson & Mazzeo and Anderberg full text not read (PubMed blocked); sample size of Simpson & Mazzeo not confirmed in my sources (a secondary search summary said 493 undergraduates; not verified).
- No RCT found isolating the effect of red/green coloring or over-goal feedback on ED symptoms.
- No evidence found on whether hiding calories reduces harm (inference only).

## 4. Tolerance-based status design: within range / below / above / no data; missing logging vs low intake; non-color cues (WCAG 1.4.1)

### Takeaway
I found no app documenting a "within about ±10%" band display; Cronometer's min/max thresholds are the closest precedent, and MacroFactor's trend-based approach makes per-day adherence irrelevant. WCAG requires a non-color cue; the rest of the state design below is inference.

### Cited Findings
- WCAG 2.2 SC 1.4.1 (Level A): "Color is not used as the only visual means of conveying information..."; adding a non-color cue (text, shape, pattern) resolves it; a lightness difference of at least 3:1 counts as an additional visual distinction; relying on e.g. green vs red requires an extra visual indicator regardless of contrast — [W3C Understanding SC 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
- Cronometer: bars green at minimum, red only above a user-set maximum; staff note users often miss that setting — [Cronometer forum](https://forums.cronometer.com/discussion/4047/target-range-instead-of-single-value-for-fixed-macro-targets)
- MacroFactor: missing weigh-ins are interpolated, not penalized; expenditure calculation pauses if weight isn't logged (weekly minimum, daily preferred) — [MacroFactor help: log frequency](https://help.macrofactorapp.com/en/articles/109-how-frequently-do-i-need-to-log-my-weight-for-the-expenditure-algorithm-and-weekly-coaching-updates)
- Cronometer staff RD cautioned numbers can be harmful in ED recovery and noted calories can be hidden — [Cronometer forum thread](https://forums.cronometer.com/discussion/1350/new-cronometer-update-isnt-great-if-youre-recovering-from-an-eating-disorder)
- Devakumar et al.: start with simple visualization, detail on demand — [PMC9128313](https://pmc.ncbi.nlm.nih.gov/articles/PMC9128313)

### Inferences (design proposal, not from a source)
- Four states plus one: `en rango` (within band, e.g. target ±10%, band width configurable), `por debajo`, `por encima`, `sin registro`, and optionally `registro parcial`. Treat `por debajo` and `por encima` symmetrically in color/weight (same neutral hue family, different shape), never green vs red, never an alert icon.
- Distinguish `sin registro` (empty/dotted outline, "sin datos") from `por debajo`: a day with no entries must never be shown as "low intake"; a day with only a partial log should be labelled "registro parcial" rather than evaluated, because a low total may just be incomplete logging. Do not compute band status for days with no/partial log.
- Shape coding that works in grayscale: filled circle = in range; half-filled or ring with small down-tick = below; ring with small up-tick = above; dashed empty circle = no data. Add text/aria label ("en rango", "por debajo", "por encima", "sin registro") for screen readers (WCAG 1.4.1 + 1.4.11 for 3:1 contrast of the marker vs background).
- Use sentence-case neutral words ("por encima de tu objetivo") not "excedido", "fallaste", "superaste el límite". Offer a switch "mostrar solo si registré" / "ocultar calorías" so the strip can show only logged vs not logged.
- Whether a band of ±10% is the right width is a product choice; I found no evidence to support a specific percentage (see Gaps).
- Weekly summary line beside strip: "Promedio 7 días: X kcal (objetivo Y)" rather than counting "days hit".

### Gaps
- No source for ±10% as a tolerance band in nutrition apps; no usability study on tolerance-range statuses.
- Apple HIG and Material Design color/accessibility pages could not be fetched (page returned no body / 404), so no direct HIG/Material quotes; NN/g status-indicator page 404.
- No evidence found on how partial logging is treated by MyFitnessPal, Lose It, or Cronometer.

## 5. Workout status per day: planned, done, modified, rescheduled, rest, unplanned; compact weekly strip patterns

### Takeaway
Few consumer apps distinguish all these states in one strip. Existing patterns: Hevy shows workout days only (no plan), TrainerRoad/Garmin use planned vs completed calendars with skipped items, Runna/MuscleBooster reschedule missed sessions, Gentler Streak adds illness/vacation status. A taxonomy must be mostly inferred.

### Cited Findings
- Hevy calendar: workout days colored blue, rest days implied (days without a logged workout), calendar can't schedule planned workouts — [Hevy help](https://help.hevyapp.com/hc/en-us/articles/35380117933207-Track-Your-Workout-Consistency-with-the-Calendar-and-Streak-Features) (via search summary)
- Garmin Connect: users cannot move a missed workout; the training calendar shows it as a rest day on the watch — [Garmin forum](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/214040/reschedule-missed-workout-on-a-training-plan/1744214)
- TrainerRoad: users advised to leave skipped workouts on the calendar since adaptive training uses them; alternatively move them to a day they will do — [TrainerRoad forum](https://trainerroad.com/forum/t/should-i-delete-a-skipped-or-missed-workout-from-the-calendar/70009)
- intervals.icu: skipped planned workouts disappear from calendar unless "show past planned workouts" is on — [intervals.icu forum](https://forum.intervals.icu/t/skipped-workouts-are-still-counted/905)
- Runna moves a missed workout into the current week; Finch shows missed days with a repair icon; Alma allows 14-day pauses — [Mobbin](https://mobbin.com/blog/streaks-are-about-losing-a-study-of-859-streak-designs) (secondary)
- Apple: rings can be paused; goals scheduled by weekday (e.g., lower or zero goal on rest day) — [Apple Watch User Guide](https://support.apple.com/en-bw/guide/watch/apd29b30023c/watchos)
- Strava has no official rest-day logging — [Morning Shakeout](https://themorningshakeout.com/?p=5224)
- A Musclebooster help page says a missed workout is marked as rest day and rescheduled to next available day — [Musclebooster help](https://help-centre.musclebooster.welltech.com/en-us/features-personalization1/what-if-i-miss-a-day-of-my-training) (search summary only)

### Inferences (design proposal)
- Minimal per-day vocabulary for a 7-cell strip (shape + label, not color): `hecho` (filled), `planificado, pendiente` (hollow ring, only for today/future), `hecho con cambios` (filled with small modification mark), `movido` (planned ring with arrow, shown on the new day; origin day shows plain rest), `descanso` (small dash or moon glyph, intentionally "complete", not blank), `sesión no planificada` (filled with small plus), `sin sesión planificada ni hecha` (empty).
- Past planned but not done should render as the neutral `movido/no realizado` hollow ring, not an X or red; tapping offers "marcar como hecho / mover / descansé" in one step (repair instead of reset; supported by Silverman & Barasch finding that repairable breaks attenuate the drop).
- Show a week count ("3 de 4 sesiones") only as secondary text; do not build a cross-week streak. If a streak-like element is desired, count weeks with any activity (Hevy-style) with built-in pause, never daily.
- Rest days defined by the routine (no planned session) must not be counted as missed; this follows the user complaints about rest days in Apple Rings, Strava and Freeletics.

### Gaps
- No direct teardown/screenshot of Fitbod, Strong, Hevy, Whoop, or Oura week strips; layouts for "modified" and "rescheduled" states are not documented in any source found.
- No user-testing data on compact status vocabulary.

## 6. Weekly summary patterns: 7-day averages vs single-day verdicts

### Takeaway
Averaging over a week (or a trend) before drawing conclusions is the explicit design philosophy of MacroFactor and is common among weight-trend tools; single-day verdicts are what users criticize in Strava's snapshot and in Apple's daily rings. Evidence for effects on mental health of weekly vs daily display is not found.

### Cited Findings
- MacroFactor: a single high-calorie or high-sodium day is absorbed by the weight trend so "the algorithms won't over-react"; targets update weekly from trend, "regardless of how close you came to hitting your targets from the previous week" — [MacroFactor philosophy](https://macrofactor.com/macrofactors-algorithms-and-core-philosophy/)
- MacroFactor help: weight trend is a moving average, "peace of mind by not reacting to daily swings", and perfect adherence can still yield a misleading single-week scale change — [MacroFactor help: weight trend](https://help.macrofactorapp.com/dashboard/weight_trend/)
- Apple's Weekly Summary shows a daily average and weekly total — [Apple Watch User Guide](https://support.apple.com/guide/watch/track-daily-activity-apd3bf6d85a6/watchos)
- A Cronometer forum answer notes the average matters more than single days for deficit (user explanation, not official) — [Cronometer forum](https://forums.cronometer.com/discussion/comment/5340)
- Lally (UCL) finding that missing a single opportunity does not materially affect habit formation (cited via design blog) — [Mobbin](https://mobbin.com/blog/streaks-are-about-losing-a-study-of-859-streak-designs)
- MacroFactor warns that day-to-day compensating ("save up" calories) can encourage binge-restrict patterns — [MacroFactor help: overages](https://help.macrofactorapp.com/en/articles/108-how-to-adjust-calorie-targets-to-account-for-overages-or-to-roll-over-unused-calories)

### Inferences
- A weekly summary card could show: 7-day average intake in the same neutral language, number of days with a log (e.g., "5 de 7 días con registro"), and sessions done vs planned, without a pass/fail label. Require a minimum number of logged days (e.g., 4) before showing an average, and say "pocos datos" otherwise, mirroring the guidance to avoid firm conclusions from single measurements.
- Do not show "calories remaining to hit weekly total" or compensation prompts, given MacroFactor's own warning.
- Avoid default week-over-week comparison (Strava complaint).

### Gaps
- No peer-reviewed evidence found comparing 7-day-average displays with daily displays on psychological outcomes.
- Specifics of Oura/Whoop weekly summaries not verified.
