This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


## Planning

### TODOs
- update readme for developers to help (env-configuration, API-key access, authorization before )
- make the authorization process aka. generating token requirement on app-start-up 
(get send to http://localhost:3000/api/auth/callback 
--> http://localhost:3000) or whatever URL will be used later.
- the client-secret + token.js Need to be saved in a different way (other .env --> make it more usable for new ppl)
- delete the example-stuff (is in git-history, if someone wants to Play around with that)
- configure the call to Ollama / gemini
- update UI-interface (Needs to include visual Chat history + ability to reference previous Chat Messages)

### Features To Add
- able to upload files (pdf, txt, docx)
- section for VectorDB --> might even Need to switch from MCP to VectorDB entirely because of Efficiency + length limitations on prompt
- [once we get a google Cloud project] different Groups can see different parts of the same Google Cloud

### Project changes when going prod
- different application type (from desktop-app to webapp)
- might Need to Change the Transport between Server and Client (from stdio to http) depending on where Servers will live (apart from or together with Node-app)