'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './home.module.css';

export default function HomePage() {
  // 画面がブラウザに完全に読み込まれたかを管理するフラグ
  const [isMounted, setIsMounted] = useState(false);

  // タスクの状態
  const [tasks, setTasks] = useState({
    healthCheck: true,
    jobHunting: true,
  });

  // 画面起動時に一度だけ実行
  useEffect(() => {
    const savedHealthCheck = localStorage.getItem('task_healthCheck');
    const savedJobHunting = localStorage.getItem('task_jobHunting');

    setTasks({
      healthCheck: savedHealthCheck !== null ? JSON.parse(savedHealthCheck) : true,
      jobHunting: savedJobHunting !== null ? JSON.parse(savedJobHunting) : true,
    });

    setIsMounted(true);
  }, []);

  // チェックボックスが変更された時の処理
  const handleCheckboxChange = (taskKey: 'healthCheck' | 'jobHunting', checked: boolean) => {
    setTasks((prev) => ({ ...prev, [taskKey]: checked }));
    localStorage.setItem(`task_${taskKey}`, JSON.stringify(checked));
  };

  if (!isMounted) {
    return <div className={styles.container} style={{ background: '#ffffff' }}></div>; 
  }

  return (
    <div className={styles.container}>
      {/* ヘッダー：メニュー & 設定 */}
      <div className={styles.header}>
        <Link href="/settings" className={styles.iconBtn}>
          <span className={styles.gearIcon}>⚙️</span>
        </Link>
      </div>

      <h1 className={styles.title}>ホーム画面</h1>

      {/* ⭕ 【新設】一番上に移動：ニュースと同じ幅（ワイドサイズ）のAIチャット */}
      <Link href="/chat" className={styles.aiChatFullCard}>
        <div className={styles.chatLinkContentRow}>
          <span className={styles.chatTextLarge}>AIチャット</span>
          <span className={styles.chatEmojiLarge}>🤖</span>
        </div>
      </Link>

      {/* 上段：予定 ＆ 天気 （2つのカードが綺麗に横に並びます） */}
      <div className={styles.topGrid}>
        <div className={`${styles.card} ${styles.scheduleCard}`}>
          <div>
            <p className={styles.cardTitle}>6月16日 火曜日</p>
            <div className={styles.todoList}>
              
              {/* 健康診断のチェックボックス */}
              <label className={styles.todoLabel}>
                <input 
                  type="checkbox" 
                  checked={tasks.healthCheck} 
                  onChange={(e) => handleCheckboxChange('healthCheck', e.target.checked)}
                />
                <span className={!tasks.healthCheck ? styles.completed : ''}>健康診断</span>
              </label>

              {/* 就職活動のチェックボックス */}
              <label className={styles.todoLabel}>
                <input 
                  type="checkbox" 
                  checked={tasks.jobHunting} 
                  onChange={(e) => handleCheckboxChange('jobHunting', e.target.checked)}
                />
                <span className={!tasks.jobHunting ? styles.completed : ''}>就職活動</span>
              </label>

            </div>
          </div>
        </div>

        {/* 天気予報 */}
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

      {/* 下段：GitHubチーム（ここも横いっぱいに綺麗に収まる構成に変更します） */}
      <div className={styles.githubFullCard}>
        <p className={styles.githubTitle}>GitHubチーム</p>
        <div className={styles.memberList}>
          <div className={styles.memberItem}>
            <div className={styles.memberMain}>
              <span className={`${styles.statusDot} ${styles.online}`}></span>
              <span>田中</span>
            </div>
            <span className={styles.lastActivity}>Last activity: 5 min ago</span>
          </div>
          <div className={styles.memberItem}>
            <div className={styles.memberMain}>
              <span className={`${styles.statusDot} ${styles.away}`}></span>
              <span>佐藤</span>
            </div>
            <span className={styles.lastActivity}>Last activity: 1 hour ago</span>
          </div>
        </div>
      </div>

    </div>
  );
}