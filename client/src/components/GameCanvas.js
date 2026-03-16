import { useEffect, useRef, useCallback } from "react";
import { drawCharacter, CHAR_HEIGHT } from "./character";

const W = 800;
const H = 300;

function generateStars(count) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * W, y: Math.random() * H * 0.55,
    size: Math.random() < 0.25 ? 2 : 1, phase: Math.random() * Math.PI * 2,
  }));
}
function generateClouds() {
  return Array.from({ length: 5 }, (_, i) => ({
    x: i * 180 + Math.random() * 60, y: 25 + Math.random() * 55,
    w: 48 + Math.floor(Math.random() * 5) * 8, speed: 0.15 + Math.random() * 0.2,
  }));
}
function generateGroundTiles() {
  return Array.from({ length: 40 }, (_, i) => ({
    x: i * 32, type: Math.floor(Math.random() * 3),
  }));
}

// ── Bird flock generator ──────────────────────────────────────────────────────
function spawnBirdFlock() {
  const count = 2 + Math.floor(Math.random() * 3); // 2-4 birds
  const baseY = 20 + Math.random() * 80;
  const speed = 28 + Math.random() * 20;
  return Array.from({ length: count }, (_, i) => ({
    x: -20 - i * (10 + Math.random() * 8),
    y: baseY + (Math.random() - 0.5) * 14,
    speed,
    wingPhase: Math.random() * Math.PI * 2,
    wingSpeed: 3 + Math.random() * 2,
  }));
}

// Draw a tiny pixel bird silhouette (2 wing states)
function drawBird(ctx, x, y, wingUp) {
  ctx.fillStyle = "rgba(40, 35, 45, 0.7)";
  // Body — 2x1 pixels
  ctx.fillRect(Math.round(x), Math.round(y), 2, 1);
  if (wingUp) {
    // Wings up
    ctx.fillRect(Math.round(x) - 2, Math.round(y) - 1, 2, 1);
    ctx.fillRect(Math.round(x) + 2, Math.round(y) - 1, 2, 1);
  } else {
    // Wings level
    ctx.fillRect(Math.round(x) - 2, Math.round(y), 2, 1);
    ctx.fillRect(Math.round(x) + 2, Math.round(y), 2, 1);
  }
}

export default function GameCanvas({ palette, charState, energy, hungerState, arrived, popups, onPopupTick, raining, fog, distance }) {
  const canvasRef      = useRef(null);
  const scrollRef      = useRef({ ground: 0, hill1: 0, hill2: 0 });
  const animRef        = useRef(null);
  const charAnimRef    = useRef({ frame: 0, timer: 0 });
  const lastTimeRef    = useRef(null);
  const staticRef      = useRef(null);
  const hungerStateRef = useRef(hungerState);
  const paletteRef     = useRef(palette);
  const arrivedRef     = useRef(arrived);
  const charStateRef   = useRef(charState);
  const energyRef      = useRef(energy);
  const popupsRef      = useRef(popups);
  const rainingRef     = useRef(raining);
  const fogRef         = useRef(fog);
  const distanceRef    = useRef(distance);
  const rainParticles  = useRef([]);

  // ── Fog state ──
  const fogOpacityRef  = useRef(0);    // current rendered opacity, fades in/out
  const fogLayersRef   = useRef([
    { x: 0,   speed: 8  },
    { x: 300, speed: 5  },
    { x: 600, speed: 11 },
  ]);

  // ── Shooting star state ──
  const shootingStarRef  = useRef(null);
  const nextStarTimerRef = useRef(0);

  // ── Bird state ──
  const birdsRef         = useRef([]);
  const nextBirdTimerRef = useRef(0);

  useEffect(() => { hungerStateRef.current = hungerState; }, [hungerState]);
  useEffect(() => { arrivedRef.current     = arrived;     }, [arrived]);
  useEffect(() => { paletteRef.current     = palette;     }, [palette]);
  useEffect(() => { charStateRef.current   = charState;   }, [charState]);
  useEffect(() => { energyRef.current      = energy;      }, [energy]);
  useEffect(() => { popupsRef.current      = popups;      }, [popups]);
  useEffect(() => { rainingRef.current     = raining;
    if (!raining) rainParticles.current = [];
  }, [raining]);
  useEffect(() => { fogRef.current    = fog;      }, [fog]);
  useEffect(() => { distanceRef.current = distance; }, [distance]);

  useEffect(() => {
    staticRef.current = {
      stars: generateStars(70),
      clouds: generateClouds(),
      groundTiles: generateGroundTiles(),
    };
    // First bird flock in 8-20 seconds
    nextBirdTimerRef.current = 8 + Math.random() * 12;
    // First shooting star in 30-90 seconds
    nextStarTimerRef.current = 30 + Math.random() * 60;
  }, []);

  const drawFrame = useCallback((timestamp) => {
    const canvas = canvasRef.current;
    if (!canvas || !staticRef.current) {
      animRef.current = requestAnimationFrame(drawFrame);
      return;
    }
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    const dt        = Math.min((timestamp - (lastTimeRef.current || timestamp)) / 1000, 0.05);
    lastTimeRef.current = timestamp;

    const palette   = paletteRef.current;
    const charState = charStateRef.current;
    const isArrived = arrivedRef.current;
    const isRaining = rainingRef.current;
    const isFoggy   = fogRef.current;

    if (isArrived) {
      drawArrivalScene(ctx, timestamp, charAnimRef, dt, palette);
      animRef.current = requestAnimationFrame(drawFrame);
      return;
    }

    let visualSpeed = 0;
    if (charState === "run")       visualSpeed = 110;
    else if (charState === "walk") visualSpeed = 60;

    scrollRef.current.ground += visualSpeed * dt;
    scrollRef.current.hill1  += visualSpeed * 0.38 * dt;
    scrollRef.current.hill2  += visualSpeed * 0.15 * dt;

    const { clouds, groundTiles, stars } = staticRef.current;
    clouds.forEach((c) => { c.x -= c.speed * (visualSpeed || 4) * dt * 0.12; });

    const ca = charAnimRef.current;
    const hungerSlow = hungerStateRef.current === "starving" ? 2.2
      : hungerStateRef.current === "very-hungry" ? 1.6
      : hungerStateRef.current === "hungry" ? 1.2 : 1.0;
    const animSpeed = (charState === "run" ? 0.09 : charState === "walk" ? 0.16 : 1.1) * hungerSlow;
    ca.timer += dt;
    if (ca.timer >= animSpeed) {
      ca.timer = 0;
      ca.frame = (ca.frame + 1) % (charState === "sit" ? 2 : 4);
    }

    // ── SKY ──
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    const sky = palette.sky || ["#001","#002","#003","#004"];
    skyGrad.addColorStop(0, sky[0]); skyGrad.addColorStop(0.35, sky[1]);
    skyGrad.addColorStop(0.7, sky[2]); skyGrad.addColorStop(1, sky[3]);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // ── STARS ──
    const starAlpha = palette.cloudOpacity < 0.25
      ? 0.85 : Math.max(0, 0.85 - (palette.cloudOpacity - 0.25) * 4);
    if (starAlpha > 0.05) {
      stars.forEach((star) => {
        const twinkle = 0.6 + Math.sin(timestamp * 0.0008 + star.phase) * 0.35;
        ctx.globalAlpha = starAlpha * twinkle;
        ctx.fillStyle = palette.star;
        ctx.fillRect(star.x, star.y, star.size, star.size);
      });
      ctx.globalAlpha = 1;
    }

    // ── SHOOTING STAR ──
    // Only at night (low cloudOpacity = dark sky)
    if (starAlpha > 0.3) {
      nextStarTimerRef.current -= dt;
      if (nextStarTimerRef.current <= 0) {
        // Spawn a new shooting star
        shootingStarRef.current = {
          x:     Math.random() * W * 0.7 + 50,
          y:     10 + Math.random() * 60,
          vx:    120 + Math.random() * 80,
          vy:    30 + Math.random() * 30,
          life:  1.0,
          trail: 28 + Math.random() * 16,
        };
        // Next one in 2-5 minutes
        nextStarTimerRef.current = 120 + Math.random() * 180;
      }
      if (shootingStarRef.current) {
        const s = shootingStarRef.current;
        s.x    += s.vx * dt;
        s.y    += s.vy * dt;
        s.life -= dt * 2.5;
        if (s.life > 0) {
          const alpha = Math.min(1, s.life * 2) * starAlpha;
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = palette.star || "#fff";
          ctx.lineWidth   = 1.5;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x - s.vx / s.trail, s.y - s.vy / s.trail);
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else {
          shootingStarRef.current = null;
        }
      }
    }

    // ── BIRDS ──
    // More common in morning/afternoon (higher cloudOpacity = daytime)
    const isDaytime = palette.cloudOpacity > 0.15;
    if (isDaytime && !isRaining) {
      nextBirdTimerRef.current -= dt;
      if (nextBirdTimerRef.current <= 0 && birdsRef.current.length === 0) {
        birdsRef.current = spawnBirdFlock();
        // Next flock in 25-80 seconds
        nextBirdTimerRef.current = 25 + Math.random() * 55;
      }
    }

    if (birdsRef.current.length > 0) {
      birdsRef.current = birdsRef.current.map(b => ({
        ...b,
        x: b.x + b.speed * dt,
        wingPhase: b.wingPhase + b.wingSpeed * dt,
      })).filter(b => b.x < W + 30);

      birdsRef.current.forEach(b => {
        drawBird(ctx, b.x, b.y, Math.sin(b.wingPhase) > 0);
      });
    }

    // ── CLOUDS ──
    // During rain: increase opacity and lower clouds
    const rainCloudBoost = isRaining ? 0.35 : 0;
    const cloudY         = isRaining ? 8 : 0;  // shift down slightly in rain
    ctx.globalAlpha = Math.min(0.95, (palette.cloudOpacity || 0.3) + rainCloudBoost);
    clouds.forEach((cloud) => {
      const cx = ((cloud.x % (W + 120) + W + 120) % (W + 120));
      ctx.fillStyle = palette.text;
      ctx.fillRect(cx,     cloud.y + cloudY,      cloud.w,      8);
      ctx.fillRect(cx + 8, cloud.y + cloudY - 8,  cloud.w - 16, 8);
      ctx.fillRect(cx + 4, cloud.y + cloudY - 16, cloud.w - 24, 8);
      // Extra cloud mass during rain
      if (isRaining) {
        ctx.fillRect(cx + 2, cloud.y + cloudY + 8, cloud.w - 4, 6);
      }
    });
    ctx.globalAlpha = 1;

    // ── DISTANT LANDSCAPE ──
    const landscapeBlend = getLandscapeBlend(distanceRef.current);
    landscapeBlend.forEach(({ idx, alpha }) => {
      if (idx < LANDSCAPE_STAGES.length) {
        LANDSCAPE_STAGES[idx].draw(ctx, alpha, scrollRef.current.hill2);
      }
    });

    // ── HILLS ──
    drawHill(ctx, palette.hill1, scrollRef.current.hill2, 35, H - 105, W);
    drawHill(ctx, palette.hill2, scrollRef.current.hill1, 22, H - 82,  W);

    // ── GROUND ──
    const groundY = H - 60;
    ctx.fillStyle = palette.ground;
    ctx.fillRect(0, groundY, W, 60);
    ctx.fillStyle = palette.groundLine;
    ctx.fillRect(0, groundY, W, 4);

    groundTiles.forEach((tile) => {
      const tx = ((tile.x - Math.floor(scrollRef.current.ground) % (W + 80) + W + 80) % (W + 80));
      if (tile.type === 0) {
        ctx.fillStyle = palette.groundLine;
        ctx.fillRect(tx, groundY + 9, 4, 4);
        ctx.fillRect(tx + 10, groundY + 18, 4, 4);
      } else if (tile.type === 1) {
        ctx.fillStyle = palette.hill2;
        ctx.globalAlpha = 0.4;
        ctx.fillRect(tx, groundY + 7, 8, 4);
        ctx.fillRect(tx + 4, groundY + 3, 4, 4);
        ctx.globalAlpha = 1;
      }
    });

    // ── RAIN ──
    if (isRaining) {
      ctx.fillStyle = "rgba(20, 20, 40, 0.25)";
      ctx.fillRect(0, 0, W, H);
      while (rainParticles.current.length < 80) {
        rainParticles.current.push({
          x: Math.random() * W, y: Math.random() * H,
          speed: 180 + Math.random() * 80, length: 8 + Math.random() * 6,
        });
      }
      ctx.strokeStyle = "rgba(174, 194, 224, 0.45)";
      ctx.lineWidth = 1;
      rainParticles.current.forEach(p => {
        p.y += p.speed * dt;
        p.x -= p.speed * 0.15 * dt;
        if (p.y > H) { p.y = 0; p.x = Math.random() * W; }
        ctx.beginPath();
        ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.length * 0.15, p.y + p.length);
        ctx.stroke();
      });
    }

    // ── FOG ──
    // Fade opacity in/out based on isFoggy
    const fogTarget = isFoggy ? 0.72 : 0;
    const fogDelta  = isFoggy ? 0.015 : 0.02;
    if (fogOpacityRef.current < fogTarget) {
      fogOpacityRef.current = Math.min(fogTarget, fogOpacityRef.current + fogDelta * dt * 20);
    } else if (fogOpacityRef.current > fogTarget) {
      fogOpacityRef.current = Math.max(fogTarget, fogOpacityRef.current - fogDelta * dt * 20);
    }

    if (fogOpacityRef.current > 0.01) {
      // Drift fog layers across the scene
      fogLayersRef.current.forEach(layer => {
        layer.x = (layer.x + layer.speed * dt) % W;
      });

      fogLayersRef.current.forEach((layer, i) => {
        const alphas   = [0.28, 0.20, 0.16];
        const heights  = [55, 45, 35];
        const yOffsets = [groundY - 20, groundY - 40, groundY - 60];
        const alpha    = alphas[i] * fogOpacityRef.current;

        for (let pass = 0; pass < 2; pass++) {
          const xOff = pass === 0 ? layer.x - W : layer.x;
          const fogGrad = ctx.createLinearGradient(0, yOffsets[i], 0, yOffsets[i] + heights[i]);
          fogGrad.addColorStop(0, `rgba(200,210,205,0)`);
          fogGrad.addColorStop(0.5, `rgba(200,210,205,${alpha})`);
          fogGrad.addColorStop(1, `rgba(200,210,205,${alpha * 1.3})`);
          ctx.fillStyle = fogGrad;
          ctx.fillRect(xOff, yOffsets[i], W, heights[i]);
        }
      });

      // Ground-level fog bank — always present when foggy
      const groundFog = ctx.createLinearGradient(0, groundY - 30, 0, groundY + 20);
      groundFog.addColorStop(0, `rgba(195,205,200,0)`);
      groundFog.addColorStop(0.6, `rgba(195,205,200,${0.45 * fogOpacityRef.current})`);
      groundFog.addColorStop(1, `rgba(195,205,200,${0.6 * fogOpacityRef.current})`);
      ctx.fillStyle = groundFog;
      ctx.fillRect(0, groundY - 30, W, 50);
    }

    // ── CHARACTER ──
    const charX = 80;
    const charY = groundY - CHAR_HEIGHT - 2;
    const bounce = charState === "sit" ? 0
      : Math.sin(timestamp * (charState === "run" ? 0.02 : 0.011))
        * (charState === "run" ? 3.5 : 2);
    drawCharacter(ctx, charState, ca.frame, charX, charY, palette, bounce, hungerStateRef.current);

    // ── POPUPS ──
    popupsRef.current.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life);
      if (p.mine) {
        ctx.font = "bold 18px monospace";
        ctx.fillStyle = "#f5c97a";
        ctx.shadowColor = "#f5c97a";
        ctx.shadowBlur = 10;
        ctx.fillText(p.text, p.x, p.y);
        ctx.shadowBlur = 0;
      } else if (p.feed) {
        ctx.font = "bold 13px monospace";
        ctx.fillStyle = "#74c69d";
        ctx.shadowColor = "#74c69d";
        ctx.shadowBlur = 6;
        const w = ctx.measureText(p.text).width;
        ctx.fillText(p.text, Math.min(p.x, W - w - 8), p.y);
        ctx.shadowBlur = 0;
      } else {
        ctx.font = "bold 8px monospace";
        ctx.fillStyle = palette.accent;
        ctx.fillText(p.text, p.x, p.y);
      }
    });
    ctx.globalAlpha = 1;
    onPopupTick?.(dt);

    // ── SCANLINES ──
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = "#000";
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
    ctx.globalAlpha = 1;

    // ── VIGNETTE ──
    const vig = ctx.createRadialGradient(W/2, H/2, H*0.25, W/2, H/2, H*0.85);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    animRef.current = requestAnimationFrame(drawFrame);
  }, [onPopupTick]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(animRef.current);
  }, [drawFrame]);

  return (
    <canvas ref={canvasRef} width={W} height={H}
      style={{ display: "block", imageRendering: "pixelated", cursor: "pointer" }} />
  );
}

// ── ARRIVAL SCENE ─────────────────────────────────────────────────────────────
function drawArrivalScene(ctx, timestamp, charAnimRef, dt, _palette) {
  const GROUND_COL = "#3a4a38"; const GROUND_LINE = "#2e3d2c";
  const HILL1 = "#2e3d30"; const HILL2 = "#364438";
  const FOG = "rgba(180,195,185,";

  const ca = charAnimRef.current;
  ca.timer += dt;
  if (ca.timer >= 1.2) { ca.timer = 0; ca.frame = (ca.frame + 1) % 2; }

  const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
  skyGrad.addColorStop(0, "#2a3340"); skyGrad.addColorStop(0.5, "#3d4d50");
  skyGrad.addColorStop(1, "#4e5e52");
  ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H);

  drawHill(ctx, HILL1, 0, 35, H - 105, W);
  drawHill(ctx, HILL2, 0, 22, H - 82,  W);

  const groundY = H - 60;
  ctx.fillStyle = GROUND_COL; ctx.fillRect(0, groundY, W, 60);
  ctx.fillStyle = GROUND_LINE; ctx.fillRect(0, groundY, W, 4);

  // ── Ruined cottage — walls mostly gone, chimney stands ──
  const cotX = W - 180, cotY = groundY - 80;

  // Chimney — still standing
  ctx.fillStyle = "#3a3e38";
  ctx.fillRect(cotX + 60, cotY - 20, 14, 60);
  ctx.fillRect(cotX + 58, cotY - 22, 18, 6);

  // Remnant walls — low, broken
  ctx.fillStyle = "#3a4240";
  ctx.fillRect(cotX,      cotY + 50, 30, 10); // left wall stump
  ctx.fillRect(cotX + 58, cotY + 40, 30, 20); // right wall stump
  ctx.fillRect(cotX + 10, cotY + 56, 50, 4);  // foundation line

  // Scattered stones
  ctx.fillStyle = "#2e3530";
  [[cotX - 10, groundY - 8, 6, 4], [cotX + 90, groundY - 6, 8, 4],
   [cotX + 30, groundY - 5, 5, 3], [cotX + 50, groundY - 9, 7, 4]].forEach(([x,y,w,h]) => {
    ctx.fillRect(x, y, w, h);
  });

  // Open gate — still standing
  const gateX = cotX - 24;
  ctx.fillStyle = "#3a3e35";
  ctx.fillRect(gateX,      groundY - 24, 4, 24);
  ctx.fillRect(gateX + 16, groundY - 22, 3, 22);
  // Gate open — horizontal bar pointing outward
  ctx.fillRect(gateX + 4, groundY - 20, 12, 3);

  // Campfire
  const fireX = cotX - 60, fireY = groundY - 8;
  ctx.fillStyle = "#2a2825";
  ctx.fillRect(fireX - 6, fireY + 4, 14, 3); // log
  ctx.fillRect(fireX - 2, fireY + 2, 6, 2);  // log crossing
  // Flames — animated
  const flicker = Math.sin(timestamp * 0.008) * 0.3 + 0.7;
  const flicker2 = Math.sin(timestamp * 0.011 + 1) * 0.25 + 0.75;
  ctx.globalAlpha = flicker;
  ctx.fillStyle = "#e8a030"; ctx.fillRect(fireX - 2, fireY - 2, 4, 4);
  ctx.fillStyle = "#f0600a"; ctx.fillRect(fireX - 1, fireY - 4, 3, 3);
  ctx.globalAlpha = flicker2;
  ctx.fillStyle = "#fff8c0"; ctx.fillRect(fireX, fireY - 3, 2, 2);
  ctx.globalAlpha = 1;
  // Glow
  const glow = ctx.createRadialGradient(fireX + 1, fireY, 1, fireX + 1, fireY, 22);
  glow.addColorStop(0, "rgba(240,140,20,0.18)");
  glow.addColorStop(1, "rgba(240,140,20,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(fireX - 22, fireY - 22, 46, 44);

  // Path continuing beyond — dotted line
  ctx.fillStyle = "#4a5448";
  for (let px = cotX + 110; px < W - 10; px += 14) {
    ctx.fillRect(px, groundY - 2, 8, 3);
  }

  // Daffodil remnants — just stems and small hints
  [
    { x: cotX - 40, h: 10 }, { x: cotX - 52, h: 14 }, { x: cotX - 30, h: 8 },
  ].forEach(({ x, h }) => {
    ctx.fillStyle = "#4a6040";
    ctx.fillRect(x, groundY - h, 2, h);
    // Just a tiny hint of yellow — faded
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#d4b44a";
    ctx.fillRect(x - 1, groundY - h - 3, 4, 2);
    ctx.globalAlpha = 1;
  });

  // Wanderer sits by the fire
  drawCharacter(ctx, "sit", charAnimRef.current.frame, cotX - 85, groundY - CHAR_HEIGHT - 2,
    { ..._palette, accent: "#d4b44a" }, 0, "full");

  // Fog layers
  const fogOffset = (timestamp * 0.008) % W;
  [
    { y: H - 30, h: 30, alpha: 0.35 }, { y: H - 55, h: 28, alpha: 0.20 },
    { y: H - 80, h: 30, alpha: 0.12 }, { y: H - 110, h: 40, alpha: 0.07 },
  ].forEach(({ y, h, alpha }) => {
    const fogGrad = ctx.createLinearGradient(0, y, 0, y + h);
    fogGrad.addColorStop(0, FOG + "0)");
    fogGrad.addColorStop(0.4, FOG + alpha + ")");
    fogGrad.addColorStop(1, FOG + (alpha * 1.4) + ")");
    ctx.fillStyle = fogGrad;
    ctx.fillRect(-fogOffset, y, W + fogOffset, h);
    ctx.fillRect(W - fogOffset, y, fogOffset, h);
  });

  ctx.globalAlpha = 0.06; ctx.fillStyle = "#000";
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
  ctx.globalAlpha = 1;

  const vig = ctx.createRadialGradient(W/2, H/2, H*0.15, W/2, H/2, H*0.9);
  vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,0.65)");
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
}

// ── DISTANT LANDSCAPE ────────────────────────────────────────────────────────
// Five stages that crossfade based on distance traveled
const LANDSCAPE_STAGES = [
  { // 0-1500 km: open countryside, flat horizon, distant farmhouse
    draw(ctx, alpha, scrollX) {
      // Faint flat horizon line
      ctx.globalAlpha = alpha * 0.36;
      ctx.fillStyle = "#3a4a35";
      ctx.fillRect(0, H - 128, W, 4);
      // Distant farmhouse silhouette
      const fx = ((W * 0.7 - scrollX * 0.02) % W + W) % W;
      ctx.globalAlpha = alpha * 0.28;
      ctx.fillStyle = "#2e3830";
      ctx.fillRect(fx, H - 140, 18, 12);      // house body
      ctx.fillRect(fx - 2, H - 144, 22, 5);   // roof
      ctx.fillRect(fx + 14, H - 148, 4, 8);   // chimney
      ctx.globalAlpha = 1;
    }
  },
  { // 1500-3000 km: low hills appearing, gentle treeline
    draw(ctx, alpha, scrollX) {
      ctx.globalAlpha = alpha * 0.30;
      ctx.fillStyle = "#2e3d2a";
      // Distant low hill
      ctx.beginPath(); ctx.moveTo(0, H - 118);
      for (let x = 0; x <= W; x += 8) {
        const nx = (x + scrollX * 0.018) * 0.004;
        const y = H - 118 - Math.sin(nx) * 18 - Math.sin(nx * 1.7) * 8;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
      // Treeline — anchored to hill surface
      ctx.globalAlpha = alpha * 0.22;
      ctx.fillStyle = "#263320";
      for (let x = 20; x < W; x += 28 + Math.sin(x) * 8) {
        const tx = ((x - scrollX * 0.022) % W + W) % W;
        const nx = (tx + scrollX * 0.018) * 0.004;
        const hillY = H - 118 - Math.sin(nx) * 18 - Math.sin(nx * 1.7) * 8;
        const th = 8 + Math.sin(x * 0.3) * 4;
        ctx.fillRect(tx, hillY - th, 4, th);
        ctx.fillRect(tx - 2, hillY - th + 4, 8, 4);
      }
      ctx.globalAlpha = 1;
    }
  },
  { // 3000-4500 km: prominent hills, dark treeline
    draw(ctx, alpha, scrollX) {
      ctx.globalAlpha = alpha * 0.32;
      ctx.fillStyle = "#263530";
      ctx.beginPath(); ctx.moveTo(0, H - 112);
      for (let x = 0; x <= W; x += 6) {
        const nx = (x + scrollX * 0.02) * 0.003;
        const y = H - 112 - Math.sin(nx) * 28 - Math.sin(nx * 2.3 + 1) * 12;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
      // Dense treeline — anchored to hill surface
      ctx.globalAlpha = alpha * 0.28;
      ctx.fillStyle = "#1e2820";
      for (let x = 0; x < W; x += 18) {
        const tx = ((x - scrollX * 0.025) % W + W) % W;
        const nx = (tx + scrollX * 0.02) * 0.003;
        const hillY = H - 112 - Math.sin(nx) * 28 - Math.sin(nx * 2.3 + 1) * 12;
        const th = 12 + Math.sin(x * 0.2) * 5;
        ctx.fillRect(tx, hillY - th, 6, th);
        ctx.fillRect(tx - 2, hillY - th + 4, 10, 5);
      }
      ctx.globalAlpha = 1;
    }
  },
  { // 4500-5500 km: landscape opens, coastal feel, wider sky
    draw(ctx, alpha, scrollX) {
      // Flatter, wider horizon — cliffs starting to appear
      ctx.globalAlpha = alpha * 0.28;
      ctx.fillStyle = "#2a3840";
      ctx.beginPath(); ctx.moveTo(0, H - 108);
      for (let x = 0; x <= W; x += 8) {
        const nx = (x + scrollX * 0.015) * 0.002;
        const y = H - 108 - Math.sin(nx) * 14 - Math.sin(nx * 3) * 5;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
      // Hint of water/sea — very faint horizontal band
      ctx.globalAlpha = alpha * 0.18;
      ctx.fillStyle = "#304858";
      ctx.fillRect(0, H - 114, W, 5);
      ctx.globalAlpha = 1;
    }
  },
  { // 5500-6000 km: coastal cliffs, sea visible, open windswept
    draw(ctx, alpha, scrollX) {
      // Cliff silhouette
      ctx.globalAlpha = alpha * 0.36;
      ctx.fillStyle = "#283540";
      ctx.beginPath(); ctx.moveTo(0, H - 105);
      for (let x = 0; x <= W; x += 6) {
        const nx = (x + scrollX * 0.012) * 0.0025;
        const y = H - 105 - Math.abs(Math.sin(nx)) * 22 - Math.sin(nx * 4) * 6;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
      // Sea — layered faint bands
      ctx.globalAlpha = alpha * 0.22;
      ctx.fillStyle = "#2a4860";
      ctx.fillRect(0, H - 115, W, 6);
      ctx.globalAlpha = alpha * 0.16;
      ctx.fillStyle = "#3a5870";
      ctx.fillRect(0, H - 121, W, 4);
      ctx.globalAlpha = 1;
    }
  },
];

function getLandscapeBlend(distance) {
  const DEST = 6000;
  const stages = [0, 1500, 3000, 4500, 5500, DEST];
  for (let i = 0; i < stages.length - 1; i++) {
    if (distance <= stages[i + 1]) {
      const t = (distance - stages[i]) / (stages[i + 1] - stages[i]);
      // Crossfade: current stage fades out, next fades in over last 20% of range
      const fadeStart = 0.8;
      if (t < fadeStart) return [{ idx: i, alpha: 1.0 }];
      const blend = (t - fadeStart) / (1 - fadeStart);
      return [
        { idx: i,     alpha: 1.0 - blend },
        { idx: i + 1, alpha: blend        },
      ];
    }
  }
  return [{ idx: 4, alpha: 1.0 }];
}

function drawHill(ctx, color, offsetX, amplitude, yBase, W) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(-20, H);
  for (let x = -20; x <= W + 20; x += 4) {
    const nx = (x + offsetX) * 0.0028;
    const y = yBase
      - Math.sin(nx) * amplitude
      - Math.sin(nx * 2.1 + 0.5) * (amplitude * 0.45)
      - Math.sin(nx * 0.5) * (amplitude * 0.3);
    ctx.lineTo(x, Math.floor(y / 4) * 4);
  }
  ctx.lineTo(W + 20, H); ctx.closePath(); ctx.fill();
}