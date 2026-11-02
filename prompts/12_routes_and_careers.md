# Earn while you learn + where graduates work (after prompts/11)

New data (from Muse Spark Open batch jobs; don't regenerate):
- data/apprenticeships.json — 499 live apprenticeship standards (Skills England data via github.com/SkillsFundingAgency/das-standards-data, OGL v3).
- data/subject_apprenticeships.json — for each subject, up to 6 linked apprenticeships {ref, title, level, months, degree, url, reason}.
Attribution (must appear in the app's "How it works" sheet and README, plus a small line under the apprenticeship list): "Contains public sector information licensed under the Open Government Licence v3.0. Apprenticeship standards © Skills England."

## A. Remove the personality-style label (anti-project risk: "Personality Analyzers")
Remove the "doer vs wonderer" / "A bit of both: you like doing things and wondering about them" line and anything that labels the player as a type of person. Everything is framed as interests → subjects, grounded in data. Keep the room as the summary of their interests.

## B. "Rather earn while you learn?" on every subject
- In the course sheet for a subject (and as a second tab/segment in that sheet: "University courses" | "Apprenticeships"), list that subject's linked apprenticeships: title, level in plain words (L2–3 "Hands-on, ~GCSE/A-level standard", L4–5 "Higher apprenticeship", L6–7 "Degree apprenticeship" / "Master's level"), "Degree included" tag when degree = true, typical length (months → "about 4 years"), the one-line reason, and "Official page" link (opens Skills England in a new tab). Show "No close apprenticeships for this subject" when the list is empty.
- One line at the top of that tab: "Get paid, train on the job, no tuition fees." (true for apprenticeships in England; keep it as stated).
- England-only note under the list: "Apprenticeship standards shown are for England."

## C. Where graduates work (from HESA, not AI)
Each subject on the explore page gets a short line "Graduates often work as: …" from the top 3 job groups in data/processed/inkling.db course_jobs for that subject (weighted by percent), precomputed into web/public/subjects/<code>.json by build_course_lists.py. Source note in the sheet: "Graduate job data: Discover Uni (HESA)". Plain wording, sentence case; skip if no data.

## D. Hands-on routes for practical players
If the player's answers lean practical/hands-on (strong yes to making/fixing cards, "Make it happen", "Some of it outdoors" in pairs), add one extra reveal page after the wildcard: "Hands-on routes" — 3 apprenticeships drawn from their top subjects' links (prefer degree apprenticeships, then L3–5), each on a paper card with title, level in plain words, length and official link. Skip the page for everyone else.

## E. Check
Mobile test (prompts/11 J) still passes; the apprenticeship tab fits without scrolling issues (the list inside the sheet may scroll, nothing else); attribution visible.
