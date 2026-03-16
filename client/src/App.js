import { useState, useCallback, useEffect, useRef } from "react";
import GameCanvas from "./components/GameCanvas";
import { useWandererSocket } from "./hooks/useWandererSocket";
import { getPaletteForTime } from "./hooks/usePalette";
import { useAudio } from "./hooks/useAudio";
import "./App.css";

const DESTINATION_KM    = 6000;
const DAILY_FEED_MAX    = 4;
const DESTINATION_LABEL = "Somewhere ahead, a fire still burns.\nThe path continues beyond it.\nThat's all they know.";

function fmtEnergy(n)   { return Math.round(n).toLocaleString(); }
function fmtDistance(km) {
  if (km < 1) return (km * 1000).toFixed(0) + " m";
  return km.toFixed(km < 10 ? 2 : 1) + " km";
}
function fmtCountdown(ms) {
  if (ms <= 0) return "now";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const ALL_LORE = [
  { km: 100,  text: "They started walking. They don't remember deciding to." },
  { km: 300,  text: "Someone asked where they were going. They said: forward. It seemed like enough." },
  { km: 500,  text: "The wanderer has been walking for a long time. They don't talk about why." },
  { km: 750,  text: "There's a particular quality to moving. It keeps the thoughts from settling." },
  { km: 1000, text: "They've started counting steps. Then stopped. Some things are better not measured." },
  { km: 1200, text: "Someone once told them: if you ever feel lost, just keep moving. The world is smaller than it seems." },
  { km: 1500, text: "They passed through a town. Nobody looked up. That felt right, somehow." },
  { km: 1800, text: "The question isn't why you keep going. The question is what you'd do if you stopped." },
  { km: 2000, text: "They used to live somewhere cold. They left when the house got too quiet." },
  { km: 2300, text: "There are nights when the distance feels impossible. They walk anyway. That's the whole secret." },
  { km: 2600, text: "They found an old road marker. The place it named didn't exist anymore. They kept going." },
  { km: 3000, text: "Halfway. The wanderer sits for a long time before getting up again." },
  { km: 3300, text: "Not all movement is escape. Sometimes it's just the only honest thing left to do." },
  { km: 3600, text: "The sky looked like something they half-remembered. They couldn't say what." },
  { km: 4000, text: "They've started recognising the quality of light in the late afternoon. It looked like this, back then." },
  { km: 4300, text: "A child waved from a window. They waved back. It was the kindest moment in weeks." },
  { km: 4600, text: "They don't know what they're moving toward. They've made peace with that. Mostly." },
  { km: 5000, text: "The cottage was built by hand. It took two summers. Someone loved something enough to build it." },
  { km: 5200, text: "They've stopped asking if it's worth it. The asking was the thing that was weighing them down." },
  { km: 5500, text: "There were daffodils here once, apparently. You can still see where they grew." },
  { km: 5700, text: "The walls are gone. The chimney still stands. Something happened here, and then life continued anyway." },
  { km: 5900, text: "The fire is still burning. Someone was here, or is still nearby. The path continues beyond it." },
  { km: 5950, text: "They sit beside the fire for a while. Not because they've arrived. Because they're allowed to rest." },
  { km: 5980, text: "The path continues. Of course it does. It always does." },
  { km: 6000, text: "The gate is open. Beyond it, another road. They look at it for a long time. Then they keep walking." },
];

// Word-by-word fade-in component
function LoreEntry({ km, text, revealedAt, isNew }) {
  const words = text.split(" ");
  return (
    <p className={`lore-entry ${isNew ? "lore-entry-new" : ""}`}>
      <span className="lore-km">{
        km < 1 ? (km * 1000).toFixed(0) + " m" :
        km.toFixed(km < 10 ? 2 : 1) + " km"
      } —</span>{" "}
      {isNew ? words.map((word, i) => (
        <span key={i} className="lore-word" style={{ animationDelay: `${i * 80}ms` }}>
          {word}{i < words.length - 1 ? " " : ""}
        </span>
      )) : text}
      {revealedAt && (
        <span className="lore-timestamp">
          {new Date(revealedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </p>
  );
}

export default function App() {
  const [energy, setEnergy]             = useState(12);
  const [energyCap, setEnergyCap]       = useState(500);
  const [totalEnergy, setTotalEnergy]   = useState(12);
  const [hunger, setHunger]             = useState(0);
  const [hungerState, setHungerState]   = useState("full");
  const [distance, setDistance]         = useState(0);
  const [onlineCount, setOnlineCount]   = useState(0);
  const [charState, setCharState]       = useState("walk");
  const [arrived, setArrived]           = useState(false);
  const [speedKmh, setSpeedKmh]         = useState(0);
  const [burnRate, setBurnRate]         = useState(0);
  const [palette, setPalette]           = useState(() => getPaletteForTime());
  const [popups, setPopups]             = useState([]);
  const [boostFlash, setBoostFlash]     = useState(false);
  const [feedFlash, setFeedFlash]       = useState(false);
  const [timeLabel, setTimeLabel]       = useState("");
  const [wsConnected, setWsConnected]   = useState(false);
  const [feedsUsed, setFeedsUsed]       = useState(0);
  const [feedsResetAt, setFeedsResetAt] = useState(null);
  const [feedMsg, setFeedMsg]           = useState("");
  const [revealedLore, setRevealedLore] = useState([]);
  const [milestoneFlash, setMilestoneFlash] = useState(null);
  const [showArrivalText, setShowArrivalText] = useState(false);
  const [raining, setRaining]           = useState(false);
  const [fog, setFog]                   = useState(false);
  const [myUsername, setMyUsername]     = useState("");
  const [shareCopied, setShareCopied]   = useState(false);

  // ── Chat state ──
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput]       = useState("");
  const [chatOpen, setChatOpen]         = useState(false);
  const [chatBlocked, setChatBlocked]   = useState("");
  const [unreadCount, setUnreadCount]   = useState(0);
  const [showOnlineModal, setShowOnlineModal] = useState(false);
  const [onlineList, setOnlineList]     = useState([]);
  const [audioStarted, setAudioStarted] = useState(false);
  const [soundOn, setSoundOn]           = useState(true);

  const playFeedRef         = useRef(null);
  const milestoneFlashTimer = useRef(null);
  const popupIdRef          = useRef(0);
  const feedMsgTimer        = useRef(null);
  const chatBlockedTimer    = useRef(null);
  const chatEndRef          = useRef(null);

  // Palette clock
  useEffect(() => {
    const update = () => {
      if (!arrived) setPalette(getPaletteForTime());
      const now = new Date();
      setTimeLabel(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };
    update();
    const iv = setInterval(update, 30000);
    return () => clearInterval(iv);
  }, [arrived]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatOpen]);

  // Clear unread when chat opened
  useEffect(() => {
    if (chatOpen) setUnreadCount(0);
  }, [chatOpen]);

  // Tick every second to keep feed countdown fresh and re-enable button on expiry
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!feedsResetAt || feedsUsed === 0) return;
    const iv = setInterval(() => {
      setTick(t => t + 1);
      if (Date.now() >= feedsResetAt) setFeedsUsed(0);
    }, 1000);
    return () => clearInterval(iv);
  }, [feedsResetAt, feedsUsed]);

  function showFeedMsg(text, duration = 3000) {
    clearTimeout(feedMsgTimer.current);
    setFeedMsg(text);
    feedMsgTimer.current = setTimeout(() => setFeedMsg(""), duration);
  }

  const triggerMilestone = useCallback((km, text) => {
    clearTimeout(milestoneFlashTimer.current);
    setMilestoneFlash({ km, text });
    milestoneFlashTimer.current = setTimeout(() => setMilestoneFlash(null), 8000);
    setRevealedLore(prev => {
      if (prev.find(m => m.km === km)) return prev;
      const entry = { km, text, revealedAt: Date.now(), isNew: true };
      setTimeout(() => {
        setRevealedLore(p => p.map(m => m.km === km ? { ...m, isNew: false } : m));
      }, text.split(" ").length * 80 + 1000);
      return [...prev, entry];
    });
  }, []);

  // ── Socket handlers ──
  const handleHello = useCallback((msg) => {
    setEnergy(msg.energy);
    setEnergyCap(msg.energyCap ?? 500);
    setTotalEnergy(msg.totalEnergy);
    setHunger(msg.hunger ?? 0);
    setHungerState(msg.hungerState ?? "full");
    setDistance(msg.distance);
    setOnlineCount(msg.onlineCount);
    setCharState(msg.charState);
    setArrived(msg.arrived ?? false);
    setWsConnected(true);
    setFeedsUsed(msg.feedsUsed ?? 0);
    setFeedsResetAt(msg.feedsResetAt ?? null);
    setMyUsername(msg.username ?? "");
    if (msg.chatHistory?.length) setChatMessages(msg.chatHistory);
    if (msg.reachedMilestones?.length) {
      const reached = new Set(msg.reachedMilestones);
      setRevealedLore(ALL_LORE.filter(m => reached.has(m.km)).map(m => ({ ...m, revealedAt: null, isNew: false })));
    }
    if (msg.arrived) setShowArrivalText(true);
  }, []);

  const handleState = useCallback((msg) => {
    setEnergy(msg.energy);
    setEnergyCap(msg.energyCap ?? 500);
    setTotalEnergy(msg.totalEnergy);
    setHunger(msg.hunger ?? 0);
    setHungerState(msg.hungerState ?? "full");
    setDistance(msg.distance);
    setOnlineCount(msg.onlineCount);
    setCharState(msg.charState);
    setArrived(msg.arrived ?? false);
    setSpeedKmh(msg.speedKmh ?? 0);
    setBurnRate(msg.burnRate ?? 0);
    if (msg.fog !== undefined) setFog(msg.fog);
  }, []);

  const handleMyBoost = useCallback((msg) => {
    setEnergy(msg.energy);
    setTotalEnergy(msg.totalEnergy);
    const id = popupIdRef.current++;
    setPopups((prev) => {
      const feeds  = prev.filter(p => p.feed);
      const boosts = prev.filter(p => !p.feed).slice(-6);
      return [...feeds, ...boosts, { id, x: 58, y: 212, text: `+${fmtEnergy(msg.gain)}`, life: 1, mine: true }];
    });
    setBoostFlash(true);
    setTimeout(() => setBoostFlash(false), 130);
  }, []);

  const handleBoostEvent = useCallback((msg) => {
    setEnergy(msg.energy);
    setTotalEnergy(msg.totalEnergy);
    const id = popupIdRef.current++;
    setPopups((prev) => {
      const feeds  = prev.filter(p => p.feed);
      const boosts = prev.filter(p => !p.feed).slice(-6);
      return [...feeds, ...boosts, { id, x: 75 + Math.random() * 60, y: 185 + Math.random() * 20, text: `+${fmtEnergy(msg.gain)}`, life: 1, mine: false }];
    });
  }, []);

  const handleBoostCapped = useCallback((msg) => { setEnergy(msg.energy); }, []);

  const handleFeedEvent = useCallback((msg) => {
    setHunger(msg.hunger);
    setHungerState(msg.hungerState);
    const id = popupIdRef.current++;
    const label = (msg.flag ? `${msg.flag} ` : "") + `${msg.from} fed the wanderer`;
    setPopups((prev) => {
      const feeds  = prev.filter(p => p.feed).slice(-2);
      const boosts = prev.filter(p => !p.feed);
      return [...boosts, ...feeds, { id, x: 460 + Math.random() * 30, y: 230, text: label, life: 3.5, feed: true }];
    });
    setFeedFlash(true);
    setTimeout(() => setFeedFlash(false), 200);
  }, []);

  const handleFeedResult = useCallback((msg) => {
    setFeedsUsed(msg.feedsUsed);
    setFeedsResetAt(msg.feedsResetAt);
    if (msg.success) {
      setHunger(msg.hunger);
      setHungerState(msg.hungerState);
      playFeedRef.current?.();
    } else if (msg.reason === "daily_limit") {
      const msLeft = (msg.feedsResetAt || 0) - Date.now();
      showFeedMsg(`No more food today. Resets in ${fmtCountdown(msLeft)}.`);
    }
  }, []);

  const handleMilestone = useCallback((msg) => {
    triggerMilestone(msg.km, msg.text);
    if (msg.isArrival) { setArrived(true); setShowArrivalText(true); }
  }, [triggerMilestone]);

  const handleReset = useCallback(() => {
    setArrived(false); setShowArrivalText(false); setRevealedLore([]);
    setMilestoneFlash(null); setEnergy(12); setTotalEnergy(0);
    setHunger(0); setHungerState("full"); setDistance(0);
    setCharState("walk"); setSpeedKmh(0); setBurnRate(0);
  }, []);

  const handleOnlineCount = useCallback((count) => setOnlineCount(count), []);
  const handleWeather     = useCallback(({ raining, fog }) => { setRaining(raining); setFog(fog); }, []);

  const handleChatMessage = useCallback((msg) => {
    setChatMessages(prev => [...prev.slice(-99), msg]);
    setUnreadCount(prev => chatOpen ? 0 : prev + 1);
  }, [chatOpen]);

  const handleChatBlocked = useCallback((msg) => {
    clearTimeout(chatBlockedTimer.current);
    setChatBlocked(msg.text);
    chatBlockedTimer.current = setTimeout(() => setChatBlocked(""), 3000);
  }, []);

  const handleOnlineList = useCallback((users) => setOnlineList(users), []);

  const handlePopupTick = useCallback((dt) => {
    setPopups((prev) =>
      prev.map((p) => ({
        ...p,
        y:    p.y - (p.feed ? 22 : 38) * dt,
        life: p.life - dt * (p.feed ? 0.25 : 1.3),
      })).filter((p) => p.life > 0)
    );
  }, []);

  const { sendBoost, sendFeed, sendChat, sendGetOnline, connected } = useWandererSocket({
    onHello:        handleHello,
    onState:        handleState,
    onMyBoost:      handleMyBoost,
    onBoostEvent:   handleBoostEvent,
    onBoostCapped:  handleBoostCapped,
    onFeedEvent:    handleFeedEvent,
    onFeedResult:   handleFeedResult,
    onMilestone:    handleMilestone,
    onReset:        handleReset,
    onOnlineCount:  handleOnlineCount,
    onWeather:      handleWeather,
    onChatMessage:  handleChatMessage,
    onChatBlocked:  handleChatBlocked,
    onOnlineList:   handleOnlineList,
  });

  useEffect(() => { setWsConnected(connected); }, [connected]);

  // ── Audio ──
  const { playThunder, playFeed, toggleMute } = useAudio({ raining, fog, charState, arrived, onInit: () => setAudioStarted(true) });
  playFeedRef.current = playFeed;

  // Occasionally trigger thunder during rain
  useEffect(() => {
    if (!raining) return;
    const minMs = 30000, maxMs = 120000;
    let timer;
    const schedule = () => {
      timer = setTimeout(() => { playThunder(); schedule(); }, minMs + Math.random() * (maxMs - minMs));
    };
    schedule();
    return () => clearTimeout(timer);
  }, [raining, playThunder]);

  const handleMuteToggle = useCallback((e) => {
    e.stopPropagation();
    const on = toggleMute();
    setSoundOn(on);
  }, [toggleMute]);

  const boost = useCallback(() => { if (!arrived) sendBoost(); }, [sendBoost, arrived]);
  const feed  = useCallback(() => { if (!arrived) sendFeed();  }, [sendFeed,  arrived]);

  useEffect(() => {
    const handler = (e) => {
      if (e.repeat) return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") { e.preventDefault(); boost(); }
      if (e.code === "KeyF")  { e.preventDefault(); feed();  }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [boost, feed]);

  function share() {
    const km = fmtDistance(distance);
    const pct = pctToDest.toFixed(1);
    const shareText = `A little pixel wanderer is walking 6,000 km home. They've made it ${km} (${pct}%). Help keep them moving.`;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: "The Little Wanderer", text: shareText, url }).catch(() => {});
    } else {
      try {
        const el = document.createElement("textarea");
        el.value = url;
        el.style.cssText = "position:fixed;opacity:0;pointer-events:none;";
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      } catch {
        window.prompt("Copy this link:", url);
      }
    }
  }

  function submitChat(e) {
    e?.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    sendChat(text);
    setChatInput("");
  }

  function openOnlineModal() {
    sendGetOnline();
    setShowOnlineModal(true);
  }

  // ── Derived ──
  const tankFillPct    = Math.min(100, (energy / energyCap) * 100);
  const energyColor    = energy > energyCap * 0.5 ? "#74c69d" : energy > energyCap * 0.15 ? "#ffd166" : "#ef476f";
  const hungerFillPct  = Math.round(100 - hunger);
  const hungerColor    = hungerState === "starving" ? "#ef476f" : hungerState === "very-hungry" ? "#ff8c42" : hungerState === "hungry" ? "#ffd166" : "#74c69d";
  const hungerLabel    = hungerState === "starving" ? "★ STARVING" : hungerState === "very-hungry" ? "VERY HUNGRY" : hungerState === "hungry" ? "HUNGRY" : "WELL FED";
  const feedsLeft      = Math.max(0, DAILY_FEED_MAX - feedsUsed);
  const msUntilReset   = feedsResetAt ? Math.max(0, feedsResetAt - Date.now()) : 0;
  const canFeed        = (feedsLeft > 0 || msUntilReset === 0) && !arrived;
  const resetCountdown = msUntilReset > 0 ? fmtCountdown(msUntilReset) : null;
  const pctToDest      = Math.min(100, (distance / DESTINATION_KM) * 100);
  const kmRemaining    = Math.max(0, DESTINATION_KM - distance);
  const speedLabel     = charState === "sit" ? "0 km/h" : `${speedKmh} km/h`;
  const isFull         = energy >= energyCap - 2;

  return (
    <div className="app">
      <header className="header">
        <div className="title-line">
          <span className="diamond">◆</span>
          <span className="title">THE LITTLE WANDERER</span>
          <span className="diamond">◆</span>
        </div>
        <div className="subtitle">A COLLECTIVE JOURNEY</div>
      </header>

      {milestoneFlash && (
        <div className="milestone-flash">
          <div className="milestone-km">{fmtDistance(milestoneFlash.km)} reached</div>
          <div className="milestone-text">"{milestoneFlash.text}"</div>
        </div>
      )}

      <div className="scene-row">
        <div className="canvas-wrapper" onClick={boost}>
          <div className={`boost-overlay ${boostFlash ? "flash" : ""} ${feedFlash ? "feed-flash" : ""}`} />

          <GameCanvas
            palette={palette}
            charState={charState}
            energy={energy}
            hungerState={hungerState}
            arrived={arrived}
            popups={popups}
            onPopupTick={handlePopupTick}
            raining={raining}
            fog={fog}
          />

          {showArrivalText && (
            <div className="arrival-overlay">
              <div className="arrival-text">
                You helped them keep moving.
                <br />
                <span className="arrival-sub">The path continues. It always does.</span>
              </div>
            </div>
          )}

          {!arrived && <>
            <div className="hud hud-tr">
              <div className="hud-label">REMAINING</div>
              <div className="hud-value">{fmtDistance(kmRemaining)}</div>
            </div>
            <div className="hud hud-tl">
              <div className="hud-scene">{palette.name || "—"}</div>
              {timeLabel && <div className="hud-time">{timeLabel}</div>}
            </div>
            <div className="hud hud-bl" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {charState === "sit"
                ? <span className="hud-state blink-slow">★ RESTING</span>
                : <span className="hud-state">{charState === "run" ? "▶▶" : "▶"} {speedLabel}</span>
              }
              {audioStarted && (
                <button className="mute-btn" onClick={handleMuteToggle} title={soundOn ? "mute" : "unmute"}>
                  {soundOn ? "♪" : "♪̸"}
                </button>
              )}
            </div>
            <div
              className={`hud hud-br ${wsConnected ? "online" : "offline"}`}
              onClick={(e) => { e.stopPropagation(); openOnlineModal(); }}
              style={{ cursor: "pointer" }}
            >
              <span className="dot" />
              {wsConnected ? `${onlineCount} online` : "connecting..."}
            </div>
          </>}

          {arrived && (
            <div className="hud hud-tl">
              <div className="hud-scene arrived-scene">THE COTTAGE</div>
              <div className="hud-time">coastal cliffs · grey-green morning</div>
            </div>
          )}
        </div>

        {/* ── CHAT PANEL ── */}
        <div className={`chat-panel ${chatOpen ? "open" : "closed"}`}>
          <button className="chat-toggle" onClick={(e) => { e.stopPropagation(); setChatOpen(o => { if (!o) setTimeout(() => window.scrollTo({ top: 0, behavior: "instant" }), 0); return !o; }); }}>
            {chatOpen ? "✕" : (
              <span style={{ position: "relative" }}>
                💬
                {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
              </span>
            )}
          </button>
          {chatOpen && (
            <>
              <div className="chat-header">
                TRAVELLERS
                <div className="chat-username">you are {myUsername}</div>
              </div>
              <div className="chat-messages">
                {chatMessages.map((m, i) => (
                  <div key={i} className="chat-msg">
                    <span className="chat-name">{m.username}</span>
                    <span className="chat-text">{m.text}</span>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              {chatBlocked && <div className="chat-blocked-msg">{chatBlocked}</div>}
              <div className="chat-input-row">
                <input
                  className="chat-input"
                  placeholder="say something..."
                  value={chatInput}
                  maxLength={120}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submitChat(); } }}
                  onClick={e => e.stopPropagation()}
                />
                <button className="chat-send" onClick={(e) => { e.stopPropagation(); submitChat(); }}>→</button>
              </div>
            </>
          )}
        </div>
      </div>

      {!arrived && (
        <div className="destination-label">
          {DESTINATION_LABEL.split("\n").map((line, i) => (
            <span key={i}>{line}{i < 2 && <br />}</span>
          ))}
        </div>
      )}

      {arrived && revealedLore.length > 0 && (
        <div className="lore-scroll arrived-lore">
          {revealedLore.map((m) => (
            <LoreEntry key={m.km} km={m.km} text={m.text} revealedAt={m.revealedAt} isNew={false} />
          ))}
        </div>
      )}

      {!arrived && (
        <div className="meters-row">
          <div className="meter-block">
            <div className="meter-labels">
              <span className="meter-label-left">
                ENERGY TANK
                {energy < 10 && <span className="low-warn blink"> !! LOW</span>}
                {isFull && <span className="full-warn"> ▲ FULL</span>}
              </span>
              <span className="meter-label-right" style={{ color: energyColor }}>
                {fmtEnergy(energy)}<span className="meter-unit"> / {fmtEnergy(energyCap)}</span>
              </span>
            </div>
            <div className="meter-track">
              <div className="meter-fill" style={{ width: `${tankFillPct}%`, background: energyColor }} />
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="meter-tick" style={{ left: `${(i+1)*10}%` }} />
              ))}
            </div>
            <div className="meter-sub">
              Total contributed: <span style={{ color: "#888" }}>{fmtEnergy(totalEnergy)}</span>
              {charState !== "sit" && burnRate > 0 && (
                <span style={{ color: "#555" }}> · burning {burnRate}/sec</span>
              )}
            </div>
          </div>

          <div className="meter-block">
            <div className="meter-labels">
              <span className="meter-label-left" style={{ color: hungerColor }}>HUNGER — {hungerLabel}</span>
              <span className="meter-label-right" style={{ color: hungerColor }}>
                {hungerFillPct}<span className="meter-unit">%</span>
              </span>
            </div>
            <div className="meter-track hunger">
              <div className="meter-fill" style={{ width: `${hungerFillPct}%`, background: hungerColor }} />
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="meter-tick" style={{ left: `${(i+1)*10}%` }} />
              ))}
            </div>
            <div className="meter-sub">
              {hungerState !== "full"
                ? <span style={{ color: hungerColor }}>speed reduced · energy burning faster</span>
                : <span style={{ color: "#555" }}>well fed · normal burn rate</span>
              }
            </div>
          </div>
        </div>
      )}

      {!arrived && (
        <div className="actions-row">
          <div className="action-block">
            <button className={`boost-btn ${isFull ? "capped" : ""}`} onClick={boost}>
              {isFull ? "▲ TANK FULL" : "▲ GIVE ENERGY"}
            </button>
            <div className="action-hint">CLICK · SPACE · TAP</div>
          </div>
          <div className="action-block">
            <button
              className={`feed-btn ${!canFeed ? "depleted" : ""}`}
              onClick={feed} disabled={!canFeed}
            >
              🍖 FEED
            </button>
            <div className="action-hint feed-quota" style={{ color: canFeed ? "#9090b8" : "#ef476f" }}>
              {canFeed
                ? `${feedsLeft} of ${DAILY_FEED_MAX} feeds left`
                : resetCountdown
                  ? `all used · resets in ${resetCountdown}`
                  : `all used · refreshing...`}
            </div>
            {feedMsg && <div className="feed-msg">{feedMsg}</div>}
          </div>
        </div>
      )}

      {!arrived && (
        <div className="stats-row">
          <div className="stat-block">
            <div className="stat-label">TRAVELED</div>
            <div className="stat-value accent">{fmtDistance(distance)}</div>
          </div>
          <div className="stat-block center">
            <div className="stat-label">DESTINATION</div>
            <div className="progress-wrap">
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${pctToDest}%` }} />
              </div>
              <div className="progress-pct">{pctToDest.toFixed(3)}%</div>
            </div>
            <div className="stat-remaining">{fmtDistance(kmRemaining)} remaining</div>
          </div>
          <div className="stat-block right">
            <div className="stat-label">SPEED</div>
            <div className="stat-value">{speedLabel}</div>
          </div>
        </div>
      )}



      {!arrived && revealedLore.length > 0 && (
        <div className="lore-scroll">
          <div className="lore-scroll-title">◆ FRAGMENTS</div>
          {revealedLore.map((m) => (
            <LoreEntry key={m.km} km={m.km} text={m.text} revealedAt={m.revealedAt} isNew={m.isNew} />
          ))}
        </div>
      )}


      <footer className="lore">
        THE WANDERER WALKS WHETHER YOU WATCH OR NOT.
        <br />
        ENERGY KEEPS THEM MOVING · FOOD KEEPS THEM STRONG.
        <br />
        <button className="share-btn" onClick={share}>
          {shareCopied ? "✓ LINK COPIED" : "◈ SEND HELP"}
        </button>
        <br /><br />
        <a className="kofi-link" href="https://ko-fi.com/heyjustingray" target="_blank" rel="noopener noreferrer">
          ◇ leave something for the journey
        </a>
      </footer>

      {/* ── ONLINE MODAL ── */}
      {showOnlineModal && (
        <div className="modal-overlay" onClick={() => setShowOnlineModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">TRAVELLERS ONLINE</div>
            <div className="my-username">you are <span>{myUsername}</span></div>
            <div className="online-list">
              {onlineList.length === 0 && <div className="online-empty">no one else is here</div>}
              {onlineList.map((u, i) => (
                <div key={i} className="online-row">
                  <span className="online-name">{u.username}</span>
                  <span className="online-stat" title="energy given">⚡ {u.boosts}</span>
                  <span className="online-stat" title="times fed">🍞 {u.feeds}</span>
                </div>
              ))}
            </div>
            <button className="modal-close" onClick={() => setShowOnlineModal(false)}>CLOSE</button>
          </div>
        </div>
      )}
    </div>
  );
}