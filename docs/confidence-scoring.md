# Confidence Scoring

Helix suggestions use a `0.00` to `1.00` confidence score.

## Initial Bands

- `0.90+`: strong auto-patch candidate after validation exists.
- `0.75-0.89`: recommend human review.
- `0.50-0.74`: weak suggestion; show alternatives.
- Below `0.50`: do not suggest a patch.

## MVP Ranking Signals

The first implementation uses deterministic ranking:

- Locator strategy preference.
- Inferred accessible name from the failure message.
- Candidate stability.
- Candidate readability.

Future ranking should include:

- DOM uniqueness validation.
- Accessibility tree match.
- Old and new element proximity.
- Replay validation.
- Cache success history.

