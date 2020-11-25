<img src="https://www.sipgatedesign.com/wp-content/uploads/wort-bildmarke_positiv_2x.jpg" alt="sipgate logo" title="sipgate" align="right" height="112" width="200"/>

# sipgate.io call statistics with grafana

This docker compose environment demonstrates how you can use our [official Node.js library](https://github.com/sipgate-io/sipgateio-node) to fetch call events with **sipgate.io** and store the information in a relational database. To visualize the collected data we make use of the interactive visualization web application [Grafana](https://grafana.com/) which is open source.

## Enabling sipgate.io for your sipgate account

In order to use sipgate.io, you need to book the corresponding package in your sipgate account. The most basic package is the free **sipgate.io S** package.

If you use [sipgate basic](https://app.sipgatebasic.de/feature-store) or [simquadrat](https://app.simquadrat.de/feature-store) you can book packages in your product's feature store.
If you are a **sipgate team** user logged in with an admin account you can find the option under **Account Administration**&nbsp;>&nbsp;**Plans & Packages**.

## Install required tools

The project relies on Docker Compose. Thatfore a Docker installation is required. Please follow the instructions on the [Get Docker](https://docs.docker.com/get-docker/) instructions for your dedicated system and the [Install Docker Compose](https://docs.docker.com/compose/install/) respectively. After that your system is ready tohost multiple virtual containers as multi-container application.

## Developing

For easy developing there is a Makefile with short commands to start/end the containers and populate them with fake data:

```bash
make up         # uses docker-compose up to start the server
make fakedata   # calls npm run fakeDataGenerator with the required environment variables
make down       # uses docker-compose down to shut down the server (does not delete volumes)
```
