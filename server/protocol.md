# Signaling protocol

The current WebSocket prototype supports one host and one controller per room.

- Client-to-server messages: create-room, join-room, signal, control, capabilities, leave-room, ping.
- Server-to-client messages: room-created, joined, peer-joined, peer-left, host-disconnected, signal, remote-control, capabilities, control-result, error.
- WebRTC transports camera video directly where possible. The WebSocket server relays negotiation and fallback camera-control commands; it is not a media relay.
- The prototype uses a public STUN server, but does not configure TURN. Some carrier networks, enterprise Wi-Fi and restrictive NATs need a TURN service.
- Before public deployment add TLS/WSS, origin checks, rate limits, authenticated pairing, room expiry, abuse protection, secure TURN configuration and a security review. A random room code is not complete authentication.
