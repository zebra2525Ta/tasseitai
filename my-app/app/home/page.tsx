import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getUserDatabaseMap } from "@/lib/notionDatabaseMap";
import HomeClient from "./HomeClient";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    redirect("/login");
  }

  const databases = await getUserDatabaseMap(session.userId!);
  return <HomeClient scheduleDatabaseId={databases.schedule} todoDatabaseId={databases.todo} />;
}
