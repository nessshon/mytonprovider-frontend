import { createHash } from "node:crypto"
import react from "@vitejs/plugin-react-swc"
import { defineConfig, loadEnv } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const siteUrl = env.VITE_SITE_URL || "https://mytonprovider.org"
  let base = "/"

  return {
    plugins: [
      react(),
      tsconfigPaths(),
      {
        name: "site-url",
        transformIndexHtml: (html) => html.replaceAll("%SITE_URL%", siteUrl),
      },
      {
        name: "preload-fonts",
        enforce: "post",
        configResolved: (config) => {
          base = config.base
        },
        transformIndexHtml: (html, ctx) => ({
          html,
          tags: Object.keys(ctx.bundle ?? {})
            .filter((file) => /inter-(latin|cyrillic)-wght-normal-[^.]+\.woff2$/.test(file))
            .map((file) => ({
              tag: "link",
              attrs: { rel: "preload", as: "font", type: "font/woff2", crossorigin: "", href: `${base}${file}` },
              injectTo: "head-prepend" as const,
            })),
        }),
      },
    ],
    css: {
      modules: {
        generateScopedName: (name, filename) => {
          const file = filename.split("/").pop()?.replace(".module.css", "") ?? "styles"
          const hash = createHash("sha256").update(`${filename}:${name}`).digest("base64url").slice(0, 5)
          return `${file}_${name}__${hash}`
        },
      },
    },
    server: {
      host: true,
    },
  }
})
