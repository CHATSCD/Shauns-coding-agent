# BookForge Studio

Turn a raw text or Word document into a professional, **print-ready ebook** with:

- 📄 **Import** — paste raw text or upload `.docx` / `.txt` / `.md`
- 🧭 **Auto-structure** — auto-detects chapters, prologue, epilogue, etc.
- 📚 **Front matter** — title page, copyright page, table of contents, and dedication page generated automatically
- 🎨 **Cover creator** — design a KDP-sized (1600×2560) cover with gradients, typography, and your own image
- ✨ **DeepSeek AI assistant** — polish, critique, expand, write blurbs, analyze, and get cover design advice
- 📦 **Export everything** — EPUB, PDF, DOCX, HTML, TXT (suitable for Amazon KDP, Google Play Books, Apple Books, Kobo)

## Getting started
```bash
npm install
npm run dev
```

### Environment variables (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
DEEPSEEK_API_KEY=...
```

- **Supabase**: create a project, run `schema.sql` in the SQL editor, copy URL + anon key.
- **DeepSeek**: get an API key at https://platform.deepseek.com

## Deploy
Push to GitHub → import into Vercel → add the 3 env vars → Deploy.

## Publish
- **Amazon KDP**: export EPUB (ebook) or PDF (paperback), upload at kdp.amazon.com
- **Google Play Books**: export EPUB or PDF, upload at play.google.com/books/publish
