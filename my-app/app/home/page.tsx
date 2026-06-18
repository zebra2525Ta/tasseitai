'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './home.module.css';

// 天気コードを人間用の文字と絵文字に変換するマップ
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

// GitHubのイベントタイプを分かりやすい日本語に変換する関数
const translateGithubEvent = (type: string) => {
  if (type === 'PushEvent') return 'コードをPush';
  if (type === 'IssuesEvent') return 'Issueを更新';
  if (type === 'IssueCommentEvent') return 'コメントを投稿';
  if (type === 'PullRequestEvent') return 'PRを更新';
  if (type === 'CreateEvent') return 'リポジトリ/ブランチを作成';
  return 'アクティビティ';
};

// 経過時間を計算する関数
const formatLastActivity = (dateString: string) => {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour ago`;
  return `${diffDays} day ago`;
};

export default function HomePage() {
  const [isMounted, setIsMounted] = useState(false);
  const [tasks, setTasks] = useState({ healthCheck: true, jobHunting: true });
  const [weather, setWeather] = useState({ text: '読み込み中...', emoji: '⏳', temp: '--' });
  const [newsArticles, setNewsArticles] = useState<string[]>([
    'ニュースを読み込み中...',
    'しばらくお待ちください...'
  ]);

  // ⭕ プロジェクトのアクティビティを管理するState（初期状態は読み込み中）
  const [projectActivities, setProjectActivities] = useState<any[]>([
    { name: '読み込み中...', action: '', time: '--', status: 'offline' }
  ]);

  useEffect(() => {
    // タスクの復元
    const savedHealthCheck = localStorage.getItem('task_healthCheck');
    const savedJobHunting = localStorage.getItem('task_jobHunting');
    setTasks({
      healthCheck: savedHealthCheck !== null ? JSON.parse(savedHealthCheck) : true,
      jobHunting: savedJobHunting !== null ? JSON.parse(savedJobHunting) : true,
    });

    // 天気APIの取得
    fetch('https://api.open-meteo.com/v1/forecast?latitude=34.6937&longitude=135.5023&current=temperature_2m,weather_code&timezone=Asia%2FTokyo')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.current) {
          const decoded = decodeWeather(data.current.weather_code);
          setWeather({
            text: decoded.text,
            emoji: decoded.emoji,
            temp: `${Math.round(data.current.temperature_2m)}℃`,
          });
        }
      })
      .catch(() => setWeather({ text: 'エラー', emoji: '⚠️', temp: '--' }));

    // GNews APIの取得
    const NEWS_API_KEY = '8a87edcbd181c83a254c14aa438f0ca6'; 
    const newsUrl = `https://gnews.io/api/v4/top-headlines?category=general&lang=ja&country=jp&max=2&apikey=${NEWS_API_KEY}`;
    fetch(newsUrl)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.articles && data.articles.length > 0) {
          const titles = data.articles.map((article: any) => article.title);
          setNewsArticles(titles);
        } else {
          setNewsArticles(['ニュースが見つかりませんでした', '']);
        }
      })
      .catch((err) => {
        console.error('ニュースの取得に失敗:', err);
        setNewsArticles(['ニュースの読み込みに失敗しました', '⚠️ リクエスト上限の可能性があります']);
      });

    // ⭕ 3. 指定したリポジトリ（tasseitai）のコミット履歴を確実に取得
    fetch('https://api.github.com/repos/haru200453/tasseitai/commits')
      .then((res) => res.json())
      .then((commits) => {
        if (commits && commits.length > 0) {
          // 最新の5件のコミットを抽出して整形
          const formattedActivities = commits.slice(0, 5).map((item: any) => {
            return {
              // 💡 GitHubアカウントがある場合はその名前、ない場合はコミット作成者の名前
              name: item.author ? item.author.login : item.commit.author.name, 
              action: 'コードをコミット', // コマンド内容を固定
              time: formatLastActivity(item.commit.author.date), // コミット日時
              status: 'online'
            };
          });
          setProjectActivities(formattedActivities);
        } else {
          setProjectActivities([{ name: 'コミット履歴なし', action: '', time: '--', status: 'offline' }]);
        }
      })
      .catch((err) => {
        console.error('GitHubデータの取得に失敗:', err);
        setProjectActivities([{ name: '読み込み失敗', action: 'API制限または非公開リポジトリです', time: '--', status: 'offline' }]);
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

        {/* 天気予報 */}
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

      {/* 中段：ニュース */}
      <div className={styles.newsCard}>
        <p className={styles.cardTitle} style={{ fontSize: '1rem', opacity: 1 }}>ニュース</p>
        <ul className={styles.newsList}>
          {newsArticles.map((title, index) => (
            <li key={index} className={styles.newsItem}>
              {title && <span style={{ marginRight: '6px' }}>•</span>}
              {title}
            </li>
          ))}
        </ul>
      </div>

      {/* ⭕ 下段：GitHubプロジェクトアクティビティ（tasseitai の最新の動き） */}
      <div className={styles.githubFullCard}>
        <p className={styles.githubTitle}>GitHubプロジェクト (tasseitai)</p>
        <div className={styles.memberList}>
          {projectActivities.map((activity, index) => (
            <div key={index} className={styles.memberItem}>
              <div className={styles.memberMain}>
                <span className={`${styles.statusDot} ${styles[activity.status]}`}></span>
                <span>{activity.name}</span>
                {activity.action && <span style={{ fontSize: '0.75rem', fontWeight: 'normal', opacity: 0.8 }}>({activity.action})</span>}
              </div>
              <span className={styles.lastActivity}>Last activity: {activity.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}