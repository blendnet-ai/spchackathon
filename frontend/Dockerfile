FROM node:23.11.0-slim
ARG ENV_FILE
WORKDIR /app
COPY package*.json ./
RUN npm i
COPY $ENV_FILE .env
COPY . .
RUN npm run build
RUN npm install -g serve
EXPOSE 5001
CMD ["serve", "-s", "dist", "-l", "5001"]