'use client';

import React from 'react';
import Link from 'next/link';
import styles from './home.module.css';

export default function HomePage() {
  return (
    <div className={styles.container}>
      {/* ヘッダー：メニュー & 設定 */}
      <div className={styles.header}>
        <button className={styles.iconBtn}>
          <div className={styles.hamburger}>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span className={styles.menuText}>MENU</span>
        </button>
        
        {/* ⭕ 綺麗に修正：無駄なbuttonタグを削除し、Linkタグ一本にまとめました */}
        <Link href="/settings" className={styles.iconBtn}>
          <span className={styles.gearIcon}>⚙️</span>
        </Link>
      </div>

      <h1 className={styles.title}>ホーム画面</h1>

      {/* 上段：予定 ＆ 天気 */}
      <div className={styles.topGrid}>
        <div className={`${styles.card} ${styles.scheduleCard}`}>
          <div>
            <p className={styles.cardTitle}>6月16日 火曜日</p>
            <div className={styles.todoList}>
              <label className={styles.todoLabel}>
                <input type="checkbox" defaultChecked />
                <span>健康診断</span>
              </label>
              <label className={styles.todoLabel}>
                <input type="checkbox" defaultChecked />
                <span>就職活動</span>
              </label>
            </div>
          </div>
        </div>

        <div className={`${styles.card} ${styles.weatherCard}`}>
          <div>
            <p className={styles.cardTitle}>天気予報</p>
            <p className={styles.weatherInfo}>晴れ 28℃</p>
            <p className={styles.weatherDetail}>降水確率 0%</p>
          </div>
        </div>
      </div>

      {/* 中段：ニュース */}
      <div className={styles.newsCard}>
        <p className={styles.cardTitle} style={{ fontSize: '1rem', opacity: 1 }}>ニュース</p>
        <ul className={styles.newsList}>
          <li className={styles.newsItem}>ワールドカップ結果</li>
          <li className={styles.newsItem}>G7サミット</li>
        </ul>
      </div>

      {/* 下段：GitHubアクティビティ ＆ AIチャットへの導線 */}
      <div className={styles.bottomGrid}>
        
        {/* 左下：GitHubチームのアクティビティ表示 */}
        <div className={`${styles.card} ${styles.githubCard}`}>
          <p className={styles.githubTitle}>GitHubチーム</p>
          <div className={styles.memberList}>
            {/* 田中さん */}
            <div className={styles.memberItem}>
              <div className={styles.memberMain}>
                <span className={`${styles.statusDot} ${styles.online}`}></span>
                <span>田中</span>
              </div>
              <span className={styles.lastActivity}>Last activity: 5 min ago</span>
            </div>
            {/* 佐藤さん */}
            <div className={styles.memberItem}>
              <div className={styles.memberMain}>
                <span className={`${styles.statusDot} ${styles.away}`}></span>
                <span>佐藤</span>
              </div>
              <span className={styles.lastActivity}>Last activity: 1 hour ago</span>
            </div>
          </div>
        </div>

        {/* 右下：AIチャット画面へのリンク */}
        <Link href="/chat" className={`${styles.card} ${styles.chatLinkCard}`}>
          <div className={styles.chatLinkContent}>
            <span className={styles.chatText}>AIチャット</span>
            <span className={styles.chatEmoji}>🤖</span>
          </div>
        </Link>
        
      </div>
    </div>
  );
}