"use client";

import { useState } from "react";
import { useRouter } from "next/navigation"; //
import styles from "./chat.module.css";

export default function ChatPage() {
  const router = useRouter(); // 追加
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<string[]>([]);

  const handleSend = () => {
    if (!message.trim()) return;

    setMessages((prev) => [...prev, message]);

    setMessage("");
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
          <div key={index} className={styles.userBubble}>
            {msg}
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