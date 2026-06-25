"use client";

import { useState } from "react";
import { useRouter } from "next/navigation"; //
import styles from "./chat.module.css";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export default function ChatPage() {
  const router = useRouter(); // 追加
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const handleSend = async () => {
    const question = message.trim();
    if (!question) return;

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setMessage("");

    try {
      const response = await fetch("/api/groq", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "API request failed");
      }

      const assistantText = typeof data.content === "string" ? data.content : "";
      if (assistantText.trim()) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: assistantText },
        ]);
      }
    } catch (error) {
      console.error("チャット送信エラー:", error);
    }
  };

  return (
    <main className={styles.container}>
<div className={styles.header}>
  <button
    className={styles.backBtn}
    onClick={() => router.back()}
  >
    ←
  </button>

</div>
      <div className={styles.chatArea}>
        {messages.map((msg, index) => (
          <div
            key={index}
            className={
              msg.role === "assistant"
                ? styles.assistantBubble
                : styles.userBubble
            }
          >
            {msg.text}
          </div>
        ))}
      </div>

      <div className={styles.inputArea}>
        <input
          type="text"
          placeholder="入力してください"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSend();
            }
          }}
        />

        <button onClick={handleSend}>
          ▶
        </button>
      </div>
    </main>
  );
}