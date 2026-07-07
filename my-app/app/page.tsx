import { redirect } from "next/navigation";

export default function Home() {
  // ログイン機能は一時的に無効化中（コードは/loginや/api/auth配下にそのまま残してある）
  redirect("/home");
}