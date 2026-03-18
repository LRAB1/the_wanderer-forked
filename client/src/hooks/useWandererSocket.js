import { useEffect, useRef, useState } from "react";

const WS_URL = process.env.NODE_ENV === "development" //TODO: are dev env's really used here? LRAB1 18-3-2026
  ? "ws://localhost:3001"
  : (window.location.protocol === "https:" ? "wss://" : "ws://") + window.location.host;

const RECONNECT_DELAY = 3000;

export function useWandererSocket({
  onHello, onState, onMyBoost, onBoostEvent, onBoostCapped,
  onFeedEvent, onFeedResult, onMilestone, onReset, onOnlineCount,
  onWeather, onChatMessage, onChatBlocked, onOnlineList,
}) {
  const cbRef  = useRef({});
  const wsRef  = useRef(null);
  const [connected, setConnected] = useState(false);

  cbRef.current = {
    onHello, onState, onMyBoost, onBoostEvent, onBoostCapped,
    onFeedEvent, onFeedResult, onMilestone, onReset, onOnlineCount,
    onWeather, onChatMessage, onChatBlocked, onOnlineList,
  };

  useEffect(() => {
    let reconnectTimer = null;
    let unmounted = false;

    function connect() {
      if (wsRef.current?.readyState <= 1) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => { if (!unmounted) setConnected(true); };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          const cb  = cbRef.current;
          switch (msg.type) {
            case "HELLO":
              // Pass both raining and fog state on connect
              cb.onWeather?.({ raining: msg.raining ?? false, fog: msg.fog ?? false });
              cb.onHello?.(msg);
              break;
            case "STATE":        cb.onState?.(msg);             break;
            case "MY_BOOST":     cb.onMyBoost?.(msg);           break;
            case "BOOST_EVENT":  cb.onBoostEvent?.(msg);        break;
            case "BOOST_CAPPED": cb.onBoostCapped?.(msg);       break;
            case "FEED_EVENT":   cb.onFeedEvent?.(msg);         break;
            case "FEED_RESULT":  cb.onFeedResult?.(msg);        break;
            case "MILESTONE":    cb.onMilestone?.(msg);         break;
            case "RESET":        cb.onReset?.(msg);             break;
            case "ONLINE_COUNT": cb.onOnlineCount?.(msg.count); break;
            case "WEATHER":
              cb.onWeather?.({ raining: msg.raining ?? false, fog: msg.fog ?? false });
              break;
            case "CHAT_MESSAGE": cb.onChatMessage?.(msg);       break;
            case "CHAT_BLOCKED": cb.onChatBlocked?.(msg);       break;
            case "ONLINE_LIST":  cb.onOnlineList?.(msg.users);  break;
            default: break;
          }
        } catch {}
      };

      ws.onclose = () => {
        if (unmounted) return;
        setConnected(false);
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY);
      };

      ws.onerror = () => {};
    }

    connect();
    return () => {
      unmounted = true;
      clearTimeout(reconnectTimer);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
    };
  }, []);

  function sendBoost()     { if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: "BOOST" })); }
  function sendFeed()      { if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: "FEED" })); }
  function sendChat(text)  { if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: "CHAT", text })); }
  function sendGetOnline() { if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: "GET_ONLINE" })); }

  return { sendBoost, sendFeed, sendChat, sendGetOnline, connected };
}