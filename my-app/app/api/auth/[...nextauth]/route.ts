import NextAuth from "next-auth";

const handler = NextAuth({
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

  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };