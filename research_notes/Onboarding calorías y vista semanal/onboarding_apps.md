# First-run onboarding in fitness and nutrition apps (body data + goal before the main screen)

Method note: most of the apps' own flows sit behind sign-up walls or paywalls, so screen-by-screen detail comes from help centers, teardown sites (Lazyweb, ScreensDesign) and search-result summaries. Where a source gave only a partial picture, the Gaps section says so. Ranges and counts differ between sources and are flagged. Nothing here was verified by installing the apps.

## 1. Concrete onboarding flows of the leading apps (questions, order, how the calorie target is presented)

### Takeaway
Two archetypes exist. Long "quiz + program" flows (Lose It, MyFitnessPal, Runna, MacroFactor: 25 to 85 screens) collect many inputs and put a paywall after the plan reveal. Lean flows (Strong, Apple Activity) ask only the few numbers the formula needs. The nutrition apps that publish their logic (MacroFactor, Cronometer) all end with the same chain: demographics + body + activity -> a formula-based starting TDEE -> goal + weekly rate -> calorie target, explicitly labelled a rough starting estimate.

### Cited Findings
**MacroFactor**
- Setup is a wizard that sets up "a coached program based on your goals and preferences". Initial expenditure comes from a standard TDEE formula using "basic demographic, anthropometric, and lifestyle characteristics", and the page warns the initial calculation "will considerably over- or underestimate your energy needs". — [MacroFactor Welcome](https://macrofactor.com/welcome/)
- The goal wizard order: pick primary objective (lose / maintain / gain), then target weight and rate of change, then the app generates an initial daily calorie budget and projected timeline that the user can adjust, then a goal summary screen (starting weight, target weight, weekly change, how targets will be adjusted). — [MacroFactor goal features](https://macrofactor.com/goal-features/)
- Goal rate is expressed as a percentage of body weight per week, so absolute change shrinks as weight falls (0.5%/week at 200 lb is 1 lb; at 180 lb it is 0.9 lb). — [MacroFactor help 222](https://help.macrofactorapp.com/en/articles/222-how-does-macrofactor-make-adjustments-for-a-weight-gain-or-weight-loss-goal) (via search summary; the page itself states rate in % body weight)
- A 1 lb/week loss is roughly a 500 kcal/day deficit (target = expenditure minus about 500). — [MacroFactor help search summary](https://help.macrofactorapp.com/en/articles/222-how-does-macrofactor-make-adjustments-for-a-weight-gain-or-weight-loss-goal)
- Escape hatches for a wrong starting number: enter a manual initial expenditure, back-fill 3-4 weeks of weight/nutrition through "Data & Habits" then create a new program, import ~30 days from an integration, or reduce the goal rate. Estimates become personalised after about 3-4 weeks (the Welcome page says 2-4). — [MacroFactor help 206](https://help.macrofactorapp.com/en/articles/206-what-should-i-do-if-my-initial-expenditure-or-recommended-energy-intake-seems-too-high-or-too-low); [MacroFactor calories low/high](https://macrofactor.com/calories-low-high/)
- MacroFactor will not push fat intake below a minimum; once fat hits it, further reductions come from carbs. No general calorie floor is stated on that page. — [MacroFactor help 222](https://help.macrofactorapp.com/en/articles/222-how-does-macrofactor-make-adjustments-for-a-weight-gain-or-weight-loss-goal)
- Teardown: 47 steps, hard paywall with free trial after "a lengthy and engaging onboarding"; teardown suggests an optional "quick start". One review quotes a user's quiz as: weight, height, gender, goal weight, activity level. — [ScreensDesign MacroFactor](https://screensdesign.com/showcase/macrofactor-macro-tracker); [Champagne and Coffee Stains review](https://www.champagneandcoffeestains.com/macrofactor-review/)
- One search summary says an initial estimate uses Cunningham plus activity multipliers (this needs body-fat data); MacroFactor's own pages only say "a standard formula". Treat the Cunningham claim as unconfirmed. — [MacroFactor Welcome](https://macrofactor.com/welcome/)

**Cronometer**
- Sign-up asks for details used to calculate targets; mistakes can be edited later after login. Activity level is chosen with a slider; the weight goal then adds or subtracts calories; based on the goal rate the system recommends a daily budget. Review/edit under More > Targets + Profile. Default macro targets are set to Dietary Reference Intake minimums. — [Cronometer support (via search)](https://support.cronometer.com/hc/en-us/articles/360021897491-Web-Quick-Start-Guide)
- Complaint pattern: a user entering a -2 lb/week goal got 851 kcal ("seems crazy low"); staff replied the deficit is applied automatically once a weight goal is added. — [Cronometer forum](https://forums.cronometer.com/discussion/comment/12448)

**Lose It**
- Longest onboarding of 129 tracked flows: 70 screens vs median 11 (another teardown reports 85 steps; counts vary by capture). — [Lazyweb longest flows](https://www.lazyweb.com/research/longest-app-onboarding-flows); [ScreensDesign Lose It](https://screensdesign.com/showcase/lose-it-calorie-counter)
- Visible start of flow: welcome (create account / sign in), iOS tracking permission, "build your personalised plan" checklist (Weight Goal, Calorie Budget, Calorie Schedule, Nutrition Strategy, Intermittent Fasting), "What's your primary goal?", biggest obstacle question. — [Lazyweb Lose It flow](https://www.lazyweb.com/flow/lose-it/onboarding)
- Later screens (per teardowns): exercise plan survey, strength-training education, scrolling weight wheel, "Generating Your Custom Plan" loader, plan summary with projected target and timeline, then soft paywall with free trial after the plan is built. The plan includes a "Flexible Weekender Schedule" for higher-calorie weekends. — [ScreensDesign Lose It](https://screensdesign.com/showcase/lose-it-calorie-counter); [Lazyweb company page](https://lazyweb.com/canvas/companies/lose-it)
- Length was deliberate: a Lose It executive said they added questions, some not even used for setup, and got double-digit gains in trial-start rate. — [Sub Club / BetterLaunch playbook (via search summary)](https://www.betterlaunch.co/playbooks/episodes/lose-it-freemium-mission)
- Teardown strengths: checklist framing makes long setup feel purposeful; weaknesses: 85 steps before the app, tutorial pop-ups obscure UI. — [ScreensDesign Lose It](https://screensdesign.com/showcase/lose-it-calorie-counter)

**MyFitnessPal**
- Roughly 25 steps (Lazyweb) with goal selection, a quiz on goals, past struggles and lifestyle, basic metrics (age, height, current weight), motivational interstitials, and a paywall after the quiz. Exact question order not recoverable (screens behind sign-up). — [Lazyweb MFP flow](https://lazyweb.com/canvas/flows/myfitnesspal/onboarding); [ScreensDesign MFP](https://screensdesign.com/showcase/myfitnesspal-calorie-counter); [CleverTap (ES)](https://clevertap.com/es/blog/onboarding-de-aplicaciones-que-es-12-mejores-ejemplos-para-aprender/)
- Community reports: goal derives from current weight + weekly loss target; lower goals get reset to 1200 kcal and a warning appears (one German user; another claims 1500 for men, unconfirmed). — [MFP community (DE)](https://community.myfitnesspal.com/de/discussion/1471510/zu-viel-oder-zu-wenig)

**Fitbod (strength training)**
- Setup covers goal (strength / muscle / leaner / weight loss), experience (beginner / intermediate / advanced), equipment (full gym to bodyweight), injuries or limits, plus optional split and session duration. If onboarding is skipped, experience level can be set manually later in Gym Profile / My Plan. — [Fitbod blog](https://fitbod.me/blog/how-fitbod-builds-personalized-strength-programs-without-a-trainers/); [Fitbod help](https://help.fitbod.me/hc/en-us/sections/360001927994-Getting-Started) (via search summary; the help article returned HTTP 403 on direct fetch)

**Hevy**
- "Hevy Trainer" flow asks: top goal, training experience, gender, birthday, weight, height, available equipment, workout frequency, workout length, muscle focus, then acceptance of health terms. This is the program-builder flow, not necessarily first launch. — [Hevy help](https://help.hevyapp.com/hc/en-us/articles/38385724273047-Hevy-Trainer-Explained-How-It-Builds-Your-Workout-Program) (via search summary; direct fetch 403)

**Strong**
- Minimal welcome screen with Sign in with Apple; units lbs/kg selectable; developers acknowledged the 5.0 onboarding needed smoothing. — [ScreensDesign Strong](https://screensdesign.com/showcase/strong-workout-tracker-gym-log)

**Runna**
- A detailed quiz: running ability and recent race/5K pace, goal distance, weekly availability and run days, optional strength sessions, terrain/hilliness; paywall at the end of the quiz. — [Runna teardowns via search](https://screensdesign.com/showcase/runna-running-training-plans); [uxdesign.cc case study](https://uxdesign.cc/how-to-nail-onboarding-a-case-study-of-runna-7780ba89c202) (direct fetch 403)

**Apple Activity / Fitness**
- Watch Activity setup asks sex, age, height, weight, wheelchair use, then an activity level; the Move goal is personalised from these. Wheelchair use switches Stand ring to Roll ring. Setup can be declined and done at first open of the Activity app. — [Apple Watch guide](https://support.apple.com/guide/watch/track-daily-activity-with-apple-watch-apd3bf6d85a6/watchos) (wheelchair/decline points confirmed); inputs list from [search summary of Apple support](https://support.apple.com/en-lk/guide/watch/apd3bf6d85a6/8.0/watchos)
- HealthKit's biological sex type has four values: not set, female, male, other. — [Apple HKBiologicalSex docs (via search)](https://developer.apple.com/documentation/healthkit/hkbiologicalsex.md)

**Category length benchmark**
- Health & Fitness median onboarding: 20.5 screens (n=26); overall median 11; 12 of 129 flows (9.3%) exceed 30 screens. — [Lazyweb](https://www.lazyweb.com/research/longest-app-onboarding-flows)

### Inferences
- Common question order across apps (inferred from the above): goal type -> body data (sex/age/height/weight) -> activity level -> target weight and rate -> computed target -> account/paywall. Training apps put goal -> experience -> equipment -> days/duration -> body data.
- The minimum set a calorie formula needs is sex, age, height, weight, activity, goal direction and weekly rate (the Cronometer and Apple inputs). Everything else in the long flows (obstacles, "how did you hear about us", terrain) is engagement or marketing, not computation.
- The long-flow pattern is monetisation-driven (pre-paywall investment). It does not transfer to a free PWA for one user; copying the lean subset plus an editable result is safer.
- A designer can copy MacroFactor's end state (summary: start weight, target, rate, projected timeline, "adjustable", labelled as starting estimate) and Cronometer's "edit later under Targets + Profile".

### Gaps
- No full question-by-question order for MyFitnessPal, Hevy first launch, Strong, Fitbod, Runna or Fitness+ was retrievable (screens gated, help pages returned 403).
- No source for Fitness+ onboarding beyond Apple Watch Activity setup.
- No verification of which BMR equation MacroFactor/MFP/Lose It use.

## 2. Best practice for multi-step forms on mobile (one question per screen vs grouped, progress, skip/edit, units, validation, partial save, accessibility)

### Takeaway
Authoritative guidance converges on: logically grouped steps, tell users up front how many steps, show progress at every step, allow save/resume and back without data loss, mark optional steps with a way to skip, never re-ask known data, and do not hide state from screen readers. One-question-per-page is favoured by government design systems for focus and accessibility, at the cost of length.

### Cited Findings
- NN/g wizards: use for novices and infrequent setup tasks; show the full process and current step and say how many steps; descriptive Next/Back labels (generic "Next" has weak information scent); "Allow users to exit the wizard midway and save state"; each step self-sufficient; help beside, not over, the wizard; reuse earlier selections as defaults. — [NN/g Wizards](https://www.nngroup.com/articles/wizards/)
- W3C WAI multi-page forms: divide into logical groups; tell users the number of steps at the start; put progress first in the page title ("Step 2 of 4: ..."), repeat it in the main heading; step indicator as an ordered list with hidden text for completed/current; make optional steps recognisable and skippable; save data in the current step when the user navigates back. — [W3C WAI](https://www.w3.org/WAI/tutorials/forms/multi-page/)
- The HTML `progress` element is suitable when step count varies with answers, but OS animation can violate WCAG 2.2.2. — [W3C WAI](https://www.w3.org/WAI/tutorials/forms/multi-page/)
- WCAG 2.2 SC 3.3.7 Redundant Entry (Level A): information already entered in the same process must be auto-populated or selectable. — [W3C Understanding 3.3.7](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html)
- Alberta design system: one question per page lets users focus and recover from errors, and helps screen reader users; validate small sets of questions at a time. — [Alberta question page pattern](https://design.alberta.ca/patterns/question-page) (via search summary)
- Visa/other guidance: avoid a horizontal stepper on every page when branching makes step count unstable. — [Visa wizard pattern](https://design.visa.com/patterns/wizard) (via search summary; low-confidence paraphrase)
- Baymard: only 14% of checkouts mark both required and optional fields, linked to errors and abandonment; collapse or split forms when 10-15+ fields are visible; input masks cut hesitation and validation errors. Scope is e-commerce checkout. — [Baymard required/optional](https://baymard.com/blog/required-optional-form-fields); [Baymard input fields](https://baymard.com/learn/input-fields) (via search summaries)
- Fitness-app teardown evidence: Lose It uses a persistent checklist to make a long flow feel structured; a scrolling weight wheel makes numbers concrete; MacroFactor teardown recommends a quick-start option. — [ScreensDesign Lose It](https://screensdesign.com/showcase/lose-it-calorie-counter); [ScreensDesign MacroFactor](https://screensdesign.com/showcase/macrofactor-macro-tracker)
- Units: Strong supports kg, lb or mixed. — [ScreensDesign Strong](https://screensdesign.com/showcase/strong-workout-tracker-gym-log)

### Inferences
- For about 7-9 body/goal inputs, grouping into 3-4 steps ("About you", "Your activity", "Your goal", "Review") with a visible "Step n of N" meets NN/g and WAI guidance; one-question-per-screen is defensible for the goal choice and for numeric entry of weight/height where large controls and unit toggles help.
- Persist each step to the server (or local draft) on advance so an interrupted user resumes; for a multi-user-safe PWA, key the draft by authenticated user id.
- Unit handling is not covered by an authoritative source here; a unit toggle (kg/lb, cm/ft-in) with canonical storage in metric is an inference from the Strong/Apple examples, not a sourced rule.
- Use native input types (`inputmode="decimal"`, `autocomplete` tokens) for validation help; this is general practice, not sourced from the pages above.

### Gaps
- NN/g's own mobile-form and progress-indicator articles were not retrieved (the wizard article does not discuss progress bars).
- No controlled study on one-question-per-screen vs grouped for health onboarding was found.
- No source on soft vs hard validation ranges for weight/height.

## 3. Explaining "why we ask" for sensitive data, privacy, and users who decline to give a value

### Takeaway
Baymard's field research shows that unexplained required sensitive fields cause false data and abandonment, and the fix is to explain, make optional, or remove. Apple and Hevy treat sex/age/height/weight as inputs to a calculation and allow skipping or "not set". Specific app "why we ask" microcopy was not retrievable.

### Cited Findings
- Baymard: with a required phone field and no explanation, some participants gave false information or abandoned; recommended fix is to explain why, make it optional, or remove it. Figures reported: 14% would abandon if required; 39% of sites (earlier version 58%) fail to explain. Treat numbers as unverified. — [Baymard phone explanation](https://baymard.com/research-articles/explain-phone-number-field) (via search summary; page not fetched)
- Apple Watch lets the user decline Activity configuration during setup and complete it later; Macworld notes some details can be skipped. — [Apple Watch guide](https://support.apple.com/guide/watch/track-daily-activity-with-apple-watch-apd3bf6d85a6/watchos); [Macworld (via search)](https://www.macworld.com/article/671632/best-tools-to-manage-iphone.html)
- HealthKit models sex with "not set" and "other" values. — [Apple HKBiologicalSex (via search)](https://developer.apple.com/documentation/healthkit/hkbiologicalsex.md)
- Cronometer: entry errors can be fixed after login. — [Cronometer support (via search)](https://support.cronometer.com/hc/en-us/articles/360021897491-Web-Quick-Start-Guide)
- MacroFactor lets users bypass the formula entirely by entering a manual expenditure, which removes need for some body inputs. — [MacroFactor help 206](https://help.macrofactorapp.com/en/articles/206-what-should-i-do-if-my-initial-expenditure-or-recommended-energy-intake-seems-too-high-or-too-low)
- Hevy ends its Trainer questions with an explicit health terms/policy acceptance step. — [Hevy help (via search)](https://help.hevyapp.com/hc/en-us/articles/38385724273047-Hevy-Trainer-Explained-How-It-Builds-Your-Workout-Program)
- Lose It asks the iOS tracking-permission prompt as the second screen, before any personal question. — [Lazyweb Lose It](https://www.lazyweb.com/flow/lose-it/onboarding)

### Inferences
- A one-line "Para qué lo usamos" under each sensitive field (age and sex: ecuación de metabolismo basal; weight: punto de partida del objetivo; height: ecuación de metabolismo basal) plus "se guarda solo en tu cuenta" matches Baymard's recommendation; no app teardown here confirms this exact microcopy.
- Skip behaviour for a decliner: allow "Prefiero no decirlo" for sex/age and fall back to a manual calorie target or a sex-neutral midpoint estimate with an explicit "estimación menos precisa" label. This follows MacroFactor's manual-expenditure override and HealthKit's "not set"; the fallback design is the writer's inference.
- Ask the least invasive, highest-value fields first and keep weight on the same step as its purpose (calorie target).

### Gaps
- No app's actual "why we ask" copy was found; teardown pages show screens as video only.
- No privacy-policy/GDPR/LGPD/Latin-American health-data law analysis was done; the target jurisdiction of the product is unknown to this researcher.
- No evidence on how apps treat a user who refuses to provide weight specifically.

## 4. Showing the computed calorie target: inputs and math, ranges, adjustability, non-shaming wording, inclusive sex wording

### Takeaway
The best-documented pattern is MacroFactor's: a goal summary with start/target weight, weekly rate and timeline, explicit "starting estimate, will be refined" language, and an easy path to change rate or enter a manual value. Complaints show that very low targets (e.g. 851 kcal) arise when apps silently apply an aggressive rate without surfacing the deficit.

### Cited Findings
- MacroFactor shows a goal summary (starting weight, target weight, weekly change, how targets adjust) and describes the budget as a starting point refined as it learns. — [MacroFactor goal features](https://macrofactor.com/goal-features/)
- MacroFactor says to check the goal first when intake seems low: "slowing the target rate usually fixes this"; also that targets may sit below a calorie floor and bulking surpluses can be intentionally small. — [MacroFactor help 206](https://help.macrofactorapp.com/en/articles/206-what-should-i-do-if-my-initial-expenditure-or-recommended-energy-intake-seems-too-high-or-too-low)
- MacroFactor "calories feel too low" article attributes mis-estimates to unrealistic starting numbers, incomplete logging and aggressive goal rate; recommends reducing rate, and mentions a green slider range as "more sustainable for most people". — [MacroFactor calories low/high](https://macrofactor.com/calories-low-high/)
- MacroFactor does not ramp up aggressiveness to catch up after falling behind, because steeper deficits mainly increase lean mass loss. — [MacroFactor help 202 (via search)](https://help.macrofactorapp.com/en/articles/202-what-should-i-do-if-i-m-pursuing-a-goal-with-a-strict-timeline)
- Lose It plan summary shows projected target and timeline after a "Generating Your Custom Plan" loader; offers calorie schedule for higher weekends. — [Lazyweb company page](https://lazyweb.com/canvas/companies/lose-it); [ScreensDesign Lose It](https://screensdesign.com/showcase/lose-it-calorie-counter)
- MyFitnessPal: community reports a 1200 kcal floor and a warning below it; not documented in an official page found. — [MFP community (DE)](https://community.myfitnesspal.com/de/discussion/1471510/zu-viel-oder-zu-wenig)
- Cronometer: 851 kcal result confusion; staff say deficit is "already calculated". — [Cronometer forum](https://forums.cronometer.com/discussion/comment/12448)
- Research context on harm: a survey of 105 people with eating disorders reported 30% used MFP and believed it contributed; other studies associate calorie-tracking tech with restrictive dieting (secondary summaries, mixed quality). — [Recatalyst summary](https://recatalyst.org/3499/showcase/the-mental-health-impact-of-myfitnesspal/); [First Steps ED](https://firststepsed.co.uk/?p=10790)
- Mifflin-St Jeor and Harris-Benedict use sex-specific constants, so a sex input is required to apply them; one source labels constants as "assigned at birth". — [Healthline BMR (via search)](https://www.healthline.com/health/what-is-basal-metabolic-rate)
- HealthKit offers female / male / other / not set for biological sex. — [Apple HKBiologicalSex (via search)](https://developer.apple.com/documentation/healthkit/hkbiologicalsex.md)

### Inferences
- A copyable result screen: big number (kcal/day) with "estimación inicial", one line of math (mantenimiento estimado X, objetivo -Y por semana = Z), a range (e.g. +/-10% or an "approx" band) , a rate control, and a visible "Editar objetivo" and "Poner mi propio número". MacroFactor and Cronometer cover each of these elements individually; no single app source shows all.
- To avoid extreme targets: cap the weekly rate by a % of body weight (MacroFactor convention), enforce a calorie floor with a neutral message, and make the default rate conservative. The specific numeric floor/cap is not sourced here.
- Non-shaming wording: describe the number as a starting estimate to be adjusted by data, avoid "you are overweight" or goal-weight judgments, avoid red warnings; MacroFactor's tone (starting point, trust the process) is the nearest model. Evidence of effect on outcomes was not found.
- Inclusive sex wording: label the field by its function ("Sexo para la fórmula de metabolismo basal"), offer "Prefiero no decirlo / Otro" with a documented fallback (average of both constants, flagged as less precise). The fallback is the writer's design inference; no app source was found for it.

### Gaps
- No official numeric floor or max-rate rule was found for MacroFactor, MFP or Lose It (MFP floor only from forum posts).
- No app was found documenting inclusive sex wording in its calorie flow; Apple HealthKit values are the only concrete example.
- No clinical source (e.g. dietetic guideline for safe weekly loss rate) was retrieved in this pass; do not state numbers as sourced.
- Muscle gain and recomposition goals: MacroFactor mentions gain/lose/maintain and intentionally small surpluses; no source on how apps present "recomposition".

## 5. Evidence on onboarding drop-off and conversion for health apps

### Takeaway
Hard primary benchmarks (Appcues, UserOnboard, NN/g) were not found; available figures come from vendor blogs and conflict. The strongest first-hand evidence is the Lose It case, where adding questions raised trial starts, which shows long flows work when monetisation follows the plan reveal, not that they suit free apps.

### Cited Findings
- Lose It: more onboarding questions (some unused) produced double-digit gains in trial-start rate; they extended until diminishing returns. — [Sub Club / BetterLaunch (via search)](https://www.betterlaunch.co/playbooks/episodes/lose-it-freemium-mission)
- Median onboarding across 129 flows is 11 screens; Health & Fitness median 20.5; only 9.3% exceed 30 screens. — [Lazyweb](https://www.lazyweb.com/research/longest-app-onboarding-flows)
- Vendor blogs: health/fitness onboarding completion roughly 60-80% (one source), versus 8-9% quoted elsewhere (conflicting, definition unclear); Day-1 activation about 26% falling to about 10% by day 28 (Business of Apps, cited secondhand); paywall prompts 30-60% drop-off; Day-30 retention 4-8%. — [Lifecycle Architect](https://lifecyclearchitect.com/guides/onboarding-optimization-for-fitness-apps/); [SEMNexus](https://semnexus.com/app-onboarding-flow-benchmarks-where-users-drop-off-2026) (via search summary; low-confidence)
- Noom web-to-app funnel reaches 113 screens and 10-15 minutes (comparison). — [RevenueCat](https://www.revenuecat.com/blog/growth/web-to-app-onboarding-funnel.md) (via search summary)
- Baymard (e-commerce analog): required unexplained field -> 14% abandonment claim; collapse long forms. — [Baymard](https://baymard.com/research-articles/explain-phone-number-field)

### Inferences
- Do not reuse subscription-funnel benchmarks for a free single-user PWA; the incentive to lengthen disappears. A short flow (about 5-8 screens) is below the health median and avoids the long-flow drop-off risk.
- Treat all drop-off percentages above as directional only.

### Gaps
- No Appcues, UserOnboard or NN/g quantitative health-app onboarding dataset was retrieved.
- No data on drop-off per question (e.g. at weight entry) was found.

## 6. User complaints (app reviews, Reddit, forums) about onboarding length, aggression and inaccuracy

### Takeaway
Most verifiable complaints concern inaccurate or too-low starting targets rather than question count; length complaints appear mainly in teardown commentary. Direct r/MacroFactor, r/loseit and App Store review text was not retrievable, so complaint evidence is thin and secondhand.

### Cited Findings
- MacroFactor itself warns the starting estimate may be "too high or too low", with common causes unrealistic starting numbers, partial logging and aggressive rate; this suggests it is a recurring support issue. — [MacroFactor calories low/high](https://macrofactor.com/calories-low-high/)
- r/MacroFactor mirror: recurring "calories seem low" thread (Nov 2024); a commenter believed ~1,532 kcal was the floor for men (unverified). — [r/MacroFactor mirror](https://nyc1.lr.ggtyler.dev/r/MacroFactor/comments/1gpz9pj/another_calories_seem_low_thread)
- Cronometer forum: 851 kcal target after a -2 lb/week goal, "seems crazy low". — [Cronometer forum](https://forums.cronometer.com/discussion/comment/12448)
- Older MFP-related forum posts: 1210 kcal goal for a modest loss; users advise slower rate or adding 100-300 kcal (2012-2013, anecdotal). — [The Knot forum](https://forums.theknot.com/discussion/comment/399690)
- Aggregated review summary says MacroFactor overwhelms casual users and feels "clinical or demanding"; most frequent complaints are cost and food database, not onboarding. — [Macaron reviews summary](https://macaron.im/playbook/macrofactor-reviews) (secondary, low quality)
- Teardown critiques: Lose It 85 steps with tutorial pop-ups obscuring UI; MacroFactor 47 steps "exceptionally thorough but also very long". — [ScreensDesign Lose It](https://screensdesign.com/showcase/lose-it-calorie-counter); [ScreensDesign MacroFactor](https://screensdesign.com/showcase/macrofactor-macro-tracker)
- Strong's developers said onboarding after the 5.0 rebuild needed smoothing, and a reviewer called the learning curve steep. — [ScreensDesign Strong](https://screensdesign.com/showcase/strong-workout-tracker-gym-log)
- Competitor-authored (Nutrola) claim that Reddit users like Lose It's goal setting and mostly complain about ads/paywall. — [Nutrola](https://nutrola.app/en/blog/what-do-reddit-users-say-about-lose-it-2026) (biased source)

### Inferences
- The designer-relevant lesson is that "too low" complaints are triggered by an aggressive default rate or an unexplained deficit, not by question count. Show the deficit explicitly, default to a moderate rate, and show how to change it.
- For a no-paywall product, the onboarding-length complaint risk is lower; the inaccurate-target risk remains and needs the "starting estimate, adjusts with your data" framing.

### Gaps
- No primary Reddit threads or App Store review text on onboarding length were retrieved for r/loseit, r/fitness or any app; searches returned mirrors, older forum posts or competitor blogs.
- No quantified complaint frequency about onboarding specifically (MacroFactor cost complaint "around 15%" is from a low-quality aggregator and not onboarding).
