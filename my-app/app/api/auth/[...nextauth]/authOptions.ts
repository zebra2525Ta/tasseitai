import type { AuthOptions } from "next-auth";

export const authOptions: AuthOptions = {
  debug: true,

  pages: {
    signIn: "/login",
    error: "/login",
  },

  providers: [
    {
      id: "notion",
      name: "Notion",
      type: "oauth",

      clientId: process.env.NOTION_CLIENT_ID!,
      clientSecret: process.env.NOTION_CLIENT_SECRET!,

      authorization: {
        url: "https://api.notion.com/v1/oauth/authorize",
        params: {
          owner: "user",
          response_type: "code",
        },
      },

      token: {
        async request({ params }) {
          const response = await fetch(
            "https://api.notion.com/v1/oauth/token",
            {
              method: "POST",
              headers: {
                Authorization:
                  "Basic " +
                  Buffer.from(
                    `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`
                  ).toString("base64"),
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                grant_type: "authorization_code",
                code: params.code,
                redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback/notion`,
              }),
            }
          );

          const tokens = await response.json();

          return {
            tokens,
          };
        },
      },

      userinfo: {
        async request({ tokens }) {
          return {
            id: tokens.access_token || "notion-user",
            name: "Notion User",
          };
        },
      },

      profile(profile) {
        return {
          id: profile.id,
          name: profile.name,
        };
      },
    },
  ],

  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      if (account?.workspace_id) {
        token.workspaceId = account.workspace_id as string;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.workspaceId = token.workspaceId;
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};
