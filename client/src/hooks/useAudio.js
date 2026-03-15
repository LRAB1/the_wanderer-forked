import { useEffect, useRef, useCallback } from "react";

const SOUNDS_PATH = "/sounds/";

const AMBIENT_SCHEDULE = [
  { fromHour: 5,  toHour: 10, file: "622804__nlux__local-woodland-birds-a2.mp3",           name: "dawn"      },
  { fromHour: 10, toHour: 17, file: "634511__resaural__spring-birds-woodpeckers-loop.mp3",  name: "afternoon" },
  { fromHour: 17, toHour: 21, file: "665159__felixblume__countryside-during-evening-in-missouri-in-a-field-some-birds-singing-slight-wind.mp3", name: "evening" },
  { fromHour: 21, toHour: 24, file: "405515__lasdimot__nc-night-forest.mp3",                name: "night"     },
  { fromHour: 0,  toHour: 5,  file: "405515__lasdimot__nc-night-forest.mp3",                name: "night"     },
];

const RAIN_FILE    = "238431__philllchabbb__suburbrain_outdoorloop.mp3";
const THUNDER_FILE = "581125__fission9__distant-thunder-4.mp3";
const OWL_FILE     = "745208__patrick_corra__tawny-owl-hooting.mp3";

const AMBIENT_VOL  = 0.5;
const RAIN_VOL     = 0.45;
const OWL_VOL      = 0.3;
const THUNDER_VOL  = 0.6;
const FADE_SECS    = 3.0;

const OWL_MIN_MS   = 60000;
const OWL_MAX_MS   = 180000;

const STEP_FILE    = "807862__designerschoice__feethmn-mcu_footsteps-on-grass_nicholas-judy_tdc.mp3";
const STEP_VOL     = 0.35;
const FEED_FILE    = "47313572-ui-sounds-pack-2-sound-4-358895.mp3";
const FEED_VOL     = 0.6;

function getSlotForHour(hour) {
  return AMBIENT_SCHEDULE.find(s => hour >= s.fromHour && hour < s.toHour) || AMBIENT_SCHEDULE[3];
}

function makeFader(audio) {
  // Returns { fadeIn(targetVol, secs), fadeOut(secs, onDone) }
  let iv = null;
  function stop() { if (iv) { clearInterval(iv); iv = null; } }
  return {
    fadeIn(targetVol, secs = FADE_SECS) {
      stop();
      const steps = Math.round(secs * 20); // 20 steps/sec
      const step  = targetVol / steps;
      iv = setInterval(() => {
        audio.volume = Math.min(targetVol, +(audio.volume + step).toFixed(4));
        if (audio.volume >= targetVol) stop();
      }, 1000 / 20);
    },
    fadeOut(secs = FADE_SECS, onDone) {
      stop();
      const startVol = audio.volume;
      if (startVol === 0) { audio.pause(); onDone?.(); return; }
      const steps = Math.round(secs * 20);
      const step  = startVol / steps;
      iv = setInterval(() => {
        audio.volume = Math.max(0, +(audio.volume - step).toFixed(4));
        if (audio.volume <= 0) { stop(); audio.pause(); audio.currentTime = 0; onDone?.(); }
      }, 1000 / 20);
    },
    stop,
  };
}

export function useAudio({ raining, charState, arrived, onInit }) {
  const ready      = useRef(false);
  const muted      = useRef(false);
  const rainingRef = useRef(raining);

  const ambient    = useRef(null); // { audio, fader, slot }
  const rain       = useRef(null); // { audio, fader }
  const owl        = useRef(null); // { audio, fader }
  const thunder    = useRef(null);
  const owlTimer   = useRef(null);
  const stepAudio  = useRef(null);
  const charRef    = useRef(charState);
  const feedAudio  = useRef(null);

  const scheduleOwl = useCallback(() => {
    clearTimeout(owlTimer.current);
    const ms = OWL_MIN_MS + Math.random() * (OWL_MAX_MS - OWL_MIN_MS);
    owlTimer.current = setTimeout(() => {
      if (ready.current && !muted.current && ambient.current?.slot === "night") {
        if (!owl.current) {
          const audio = new Audio(SOUNDS_PATH + OWL_FILE);
          audio.volume = 0;
          owl.current = { audio, fader: makeFader(audio) };
        }
        owl.current.audio.currentTime = 0;
        owl.current.audio.play().then(() => {
          owl.current.fader.fadeIn(OWL_VOL, 1.5);
          setTimeout(() => owl.current?.fader.fadeOut(2.0), 6000);
        }).catch(() => {});
      }
      scheduleOwl();
    }, ms);
  }, []);

  useEffect(() => { charRef.current = charState; }, [charState]);

  const init = useCallback(() => {
    if (ready.current) return;
    ready.current = true;

    const hour = new Date().getHours();
    const slot = getSlotForHour(hour);

    const ambAudio = new Audio(SOUNDS_PATH + slot.file);
    ambAudio.loop   = true;
    ambAudio.volume = 0;
    const ambFader  = makeFader(ambAudio);
    ambient.current = { audio: ambAudio, fader: ambFader, slot: slot.name };

    const playWhenReady = () => {
      ambAudio.play().then(() => {
        if (!muted.current) ambFader.fadeIn(AMBIENT_VOL);
      }).catch((e) => console.warn("Ambient play failed:", e));
    };
    if (ambAudio.readyState >= 3) {
      playWhenReady();
    } else {
      ambAudio.addEventListener("canplaythrough", playWhenReady, { once: true });
    }

    const rainAudio = new Audio(SOUNDS_PATH + RAIN_FILE);
    rainAudio.loop   = true;
    rainAudio.volume = 0;
    rain.current = { audio: rainAudio, fader: makeFader(rainAudio) };

    if (rainingRef.current) {
      rainAudio.play().then(() => {
        if (!muted.current) rain.current.fader.fadeIn(RAIN_VOL);
      }).catch(() => {});
    }

    scheduleOwl();

    // Pre-load step audio as a loop, start immediately if already walking/running
    const s = new Audio(SOUNDS_PATH + STEP_FILE);
    s.loop   = true;
    s.volume = 0;
    const stepFader = makeFader(s);
    stepAudio.current = { audio: s, fader: stepFader };

    // Delay slightly so charRef has time to reflect server state
    setTimeout(() => {
      if (charRef.current !== "sit") {
        s.play().then(() => {
          if (!muted.current) stepFader.fadeIn(STEP_VOL, 0.5);
        }).catch(() => {});
      }
    }, 500);

    // Pre-load feed sound
    const f = new Audio(SOUNDS_PATH + FEED_FILE);
    f.volume = FEED_VOL;
    feedAudio.current = f;

    onInit?.();
  }, [scheduleOwl, onInit]);

  // First interaction triggers init
  useEffect(() => {
    const go = () => init();
    window.addEventListener("click",      go, { once: true });
    window.addEventListener("keydown",    go, { once: true });
    window.addEventListener("touchstart", go, { once: true });
    return () => {
      window.removeEventListener("click",      go);
      window.removeEventListener("keydown",    go);
      window.removeEventListener("touchstart", go);
    };
  }, [init]);

  // Rain changes
  useEffect(() => {
    rainingRef.current = raining;
    if (!ready.current || !rain.current) return;
    if (raining) {
      rain.current.audio.play().then(() => {
        if (!muted.current) rain.current.fader.fadeIn(RAIN_VOL);
      }).catch(() => {});
    } else {
      rain.current.fader.fadeOut();
    }
  }, [raining]);

  // Check ambient slot every minute
  useEffect(() => {
    const iv = setInterval(() => {
      if (!ready.current || !ambient.current) return;
      const slot = getSlotForHour(new Date().getHours());
      if (slot.name === ambient.current.slot) return;

      // Fade out old, start new
      const old = ambient.current;
      old.fader.fadeOut(FADE_SECS, () => { old.audio.src = ""; });

      const newAudio  = new Audio(SOUNDS_PATH + slot.file);
      newAudio.loop   = true;
      newAudio.volume = 0;
      const newFader  = makeFader(newAudio);
      ambient.current = { audio: newAudio, fader: newFader, slot: slot.name };
      newAudio.play().then(() => {
        if (!muted.current) newFader.fadeIn(AMBIENT_VOL);
      }).catch(() => {});
    }, 60000);
    return () => clearInterval(iv);
  }, []);

  // Start/stop footstep loop based on charState
  useEffect(() => {
    if (!ready.current || !stepAudio.current) return;
    const { audio, fader } = stepAudio.current;
    if (charState === "sit") {
      fader.fadeOut(0.8);
    } else {
      audio.play().then(() => {
        if (!muted.current) fader.fadeIn(STEP_VOL, 0.5);
      }).catch(() => {});
    }
  }, [charState]);

  // Cleanup
  useEffect(() => {
    return () => {
      clearTimeout(owlTimer.current);
      ambient.current?.audio.pause();
      rain.current?.audio.pause();
      owl.current?.audio.pause();
      thunder.current?.pause();
      stepAudio.current?.audio.pause();
      feedAudio.current?.pause();
    };
  }, []);

  const playFeed = useCallback(() => {
    if (!ready.current || muted.current || !feedAudio.current) return;
    feedAudio.current.currentTime = 0;
    feedAudio.current.play().catch(() => {});
  }, []);

  const playThunder = useCallback(() => {
    if (!ready.current || muted.current) return;
    if (!thunder.current) {
      thunder.current = new Audio(SOUNDS_PATH + THUNDER_FILE);
      thunder.current.volume = THUNDER_VOL;
    }
    thunder.current.currentTime = 0;
    thunder.current.play().catch(() => {});
  }, []);

  const toggleMute = useCallback(() => {
    muted.current = !muted.current;
    if (ambient.current) {
      if (muted.current) {
        ambient.current.fader.stop();
        ambient.current.audio.volume = 0;
      } else {
        ambient.current.fader.fadeIn(AMBIENT_VOL, 1.0);
      }
    }
    if (rain.current && rainingRef.current) {
      if (muted.current) {
        rain.current.fader.stop();
        rain.current.audio.volume = 0;
      } else {
        rain.current.fader.fadeIn(RAIN_VOL, 1.0);
      }
    }
    if (stepAudio.current) {
      if (muted.current) { stepAudio.current.fader.stop(); stepAudio.current.audio.volume = 0; }
      else if (charRef.current !== "sit") stepAudio.current.fader.fadeIn(STEP_VOL, 0.5);
    }
    return !muted.current;
  }, []);

  return { playThunder, playFeed, toggleMute };
}