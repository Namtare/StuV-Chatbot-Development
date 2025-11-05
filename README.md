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

Follow the steps in `README.md` in ./ollama/ to start ollama locally and installing the model locally. Then just run the application with `npm run dev` and you can chat with the model. The response times are a little higher 30-40seconds currently.

### TODO

- reducing response time by changing architecture to RAG first, LLM response optional
- reduce response time by changing architecture to RAG first, then A2A for efficient extension of context and response capabilities

### Features To Add

- [once we get a google Cloud project] different Groups can see different parts of the same Google Cloud
- [For Vector-Database] create a webinterface in which you can upload your pdfs to add to the DB

### Project changes when going prod

- different application type (from desktop-app to webapp)
- might Need to Change the Transport between Server and Client (from stdio to http) depending on where Servers will live (apart from or together with Node-app)
