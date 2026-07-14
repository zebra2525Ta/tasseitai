"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./chat.module.css";
import { ArrowLeftIcon, SendIcon } from "@/app/components/icons";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

type PendingItem = {
  topicId: string;
  title: string;
  values?: Record<string, unknown>;
  multiDates?: string[];
};
type TopicChoice = { id: string; label: string };

export default function ChatClient() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Notion登録の確認待ちアイテム（会話履歴とは別に、確認フローのためだけに1件だけ保持する）
  const [pendingItem, setPendingItem] = useState<PendingItem | null>(null);
  // どのトピック（データベース）の話か曖昧なときに、選択肢とその元メッセージを保持する
  const [topicChoices, setTopicChoices] = useState<TopicChoice[]>([]);
  const [pendingOriginalMessage, setPendingOriginalMessage] = useState("");

  const handleSend = async () => {
    const question = message.trim();
    if (!question) return;

    // 会話はログとして残さず、直前の1往復だけを表示する（新しい質問で前のやり取りは消える）
    setMessages([{ role: "user", text: question }]);
    // 登録確認・トピック選択はボタンでのみ行うため、メッセージを送るということは確認待ちを打ち切る扱いにする
    setPendingItem(null);
    setTopicChoices([]);
    setPendingOriginalMessage("");

    setMessage("");

    try {
      // Notionを参照するかどうかの判定はサーバー側で行う。会話履歴は送信しない（1問1答のまま）。
      const response = await fetch("/api/groq", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: question }),
      });

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "API request failed");
      }

      applyServerResponse(data);
    } catch (error) {
      console.error("チャット送信エラー:", error);
      showErrorMessage(error);
    }
  };

  // API呼び出しが失敗したとき、コンソールに沈めるだけでなく画面にも表示する
  const showErrorMessage = (error: unknown) => {
    const text = error instanceof Error ? error.message : "エラーが発生しました。もう一度試してみてください。";
    setMessages((prev) => [...prev, { role: "assistant", text }]);
  };

  // サーバーからのレスポンスに含まれる、確認待ち状態（登録待ち・トピック選択待ち）とメッセージ本文を反映する
  const applyServerResponse = (data: any) => {
    setPendingItem(
      data?.pendingItem && typeof data.pendingItem === "object" ? data.pendingItem : null
    );
    setTopicChoices(Array.isArray(data?.topicChoices) ? data.topicChoices : []);
    setPendingOriginalMessage(typeof data?.originalMessage === "string" ? data.originalMessage : "");

    const assistantText = typeof data.content === "string" ? data.content : "";
    const hasChoices = Array.isArray(data?.topicChoices) && data.topicChoices.length > 0;
    const hasPendingItem = data?.pendingItem && typeof data.pendingItem === "object";
    if (assistantText.trim()) {
      setMessages((prev) => [...prev, { role: "assistant", text: assistantText }]);
    } else if (!hasChoices && !hasPendingItem) {
      // サーバーが本文なし・選択肢なし・登録待ちなしを返した場合、ユーザーには何も起きていないように
      // 見えてしまうため、必ず何かしらのフィードバックを表示する
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "うまく取得できなかったみたい。もう一度試してみてね。" },
      ]);
    }
  };

  // トピック選択ボタン用：選ばれたトピックで元のメッセージを処理し直す
  const handleTopicChoice = async (topicId: string) => {
    if (!pendingOriginalMessage) return;

    try {
      const response = await fetch("/api/groq", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topicId, originalMessage: pendingOriginalMessage }),
      });

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "API request failed");
      }

      applyServerResponse(data);
    } catch (error) {
      console.error("トピック選択エラー:", error);
      showErrorMessage(error);
    }
  };

  // 登録確認ボタン用：はい/やめる の選択を受けて処理する
  const handleConfirmRegistration = async (confirmed: boolean) => {
    if (!pendingItem) return;

    if (!confirmed) {
      setPendingItem(null);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "登録をやめておいたよ。また必要になったら教えてね。" },
      ]);
      return;
    }

    try {
      const response = await fetch("/api/groq", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmRegistration: pendingItem }),
      });

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "API request failed");
      }

      applyServerResponse(data);
    } catch (error) {
      console.error("登録確定エラー:", error);
      showErrorMessage(error);
    }
  };

  return (
    <main className={styles.container}>
      {/* ヘッダー */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>
          <ArrowLeftIcon size={20} color="#ffffff" />
        </button>
      </div>

      {/* チャット履歴エリア */}
      <div className={styles.chatArea}>
        {/* 会話が始まる前は、中央にNoirマークの色違い（チャット用のブルー）を表示する */}
        {messages.length === 0 && !pendingItem && topicChoices.length === 0 && (
          <div className={styles.emptyStateMark}>
            <svg viewBox="0 0 100 100" width="140" height="140" aria-hidden="true">
              <polygon points="10,15 10,85 50,50" fill="#6a67ff" />
              <polygon points="90,15 90,85 50,50" fill="#9aa0b5" />
            </svg>
            <span className={styles.emptyStateLabel}>Noir</span>
          </div>
        )}

        {messages.map((msg, index) => (
          <div
            key={index}
            className={
              msg.role === "assistant"
                ? styles.messageRowAssistant
                : styles.messageRowUser
            }
          >
            {/* 役割ラベル */}
            <div className={styles.roleLabel}>
              {msg.role === "assistant" ? "Noir" : "User"}
            </div>

            {/* メッセージの吹き出し */}
            <div
              className={
                msg.role === "assistant"
                  ? styles.assistantBubble
                  : styles.userBubble
              }
            >
              {msg.text && <div>{msg.text}</div>}
            </div>
          </div>
        ))}

        {/* Notion登録の確認ボタン（メッセージではなく選択式にする） */}
        {pendingItem && (
          <div className={styles.confirmRow}>
            <button
              type="button"
              className={styles.confirmYesBtn}
              onClick={() => handleConfirmRegistration(true)}
            >
              はい、登録する
            </button>
            <button
              type="button"
              className={styles.confirmNoBtn}
              onClick={() => handleConfirmRegistration(false)}
            >
              やめる
            </button>
          </div>
        )}

        {/* どのデータベースの話か曖昧なときの選択ボタン */}
        {topicChoices.length > 0 && (
          <div className={styles.confirmRow}>
            {topicChoices.map((topic) => (
              <button
                key={topic.id}
                type="button"
                className={styles.confirmNoBtn}
                onClick={() => handleTopicChoice(topic.id)}
              >
                {topic.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ボトム入力エリア */}
      <div className={styles.inputArea}>

        {/* カプセル型の入力枠コンテナ */}
        <div className={styles.inputWrapper}>
          <input
            type="text"
            placeholder="Message Noir..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSend();
              }
            }}
            className={styles.textField}
          />

          <button className={styles.sendBtn} onClick={handleSend}>
            <SendIcon size={18} color="currentColor" />
          </button>
        </div>
      </div>
    </main>
  );
}
