'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './home.module.css';

// 天気コード（weather_code）を人間用の文字と絵文字に変換するマップ
const decodeWeather = (code: number) => {
  if (code === 0) return { text: '快晴', emoji: '☀️' };
  if ([1, 2, 3].includes(code)) return { text: '晴れ/曇', emoji: '⛅' };
  if ([45, 48].includes(code)) return { text: '霧', emoji: '🌫️' };
  if ([51, 53, 55, 56, 57].includes(code)) return { text: '小雨', emoji: '🌦️' };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { text: '雨', emoji: '☔' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { text: '雪', emoji: '❄️' };
  if ([95, 96, 99].includes(code)) return { text: '雷雨', emoji: '⛈️' };
  return { text: '不明', emoji: '❓' };
};

export default function HomePage() {
  const [isMounted, setIsMounted] = useState(false);
  const [tasks, setTasks] = useState({ healthCheck: true, jobHunting: true });

  // ⭕ 天気データを管理するStateを追加
  const [weather, setWeather] = useState({
    text: '読み込み中...',
    emoji: '⏳',
    temp: '--',
  });

  useEffect(() => {
    // 1. タスクの復元
    const savedHealthCheck = localStorage.getItem('task_healthCheck');
    const savedJobHunting = localStorage.getItem('task_jobHunting');
    setTasks({
      healthCheck: savedHealthCheck !== null ? JSON.parse(savedHealthCheck) : true,
      jobHunting: savedJobHunting !== null ? JSON.parse(savedJobHunting) : true,
    });

    // ⭕ 2. Open-Meteo APIから実際の天気を取得（例として東京付近の座標: 緯度35.678, 経度139.767）
    // 大阪にする場合は latitude=34.6937&longitude=135.5023 に変更してください
    fetch('https://api.open-meteo.com/v1/forecast?latitude=35.678&longitude=139.767&current=temperature_2m,weather_code&timezone=Asia%2FTokyo')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.current) {
          const currentCode = data.current.weather_code;
          const currentTemp = Math.round(data.current.temperature_2m); // 四捨五入して整数に
          const decoded = decodeWeather(currentCode);

          setWeather({
            text: decoded.text,
            emoji: decoded.emoji,
            temp: `${currentTemp}℃`,
          });
        }
      })
      .catch((err) => {
        console.error('天気データの取得に失敗:', err);
        setWeather({ text: 'エラー', emoji: '⚠️', temp: '--' });
      });

    setIsMounted(true);
  }, []);

  const handleCheckboxChange = (taskKey: 'healthCheck' | 'jobHunting', checked: boolean) => {
    setTasks((prev) => ({ ...prev, [taskKey]: checked }));
    localStorage.setItem(`task_${taskKey}`, JSON.stringify(checked));
  };

  if (!isMounted) {
    return <div className={styles.container} style={{ background: '#ffffff' }}></div>; 
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/settings" className={styles.iconBtn}>
          <span className={styles.gearIcon}>⚙️</span>
        </Link>
      </div>

      <h1 className={styles.title}>ホーム画面</h1>

      {/* AIチャット */}
      <Link href="/chat" className={styles.aiChatFullCard}>
        <div className={styles.chatLinkContentRow}>
          <span className={styles.chatTextLarge}>AIチャット</span>
          <span className={styles.chatEmojiLarge}>🤖</span>
        </div>
      </Link>

      {/* 上段：予定 ＆ 天気 */}
      <div className={styles.topGrid}>
        <div className={`${styles.card} ${styles.scheduleCard}`}>
          <div>
            <p className={styles.cardTitle}>6月16日 火曜日</p>
            <div className={styles.todoList}>
              <label className={styles.todoLabel}>
                <input 
                  type="checkbox" 
                  checked={tasks.healthCheck} 
                  onChange={(e) => handleCheckboxChange('healthCheck', e.target.checked)}
                />
                <span className={!tasks.healthCheck ? styles.completed : ''}>健康診断</span>
              </label>

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

        {/* ⭕ 天気予報カード（取得したリアルタイムデータを反映！） */}
        <div className={`${styles.card} ${styles.weatherCard}`}>
          <div>
            <p className={styles.cardTitle}>天気予報</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '2rem' }}>{weather.emoji}</span>
              <p className={styles.weatherInfo}>{weather.text}</p>
            </div>
            <p className={styles.weatherDetail}>現在気温: {weather.temp}</p>
          </div>
        </div>
      </div>

      {/* ニュース */}
      <div className={styles.newsCard}>
        <p className={styles.cardTitle} style={{ fontSize: '1rem', opacity: 1 }}>ニュース</p>
        <ul className={styles.newsList}>
          <li className={styles.newsItem}>ワールドカップ結果</li>
          <li className={styles.newsItem}>G7サミット</li>
        </ul>
      </div>

      {/* GitHubチーム */}
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