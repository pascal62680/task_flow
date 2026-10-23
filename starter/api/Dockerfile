FROM node:20-alpine

COPY . ./

RUN npm install

ENV PORT=3000


ENV DATABASE_URL=postgres://taskflow:taskflow@localhost:5432/taskflow


ENV APP_ENV=local


ENV APP_VERSION=dev

CMD ["npm", "run", "dev"]