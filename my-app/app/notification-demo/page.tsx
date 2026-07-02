'use client';

import React, { useCallback, useEffect, useState } from 'react';

// ========================================
// 型定義
// ========================================

type SupportState = 'checking' | 'supported' | 'unsupported';
type SwState = 'idle' | 'registering' | 'ready' | 'error';

type SubscriptionState = {
  endpoint: string;
  raw: PushSubscription;
} | null;

// ========================================
// 定数
// ========================================

const publicVapidKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;

const NOTIFICATION_CONFIG = {
  title: 'Journee push test',
  body: 'Service Worker経由のテスト通知です。',
  icon: '/icon-192x192.png',
  badge: '/icon-192x192.png',
  tag: 'journee-push-test',
} as const;

const ERROR_MESSAGES = {
  noServiceWorker: 'Service Workerが準備できていません',
  noPermission: '通知権限を許可してください',
  noVapidKey: 'VAPID公開鍵が設定されていません',
  noSubscription: 'まず購読を作成してください',
  unsupportedBrowser: 'このブラウザではプッシュ通知を利用できません。',
} as const;

// ========================================
// ユーティリティ関数
// ========================================

/**
 * Base64エンコードされたVAPID公開鍵をArrayBufferに変換
 */
function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = typeof window !== 'undefined' ? window.atob(base64) : '';
  
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  
  for (let i = 0; i < rawData.length; i += 1) {
    view[i] = rawData.charCodeAt(i);
  }
  
  return buffer;
}

/**
 * ブラウザがプッシュ通知をサポートしているかチェック
 */
function checkBrowserSupport(): boolean {
  return 'serviceWorker' in navigator && typeof Notification !== 'undefined';
}

/**
 * エラーメッセージを安全に抽出
 */
function extractErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// ========================================
// Service Worker関連の処理
// ========================================

/**
 * Service Workerを登録し、既存の購読を確認
 */
async function registerServiceWorker(): Promise<{
  registration: ServiceWorkerRegistration;
  existingSubscription: PushSubscription | null;
}> {
  const existing = await navigator.serviceWorker.getRegistration();
  const activeReg = existing ?? (await navigator.serviceWorker.register('/sw.js'));
  const readyReg = activeReg ?? (await navigator.serviceWorker.ready);
  const existingSubscription = await readyReg.pushManager.getSubscription();
  
  return {
    registration: readyReg,
    existingSubscription,
  };
}

/**
 * ローカル通知を送信（Service Worker経由）
 */
async function showLocalNotification(
  registration: ServiceWorkerRegistration
): Promise<void> {
  await registration.showNotification(NOTIFICATION_CONFIG.title, {
    body: NOTIFICATION_CONFIG.body,
    icon: NOTIFICATION_CONFIG.icon,
    badge: NOTIFICATION_CONFIG.badge,
    tag: NOTIFICATION_CONFIG.tag,
  });
}

// ========================================
// プッシュ購読関連の処理
// ========================================

/**
 * プッシュ通知を購読
 */
async function createPushSubscription(
  registration: ServiceWorkerRegistration,
  vapidKey: string
): Promise<PushSubscription> {
  const appServerKey = urlBase64ToArrayBuffer(vapidKey);
  
  return await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: appServerKey,
  });
}

/**
 * 既存の購読を取得、なければ新規作成
 */
async function getOrCreateSubscription(
  registration: ServiceWorkerRegistration,
  vapidKey: string
): Promise<{ subscription: PushSubscription; isExisting: boolean }> {
  const existing = await registration.pushManager.getSubscription();
  
  if (existing) {
    return { subscription: existing, isExisting: true };
  }
  
  const newSubscription = await createPushSubscription(registration, vapidKey);
  return { subscription: newSubscription, isExisting: false };
}

// ========================================
// サーバー通信
// ========================================

/**
 * サーバーにプッシュ通知送信をリクエスト
 */
async function requestServerPush(subscription: PushSubscription): Promise<void> {
  const response = await fetch('/api/push/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
  
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error || 'サーバー通知の送信に失敗しました');
  }
}

// ========================================
// メインコンポーネント
// ========================================

const NotificationDemoPage: React.FC = () => {
  // 状態管理
  const [supportState, setSupportState] = useState<SupportState>('checking');
  const [swState, setSwState] = useState<SwState>('idle');
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionState>(null);
  const [message, setMessage] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSendingServer, setIsSendingServer] = useState(false);

  // ========================================
  // 初期化処理
  // ========================================
  
  useEffect(() => {
    // 現在の通知権限を取得
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }

    // ブラウザサポートチェック
    if (!checkBrowserSupport()) {
      setSupportState('unsupported');
      setMessage(ERROR_MESSAGES.unsupportedBrowser);
      return;
    }

    setSupportState('supported');
    setSwState('registering');

    // Service Worker登録処理
    const initialize = async () => {
      try {
        const { registration: reg, existingSubscription } = await registerServiceWorker();
        
        setRegistration(reg);
        
        if (existingSubscription) {
          setSubscription({
            endpoint: existingSubscription.endpoint,
            raw: existingSubscription,
          });
        }
        
        setSwState('ready');
      } catch (error) {
        setSwState('error');
        setMessage(extractErrorMessage(error, 'Service Worker登録に失敗しました'));
      }
    };

    initialize();
  }, []);

  // ========================================
  // イベントハンドラー
  // ========================================

  /**
   * 通知権限をリクエスト
   */
  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  /**
   * ローカル通知を送信
   */
  const sendLocalNotification = useCallback(async () => {
    // 事前チェック
    if (!registration) {
      setMessage(ERROR_MESSAGES.noServiceWorker);
      return;
    }

    if (permission !== 'granted') {
      setMessage(ERROR_MESSAGES.noPermission);
      return;
    }

    try {
      await showLocalNotification(registration);
      setMessage('ローカル通知を送信しました');
    } catch (error) {
      setMessage(extractErrorMessage(error, '通知送信に失敗しました'));
    }
  }, [registration, permission]);

  /**
   * プッシュ通知を購読
   */
  const subscribePush = useCallback(async () => {
    // 事前チェック
    if (!registration) {
      setMessage(ERROR_MESSAGES.noServiceWorker);
      return;
    }
    
    if (!publicVapidKey) {
      setMessage(ERROR_MESSAGES.noVapidKey);
      return;
    }

    // 権限確認・リクエスト
    const currentPermission =
      permission === 'default' ? await Notification.requestPermission() : permission;
    setPermission(currentPermission);

    if (currentPermission !== 'granted') {
      setMessage(ERROR_MESSAGES.noPermission);
      return;
    }

    // 購読処理
    setIsSubscribing(true);
    try {
      const { subscription: sub, isExisting } = await getOrCreateSubscription(
        registration,
        publicVapidKey
      );
      
      setSubscription({ endpoint: sub.endpoint, raw: sub });
      setMessage(isExisting ? '既存の購読を再利用します' : '購読を作成しました');
    } catch (error) {
      setMessage(extractErrorMessage(error, '購読に失敗しました'));
    } finally {
      setIsSubscribing(false);
    }
  }, [permission, registration]);

  /**
   * サーバー経由でプッシュ通知を送信
   */
  const sendServerPush = useCallback(async () => {
    // 事前チェック
    if (!subscription) {
      setMessage(ERROR_MESSAGES.noSubscription);
      return;
    }

    // サーバーリクエスト
    setIsSendingServer(true);
    try {
      await requestServerPush(subscription.raw);
      setMessage('サーバーから通知を送信しました');
    } catch (error) {
      setMessage(extractErrorMessage(error, 'サーバー通知の送信に失敗しました'));
    } finally {
      setIsSendingServer(false);
    }
  }, [subscription]);

  // ========================================
  // 表示用ラベル生成
  // ========================================

  const supportLabel =
    supportState === 'checking'
      ? '確認中'
      : supportState === 'supported'
        ? 'サポートされています'
        : '未対応のブラウザです';

  const swLabel =
    swState === 'registering'
      ? '登録中'
      : swState === 'ready'
        ? '準備完了'
        : swState === 'error'
          ? 'エラー'
          : '未開始';

  // ========================================
  // レンダリング
  // ========================================

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-8">
          <h1 className="text-2xl font-bold text-gray-900">プッシュ通知テスト</h1>
          <p className="text-gray-600 mt-2">
            PWA環境でのローカル通知とWeb Push（サーバー送信）の双方を確認します。
          </p>

          {/* ステータス表示エリア */}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
              <p className="text-sm text-gray-500">ブラウザ対応状況</p>
              <p className="text-base font-semibold text-gray-800">{supportLabel}</p>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
              <p className="text-sm text-gray-500">Service Worker</p>
              <p className="text-base font-semibold text-gray-800">{swLabel}</p>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
              <p className="text-sm text-gray-500">通知権限</p>
              <p className="text-base font-semibold text-gray-800">{permission}</p>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
              <p className="text-sm text-gray-500">メッセージ</p>
              <p className="text-base font-semibold text-gray-800 break-words">
                {message || '—'}
              </p>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 md:col-span-2">
              <p className="text-sm text-gray-500">購読エンドポイント</p>
              <p className="text-xs text-gray-700 break-all">{subscription?.endpoint || '未購読'}</p>
            </div>
          </div>

          {/* アクションボタンエリア */}
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={requestPermission}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              disabled={permission === 'granted' || supportState !== 'supported'}
            >
              通知を許可する
            </button>
            <button
              type="button"
              onClick={sendLocalNotification}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-700 focus:ring-offset-2 disabled:opacity-50"
              disabled={permission !== 'granted' || !registration || swState !== 'ready'}
            >
              ローカル通知を送信
            </button>
            <button
              type="button"
              onClick={subscribePush}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
              disabled={isSubscribing || swState !== 'ready'}
            >
              {isSubscribing ? '購読処理中...' : 'Web Pushを購読'}
            </button>
            <button
              type="button"
              onClick={sendServerPush}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 text-white hover:indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
              disabled={isSendingServer || !subscription}
            >
              {isSendingServer ? '送信中...' : 'サーバー通知を送信'}
            </button>
          </div>

          {/* 使い方説明エリア */}
          <div className="mt-10">
            <h2 className="text-lg font-semibold text-gray-900">使い方</h2>
            <ol className="mt-3 list-decimal list-inside space-y-2 text-gray-700">
              <li>このページにアクセスするとService Workerを登録します。</li>
              <li>「通知を許可する」を押して権限を付与します。</li>
              <li>「Web Pushを購読」で PushManager.subscribe を実行し購読を作成します。</li>
              <li>「ローカル通知を送信」でクライアント→SW経由の通知を確認します。</li>
              <li>「サーバー通知を送信」でサーバー→PushService→SW経由の通知を確認します。</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationDemoPage;