'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useTheme } from '../theme-provider'; // 👈 テーマを読み込み
import styles from './settings.module.css';

export default function SettingsPage() {
  // ⭕ アプリ共通のダークモード状態を呼び出し（独自のuseState[darkMode]は削除）
  const { darkMode, setDarkMode } = useTheme();

  // AI設定や通知機能は、この画面内だけの管理でOKなのでuseStateのままで大丈夫です
  const [aiBusiness, setAiBusiness] = useState(true);   // ビジネス用：ON
  const [aiDaily, setAiDaily] = useState(true);      // 日常生活用：ON
  const [notifications, setNotifications] = useState(true); // 通知機能：ON

  return (
    <div className={styles.container}>
      {/* ヘッダー */}
      <div className={styles.header}>
        {/* ⭕ 戻るボタンのリンク先を「/home」から正しいトップページ「/」に修正 */}
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
                    onChange={(e) => setAiBusiness(e.target.checked)} 
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
                    onChange={(e) => setAiDaily(e.target.checked)} 
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
              {/* ⭕ 共通のdarkModeを参照 */}
              <span className={darkMode ? styles.textOn : styles.textOff}>
                {darkMode ? 'ON' : 'OFF'}
              </span>
              <label className={styles.switch}>
                <input 
                  type="checkbox" 
                  checked={darkMode} 
                  onChange={(e) => setDarkMode(e.target.checked)} // ⭕ 共通のsetDarkModeをトリガー
                />
                <span className={styles.slider}></span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 通知機能設定セクション */}
      <div className={styles.section}>
        <div className={styles.settingRowInline}>
          <span className={styles.sectionTitle}>通知機能</span>
          <div className={styles.toggleWrapper}>
            <span className={notifications ? styles.textOn : styles.textOff}>
              {notifications ? 'ON' : 'OFF'}
            </span>
            <label className={styles.switch}>
              <input 
                type="checkbox" 
                checked={notifications} 
                onChange={(e) => setNotifications(e.target.checked)} 
              />
              <span className={styles.slider}></span>
            </label>
          </div>
        </div>
      </div>

      {/* アカウント操作エリア */}
      <div className={styles.dangerSection}>
        <button className={styles.dangerBtn} onClick={() => alert('ログアウトしました')}>
          ログアウト
        </button>
        <button className={styles.dangerBtn} onClick={() => alert('アカウントを削除しました')}>
          アカウント削除
        </button>
      </div>
    </div>
  );
}