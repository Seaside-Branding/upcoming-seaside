# syntax=docker/dockerfile:1
# Build from repo root: docker build -t ziff .
FROM node:22-alpine AS build
WORKDIR /repo
COPY site-rewrite/package.json site-rewrite/package-lock.json site-rewrite/
RUN cd site-rewrite && npm ci
COPY . .
RUN cd site-rewrite && npm run build

FROM nginx:alpine
COPY --from=build /repo/site-rewrite/dist /usr/share/nginx/html
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  index index.html;\n  gzip on;\n  gzip_types text/css application/javascript application/json image/svg+xml;\n  location / { try_files $uri $uri/ $uri.html =404; }\n  error_page 404 /404.html;\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
