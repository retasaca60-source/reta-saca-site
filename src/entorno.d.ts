// Las variables de entorno que lee el sitio (Vite las mete al compilar).
// Todas son públicas: lo que empieza con VITE_ termina dentro del sitio.

interface ImportMetaEnv {
  /** "real" para usar Supabase; cualquier otra cosa, la versión simulada. */
  readonly VITE_DATOS?: string
  readonly VITE_SUPABASE_URL?: string
  /** La llave PUBLICABLE del proyecto (sb_publishable_…), nunca la secreta. */
  readonly VITE_SUPABASE_LLAVE_PUBLICA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
