# Local-development image for the FairShare frontend. Runs Vite's own dev
# server (hot reload included) inside the container -- not a production
# build. This supports local dev via `docker compose up` (see
# ../docker-compose.yml); a real static-build deployment image is future
# scope.
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# --host so Vite binds 0.0.0.0 instead of its default 127.0.0.1 -- without
# this the dev server is unreachable from outside the container even
# though the port is published in docker-compose.yml.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
