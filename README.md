This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started (without Ollama)

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

## Getting Ollama to work

Prerequisits:
- docker

Follow the steps in `README.md` in ./ollama/ to start ollama locally and installing gpt-oss 20B locally. Then just run the application with `npm run dev` and you can chat with gpt-oss 20B. The response times are a little higher 30-40seconds (will be adressed in future updates).


## Planning

### TODOs
- configure the call to Ollama (done)
- assess the speed of request (make it visible to user / make visible how much resources are used -> can we put it on a GPU instead of a CPU)
- make ollama (gpt-oss 20B) accessable to MCP-tools
- make the authorization process aka. generating token requirement on app-start-up 
(get send to http://localhost:3000/api/auth/callback 
--> http://localhost:3000) or whatever URL will be used later.
- check gemini-option (cost-wise and maybe more benefits with student subscription) (done)
- update UI-interface (Needs to include visual Chat history + ability to reference previous Chat Messages)

### Features To Add
- section for VectorDB --> might even Need to switch from MCP to VectorDB entirely because of Efficiency + length limitations on prompt
- [once we get a google Cloud project] different Groups can see different parts of the same Google Cloud
- [For Vector-Database] create a webinterface in which you can upload your pdfs to add to the DB

### Project changes when going prod
- different application type (from desktop-app to webapp)
- might Need to Change the Transport between Server and Client (from stdio to http) depending on where Servers will live (apart from or together with Node-app)
