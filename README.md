<img src="https://www.sipgatedesign.com/wp-content/uploads/wort-bildmarke_positiv_2x.jpg" alt="sipgate logo" title="sipgate" align="right" height="112" width="200"/>

# sipgate.io call statistics with grafana

This docker compose environment demonstrates how you can use our [official Node.js library](https://github.com/sipgate-io/sipgateio-node) to fetch call events with **sipgate.io** and store the information in a relational database. To visualize the collected data we make use of the interactive visualization web application [Grafana](https://grafana.com/) which is open source.

## Enabling sipgate.io for your sipgate account

In order to use sipgate.io, you need to book the corresponding package in your sipgate account. The most basic package is the free **sipgate.io S** package.

## Install required tools

The project relies on Docker Compose. Therefore, a Docker installation is required. Please follow the instructions on the [Get Docker](https://docs.docker.com/get-docker/) instructions for your dedicated system and the [Install Docker Compose](https://docs.docker.com/compose/install/) respectively. After that your system is ready to host multiple virtual containers as multi-container application.

## Quickstart

1. To make your local environment accessible, use a service like [localhost.run](https://localhost.run/) or [ngrok](https://ngrok.com/).

2. To set up the project follow the instructions at 2.a.<br>
If you prefer a manual setup process, please follow the instructions at 2.b.

    a. &nbsp; Create a Personal Access Token at [app.sipgate.com](https://app.sipgate.com/w0/personal-access-token) with the following scopes.
    This token will only be used by the `setup.sh` script and can be deleted afterwards.

    ```
    authorization:oauth2:clients:read
    authorization:oauth2:clients:write
    settings:sipgateio:write
    ```
    
    &nbsp; &nbsp; &nbsp;&nbsp; Then run `./setup.sh` in the project's directory.<br>
    &nbsp; &nbsp; &nbsp;&nbsp; If you run into any problems, follow the manual setup at 2.b.

    b. &nbsp; To manually set up the project, create a `.env` file by copying [`.env.example`](.env.example) and follow the instructions above each variable.

3. Start the docker containers with `make up`.

4. To authenticate on your local system, visit `http://localhost:{WEBHOOK_PORT}/auth` (replace `{WEBHOOK_PORT}` with your port). To authenticate from another system, use `{WEBHOOK_URL}/auth` instead.

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
