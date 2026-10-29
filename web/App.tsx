import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Aperture, Camera, Check, CircleHelp, Copy, Focus, Gauge, Monitor, Radio, RefreshCw, Settings2, ShieldCheck, Smartphone, Wifi, X } from 'lucide-react';

type Role = 'host' | 'viewer';
type Phase = 'idle' | 'starting' | 'hosting' | 'joining' | 'connected';
type Message = { type: string; [key: string]: any };
type RangeCapability = { min: number; max: number; step?: number };
type CameraCaps = { zoom?: RangeCapability; exposureCompensation?: RangeCapability; torch?: boolean; focusMode?: string[] };

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

function defaultSignalUrl() {
  const override = (import.meta as any).env?.VITE_SIGNAL_URL as string | undefined;
  if (override) return override;
  const host = window.location.hostname || '127.0.0.1';
  return (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + host + ':8787';
}
function readParam(name: string) { return new URLSearchParams(window.location.search).get(name) || ''; }
function capabilities(track: MediaStreamTrack): CameraCaps {
  const raw = track.getCapabilities() as any;
  const result: CameraCaps = {};
  if (raw.zoom && Number.isFinite(raw.zoom.min) && Number.isFinite(raw.zoom.max))
    result.zoom = { min: raw.zoom.min, max: raw.zoom.max, step: raw.zoom.step || 0.1 };
  if (raw.exposureCompensation && Number.isFinite(raw.exposureCompensation.min) && Number.isFinite(raw.exposureCompensation.max))
    result.exposureCompensation = { min: raw.exposureCompensation.min, max: raw.exposureCompensation.max, step: raw.exposureCompensation.step || 0.1 };
  if (typeof raw.torch === 'boolean') result.torch = raw.torch;
  if (Array.isArray(raw.focusMode)) result.focusMode = raw.focusMode;
  return result;
}

export default function App() {
  const [signalUrl, setSignalUrl] = useState(() => readParam('signal') || defaultSignalUrl());
  const [joinCode, setJoinCode] = useState(() => readParam('join').toUpperCase());
  const [role, setRole] = useState<Role | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('Ready to connect');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState('');
  const [caps, setCaps] = useState<CameraCaps>({});
  const [zoom, setZoom] = useState(1);
  const [exposure, setExposure] = useState(0);
  const [torch, setTorch] = useState(false);
  const [focusMode, setFocusMode] = useState('continuous');
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lanAddresses, setLanAddresses] = useState<string[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const roleRef = useRef<Role | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const live = phase === 'hosting' || phase === 'connected';
  const host = role === 'host';

  const joinUrl = useMemo(() => {
    if (!roomCode) return '';
    try {
      const nativeAndroid = Boolean((window as any).Capacitor?.isNativePlatform?.());
      const fromDesktop = window.location.protocol === 'file:';
      let pageAddress = window.location.hostname;
      let endpoint = signalUrl;
      let pageRoot = window.location.href;
      if (fromDesktop) {
        pageAddress = lanAddresses[0] || '';
        if (!pageAddress) return '';
        endpoint = 'ws://' + pageAddress + ':8787';
        pageRoot = 'http://' + pageAddress + ':8787/';
      } else if (nativeAndroid) {
        const signal = new URL(signalUrl);
        pageAddress = signal.hostname;
        const port = signal.port || '8787';
        pageRoot = 'http://' + pageAddress + ':' + port + '/';
      }
      if (!pageAddress) return '';
      const url = new URL(pageRoot);
      url.searchParams.set('join', roomCode);
      url.searchParams.set('signal', endpoint);
      return url.toString();
    } catch { return ''; }
  }, [roomCode, signalUrl, lanAddresses]);

  const sendSocket = useCallback((data: Message) => {
    const ws = socketRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
  }, []);

  const sendControl = useCallback((name: string, value: unknown) => {
    const data = JSON.stringify({ type: 'remote-control', name, value });
    if (channelRef.current?.readyState === 'open') channelRef.current.send(data);
    else sendSocket({ type: 'control', name, value });
    if (name === 'zoom') setZoom(Number(value));
    if (name === 'torch') setTorch(Boolean(value));
    if (name === 'exposureCompensation') setExposure(Number(value));
    if (name === 'focusMode') setFocusMode(String(value));
  }, [sendSocket]);

  const sendCapabilities = useCallback(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const result = capabilities(track);
    setCaps(result);
    sendSocket({ type: 'capabilities', capabilities: result });
    if (channelRef.current?.readyState === 'open') channelRef.current.send(JSON.stringify({ type: 'capabilities', capabilities: result }));
    const current = track.getSettings() as any;
    if (typeof current.zoom === 'number') setZoom(current.zoom);
    if (typeof current.exposureCompensation === 'number') setExposure(current.exposureCompensation);
  }, [sendSocket]);

  const applyControl = useCallback(async (name: string, value: unknown) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const setting: any = {};
      if (name === 'zoom') setting.zoom = Number(value);
      else if (name === 'torch') setting.torch = Boolean(value);
      else if (name === 'exposureCompensation') setting.exposureCompensation = Number(value);
      else if (name === 'focusMode') setting.focusMode = String(value);
      else return;
      await track.applyConstraints({ advanced: [setting] } as unknown as MediaTrackConstraints);
      if (name === 'zoom') setZoom(Number(value));
      if (name === 'torch') setTorch(Boolean(value));
      if (name === 'exposureCompensation') setExposure(Number(value));
      if (name === 'focusMode') setFocusMode(String(value));
      const result = JSON.stringify({ type: 'control-result', name, ok: true });
      if (channelRef.current?.readyState === 'open') channelRef.current.send(result);
      else sendSocket({ type: 'control-result', name, ok: true });
    } catch (e) {
      setStatus('This camera rejected the ' + name + ' setting');
      const reason = e instanceof Error ? e.message : 'Unsupported setting';
      const result = JSON.stringify({ type: 'control-result', name, ok: false, error: reason });
      if (channelRef.current?.readyState === 'open') channelRef.current.send(result);
      else sendSocket({ type: 'control-result', name, ok: false, error: reason });
    }
  }, [sendSocket]);

  const configureChannel = useCallback((channel: RTCDataChannel) => {
    channelRef.current = channel;
    channel.onopen = () => {
      setPhase('connected');
      setStatus('Peer connection established');
      if (roleRef.current === 'host') sendCapabilities();
    };
    channel.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data));
        if (msg.type === 'remote-control' && roleRef.current === 'host') void applyControl(msg.name, msg.value);
        else if (msg.type === 'capabilities' && roleRef.current === 'viewer') setCaps(msg.capabilities || {});
        else if (msg.type === 'control-result') setStatus(msg.ok ? 'Camera setting updated' : 'Camera does not support that setting');
      } catch { setStatus('Received invalid control data'); }
    };
  }, [applyControl, sendCapabilities]);

  const makePeer = useCallback((hostSide: boolean) => {
    pcRef.current?.close();
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    pendingIceRef.current = [];
    pc.onicecandidate = (event) => {
      if (event.candidate) sendSocket({ type: 'signal', payload: { kind: 'ice', candidate: event.candidate.toJSON() } });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') { setPhase('connected'); setStatus('Devices connected'); }
      else if (pc.connectionState === 'failed') setStatus('Connection failed; this network may need a TURN server.');
      else if (pc.connectionState === 'disconnected') setStatus('Connection interrupted');
    };
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0] || new MediaStream([event.track]);
        void remoteVideoRef.current.play().catch(() => undefined);
      }
      setStatus('Receiving live camera video');
    };
    if (hostSide) {
      const stream = streamRef.current;
      stream?.getTracks().forEach((track) => { if (stream) pc.addTrack(track, stream); });
      configureChannel(pc.createDataChannel('cambridge-control'));
    } else pc.ondatachannel = (event) => configureChannel(event.channel);
    return pc;
  }, [configureChannel, sendSocket]);

  const handleSignal = useCallback(async (payload: any) => {
    try {
      if (payload.kind === 'offer' && roleRef.current === 'viewer') {
        const pc = pcRef.current || makePeer(false);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        for (const candidate of pendingIceRef.current) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        pendingIceRef.current = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSocket({ type: 'signal', payload: { kind: 'answer', sdp: pc.localDescription } });
      } else if (payload.kind === 'answer' && roleRef.current === 'host') {
        const pc = pcRef.current;
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          for (const candidate of pendingIceRef.current) await pc.addIceCandidate(new RTCIceCandidate(candidate));
          pendingIceRef.current = [];
        }
      } else if (payload.kind === 'ice' && payload.candidate) {
        const pc = pcRef.current;
        if (pc?.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        else pendingIceRef.current.push(payload.candidate);
      }
    } catch (e) {
      setError('WebRTC setup failed: ' + (e instanceof Error ? e.message : String(e)));
      setStatus('Could not establish the media connection');
    }
  }, [makePeer, sendSocket]);

  const negotiateHost = useCallback(async () => {
    try {
      const pc = makePeer(true);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSocket({ type: 'signal', payload: { kind: 'offer', sdp: pc.localDescription } });
      sendCapabilities();
    } catch (e) { setError('Unable to start media connection: ' + (e instanceof Error ? e.message : String(e))); }
  }, [makePeer, sendCapabilities, sendSocket]);

  const handleServerMessage = useCallback(async (msg: Message) => {
    switch (msg.type) {
      case 'room-created':
        setRoomCode(msg.code); setPhase('hosting'); setStatus('Camera is ready. Waiting for another device…'); break;
      case 'joined':
        setRoomCode(msg.code); setStatus('Joined room. Waiting for camera video…'); break;
      case 'peer-joined':
        setStatus('Controller joined. Negotiating WebRTC…');
        if (roleRef.current === 'host') await negotiateHost();
        break;
      case 'peer-left':
        pcRef.current?.close(); pcRef.current = null; channelRef.current = null;
        setPhase(roleRef.current === 'host' ? 'hosting' : 'joining'); setStatus('Other device disconnected'); break;
      case 'host-disconnected':
        pcRef.current?.close(); pcRef.current = null; setPhase('idle'); setStatus('Camera host disconnected'); break;
      case 'signal': await handleSignal(msg.payload); break;
      case 'capabilities': setCaps(msg.capabilities || {}); break;
      case 'remote-control':
        if (roleRef.current === 'host') await applyControl(msg.name, msg.value);
        break;
      case 'control-result':
        setStatus(msg.ok ? 'Camera setting updated' : 'Camera does not support that setting'); break;
      case 'error': setError(msg.message || 'Signaling error'); setStatus('Connection failed'); break;
      default: break;
    }
  }, [applyControl, handleSignal, negotiateHost]);

  const openSocket = useCallback((nextRole: Role, code?: string) => {
    const endpoint = signalUrl.trim();
    if (!endpoint.startsWith('ws://') && !endpoint.startsWith('wss://')) {
      setError('Signaling URL must start with ws:// or wss://'); return;
    }
    try {
      const ws = new WebSocket(endpoint);
      socketRef.current = ws;
      ws.onopen = () => {
        setError('');
        if (nextRole === 'host') ws.send(JSON.stringify({ type: 'create-room' }));
        else ws.send(JSON.stringify({ type: 'join-room', code: (code || '').trim().toUpperCase() }));
      };
      ws.onmessage = (event) => {
        try { void handleServerMessage(JSON.parse(String(event.data))); }
        catch { setError('Invalid response from signaling server'); }
      };
      ws.onerror = () => { setError('Cannot reach signaling server. Check its address and make sure it is running.'); setPhase('idle'); };
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect to signaling service'); return false;
    }
  }, [handleServerMessage, signalUrl]);

  const startSharing = useCallback(async () => {
    setError(''); setPhase('starting'); setStatus('Requesting camera permission…');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access needs a supported browser and a secure origin (HTTPS or localhost).'); setPhase('idle'); return;
    }
    try {
      const video: MediaTrackConstraints = cameraId
        ? { deviceId: { exact: cameraId }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      streamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setCaps(capabilities(stream.getVideoTracks()[0]));
      const current = stream.getVideoTracks()[0].getSettings() as any;
      if (typeof current.zoom === 'number') setZoom(current.zoom);
      if (typeof current.exposureCompensation === 'number') setExposure(current.exposureCompensation);
      setDevices((await navigator.mediaDevices.enumerateDevices()).filter((item) => item.kind === 'videoinput'));
      roleRef.current = 'host'; setRole('host'); setStatus('Connecting to signaling server…');
      if (!openSocket('host')) { stream.getTracks().forEach((track) => track.stop()); streamRef.current = null; setPhase('idle'); }
    } catch (e) {
      setPhase('idle'); setError(e instanceof Error ? e.message : 'Camera permission was denied or the camera is busy.');
      setStatus('Camera could not start');
    }
  }, [cameraId, openSocket]);

  const joinRoom = useCallback(() => {
    if (!joinCode.trim()) { setError('Enter the pairing code shown on the camera device.'); return; }
    setError(''); roleRef.current = 'viewer'; setRole('viewer'); setPhase('joining'); setStatus('Connecting to camera host…');
    openSocket('viewer', joinCode);
  }, [joinCode, openSocket]);

  const stopSession = useCallback(() => {
    sendSocket({ type: 'leave-room' });
    socketRef.current?.close(); socketRef.current = null;
    pcRef.current?.close(); pcRef.current = null;
    channelRef.current?.close(); channelRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    roleRef.current = null; pendingIceRef.current = [];
    setRole(null); setPhase('idle'); setRoomCode(''); setCaps({}); setStatus('Session stopped');
  }, [sendSocket]);

  const copyText = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1300); }
    catch { setError('Clipboard unavailable — select and copy the code or link manually.'); }
  };

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then((all) => setDevices(all.filter((item) => item.kind === 'videoinput'))).catch(() => undefined);
  }, []);

  useEffect(() => {
    try {
      const signal = new URL(signalUrl);
      const apiOrigin = (signal.protocol === 'wss:' ? 'https:' : 'http:') + '//' + signal.host;
      fetch(apiOrigin + '/api/info').then((response) => response.ok ? response.json() : null).then((info) => {
        if (info && Array.isArray(info.addresses)) setLanAddresses(info.addresses.filter((address: unknown) => typeof address === 'string'));
      }).catch(() => undefined);
    } catch { /* signaling URL is being edited */ }
  }, [signalUrl]);

  useEffect(() => () => {
    socketRef.current?.close(); pcRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark"><Aperture size={22} /></span><span>CamBridge<span className="brand-dot">.</span></span></a>
        <div className="topbar-right">
          <span className="secure-label"><ShieldCheck size={14} /> Camera only</span>
          <button className="icon-button" onClick={() => setShowHelp(!showHelp)} title="Help"><CircleHelp size={18} /></button>
          <button className="icon-button" onClick={() => setShowSettings(!showSettings)} title="Connection settings"><Settings2 size={18} /></button>
        </div>
      </header>
      <main className="page">
        <section className="hero">
          <div className="eyebrow"><span className="eyebrow-line" /> CAMERA, CONNECTED</div>
          <h1>Your camera.<br /><span>On your terms.</span></h1>
          <p className="hero-copy">Turn a phone or PC into a camera you can view and control from another device. No screen sharing — just the camera.</p>
          <div className="hero-stats">
            <div><span className="stat-icon"><Radio size={15} /></span>Live video</div>
            <div><span className="stat-icon"><Focus size={15} /></span>Remote settings</div>
            <div><span className="stat-icon"><ShieldCheck size={15} /></span>Pair by code</div>
          </div>
        </section>

        {showSettings && <section className="settings-panel">
          <div className="section-heading"><div><span className="step-label">CONNECTION</span><h2>Signaling server</h2></div><button className="icon-button" onClick={() => setShowSettings(false)}><X size={18} /></button></div>
          <label className="field-label">WebSocket address<input className="text-input" value={signalUrl} onChange={(e) => setSignalUrl(e.target.value)} placeholder="ws://192.168.1.10:8787" /></label>
          <p className="helper">Both devices must use the same reachable server. For internet use, configure HTTPS/WSS and TURN. A raw IP address cannot bypass every router or firewall.</p>
        </section>}
        {showHelp && <section className="settings-panel">
          <div className="section-heading"><div><span className="step-label">QUICK GUIDE</span><h2>How pairing works</h2></div><button className="icon-button" onClick={() => setShowHelp(false)}><X size={18} /></button></div>
          <ol><li>On the camera device choose Share this camera and allow camera permission.</li><li>Send the generated code or QR link to the second device.</li><li>Enter the code to view live video and request supported camera settings.</li></ol>
          <p className="helper">This browser prototype cannot promise background sharing after the browser is minimized or the phone is locked. The native Android app needs a visible foreground camera service.</p>
        </section>}
        {error && <div className="error-banner" role="alert"><X size={17} /><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss"><X size={15} /></button></div>}

        <section className="workspace">
          <div className="workspace-main">
            <div className="section-heading"><div><span className="step-label">01 / CAMERA</span><h2>Choose your role</h2></div><span className={'connection-pill ' + (live ? 'online' : '')}><span className="status-dot" />{live ? 'Session active' : 'Not connected'}</span></div>
            <div className="role-grid">
              <button className={'role-card ' + (role === 'host' ? 'selected' : '')} onClick={() => { if (!live) { setRole('host'); setError(''); } }} disabled={live}>
                <span className="role-icon purple"><Camera size={23} /></span><span className="role-title">Share this camera</span><span className="role-description">Use the camera on this phone or computer.</span><span className="role-foot">HOST DEVICE <Smartphone size={14} /></span>
              </button>
              <button className={'role-card ' + (role === 'viewer' ? 'selected' : '')} onClick={() => { if (!live) { setRole('viewer'); setError(''); } }} disabled={live}>
                <span className="role-icon blue"><Monitor size={23} /></span><span className="role-title">Control another device</span><span className="role-description">Connect to a camera that is already sharing.</span><span className="role-foot">CONTROLLER <Wifi size={14} /></span>
              </button>
            </div>

            {!live && role === 'host' && <div className="action-panel">
              <div className="action-panel-copy"><span className="action-title">Ready to share?</span><span className="action-subtitle">Only camera video is captured — never the screen.</span></div>
              <label className="field-label camera-select-label">Camera<select value={cameraId} onChange={(e) => setCameraId(e.target.value)}><option value="">Default camera</option>{devices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || 'Camera'}</option>)}</select></label>
              <button className="primary-button" onClick={() => void startSharing()} disabled={phase === 'starting'}>{phase === 'starting' ? <RefreshCw className="spin" size={17} /> : <Camera size={17} />}{phase === 'starting' ? 'Starting…' : 'Start camera sharing'}</button>
            </div>}
            {!live && role === 'viewer' && <div className="action-panel viewer-form">
              <label className="field-label">Camera room code</label><div className="join-row"><input className="text-input code-input" autoComplete="off" maxLength={12} value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="E.G. 7K4Q9M" /><button className="primary-button" onClick={joinRoom} disabled={phase === 'joining'}>{phase === 'joining' ? <RefreshCw className="spin" size={17} /> : <Wifi size={17} />}Connect</button></div><span className="helper">The camera device must be sharing first.</span>
            </div>}
            {(phase === 'hosting' || phase === 'connected') && host && <div className="share-panel">
              <div className="share-code-head"><div><span className="step-label">YOUR PAIRING CODE</span><h3>{roomCode || 'Creating code…'}</h3></div><button className="secondary-button" onClick={() => void copyText(roomCode)}><Copy size={15} />{copied ? 'Copied' : 'Copy code'}</button></div>
              <p className="helper">Only share this code with someone you trust.</p>
              {lanAddresses.length > 0 && <p className="helper">LAN address: {lanAddresses[0]}:8787</p>}
              {joinUrl && <div className="qr-row"><QRCodeSVG value={joinUrl} size={104} bgColor="#fff" fgColor="#121622" level="M" /><div><b>Scan to pair</b><p>Open the same web app on the other device and scan the QR code, or send the link.</p><button className="text-button" onClick={() => void copyText(joinUrl)}>Copy pairing link</button></div></div>}
            </div>}
            {live && role === 'viewer' && <div className="share-panel connected-panel"><div><span className="step-label">CONNECTED TO</span><h3>Camera {roomCode}</h3><p className="helper">Settings controls appear when supported by the camera.</p></div></div>}

            <div className="video-panel">
              <div className="video-header"><div><span className="step-label">LIVE PREVIEW</span><strong>{host ? 'This device camera' : role === 'viewer' ? 'Remote camera' : 'Camera preview'}</strong></div><span className={'live-badge ' + (phase === 'connected' ? 'live' : '')}><span />{phase === 'connected' ? 'LIVE' : live ? 'WAITING' : 'IDLE'}</span></div>
              <div className="video-stage">
                <video ref={localVideoRef} className={'video-element ' + (host && live ? 'visible' : 'hidden')} autoPlay muted playsInline />
                <video ref={remoteVideoRef} className={'video-element ' + (role === 'viewer' && live ? 'visible' : 'hidden')} autoPlay playsInline />
                {!live && <div className="video-placeholder"><span className="placeholder-icon"><Camera size={28} /></span><b>Your preview appears here</b><span>Start sharing or connect to a room.</span></div>}
                {live && phase !== 'connected' && <div className="video-overlay"><RefreshCw className="spin" size={22} /><span>{status}</span></div>}
              </div>
              <div className="video-footer"><span><span className="status-dot" />{status}</span><span>{host ? 'Audio disabled' : role === 'viewer' ? 'Camera stream only' : 'No screen capture'}</span></div>
            </div>

            {live && <div className="camera-controls">
              <div className="section-heading controls-heading"><div><span className="step-label">02 / SETTINGS</span><h2>{host ? 'Camera settings' : 'Remote camera settings'}</h2></div><span className="helper">Device-dependent</span></div>
              {caps.zoom && <div className="control-row"><div><span className="control-name"><Focus size={16} /> Zoom</span><span className="control-value">{zoom.toFixed(1)}×</span></div><input type="range" min={caps.zoom.min} max={caps.zoom.max} step={caps.zoom.step || 0.1} value={Math.min(caps.zoom.max, Math.max(caps.zoom.min, zoom))} onChange={(e) => sendControl('zoom', Number(e.target.value))} /></div>}
              {caps.exposureCompensation && <div className="control-row"><div><span className="control-name"><Gauge size={16} /> Exposure compensation</span><span className="control-value">{exposure.toFixed(1)}</span></div><input type="range" min={caps.exposureCompensation.min} max={caps.exposureCompensation.max} step={caps.exposureCompensation.step || 0.1} value={Math.min(caps.exposureCompensation.max, Math.max(caps.exposureCompensation.min, exposure))} onChange={(e) => sendControl('exposureCompensation', Number(e.target.value))} /></div>}
              {caps.focusMode?.length && <div className="control-row"><div><span className="control-name"><Focus size={16} /> Focus mode</span><span className="control-value">{focusMode}</span></div><select value={focusMode} onChange={(e) => sendControl('focusMode', e.target.value)}>{caps.focusMode.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>}
              {caps.torch !== undefined && <div className="control-row torch-row"><div><span className="control-name"><Camera size={16} /> Camera light</span><span className="control-description">Toggle the torch, if supported.</span></div><button className={'toggle-button ' + (torch ? 'on' : '')} onClick={() => sendControl('torch', !torch)} aria-pressed={torch}><span /></button></div>}
              {!caps.zoom && !caps.exposureCompensation && !caps.focusMode?.length && caps.torch === undefined && <p className="empty-controls"><Settings2 size={17} />This browser does not expose adjustable settings for this camera.</p>}
            </div>}
            <div className="bottom-actions">{live ? <button className="danger-button" onClick={stopSession}><X size={16} /> Stop sharing / disconnect</button> : <button className="text-button" onClick={() => { setRole(null); setError(''); setStatus('Ready to connect'); }}><RefreshCw size={14} /> Reset selection</button>}<span className="footnote"><ShieldCheck size={13} /> Camera permission is controlled by your device.</span></div>
          </div>

          <aside className="side-column">
            <div className="side-card connection-card"><span className="step-label">CONNECTION STATUS</span><div className="connection-illustration"><div className="device-tile"><Smartphone size={24} /></div><div className="connection-wave"><span /><span /><span /></div><div className="device-tile"><Monitor size={24} /></div></div><h3>{phase === 'connected' ? 'You’re connected' : phase === 'hosting' ? 'Ready for a device' : phase === 'joining' ? 'Finding camera…' : 'Two devices. One camera.'}</h3><p>{phase === 'connected' ? 'Live camera video is flowing over a peer connection.' : 'Pair a phone and a PC, or configure a reachable signaling server.'}</p><div className="side-status"><span className={'status-dot ' + (live ? 'active' : '')} />{live ? status : 'Waiting for a session'}</div></div>
            <div className="side-card feature-card"><span className="step-label">BUILT FOR CONTROL</span><div className="feature-item"><span className="feature-icon"><Camera size={16} /></span><div><b>Camera, not screen</b><p>No screen capture APIs are used.</p></div></div><div className="feature-item"><span className="feature-icon"><Wifi size={16} /></span><div><b>WebRTC media</b><p>Peer-to-peer video where possible.</p></div></div><div className="feature-item"><span className="feature-icon"><Settings2 size={16} /></span><div><b>Supported settings</b><p>Only settings reported by the camera appear.</p></div></div></div>
            <div className="side-note"><ShieldCheck size={17} /><p><b>Privacy matters.</b> Sharing is user-started and visible. Stop the session here or revoke camera permission in your device settings.</p></div>
          </aside>
        </section>
        <footer className="footer"><span>CAMBRIDGE <span className="brand-dot">●</span> EARLY ACCESS</span><span>Native APK, background service, MSI, and store submission are separate release milestones.</span></footer>
      </main>
    </div>
  );
}
