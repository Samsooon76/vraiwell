/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
    readonly VITE_GOOGLE_CLIENT_ID: string
    readonly VITE_MICROSOFT_CLIENT_ID: string
    readonly VITE_SLACK_CLIENT_ID: string
    readonly VITE_NOTION_CLIENT_ID: string
    // more env variables...
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
