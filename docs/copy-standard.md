# Copy standard

Every word in the app is there to help someone finish a job. Write for a crew lead standing in a store room.

## Rules
- Say what it is or what it does, in plain words. Do not sell. "Print labels", not "Supercharge your labelling".
- Sentence case everywhere. No ALL CAPS labels, no exclamation marks, no emoji.
- Active voice. A button names what happens: "Print 12 labels", "Save template", "Delete template". Use the same word for the same action everywhere.
- Name things the way the user does (label, item, case, kiosk), not how the system is built (payload, sync engine, webhook).
- Errors say what went wrong and what to do next, without apologising: "The QR code is too small to scan. Make it at least 14 mm wide, or shorten the value."
- Empty screens say what to do: "No templates yet. Save your first one from the editor."
- Never claim what is not built or not tested. A printer is "In testing" until it has passed hands-on testing here.
- Sample data is labelled as sample. No invented customers, counts, prices or brands.
- Numbers come from the source of truth (plans, limits, prices), never from copy.

## Words we do not use
seamless, supercharge, unlock, revolutionize, cutting-edge, next-gen, state-of-the-art, world-class, game-changing, effortless, leverage, empower, elevate, robust, holistic, streamline, turnkey, best-in-class, magic, delight, enterprise-grade, industrial-grade, mission-critical, "AI-powered" (say what the feature does), sandbox/simulated/mock (in anything a customer sees).

## Checking it
`npm run check:copy` scans the modules that already follow this standard (`src/labels`, `src/components/landing`, the home page) and fails on any flagged wording.
`node scripts/check-copy.mjs --all` reports how much of the rest of the app still needs the cleanup (informational). Apply the standard to each module as it is rebuilt.
