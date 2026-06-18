'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react'; // 👈 NextAuthのログアウト関数をインポート
import { useTheme } from '../theme-provider';
import styles from './settings.module.css';

export default function SettingsPage() {
  const [isMounted, setIsMounted] = useState(false);
  const { darkMode, setDarkMode } = useTheme();

  // 各トグルの状態管理
  const [aiBusiness, setAiBusiness] = useState(true);
  const [aiDaily, setAiDaily] = useState(true);
  const [notifications, setNotifications] = useState(true);

  // 1. 画面起動時にLocalStorageから各設定を復元する
  useEffect(() => {
    const savedBusiness = localStorage.getItem('setting_aiBusiness');
    const savedDaily = localStorage.getItem('setting_aiDaily');
    const savedNotif = localStorage.getItem('setting_notifications');

    setAiBusiness(savedBusiness !== null ? JSON.parse(savedBusiness) : true);
    setAiDaily(savedDaily !== null ? JSON.parse(savedDaily) : true);
    setNotifications(savedNotif !== null ? JSON.parse(savedNotif) : true);

    setIsMounted(true);
  }, []);

  // 2. 変更時にStateを更新しつつ、LocalStorageに保存する関数
  const handleToggle = (key: 'aiBusiness' | 'aiDaily' | 'notifications', value: boolean) => {
    if (key === 'aiBusiness') setAiBusiness(value);
    if (key === 'aiDaily') setAiDaily(value);
    if (key === 'notifications') setNotifications(value);

    localStorage.setItem(`setting_${key}`, JSON.stringify(value));
  };

  // 👈 ログアウト処理用の関数を追加
  const handleLogout = async () => {
    // アラートを出したあと、NextAuthの認証セッションを破棄して /login へ遷移させる
    alert('ログアウトしました');
    await signOut({ callbackUrl: '/login' }); 
  };

  // ハイドレーションバグ防止
  if (!isMounted) {
    return <div className={styles.container}></div>;
  }

  // 3. ダークモード判定。ONならコンポーネント全体にダーク用のクラスを付与する
  const containerClass = `${styles.container} ${darkMode ? styles.dark : ''}`;

  return (
    <div className={containerClass}>
      {/* ヘッダー */}
      <div className={styles.header}>
        <Link href="/home" className={styles.backBtn} style={{ textDecoration: 'none' }}>
          ←
        </Link>
        <h1 className={styles.title}>設定画面</h1>
      </div>

      {/* AI設定セクション */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>AI設定</span>
          <div className={styles.rowContainer}>
            {/* ビジネス用 */}
            <div className={styles.settingRow}>
              <span className={styles.subLabel}>ビジネス用</span>
              <div className={styles.toggleWrapper}>
                <span className={aiBusiness ? styles.textOn : styles.textOff}>
                  {aiBusiness ? 'ON' : 'OFF'}
                </span>
                <label className={styles.switch}>
                  <input 
                    type="checkbox" 
                    checked={aiBusiness} 
                    onChange={(e) => handleToggle('aiBusiness', e.target.checked)} 
                  />
                  <span className={styles.slider}></span>
                </label>
              </div>
            </div>

            {/* 日常生活用 */}
            <div className={styles.settingRow}>
              <span className={styles.subLabel}>日常生活用</span>
              <div className={styles.toggleWrapper}>
                <span className={aiDaily ? styles.textOn : styles.textOff}>
                  {aiDaily ? 'ON' : 'OFF'}
                </span>
                <label className={styles.switch}>
                  <input 
                    type="checkbox" 
                    checked={aiDaily} 
                    onChange={(e) => handleToggle('aiDaily', e.target.checked)} 
                  />
                  <span className={styles.slider}></span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* モード設定セクション */}
      <div className={styles.section}>
        <div className={styles.settingRowInline}>
          <span className={styles.sectionTitle}>モード</span>
          <div className={styles.inlineContent}>
            <span className={styles.subLabel}>ダーク</span>
            <div className={styles.toggleWrapper}>
              <span className={darkMode ? styles.textOn : styles.textOff}>
                {darkMode ? 'ON' : 'OFF'}
              </span>
              <label className={styles.switch}>
                <input 
                  type="checkbox" 
                  checked={darkMode} 
                  onChange={(e) => setDarkMode(e.target.checked)} 
                />
                <span className={styles.slider}></span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* アカウント操作エリア */}
      <div className={styles.dangerSection}>
        {/* ⭕ onClickで上で定義したhandleLogoutを呼び出すように修正 */}
        <button className={styles.dangerBtn} onClick={handleLogout}>
          ログアウト
        </button>
      </div>
    </div>
  );
}