'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react'; 
import styles from './settings.module.css';

export default function SettingsPage() {
  const [isMounted, setIsMounted] = useState(false);

  // 各トグルの状態管理
  const [aiBusiness, setAiBusiness] = useState(true);
  const [aiDaily, setAiDaily] = useState(true);
  const [notifications, setNotifications] = useState(true);
  
  // ⭕ GitHubリポジトリ名の状態管理を追加
  const [githubRepo, setGithubRepo] = useState('haru200453/tasseitai'); // 初期値（デフォルト）

  // 起動時にLocalStorageから設定を復元
  useEffect(() => {
    const savedBusiness = localStorage.getItem('setting_aiBusiness');
    const savedDaily = localStorage.getItem('setting_aiDaily');
    const savedNotif = localStorage.getItem('setting_notifications');
    
    // ⭕ ローカルストレージから保存されたリポジトリ名を取得
    const savedRepo = localStorage.getItem('setting_githubRepo');

    setAiBusiness(savedBusiness !== null ? JSON.parse(savedBusiness) : true);
    setAiDaily(savedDaily !== null ? JSON.parse(savedDaily) : true);
    setNotifications(savedNotif !== null ? JSON.parse(savedNotif) : true);
    
    // ⭕ 保存された値があればセット
    if (savedRepo !== null) {
      setGithubRepo(savedRepo);
    }

    setIsMounted(true);
  }, []);

  const handleToggle = (key: 'aiBusiness' | 'aiDaily' | 'notifications', value: boolean) => {
    if (key === 'aiBusiness') setAiBusiness(value);
    if (key === 'aiDaily') setAiDaily(value);
    if (key === 'notifications') setNotifications(value);

    localStorage.setItem(`setting_${key}`, JSON.stringify(value));
  };

  // ⭕ GitHubリポジトリ名をLocalStorageに保存する関数
  const handleRepoChange = (value: string) => {
    setGithubRepo(value);
    localStorage.setItem('setting_githubRepo', value);
  };

  const handleLogout = async () => {
    alert('ログアウトしました');
    await signOut({ callbackUrl: '/login' }); 
  };

  if (!isMounted) {
    return <div className={styles.container}></div>;
  }

  return (
    <div className={styles.container}>
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

      {/* ⭕ 新設：GitHub連携設定セクション */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>外部連携</span>
          <div className={styles.rowContainer}>
            <div className={styles.inputRow}>
              <label className={styles.subLabel} htmlFor="githubRepoInput">GitHub リポジトリ</label>
              <input
                id="githubRepoInput"
                type="text"
                className={styles.textField}
                placeholder="ユーザー名/リポジトリ名"
                value={githubRepo}
                onChange={(e) => handleRepoChange(e.target.value)}
              />
            </div>
            <p className={styles.inputHelp}>※ 「アカウント名/リポジトリ名」の形式で入力してください</p>
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
                onChange={(e) => handleToggle('notifications', e.target.checked)} 
              />
              <span className={styles.slider}></span>
            </label>
          </div>
        </div>
      </div>

      {/* アカウント操作エリア */}
      <div className={styles.dangerSection}>
        <button className={styles.dangerBtn} onClick={handleLogout}>
          ログアウト
        </button>
      </div>
    </div>
  );
}