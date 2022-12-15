<img src="https://www.sipgatedesign.com/wp-content/uploads/wort-bildmarke_positiv_2x.jpg" alt="sipgate logo" title="sipgate" align="right" height="112" width="200"/>

# sipgate.io call statistics with grafana

This docker compose environment demonstrates how you can use our [official Node.js library](https://github.com/sipgate-io/sipgateio-node) to fetch call events with **sipgate.io** and store the information in a relational database. To visualize the collected data we make use of the interactive visualization web application [Grafana](https://grafana.com/) which is open source.

## Enabling sipgate.io for your sipgate account

In order to use sipgate.io, you need to book the corresponding package in your sipgate account. The most basic package is the free **sipgate.io S** package.

## Install required tools

The project relies on Docker Compose. Therefore, a Docker installation is required. Please follow the instructions on the [Get Docker](https://docs.docker.com/get-docker/) instructions for your dedicated system and the [Install Docker Compose](https://docs.docker.com/compose/install/) respectively. After that your system is ready to host multiple virtual containers as multi-container application.

## Quickstart

1. To make your local environment accessible, use a service like [localhost.run](https://localhost.run/) or [ngrok](https://ngrok.com/).
2. To setup the environment run `setup.sh` and follow the instructions.
    - If you are working with MacOs or the `setup.sh` fails, you can skip that step and setup the project manually:
    - Create a `.env` file by copying `.env.example` and follow the instructions above each variable.
3. Start the docker containers with `make up`.
4. Authenticate on `http://localhost:{WEBHOOK_PORT}/auth` (replace `{WEBHOOK_PORT}` with your port).
5. After successfully authenticating via OAuth you will be redirected to the Grafana dashboard.
There you can login with the Grafana standard credentials (`user: admin`, `password: admin`) and are prompted to change them.

Everything is now set up and new calls will be displayed in Grafana.
The Grafana dashboard is accessible at `http://localhost:3009/`

## Developing

For easy developing there is a Makefile with short commands to start/end the containers and populate them with fake data:

```bash
make up         # uses docker-compose up to start the server
make fakedata   # calls npm run fakeDataGenerator with the required environment variables
make down       # uses docker-compose down to shut down the server (does not delete volumes)
make purge      # removes all docker volumes
make build      # recreates the docker images and starts them
```
