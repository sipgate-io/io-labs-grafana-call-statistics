FROM node:15.1.0-alpine3.10

WORKDIR /home/node/app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["./wait-for.sh", "db:3306", "--", "npm", "start"]
