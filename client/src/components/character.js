// ─── BLOBBY — THE WANDERER CREATURE ──────────────────────────────────────────
//
// A round, fuzzy little creature with big expressive eyes, stubby legs,
// a fluffy tail, and tiny round ears. Waddles when walking, leans forward
// when running, curls up when sitting.
//
// Grid: 10 wide × 14 tall, PIXEL = 4px → renders at 40×56px
//
// Color key:
//   0 = transparent
//   1 = body fur main      (palette accent, softened)
//   2 = body fur highlight (lighter, top of head/back)
//   3 = belly / inner ear  (warm cream)
//   4 = eyes               (#0d0b08 near-black)
//   5 = eye shine          (#ffffff)
//   6 = nose               (palette accent darkened)
//   7 = cheek blush        (soft pink/warm)
//   8 = legs               (slightly darker than body)
//   9 = tail               (fluffier, lighter than body)

const PIXEL = 4;

// ─── WALK (4 frames — gentle waddle) ────────────────────────────────────────
const WALK = [
  // Frame 0 — left leg forward, slight bob up
  [
    [0,0,0,2,2,2,2,0,0,0],  // head top highlight
    [0,0,2,1,1,1,1,2,0,0],  // head upper
    [0,2,1,1,1,1,1,1,9,0],  // head + ear left + tail hint
    [2,1,1,4,1,1,4,1,9,9],  // eyes row + tail
    [1,1,1,4,5,1,4,5,1,9],  // eye shine + tail
    [1,1,7,1,6,1,7,1,1,0],  // blush + nose
    [0,1,3,3,3,3,3,1,0,0],  // belly
    [0,1,3,3,3,3,3,1,0,0],  // belly lower
    [0,1,1,3,3,3,1,1,0,0],  // lower body
    [0,0,1,1,1,1,1,0,0,0],  // bottom curve
    [0,0,8,8,0,0,8,0,0,0],  // legs — left fwd
    [0,0,8,8,0,0,8,0,0,0],  // leg lower
    [0,0,8,0,0,0,8,0,0,0],  // feet
    [0,0,8,0,0,0,8,0,0,0],  // foot pads
  ],
  // Frame 1 — both legs center, body slightly lower (passing)
  [
    [0,0,0,2,2,2,2,0,0,0],
    [0,0,2,1,1,1,1,2,0,0],
    [0,2,1,1,1,1,1,1,9,0],
    [2,1,1,4,1,1,4,1,9,9],
    [1,1,1,4,5,1,4,5,1,9],
    [1,1,7,1,6,1,7,1,1,0],
    [0,1,3,3,3,3,3,1,0,0],
    [0,1,3,3,3,3,3,1,0,0],
    [0,1,1,3,3,3,1,1,0,0],
    [0,0,1,1,1,1,1,0,0,0],
    [0,0,0,8,8,8,0,0,0,0],  // both legs together
    [0,0,0,8,8,8,0,0,0,0],
    [0,0,8,8,0,8,8,0,0,0],  // feet splayed
    [0,0,8,0,0,0,8,0,0,0],
  ],
  // Frame 2 — right leg forward
  [
    [0,0,0,2,2,2,2,0,0,0],
    [0,0,2,1,1,1,1,2,0,0],
    [0,2,1,1,1,1,1,1,9,0],
    [2,1,1,4,1,1,4,1,9,9],
    [1,1,1,4,5,1,4,5,1,9],
    [1,1,7,1,6,1,7,1,1,0],
    [0,1,3,3,3,3,3,1,0,0],
    [0,1,3,3,3,3,3,1,0,0],
    [0,1,1,3,3,3,1,1,0,0],
    [0,0,1,1,1,1,1,0,0,0],
    [0,0,8,0,0,8,8,0,0,0],  // right leg forward now
    [0,0,8,0,0,8,8,0,0,0],
    [0,0,8,0,0,0,8,0,0,0],
    [0,0,8,0,0,0,8,0,0,0],
  ],
  // Frame 3 — passing back (same as 1, slight tail wag)
  [
    [0,0,0,2,2,2,2,0,0,0],
    [0,0,2,1,1,1,1,2,0,0],
    [0,2,1,1,1,1,1,1,0,9],  // tail position shifts
    [2,1,1,4,1,1,4,1,0,9],
    [1,1,1,4,5,1,4,5,9,9],
    [1,1,7,1,6,1,7,1,9,0],
    [0,1,3,3,3,3,3,1,0,0],
    [0,1,3,3,3,3,3,1,0,0],
    [0,1,1,3,3,3,1,1,0,0],
    [0,0,1,1,1,1,1,0,0,0],
    [0,0,0,8,8,8,0,0,0,0],
    [0,0,0,8,8,8,0,0,0,0],
    [0,0,8,8,0,8,8,0,0,0],
    [0,0,8,0,0,0,8,0,0,0],
  ],
];

// ─── RUN (4 frames — excited gallop, leaning forward) ───────────────────────
const RUN = [
  // Frame 0 — full stretch, front legs out, back legs behind
  [
    [0,0,2,2,2,2,0,0,0,0],  // head shifts forward (lean)
    [0,2,1,1,1,1,2,0,0,0],
    [2,1,1,1,1,1,1,9,9,0],
    [1,1,4,1,1,4,1,0,9,9],
    [1,1,4,5,1,4,5,1,0,9],
    [1,7,1,6,1,7,1,1,0,0],
    [1,3,3,3,3,3,1,0,0,0],
    [1,3,3,3,3,1,1,0,0,0],
    [1,1,3,3,1,1,0,0,0,0],
    [0,1,1,1,1,0,0,0,0,0],
    [8,8,0,0,0,0,8,8,0,0],  // front legs fwd, back legs back — stretched
    [8,0,0,0,0,0,0,8,0,0],
    [8,0,0,0,0,0,0,8,0,0],
    [8,8,0,0,0,0,8,8,0,0],
  ],
  // Frame 1 — airborne! all feet off ground, body compact
  [
    [0,0,2,2,2,2,0,0,0,0],
    [0,2,1,1,1,1,2,0,0,0],
    [2,1,1,1,1,1,1,9,0,0],
    [1,1,4,1,1,4,1,9,9,0],
    [1,1,4,5,1,4,5,1,9,0],
    [1,7,1,6,1,7,1,1,0,0],
    [1,3,3,3,3,3,1,0,0,0],
    [1,3,3,3,3,1,1,0,0,0],
    [0,1,1,1,1,1,0,0,0,0],
    [0,0,1,1,1,0,0,0,0,0],
    [0,8,8,0,0,8,8,0,0,0],  // legs tucked under, airborne
    [0,8,0,0,0,0,8,0,0,0],
    [0,0,0,0,0,0,0,0,0,0],  // no ground contact
    [0,0,0,0,0,0,0,0,0,0],
  ],
  // Frame 2 — landing, legs under body
  [
    [0,0,2,2,2,2,0,0,0,0],
    [0,2,1,1,1,1,2,0,0,0],
    [2,1,1,1,1,1,1,0,9,0],
    [1,1,4,1,1,4,1,0,9,9],
    [1,1,4,5,1,4,5,1,9,9],
    [1,7,1,6,1,7,1,1,0,0],
    [1,3,3,3,3,3,1,0,0,0],
    [1,3,3,3,3,3,1,0,0,0],
    [1,1,3,3,3,1,1,0,0,0],
    [0,1,1,1,1,1,0,0,0,0],
    [0,0,8,8,8,8,0,0,0,0],  // all four landing
    [0,0,8,8,8,8,0,0,0,0],
    [0,8,8,0,0,8,8,0,0,0],
    [0,8,0,0,0,0,8,0,0,0],
  ],
  // Frame 3 — push off, back legs extended
  [
    [0,0,2,2,2,2,0,0,0,0],
    [0,2,1,1,1,1,2,0,0,0],
    [2,1,1,1,1,1,1,9,9,9],  // tail whips up with excitement
    [1,1,4,1,1,4,1,0,0,9],
    [1,1,4,5,1,4,5,1,0,0],
    [1,7,1,6,1,7,1,1,0,0],
    [1,3,3,3,3,3,1,0,0,0],
    [1,3,3,3,3,1,1,0,0,0],
    [1,1,3,3,1,1,0,0,0,0],
    [0,1,1,1,1,0,0,0,0,0],
    [0,8,8,0,0,0,8,8,0,0],
    [0,8,0,0,0,0,0,8,0,0],
    [0,8,0,0,0,0,0,8,0,0],
    [0,8,8,0,0,0,8,8,0,0],
  ],
];

// ─── SIT (2 frames — sleepy curl, breathing) ────────────────────────────────
const SIT = [
  // Frame 0 — sitting, eyes half open, looking a bit dejected
  [
    [0,0,0,0,0,0,0,0,0,0],
    [0,0,0,2,2,2,0,0,0,0],
    [0,0,2,1,1,1,2,0,0,0],
    [0,2,1,1,1,1,1,2,0,0],
    [0,1,1,4,1,1,4,1,0,0],  // eyes open normal
    [0,1,1,4,5,1,5,1,0,0],  // shines
    [0,1,7,1,6,1,7,1,0,0],  // blush + nose
    [0,1,3,3,3,3,3,1,0,0],  // belly
    [0,1,3,3,3,3,3,1,0,0],
    [1,1,1,3,3,3,1,1,1,0],  // body wider, sitting
    [1,8,8,1,1,1,8,8,1,0],  // short legs out front
    [0,8,8,3,3,3,8,8,0,0],  // feet visible, belly between
    [0,8,8,0,0,0,8,8,0,0],
    [0,8,8,0,0,0,8,8,0,0],
  ],
  // Frame 1 — eyes closed, head slightly drooped (sleepy breath)
  [
    [0,0,0,0,0,0,0,0,0,0],
    [0,0,0,2,2,2,0,0,0,0],
    [0,0,2,1,1,1,2,0,0,0],
    [0,2,1,1,1,1,1,2,0,0],
    [0,1,1,4,4,4,4,1,0,0],  // eyes closed — solid dark line
    [0,1,1,1,1,1,1,1,0,0],  // no shine (eyes shut)
    [0,1,7,1,6,1,7,1,0,0],
    [0,1,3,3,3,3,3,1,0,0],
    [0,1,3,3,3,3,3,1,0,0],
    [1,1,1,3,3,3,1,1,1,0],
    [1,8,8,1,1,1,8,8,1,0],
    [0,8,8,3,3,3,8,8,0,0],
    [0,8,8,0,0,0,8,8,0,0],
    [0,8,8,0,0,0,8,8,0,0],
  ],
];

const FRAMES = { walk: WALK, run: RUN, sit: SIT };

// ─── ERA DEFINITIONS ─────────────────────────────────────────────────────────
// era 0 — Sundowning     (0-1500 km)   : grief, thinning, cool blue-grey
// era 1 — Atlantic       (1500-3500 km): burning, consumed, moth-wings, ember
// era 2 — TMBTE          (3500-5500 km): Veridian, feathered, flickering between selves
// era 3 — Infinite Bath  (5500-6000 km): ethereal, pale blue, returned to source

const ERA_BODY_TINT   = ["#2a3a5a", "#c46020", "#2d6a40", "#a8c8e8"];
const ERA_TINT_AMOUNT = [0.30,       0.38,      0.38,      0.42];

/**
 * Blend a hex color toward a target hex by `amount` (0–1).
 * @param {string} hex       - Source colour in "#rrggbb" format.
 * @param {string} targetHex - Target colour in "#rrggbb" format.
 * @param {number} amount    - Blend factor: 0 = unchanged, 1 = full target.
 * @returns {string} Blended colour as "#rrggbb".
 */
function blendToward(hex, targetHex, amount) {
  const [r, g, b]    = hexToRgb(hex);
  const [tr, tg, tb] = hexToRgb(targetHex);
  return rgbToHex(
    Math.round(r  + (tr - r)  * amount),
    Math.round(g  + (tg - g)  * amount),
    Math.round(b  + (tb - b)  * amount),
  );
}

/**
 * Draw animated moth wings behind the character sprite for the Atlantic era.
 * Wings are rendered as pixel-art trapezoids that flutter gently over time.
 * @param {CanvasRenderingContext2D} ctx       - Canvas 2D context.
 * @param {number}                  x         - Character left-edge x position.
 * @param {number}                  y         - Character top-edge y position.
 * @param {number}                  timestamp - Current animation timestamp (ms).
 */
function drawMothWings(ctx, x, y, timestamp) {
  const flutter = Math.sin(timestamp * 0.006) * 2.5;
  const wTop    = y + 8  + flutter * 0.35;
  const wMid    = y + 28 + flutter * 0.15;
  const rBase   = x + 10 * PIXEL; // right edge of the 10-wide sprite

  ctx.globalAlpha = 0.72;
  ctx.fillStyle = "#8a4e28"; // dusty amber-brown base

  // Upper-left wing
  ctx.fillRect(x - 16, wTop + 4,  16, 4);
  ctx.fillRect(x - 20, wTop + 8,  20, 4);
  ctx.fillRect(x - 16, wTop + 12, 16, 4);
  ctx.fillRect(x - 12, wTop + 16, 12, 4);
  // Lower-left wing
  ctx.fillRect(x - 12, wMid + 4,  12, 4);
  ctx.fillRect(x -  8, wMid + 8,   8, 4);

  // Upper-right wing (mirrored)
  ctx.fillRect(rBase,      wTop + 4,  16, 4);
  ctx.fillRect(rBase,      wTop + 8,  20, 4);
  ctx.fillRect(rBase,      wTop + 12, 16, 4);
  ctx.fillRect(rBase,      wTop + 16, 12, 4);
  // Lower-right wing
  ctx.fillRect(rBase,      wMid + 4,  12, 4);
  ctx.fillRect(rBase,      wMid + 8,   8, 4);

  // Wing highlight veins
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = "#f0a060";
  ctx.fillRect(x - 14, wTop + 6, 8, 2);
  ctx.fillRect(rBase + 6, wTop + 6, 8, 2);

  ctx.globalAlpha = 1;
}

// ─── DRAW ─────────────────────────────────────────────────────────────────────
// hungerState: "full" | "hungry" | "very-hungry" | "starving"
// era:        0=Sundowning | 1=Atlantic | 2=TMBTE | 3=Infinite Bath
// timestamp:  performance.now() value (for animated effects)
export function drawCharacter(ctx, charState, animFrame, x, y, palette, bounce, hungerState = "full", era = 0, timestamp = 0) {
  const frames = FRAMES[charState] || FRAMES.walk;
  const frame = frames[animFrame % frames.length];

  const accentRgb = hexToRgb(palette.accent || "#f4a261");

  // When hungry, desaturate the body toward grey — lerp toward greyscale
  const hungerDesatAmt = hungerState === "starving" ? 0.75
    : hungerState === "very-hungry" ? 0.5
    : hungerState === "hungry" ? 0.2
    : 0;

  function desaturate(r, g, b, amt) {
    const grey = r * 0.299 + g * 0.587 + b * 0.114;
    return [
      Math.round(r + (grey - r) * amt),
      Math.round(g + (grey - g) * amt),
      Math.round(b + (grey - b) * amt),
    ];
  }

  function tintColor(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    const [dr, dg, db] = desaturate(r, g, b, amt);
    return rgbToHex(dr, dg, db);
  }

  const bodyMain = tintColor(rgbToHex(
    Math.min(255, Math.floor(accentRgb[0] * 0.78 + 30)),
    Math.min(255, Math.floor(accentRgb[1] * 0.68 + 10)),
    Math.min(255, Math.floor(accentRgb[2] * 0.55))
  ), hungerDesatAmt);

  const bodyHighlight = tintColor(rgbToHex(
    Math.min(255, Math.floor(accentRgb[0] * 0.92 + 40)),
    Math.min(255, Math.floor(accentRgb[1] * 0.82 + 20)),
    Math.min(255, Math.floor(accentRgb[2] * 0.68 + 10))
  ), hungerDesatAmt);

  const tailColor = tintColor(rgbToHex(
    Math.min(255, Math.floor(accentRgb[0] * 0.88 + 50)),
    Math.min(255, Math.floor(accentRgb[1] * 0.78 + 30)),
    Math.min(255, Math.floor(accentRgb[2] * 0.65 + 20))
  ), hungerDesatAmt);

  const legColor = tintColor(rgbToHex(
    Math.floor(accentRgb[0] * 0.6),
    Math.floor(accentRgb[1] * 0.52),
    Math.floor(accentRgb[2] * 0.42)
  ), hungerDesatAmt);

  const noseColor = rgbToHex(
    Math.min(255, Math.floor(accentRgb[0] * 0.5 + 20)),
    Math.floor(accentRgb[1] * 0.35),
    Math.floor(accentRgb[2] * 0.3)
  );

  // Eye colour: open=dark, droopy/starving=half-closed (use grey)
  const eyeColor = (hungerState === "very-hungry" || hungerState === "starving")
    ? "#5a5248"   // dull, tired eyes
    : "#1a1208";  // normal dark eyes

  // Blush fades when starving
  const blushColor = hungerState === "starving" ? "#c09090"
    : hungerState === "very-hungry" ? "#e89898"
    : "#f4a0a0";

  // ─── ERA TINTING ─────────────────────────────────────────────────────────────
  // Blend body colours toward the era's signature palette
  const safEra      = Math.max(0, Math.min(3, era));
  const eraTintHex  = ERA_BODY_TINT[safEra];
  const eraTintAmt  = ERA_TINT_AMOUNT[safEra];

  const finalBodyMain      = blendToward(bodyMain,      eraTintHex, eraTintAmt);
  const finalBodyHighlight = blendToward(bodyHighlight, eraTintHex, eraTintAmt);
  const finalTailColor     = blendToward(tailColor,     eraTintHex, eraTintAmt);
  const finalLegColor      = blendToward(legColor,      eraTintHex, eraTintAmt);

  // Era-specific eye overrides
  const finalEyeColor =
    safEra === 1 ? "#7a3010"   // Atlantic: ember-dark, burning
    : safEra === 3 ? "#304898" // Infinite Bath: deep-sea blue
    : eyeColor;

  // Era-specific eye-shine
  const finalEyeShine =
    hungerState === "starving"   ? "#888"
    : safEra === 1               ? "#ffd090"  // Atlantic: amber glint
    : safEra === 3               ? "#d0e8ff"  // Infinite Bath: cool shimmer
    : "#ffffff";

  const COLORS = {
    1: finalBodyMain,
    2: finalBodyHighlight,
    3: "#f5e6cc",
    4: finalEyeColor,
    5: finalEyeShine,
    6: noseColor,
    7: blushColor,
    8: finalLegColor,
    9: finalTailColor,
  };

  // When very hungry or starving, add a slight downward droop to the head rows (0-6)
  const droopOffset = hungerState === "starving" ? 2
    : hungerState === "very-hungry" ? 1
    : 0;

  // ─── ERA PRE-EFFECTS ─────────────────────────────────────────────────────────

  // Era 3 — Infinite Bath: soft pulsing glow radiates behind the character
  if (safEra === 3) {
    const pulse      = 0.70 + Math.sin(timestamp * 0.0018) * 0.22;
    const [gr, gg, gb] = hexToRgb(ERA_BODY_TINT[3]);
    const glow       = ctx.createRadialGradient(x + 20, y + 28, 3, x + 20, y + 28, 40);
    glow.addColorStop(0, `rgba(${gr},${gg},${gb},${(0.22 * pulse).toFixed(3)})`);
    glow.addColorStop(1, `rgba(${gr},${gg},${gb},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(x - 18, y - 6, 76, 86);
  }

  // Era 1 — Atlantic: moth wings flutter behind the character
  if (safEra === 1) {
    drawMothWings(ctx, x, y, timestamp);
  }

  // ─── ERA CHARACTER ALPHA ──────────────────────────────────────────────────────
  // Sundowning: limbs grow translucent as the journey deepens
  // Infinite Bath: spirit becomes ethereal and barely-there
  const eraAlpha = safEra === 0 ? 0.82
    : safEra === 3              ? 0.88
    : 1.0;
  if (eraAlpha < 1.0) ctx.globalAlpha = eraAlpha;

  // ─── MAIN PIXEL RENDER ───────────────────────────────────────────────────────
  frame.forEach((row, ry) => {
    // Head rows droop down; body stays put — gives a "head hanging" look
    const isHead = ry <= 6;
    const rowBounce = bounce + (isHead ? droopOffset : 0);
    row.forEach((v, rx) => {
      if (!v) return;
      ctx.fillStyle = COLORS[v] || "#fff";
      ctx.fillRect(
        Math.floor(x + rx * PIXEL),
        Math.floor(y + ry * PIXEL + rowBounce),
        PIXEL,
        PIXEL
      );
    });
  });

  if (eraAlpha < 1.0) ctx.globalAlpha = 1;

  // ─── ERA POST-EFFECTS ────────────────────────────────────────────────────────

  // Era 2 — TMBTE: flickering ghost-echo (Vessel flickers between selves)
  if (safEra === 2) {
    const ghostAlpha = 0.12 + Math.abs(Math.sin(timestamp * 0.0025)) * 0.14;
    ctx.globalAlpha  = ghostAlpha;
    frame.forEach((row, ry) => {
      const rowBounce = bounce + (ry <= 6 ? droopOffset : 0);
      row.forEach((v, rx) => {
        if (!v) return;
        ctx.fillStyle = "#4a8a58"; // ghostly Veridian echo
        ctx.fillRect(
          Math.floor(x + rx * PIXEL + 4),
          Math.floor(y + ry * PIXEL + rowBounce - 2),
          PIXEL,
          PIXEL
        );
      });
    });
    ctx.globalAlpha = 1;
  }
}

function hexToRgb(hex) {
  const clean = (hex || "#888").replace(/^#/, "").replace(/^rgb.*/, "");
  if (hex.startsWith("rgb")) {
    const m = hex.match(/\d+/g);
    return m ? [+m[0], +m[1], +m[2]] : [136, 136, 136];
  }
  if (clean.length < 6) return [136, 136, 136];
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b]
    .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
    .join("");
}

export const CHAR_HEIGHT = 14 * PIXEL; // 56px
export const CHAR_WIDTH  = 10 * PIXEL; // 40px
