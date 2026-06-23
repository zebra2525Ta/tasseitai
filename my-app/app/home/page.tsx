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
  
  // 天気のStateを1つに統合して整理
  const [weather, setWeather] = useState({ 
    text: '読み込み中...', 
    emoji: '⏳', 
    temp: '--',
    windSpeed: '--', 
    pop: '--', 
    tomorrow: {
      text: '',
      emoji: '',
      temp: '--',
      pop: '--'
    }
  });
  
  const [newsArticles, setNewsArticles] = useState<any[]>([
    { title: 'ニュースを読み込み中...', url: '#' },
    { title: 'しばらくお待ちください...', url: '#' }
  ]);

  const [projectActivities, setProjectActivities] = useState<any[]>([
    { name: '読み込み中...', action: '', time: '--', status: 'offline' }
  ]);

  // 現在表示中のリポジトリ名を画面（JSX）に反映するためのStateを追加
  const [currentRepoName, setCurrentRepoName] = useState('tasseitai');

  useEffect(() => {
    // タスクの復元
    const savedHealthCheck = localStorage.getItem('task_healthCheck');
    const savedJobHunting = localStorage.getItem('task_jobHunting');
    setTasks({
      healthCheck: savedHealthCheck !== null ? JSON.parse(savedHealthCheck) : true,
      jobHunting: savedJobHunting !== null ? JSON.parse(savedJobHunting) : true,
    });

    // 天気APIの取得
    const weatherUrl = 'https://api.open-meteo.com/v1/forecast?latitude=34.6937&longitude=135.5023&current=temperature_2m,weather_code,surface_pressure,wind_speed_10m&hourly=precipitation_probability&daily=weather_code,temperature_2m_max,precipitation_probability_max&timezone=Asia%2FTokyo&forecast_days=2';
    
    fetch(weatherUrl)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.current) {
          const currentDecoded = decodeWeather(data.current.weather_code);
          
          // 今日の降水確率（現在の時間帯）
          const currentHour = new Date().getHours();
          const currentPop = data.hourly?.precipitation_probability?.[currentHour] ?? '--';

          // 明日の天気データを抽出
          const tomorrowWeatherCode = data.daily?.weather_code?.[1] ?? 0;
          const tomorrowDecoded = decodeWeather(tomorrowWeatherCode);
          const tomorrowMaxTemp = data.daily?.temperature_2m_max?.[1] ?? '--';
          const tomorrowPop = data.daily?.precipitation_probability_max?.[1] ?? '--';

          setWeather({
            text: currentDecoded.text,
            emoji: currentDecoded.emoji,
            temp: `${Math.round(data.current.temperature_2m)}℃`,
            windSpeed: `${data.current.wind_speed_10m} m/s`,
            pop: `${currentPop}%`,
            tomorrow: {
              text: tomorrowDecoded.text,
              emoji: tomorrowDecoded.emoji,
              temp: `${Math.round(tomorrowMaxTemp)}℃`,
              pop: `${tomorrowPop}%`
            }
          });
        }
      })
      .catch(() => setWeather({ 
        text: 'エラー', emoji: '⚠️', temp: '--', windSpeed: '--', pop: '--', 
        tomorrow: { text: 'エラー', emoji: '⚠️', temp: '--', pop: '--' } 
      }));

    // GNews APIの取得
    const NEWS_API_KEY = '8a87edcbd181c83a254c14aa438f0ca6'; 
    const newsUrl = `https://gnews.io/api/v4/top-headlines?category=general&lang=ja&country=jp&max=2&apikey=${NEWS_API_KEY}`;
    fetch(newsUrl)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.articles && data.articles.length > 0) {
          const articles = data.articles.map((article: any) => ({
            title: article.title,
            url: article.url
          }));
          setNewsArticles(articles);
        } else {
          setNewsArticles([{ title: 'ニュースが見つかりませんでした', url: '#' }]);
        }
      })
      .catch((err) => {
        console.error('ニュースの取得に失敗:', err);
        setNewsArticles([
          { title: 'ニュースの読み込みに失敗しました', url: '#' },
          { title: '⚠️ リクエスト上限の可能性があります', url: '#' }
        ]);
      });

    // 1. LocalStorageから設定されたGitHubリポジトリ名を取得（無い場合はデフォルト値）
    const savedRepo = localStorage.getItem('setting_githubRepo') || 'haru200453/tasseitai';
        
    // 表示用カードのタイトルに反映するため、スラッシュ以降のリポジトリ名だけを切り出して保存
    const repoTitle = savedRepo.includes('/') ? savedRepo.split('/')[1] : savedRepo;
    setCurrentRepoName(repoTitle);

    // エラー対策：「ユーザー名/リポジトリ名」の形式（スラッシュが含まれているか）をチェック
    if (savedRepo.includes('/') && savedRepo.split('/')[0] && savedRepo.split('/')[1]) {
      // 2. 動的に設定されたリポジトリURLを構築してフェッチ
      fetch(`https://api.github.com/repos/${savedRepo}/commits`)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
        .then((commits) => {
          if (commits && Array.isArray(commits) && commits.length > 0) {
            const formattedActivities = commits.slice(0, 5).map((item: any) => {
              const authorName = item.author?.login || item.commit?.author?.name || 'Unknown';
              const commitDate = item.commit?.author?.date || new Date().toISOString();
              
              return {
                name: authorName, 
                action: 'コードをコミット', 
                time: formatLastActivity(commitDate), 
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
          setProjectActivities([{ name: '読み込み失敗', action: 'API制限またはリポジトリが見つかりません', time: '--', status: 'offline' }]);
        });
    } else {
      // 設定が不完全な場合の表示
      setProjectActivities([{ name: '設定不完全', action: '設定画面で正しく入力してください', time: '--', status: 'offline' }]);
    }

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

      {/* AIチャットカード「Noir」 */}
      <Link href="/chat" className={styles.aiChatFullCard}>
        <div className={styles.chatLinkContentRow}>
          <span className={styles.chatTextLarge}>Noir</span>
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

        {/* 天気予報：詳細 ＆ 明日の天気 */}
        <div className={`${styles.card} ${styles.weatherCard}`}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <div>
              <p className={styles.cardTitle}>天気予報</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '1.75rem' }}>{weather.emoji}</span>
                <p className={styles.weatherInfo}>{weather.text}</p>
              </div>
              <p className={styles.weatherDetail} style={{ fontSize: '1rem', fontWeight: 'bold', margin: '2px 0 6px 0' }}>{weather.temp}</p>
            </div>
            
            {/* 今日の詳細パラメーター */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '4px', paddingBottom: '4px' }}>
              <p className={styles.weatherDetail}>💧 降水確率: {weather.pop}</p>
              <p className={styles.weatherDetail}>🌀 風速: {weather.windSpeed}</p>
            </div>

            {/* 明日の天気予報 */}
            {weather.tomorrow.text && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '6px', marginTop: '2px' }}>
                <p className={styles.weatherDetail} style={{ opacity: 0.6, fontSize: '0.65rem', marginBottom: '2px' }}>明日の予報</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>{weather.tomorrow.emoji}</span>
                    <span>{weather.tomorrow.text}</span>
                  </span>
                  <span>{weather.tomorrow.temp} (💧{weather.tomorrow.pop})</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 中段：ニュース */}
      <div className={styles.newsCard}>
        <p className={styles.cardTitle} style={{ fontSize: '1rem', opacity: 1 }}>ニュース</p>
        <ul className={styles.newsList}>
          {newsArticles.map((article, index) => (
            <li key={index} className={styles.newsItem}>
              {article.title && <span style={{ marginRight: '6px' }}>•</span>}
              {article.url && article.url !== '#' ? (
                <a 
                  href={article.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className={styles.newsLink}
                  style={{ color: 'inherit', textDecoration: 'none' }}
                >
                  {article.title}
                </a>
              ) : (
                <span>{article.title}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* 下段：GitHubプロジェクトアクティビティ */}
      <div className={styles.githubFullCard}>
        <p className={styles.githubTitle}>GitHubプロジェクト ({currentRepoName})</p>
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