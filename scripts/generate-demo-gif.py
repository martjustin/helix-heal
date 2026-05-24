from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "site" / "assets" / "helix-demo.gif"
WIDTH, HEIGHT = 900, 520
BRAND = (201, 54, 4)
INK = (7, 11, 20)
TEXT = (29, 38, 52)
MUTED = (99, 112, 131)
LINE = (223, 229, 236)
PAGE = (246, 247, 249)
PAPER = (255, 255, 255)
GREEN = (19, 184, 111)
BLUE = (47, 126, 247)
GOLD = (240, 166, 0)
PURPLE = (163, 60, 255)


def font(size, bold=False):
    candidates = [
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
    ]

    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size)

    return ImageFont.load_default()


TITLE = font(32, True)
SUBTITLE = font(18)
LABEL = font(14, True)
SMALL = font(13)
MONO = font(16)
BIG = font(44, True)


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def text(draw, xy, value, fill=TEXT, fnt=SMALL):
    draw.text(xy, value, fill=fill, font=fnt)


def meter(draw, x, y, w, pct, color):
    rounded(draw, (x, y, x + w, y + 8), 6, (255, 216, 202))
    rounded(draw, (x, y, x + int(w * pct), y + 8), 6, color)


def draw_shell(draw):
    draw.rectangle((0, 0, WIDTH, HEIGHT), fill=PAGE)
    rounded(draw, (24, 24, 184, 496), 8, PAPER, LINE)
    text(draw, (48, 52), "Helix Heal", INK, font(18, True))
    nav = ["Dashboard", "Locator Repair", "Trace Evidence", "Validation", "Patch", "Pricing"]
    for i, item in enumerate(nav):
        y = 104 + i * 48
        if i == 0:
            rounded(draw, (42, y - 10, 166, y + 22), 7, BRAND)
            text(draw, (56, y - 3), item, PAPER, SMALL)
        else:
            text(draw, (56, y - 3), item, INK, SMALL)

    rounded(draw, (204, 24, 876, 64), 8, PAPER, LINE)
    text(draw, (232, 36), "Search failed runs, selectors, traces...", MUTED, SMALL)


def frame(step, headline, subhead, cards, command=None):
    image = Image.new("RGB", (WIDTH, HEIGHT), PAGE)
    draw = ImageDraw.Draw(image)
    draw_shell(draw)

    text(draw, (226, 94), "60-second locator repair walkthrough", BRAND, LABEL)
    text(draw, (226, 120), headline, INK, TITLE)
    text(draw, (226, 162), subhead, MUTED, SUBTITLE)

    rounded(draw, (226, 206, 846, 444), 8, PAPER, LINE)
    text(draw, (250, 232), step, BRAND, LABEL)

    x = 250
    for label, value, color in cards:
        rounded(draw, (x, 270, x + 170, 370), 8, (255, 248, 246), LINE)
        text(draw, (x + 18, 292), label, MUTED, SMALL)
        text(draw, (x + 18, 322), value, INK, font(24, True))
        meter(draw, x + 18, 350, 134, 0.82, color)
        x += 190

    if command:
        rounded(draw, (250, 392, 822, 426), 6, (17, 24, 39))
        text(draw, (266, 400), command, (244, 249, 255), MONO)

    return image


frames = [
    frame(
        "00:00 / Failed run",
        "Playwright CI turns red",
        "A brittle text selector breaks after the app copy changes from Sign in to Log in.",
        [("Status", "Failed", BRAND), ("Trace", "Saved", BLUE), ("Noise", "High", GOLD)],
        "npx playwright test --reporter=json",
    ),
    frame(
        "00:10 / Ingest",
        "Helix reads the report and trace",
        "The CLI maps the failed spec, locator, DOM snapshot, retry state, and source file.",
        [("Reports", "1", BLUE), ("Failed spec", "login", BRAND), ("Evidence", "Ready", GREEN)],
        "npx helix-heal analyze --report playwright-report.json --trace test-results",
    ),
    frame(
        "00:20 / Candidate ranking",
        "DOM-aware replacements are scored",
        "Role, label, text, and test-id candidates are ranked by stability and ambiguity risk.",
        [("Best", "role/name", GREEN), ("Confidence", "0.91", GREEN), ("Fallbacks", "3", BLUE)],
        "page.getByRole('button', { name: 'Log in' })",
    ),
    frame(
        "00:35 / Validation",
        "Helix probes before recommending",
        "A candidate must resolve uniquely and remain visible/actionable before it earns trust.",
        [("Unique", "Pass", GREEN), ("Visible", "Pass", GREEN), ("Ambiguity", "Low", BLUE)],
        "helix-heal doctor --live-url http://localhost:3000",
    ),
    frame(
        "00:50 / Patch",
        "A reviewable diff is generated",
        "Helix keeps the patch dry-run first, so developers review the exact locator change.",
        [("Patch", "Dry-run", GOLD), ("Scope", "1 line", BLUE), ("Risk", "Low", GREEN)],
        "helix-heal patch --dry-run --report playwright-report.json",
    ),
    frame(
        "01:00 / Rerun",
        "The suite returns to green",
        "The repaired selector survives the copy change and becomes a reusable cache signal.",
        [("Rerun", "Green", GREEN), ("Time saved", "30-40%", GREEN), ("Cache", "Updated", PURPLE)],
        "npx playwright test",
    ),
]

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
frames[0].save(
    OUTPUT,
    save_all=True,
    append_images=frames[1:],
    duration=[10000, 10000, 15000, 15000, 5000, 5000],
    loop=0,
    optimize=True,
)
print(f"Generated {OUTPUT.relative_to(ROOT)}")
