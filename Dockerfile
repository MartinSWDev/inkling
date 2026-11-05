# Static build of the Inkling web app.
# Note: the live model routes (functions/api/*) are Cloudflare Pages
# Functions and are NOT served by this image. The game plays fully
# without them; the live inkling, paper pal and live students simply
# degrade silently, as they do whenever the model calls fail.
FROM node:20-alpine AS builder
WORKDIR /app
COPY web/package.json web/package-lock.json web/
RUN npm ci --prefix web
COPY web/ web/
# Not `npm run build`: its prebuild hook runs a Python exporter that is
# not needed here, because the exported data is committed under
# web/public/data/.
RUN cd web && npx tsc -b && npx vite build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/web/dist /usr/share/nginx/html
EXPOSE 80
