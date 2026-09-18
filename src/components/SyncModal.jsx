import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { useStore } from '../store/useStore';
import { 
  connectSync, 
  disconnectSync, 
  generateRoomId, 
  generatePassword, 
  getDefaultDeviceName,
  forcePushLocalToDoc 
} from '../services/syncService';
import { 
  X, 
  Radio, 
  Wifi, 
  WifiOff, 
  Lock, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  RefreshCw, 
  Smartphone, 
  Laptop, 
  ShieldCheck, 
  Share2, 
  Sparkles 
} from 'lucide-react';

export default function SyncModal() {
  const { 
    isSyncModalOpen, 
    setSyncModalOpen, 
    syncStatus, 
    connectedPeers, 
    syncSettings, 
    setSyncSettings,
    lastSyncedAt,
    bookmarks,
    highlights,
    readSections
  } = useStore();

  const [enabled, setEnabled] = useState(syncSettings.enabled || false);
  const [roomId, setRoomId] = useState(syncSettings.roomId || '');
  const [password, setPassword] = useState(syncSettings.password || '');
  const [deviceName, setDeviceName] = useState(syncSettings.deviceName || '');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [syncedJustNow, setSyncedJustNow] = useState(false);
  const qrCanvasRef = useRef(null);

  // Initialize form fields when modal opens
  useEffect(() => {
    if (isSyncModalOpen) {
      setEnabled(syncSettings.enabled || false);
      setRoomId(syncSettings.roomId || generateRoomId());
      setPassword(syncSettings.password || '');
      setDeviceName(syncSettings.deviceName || getDefaultDeviceName());
    }
  }, [isSyncModalOpen, syncSettings]);

  // Generate QR Code when Room ID or Password changes
  useEffect(() => {
    if (!isSyncModalOpen || !qrCanvasRef.current || !roomId) return;

    let syncUrl = '';
    try {
      const origin = window.location.origin;
      const pathname = window.location.pathname;
      const params = new URLSearchParams();
      params.set('sync_room', roomId);
      if (password) params.set('sync_pass', password);
      syncUrl = `${origin}${pathname}#${params.toString()}`;
    } catch {
      syncUrl = `vr-sync:${roomId}:${password || ''}`;
    }

    QRCode.toCanvas(qrCanvasRef.current, syncUrl, {
      width: 140,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    }, (err) => {
      if (err) console.error('[Sync] QR Code generation error:', err);
    });
  }, [isSyncModalOpen, roomId, password]);

  if (!isSyncModalOpen) return null;

  const totalBookmarks = Object.values(bookmarks || {}).reduce((acc, list) => acc + (list?.length || 0), 0);
  const totalHighlights = Object.values(highlights || {}).reduce((acc, list) => acc + (list?.length || 0), 0);
  const totalRead = Object.values(readSections || {}).reduce((acc, list) => acc + (list?.length || 0), 0);

  const handleToggleSync = () => {
    const nextState = !enabled;
    setEnabled(nextState);

    const targetRoomId = (roomId || generateRoomId()).trim();
    const targetPassword = password.trim();
    const targetDeviceName = (deviceName || getDefaultDeviceName()).trim();

    setRoomId(targetRoomId);
    setDeviceName(targetDeviceName);

    const updated = {
      enabled: nextState,
      roomId: targetRoomId,
      password: targetPassword,
      deviceName: targetDeviceName
    };
    setSyncSettings(updated);

    if (nextState) {
      connectSync(updated);
    } else {
      disconnectSync();
    }
  };

  const handleApplySettings = () => {
    const targetRoomId = (roomId || generateRoomId()).trim();
    const targetPassword = password.trim();
    const targetDeviceName = (deviceName || getDefaultDeviceName()).trim();

    const updated = {
      enabled,
      roomId: targetRoomId,
      password: targetPassword,
      deviceName: targetDeviceName
    };
    setSyncSettings(updated);

    if (enabled) {
      connectSync(updated);
    } else {
      disconnectSync();
    }
  };

  const handleGenerateNewRoom = () => {
    const newRoom = generateRoomId();
    setRoomId(newRoom);
  };

  const handleGenerateNewPassword = () => {
    const newPass = generatePassword();
    setPassword(newPass);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyShareLink = () => {
    try {
      const origin = window.location.origin;
      const pathname = window.location.pathname;
      const params = new URLSearchParams();
      params.set('sync_room', roomId);
      if (password) params.set('sync_pass', password);
      const url = `${origin}${pathname}#${params.toString()}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      handleCopyCode();
    }
  };

  const handleManualSync = () => {
    forcePushLocalToDoc();
    setSyncedJustNow(true);
    setTimeout(() => setSyncedJustNow(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-bgSidebar border border-borderColor rounded-2xl w-full max-w-xl shadow-2xl p-5 sm:p-6 relative flex flex-col gap-4 max-h-[92vh] overflow-y-auto custom-scrollbar">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-borderColor pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Radio size={20} className={syncStatus === 'connected' ? 'animate-pulse' : ''} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                P2P Синхронизация
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  WebRTC + CRDT
                </span>
              </h2>
              <p className="text-xs text-textMuted">Прямая связь между устройствами без сторонних серверов</p>
            </div>
          </div>
          <button 
            onClick={() => setSyncModalOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-textMuted hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Live Status Card */}
        <div className={`p-3.5 rounded-xl border transition-all flex flex-col gap-2.5 ${
          !enabled 
            ? 'bg-white/[0.02] border-white/10' 
            : syncStatus === 'connected' 
              ? 'bg-accentEmerald/10 border-accentEmerald/30' 
              : 'bg-amber-500/10 border-amber-500/30'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                {enabled && (
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    syncStatus === 'connected' ? 'bg-accentEmerald' : 'bg-amber-400'
                  }`}></span>
                )}
                <span className={`relative inline-flex rounded-full h-3 w-3 ${
                  !enabled 
                    ? 'bg-textMuted/40' 
                    : syncStatus === 'connected' 
                      ? 'bg-accentEmerald' 
                      : 'bg-amber-400'
                }`}></span>
              </span>

              <span className="text-sm font-medium text-white">
                {!enabled 
                  ? 'Синхронизация выключена' 
                  : syncStatus === 'connected' 
                    ? `Подключено устройств: ${connectedPeers.length}` 
                    : 'Поиск устройств в комнате...'}
              </span>
            </div>

            {/* Toggle switch button */}
            <button
              onClick={handleToggleSync}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                enabled 
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30' 
                  : 'bg-primary text-white hover:bg-primaryGlow shadow-sm shadow-primary/25'
              }`}
            >
              {enabled ? 'Отключить' : 'Включить'}
            </button>
          </div>

          {/* Connected peers list */}
          {enabled && connectedPeers.length > 0 && (
            <div className="pt-2 border-t border-white/10 flex flex-wrap gap-1.5">
              {connectedPeers.map(peer => (
                <div 
                  key={peer.clientId} 
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-xs text-white border border-white/15"
                >
                  <Laptop size={12} className="text-accentEmerald" />
                  <span className="font-medium">{peer.name}</span>
                </div>
              ))}
            </div>
          )}

          {enabled && syncStatus === 'searching' && (
            <p className="text-xs text-textDim leading-relaxed">
              Откройте Visual Reader на втором устройстве (ноутбук, планшет или телефон) и укажите тот же код комнаты или отсканируйте QR-код.
            </p>
          )}
        </div>

        {/* Room & Password Settings */}
        <div className="flex flex-col gap-3">
          {/* Room ID Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-textDim flex items-center gap-1.5">
                <Wifi size={13} className="text-primary" />
                Код комнаты (Room ID)
              </label>
              <button
                type="button"
                onClick={handleGenerateNewRoom}
                className="text-[11px] text-primary hover:text-primaryGlow transition-colors cursor-pointer flex items-center gap-1"
              >
                <Sparkles size={11} />
                Новый случайный код
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="например: reader-sync-5432"
                className="flex-1 bg-bgMain border border-borderColor rounded-xl px-3.5 py-2 text-sm text-white font-mono placeholder:text-textMuted/50 focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-borderColor rounded-xl text-textDim hover:text-white transition-colors flex items-center gap-1.5 text-xs cursor-pointer"
                title="Скопировать код"
              >
                {copiedCode ? <Check size={14} className="text-accentEmerald" /> : <Copy size={14} />}
                <span className="hidden sm:inline">{copiedCode ? 'Скопировано' : 'Копия'}</span>
              </button>
            </div>
          </div>

          {/* Encryption Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-textDim flex items-center gap-1.5">
                <Lock size={13} className="text-amber-400" />
                Пароль сквозного шифрования (E2E)
              </label>
              <button
                type="button"
                onClick={handleGenerateNewPassword}
                className="text-[11px] text-textMuted hover:text-white transition-colors cursor-pointer"
              >
                Случайный пароль
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Опционально (AES-GCM шифрование)"
                className="w-full bg-bgMain border border-borderColor rounded-xl px-3.5 py-2 pr-10 text-sm text-white font-mono placeholder:text-textMuted/50 focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted hover:text-white p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Device Name */}
          <div>
            <label className="block text-xs font-medium text-textDim mb-1.5">
              Имя этого устройства
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="например: Домашний ПК"
              className="w-full bg-bgMain border border-borderColor rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-textMuted/50 focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* QR Code & Mobile Pairing Card */}
        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-borderColor flex flex-col sm:flex-row items-center gap-4">
          <div className="p-1.5 bg-white rounded-lg shrink-0 shadow-md">
            <canvas ref={qrCanvasRef} width={130} height={130} />
          </div>
          <div className="flex flex-col gap-2 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-semibold text-white">
              <Smartphone size={14} className="text-primary" />
              Быстрое сопряжение с телефоном
            </div>
            <p className="text-xs text-textMuted leading-relaxed">
              Отсканируйте камерой телефона или скопируйте ссылку, чтобы открыть читалку на мобильном с автоматически заполненными параметрами комнаты.
            </p>
            <div>
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-textDim hover:text-white transition-all cursor-pointer"
              >
                {copiedLink ? <Check size={13} className="text-accentEmerald" /> : <Share2 size={13} />}
                <span>{copiedLink ? 'Ссылка скопирована!' : 'Скопировать ссылку для телефона'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Synced Data Stats & Force Sync */}
        <div className="flex items-center justify-between text-xs text-textMuted border-t border-borderColor pt-3">
          <div className="flex items-center gap-3">
            <span>🔖 Закладок: <strong className="text-white">{totalBookmarks}</strong></span>
            <span>✍️ Заметок: <strong className="text-white">{totalHighlights}</strong></span>
            <span>✅ Прочитано: <strong className="text-white">{totalRead}</strong></span>
          </div>

          {enabled && (
            <button
              type="button"
              onClick={handleManualSync}
              className="flex items-center gap-1.5 text-primary hover:text-primaryGlow transition-colors cursor-pointer text-xs font-medium"
              title="Принудительно отправить локальные данные пирам"
            >
              <RefreshCw size={12} className={syncedJustNow ? 'animate-spin text-accentEmerald' : ''} />
              <span>{syncedJustNow ? 'Отправлено!' : 'Синхронизировать'}</span>
            </button>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => setSyncModalOpen(false)}
            className="px-4 py-2 rounded-xl text-xs font-medium text-textDim hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            Закрыть
          </button>
          <button
            type="button"
            onClick={() => {
              handleApplySettings();
              setSyncModalOpen(false);
            }}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-primary hover:bg-primaryGlow text-white shadow-md shadow-primary/25 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <ShieldCheck size={14} />
            Применить
          </button>
        </div>

      </div>
    </div>
  );
}
