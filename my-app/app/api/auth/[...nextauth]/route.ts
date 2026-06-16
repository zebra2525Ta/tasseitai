import NextAuth from "next-auth";

const handler = NextAuth({
  providers: [
    {
      id: "notion",
      name: "Notion",
      type: "oauth",

      authorization: {
        url: "https://api.notion.com/v1/oauth/authorize",
        params: {
          owner: "user",
        },
      },

      token: "https://api.notion.com/v1/oauth/token",
      userinfo: "https://api.notion.com/v1/users/me",

      clientId: process.env.NOTION_CLIENT_ID!,
      clientSecret: process.env.NOTION_CLIENT_SECRET!,

      profile(profile) {
        return {
          id: profile.id,
          name: profile.name || "Notion User",
        };
      },
    },
  ],

  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.userId = (profile as any)?.id;
      }
      return token;
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.userId = token.userId;
      return session;
    },
  },
});

export { handler as GET, handler as POST };