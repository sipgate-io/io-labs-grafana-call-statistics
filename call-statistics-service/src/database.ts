import { createConnection } from "mysql";

export function openDatabaseConnection() {
  return createConnection({
    host: "localhost",
    user: "user",
    password: "supersecret",
    database: "statistics",
  });
}
