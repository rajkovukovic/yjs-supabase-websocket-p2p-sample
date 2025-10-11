- Using awareness-based discovery with `y-webrtc` (signaling: []) and Hocuspocus for server sync matches Yjs patterns, with offline via `y-indexeddb` and presence via `awareness`.
- Frontend instantiates `WebrtcProvider` with STUN servers and tracks peers; backend provides Socket.IO signaling (not used by y-webrtc, correctly) and Hocuspocus WS. This hybrid with server fallback is aligned with best practice.

Key gaps/risk:
- No TURN configured; P2P will fail in many corporate/NAT cases. Add TURN.
- Auth: `HocuspocusProvider` uses a dummy token. Implement `onAuthenticate` and pass real tokens.
- WebRTC discovery: relying on awareness-only is fine, but ensure `maxConns`, backoff, and error handling are tuned; verify reconnection flows.
- Security for P2P: `WEBRTC_PASSWORD` optional; consider per-document secrets or auth-gated room join.
- Socket.IO signaling isn’t connected to y-webrtc (intentionally); ensure you don’t treat it as a requirement for P2P.
- Observability: add metrics/logging around P2P success rate and ICE states.

Recommended next steps:
- TURN: Deploy coturn; add to `peerOpts.config.iceServers` with credentials.
- Auth: Implement `onAuthenticate` on server and pass JWT/Session token from FE; set readOnly when appropriate.
- Reliability: Tune `y-webrtc` options (maxConns, filterBcConns, peerTimeout). Add exponential backoff for reconnects.
- Metrics/Debug: Expose ICE connection state changes, bytes sent/recv; integrate simple telemetry.
- UX: Surface connection mode (P2P vs server) and degrade gracefully when P2P not possible.
- Security: Gate `WebrtcProvider` with per-doc password or token; rotate if needed.

References:
- Yjs providers and y-webrtc usage: see Yjs README and y-webrtc docs.
- Hocuspocus provider auth and awareness: see Hocuspocus docs.
- WebRTC best practices: Google/MDN guidance on STUN/TURN/ICE.

- Completed: scanned FE/BE, pulled docs, compared with best practice, and proposed concrete improvements.