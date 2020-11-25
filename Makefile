SHELL := /bin/bash

include .env
export

up:
	sudo docker-compose up -d

fakedata:
	cd call-statistics-service && MYSQL_HOST=localhost npm run generateFakeData

down:
	sudo docker-compose down
