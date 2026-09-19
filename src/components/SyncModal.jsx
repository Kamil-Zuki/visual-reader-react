import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { useStore } from '../store/useStore';
import {
  connectSync,
  disconnectSync,
  forceSyncNow,
  testConnection,
  generateSyncKey,
  getDefaultDeviceName,
  normalizeSupabaseUrl
} from '../services/supabaseSyncService';
import {
  X,
  Cloud,
  CloudOff,
  CloudRain,
  RefreshCw,
  Copy,
  Check,
  Key,
  ShieldCheck,
  Sparkles,
  Eye,
  EyeOff,
  Database,
  Code,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Share2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const SQL_SETUP_SCRIPT = `-- 1. Таблица для хранения синхронизируемых данных
CREATE TABLE IF NOT EXISTS reader_sync (
  sync_key TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Включаем Row Level Security
ALTER TABLE reader_sync ENABLE ROW LEVEL SECURITY;

-- 3. Политика доступа по ключу синхронизации
CREATE POLICY "Allow public access by sync_key" 
ON reader_sync FOR ALL TO anon, authenticated 
USING (true) WITH CHECK (true);

-- 4. Включаем Realtime для таблицы
ALTER PUBLICATION supabase_realtime ADD TABLE reader_sync;`;

export default function SyncModal() {
  const {
    isSyncModalOpen,
    setSyncModalOpen,
    syncStatus,
    syncSettings,
    setSyncSettings,
    lastSyncedAt,
    bookmarks,
    highlights,
    readSections,
    apiKey
  } = useStore();

  const [enabled, setEnabled] = useState(syncSettings?.enabled || false);
  const [supabaseUrl, setSupabaseUrl] = useState(syncSettings?.supabaseUrl || '');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(syncSettings?.supabaseAnonKey || '');
  const [syncKey, setSyncKey] = useState(syncSettings?.syncKey || '');
  const [deviceName, setDeviceName] = useState(syncSettings?.deviceName || '');

  const [showAnonKey, setShowAnonKey] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [syncedJustNow, setSyncedJustNow] = useState(false);
  const [showSqlHelper, setShowSqlHelper] = useState(false);

  const qrCanvasRef = useRef(null);

  // Initialize fields on modal open
  useEffect(() => {
    if (isSyncModalOpen) {
      setEnabled(syncSettings?.enabled || false);
      setSupabaseUrl(syncSettings?.supabaseUrl || '');
      setSupabaseAnonKey(syncSettings?.supabaseAnonKey || '');
      setSyncKey(syncSettings?.syncKey || generateSyncKey());
      setDeviceName(syncSettings?.deviceName || getDefaultDeviceName());
      setTestResult(null);
    }
  }, [isSyncModalOpen, syncSettings]);

  // Generate QR Code containing sync_key link
  useEffect(() => {
    if (!isSyncModalOpen || !qrCanvasRef.current || !syncKey) return;

    let syncUrl = '';
    try {
      const origin = window.location.origin;
      const pathname = window.location.pathname;
      syncUrl = `${origin}${pathname}#sync_key=${encodeURIComponent(syncKey.trim())}`;
    } catch {
      syncUrl = `vr-sync:${syncKey.trim()}`;
    }

    QRCode.toCanvas(qrCanvasRef.current, syncUrl, {
      width: 130,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    }, (err) => {
      if (err) console.error('[Sync] QR Code render error:', err);
    });
  }, [isSyncModalOpen, syncKey]);

  if (!isSyncModalOpen) return null;

  const totalBookmarks = Object.values(bookmarks || {}).reduce((acc, list) => acc + (list?.length || 0), 0);
  const totalHighlights = Object.values(highlights || {}).reduce((acc, list) => acc + (list?.length || 0), 0);
  const totalRead = Object.values(readSections || {}).reduce((acc, list) => acc + (list?.length || 0), 0);

  const handleToggleSync = async () => {
    const nextState = !enabled;
    setEnabled(nextState);

    const targetUrl = normalizeSupabaseUrl(supabaseUrl);
    const targetKey = supabaseAnonKey.trim();
    const targetSyncKey = (syncKey || generateSyncKey()).trim();
    const targetDeviceName = (deviceName || getDefaultDeviceName()).trim();

    setSupabaseUrl(targetUrl);
    setSyncKey(targetSyncKey);
    setDeviceName(targetDeviceName);

    const updated = {
      enabled: nextState,
      supabaseUrl: targetUrl,
      supabaseAnonKey: targetKey,
      syncKey: targetSyncKey,
      deviceName: targetDeviceName
    };
    setSyncSettings(updated);

    if (nextState) {
      if (targetUrl && targetKey && targetSyncKey) {
        await connectSync(updated);
      }
    } else {
      disconnectSync();
    }
  };

  const handleSaveAndApply = async () => {
    const targetUrl = normalizeSupabaseUrl(supabaseUrl);
    const targetKey = supabaseAnonKey.trim();
    const targetSyncKey = (syncKey || generateSyncKey()).trim();
    const targetDeviceName = (deviceName || getDefaultDeviceName()).trim();

    setSupabaseUrl(targetUrl);

    const updated = {
      enabled,
      supabaseUrl: targetUrl,
      supabaseAnonKey: targetKey,
      syncKey: targetSyncKey,
      deviceName: targetDeviceName
    };
    setSyncSettings(updated);

    if (enabled && targetUrl && targetKey && targetSyncKey) {
      await connectSync(updated);
    } else if (!enabled) {
      disconnectSync();
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);

    const cleanUrl = normalizeSupabaseUrl(supabaseUrl);
    setSupabaseUrl(cleanUrl);

    const res = await testConnection(cleanUrl, supabaseAnonKey, syncKey);
    setTestResult(res);
    setTestingConnection(false);
  };

  const handleManualSync = async () => {
    setSyncedJustNow(true);
    await forceSyncNow();
    setTimeout(() => setSyncedJustNow(false), 2000);
  };

  const handleCopySyncKey = () => {
    navigator.clipboard.writeText(syncKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyLink = () => {
    try {
      const origin = window.location.origin;
      const pathname = window.location.pathname;
      const url = `${origin}${pathname}#sync_key=${encodeURIComponent(syncKey.trim())}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      handleCopySyncKey();
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SETUP_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const getStatusDisplay = () => {
    if (!enabled) {
      return {
        badge: 'Синхронизация выключена',
        dotClass: 'bg-textMuted/40',
        bgClass: 'bg-white/[0.02] border-white/10',
        icon: <CloudOff size={16} className="text-textMuted" />
      };
    }
    switch (syncStatus) {
      case 'synced':
        return {
          badge: 'Синхронизировано с Supabase',
          dotClass: 'bg-accentEmerald shadow-[0_0_8px_rgba(16,185,129,0.8)]',
          bgClass: 'bg-accentEmerald/10 border-accentEmerald/30',
          icon: <Cloud size={16} className="text-accentEmerald animate-pulse" />
        };
      case 'syncing':
        return {
          badge: 'Обновление данных...',
          dotClass: 'bg-blue-400 animate-ping',
          bgClass: 'bg-blue-500/10 border-blue-500/30',
          icon: <RefreshCw size={16} className="text-blue-400 animate-spin" />
        };
      case 'connecting':
        return {
          badge: 'Подключение к Supabase...',
          dotClass: 'bg-amber-400 animate-ping',
          bgClass: 'bg-amber-500/10 border-amber-500/30',
          icon: <RefreshCw size={16} className="text-amber-400 animate-spin" />
        };
      case 'error':
        return {
          badge: 'Ошибка синхронизации',
          dotClass: 'bg-red-400',
          bgClass: 'bg-red-500/10 border-red-500/30',
          icon: <CloudRain size={16} className="text-red-400" />
        };
      default:
        return {
          badge: 'Отключено',
          dotClass: 'bg-textMuted/40',
          bgClass: 'bg-white/[0.02] border-white/10',
          icon: <CloudOff size={16} className="text-textMuted" />
        };
    }
  };

  const statusInfo = getStatusDisplay();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 pt-[max(1rem,env(safe-area-inset-top,24px))] pb-[max(1rem,env(safe-area-inset-bottom,16px))] animate-fade-in">
      <div className="bg-bgSidebar border border-borderColor rounded-2xl w-full max-w-xl shadow-2xl p-5 sm:p-6 relative flex flex-col gap-4 max-h-[92vh] overflow-y-auto custom-scrollbar">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-borderColor pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Cloud size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                Облачная синхронизация
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Supabase Cloud
                </span>
              </h2>
              <p className="text-xs text-textMuted">Надёжная синхронизация закладок и заметок через ваше облако</p>
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
        <div className={`p-3.5 rounded-xl border transition-all flex flex-col gap-2.5 ${statusInfo.bgClass}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className={`relative inline-flex rounded-full h-3 w-3 ${statusInfo.dotClass}`}></span>
              </span>

              <div className="flex items-center gap-1.5">
                {statusInfo.icon}
                <span className="text-sm font-medium text-white">{statusInfo.badge}</span>
              </div>
            </div>

            {/* Toggle switch */}
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

          {lastSyncedAt && (
            <div className="text-[11px] text-textMuted flex items-center justify-between pt-1 border-t border-white/5">
              <span>Последняя синхронизация: {new Date(lastSyncedAt).toLocaleTimeString()}</span>
              {enabled && (
                <button
                  onClick={handleManualSync}
                  disabled={syncedJustNow || syncStatus === 'syncing'}
                  className="text-primary hover:text-primaryGlow flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RefreshCw size={11} className={syncedJustNow ? 'animate-spin' : ''} />
                  <span>{syncedJustNow ? 'Синхронизировано!' : 'Синхронизировать сейчас'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Credentials Form */}
        <div className="flex flex-col gap-3">
          {/* Supabase Project URL */}
          <div>
            <label className="text-xs font-medium text-textDim flex items-center gap-1.5 mb-1.5">
              <Database size={13} className="text-primary" />
              URL проекта Supabase (Project URL)
            </label>
            <input
              type="text"
              placeholder="https://xyzcompany.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              className="w-full bg-white/5 border border-borderColor focus:border-primary rounded-lg px-3 py-2 text-xs text-white placeholder-textMuted/50 focus:outline-none transition-colors"
            />
          </div>

          {/* Supabase Anon Key */}
          <div>
            <label className="text-xs font-medium text-textDim flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5">
                <Key size={13} className="text-primary" />
                Публичный ключ (Anon Public Key)
              </span>
              <button
                type="button"
                onClick={() => setShowAnonKey(!showAnonKey)}
                className="text-[11px] text-textMuted hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              >
                {showAnonKey ? <EyeOff size={12} /> : <Eye size={12} />}
                <span>{showAnonKey ? 'Скрыть' : 'Показать'}</span>
              </button>
            </label>
            <div className="relative">
              <input
                type={showAnonKey ? 'text' : 'password'}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={supabaseAnonKey}
                onChange={(e) => setSupabaseAnonKey(e.target.value)}
                className="w-full bg-white/5 border border-borderColor focus:border-primary rounded-lg px-3 py-2 text-xs text-white font-mono placeholder-textMuted/50 focus:outline-none transition-colors pr-10"
              />
            </div>
          </div>

          {/* Sync Key (Unique ID for grouping devices) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-textDim flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-primary" />
                Ключ синхронизации (Sync Key)
              </label>
              <button
                type="button"
                onClick={() => setSyncKey(generateSyncKey())}
                className="text-[11px] text-primary hover:text-primaryGlow transition-colors cursor-pointer flex items-center gap-1"
              >
                <Sparkles size={11} />
                Сгенерировать новый
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={syncKey}
                onChange={(e) => setSyncKey(e.target.value)}
                placeholder="reader-4821"
                className="flex-1 bg-white/5 border border-borderColor focus:border-primary rounded-lg px-3 py-2 text-xs text-white font-mono tracking-wider focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={handleCopySyncKey}
                className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-borderColor text-xs text-textDim hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                title="Скопировать ключ"
              >
                {copiedKey ? <Check size={14} className="text-accentEmerald" /> : <Copy size={14} />}
                <span className="hidden sm:inline">{copiedKey ? 'Скопировано' : 'Копировать'}</span>
              </button>
            </div>
            <p className="text-[11px] text-textMuted mt-1">
              Укажите одинаковый ключ на всех ваших устройствах для объединения библиотеки.
            </p>
          </div>

          {/* Device Name */}
          <div>
            <label className="text-xs font-medium text-textDim flex items-center gap-1.5 mb-1.5">
              <Smartphone size={13} className="text-primary" />
              Имя текущего устройства
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="Ноутбук / Телефон"
              className="w-full bg-white/5 border border-borderColor focus:border-primary rounded-lg px-3 py-2 text-xs text-white placeholder-textMuted/50 focus:outline-none transition-colors"
            />
          </div>

          {/* Test connection & Save buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection || !supabaseUrl || !supabaseAnonKey}
              className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 text-xs font-medium text-white border border-borderColor transition-all cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw size={13} className={testingConnection ? 'animate-spin text-primary' : ''} />
              <span>{testingConnection ? 'Проверка...' : 'Проверить подключение'}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAndApply}
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primaryGlow text-xs font-medium text-white transition-all cursor-pointer shadow-md shadow-primary/20"
            >
              Сохранить и применить
            </button>

            {testResult && (
              <div className={`w-full p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                testResult.success 
                  ? 'bg-accentEmerald/10 border-accentEmerald/30 text-emerald-300' 
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}>
                {testResult.success ? (
                  <CheckCircle2 size={16} className="text-accentEmerald shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                )}
                <span>
                  {testResult.success 
                    ? 'Подключение успешно! Таблица reader_sync готова к работе.' 
                    : testResult.error}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* QR Code & Mobile Connection */}
        <div className="p-3.5 bg-white/[0.02] border border-borderColor rounded-xl flex flex-col sm:flex-row items-center gap-4">
          <div className="bg-white p-2 rounded-xl shadow-md shrink-0">
            <canvas ref={qrCanvasRef} className="block" />
          </div>

          <div className="flex flex-col gap-2 flex-1 text-center sm:text-left">
            <h3 className="text-xs font-semibold text-white flex items-center justify-center sm:justify-start gap-1.5">
              <Share2 size={14} className="text-primary" />
              Быстрое сопряжение смартфона
            </h3>
            <p className="text-xs text-textMuted leading-relaxed">
              Отсканируйте QR-код камерой телефона, чтобы открыть читалку с этим ключом синхронизации.
            </p>
            <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-borderColor text-xs font-medium text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {copiedLink ? <Check size={13} className="text-accentEmerald" /> : <Copy size={13} />}
                <span>{copiedLink ? 'Ссылка скопирована' : 'Скопировать ссылку'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible SQL Setup Helper */}
        <div className="border border-borderColor rounded-xl overflow-hidden bg-white/[0.01]">
          <button
            type="button"
            onClick={() => setShowSqlHelper(!showSqlHelper)}
            className="w-full p-3 flex items-center justify-between text-xs font-medium text-textDim hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Code size={14} className="text-primary" />
              <span>SQL скрипт для настройки Supabase (выполняется один раз)</span>
            </div>
            {showSqlHelper ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showSqlHelper && (
            <div className="p-3 border-t border-borderColor bg-black/40 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-textMuted">
                  Вставьте этот SQL в Supabase Dashboard → <b>SQL Editor</b> → <b>Run</b>:
                </span>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-[11px] text-white transition-colors cursor-pointer flex items-center gap-1"
                >
                  {copiedSql ? <Check size={12} className="text-accentEmerald" /> : <Copy size={12} />}
                  <span>{copiedSql ? 'Скопировано!' : 'Копировать SQL'}</span>
                </button>
              </div>
              <pre className="text-[11px] font-mono text-emerald-400/90 bg-black/60 p-3 rounded-lg overflow-x-auto border border-white/5 select-all">
                {SQL_SETUP_SCRIPT}
              </pre>
            </div>
          )}
        </div>

        {/* Local Sync Stats Footer */}
        <div className="pt-2 border-t border-borderColor flex items-center justify-between text-xs text-textMuted">
          <div className="flex items-center gap-3 flex-wrap">
            <span>Закладок: <strong className="text-white">{totalBookmarks}</strong></span>
            <span>Выделений: <strong className="text-white">{totalHighlights}</strong></span>
            <span>Прочитано: <strong className="text-white">{totalRead}</strong></span>
            <span>OpenRouter: <strong className={apiKey ? "text-accentEmerald" : "text-amber-400"}>{apiKey ? 'Подключен' : 'Не задан'}</strong></span>
          </div>

          <button
            type="button"
            onClick={() => setSyncModalOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white transition-colors cursor-pointer"
          >
            Закрыть
          </button>
        </div>

      </div>
    </div>
  );
}
