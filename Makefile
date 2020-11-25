SHELL := /bin/bash

include .env
export

up:
	sudo docker-compose up -d

build:
	sudo docker-compose up --build -d

down:
	sudo docker-compose down

purge:
	sudo docker-compose down --volumes

fakedata:
	cd call-statistics-service && MYSQL_HOST=localhost npm run generateFakeData