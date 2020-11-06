import { createConnection } from "mysql";

export interface DatabaseConnection {
  query(sql: string, args: any): Promise<any>;
  end(): Promise<void>;
}

export const openDatabaseConnection = (): DatabaseConnection => {
  const connection = createConnection({
    host: "db",
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  return {
    query(sql: string, args: any = []) {
      return new Promise((resolve, reject) => {
        connection.query(sql, args, (error, results) => {
          if (error) reject(error);
          else resolve(results);
        });
      });
    },
    end() {
      return new Promise((resolve, reject) => {
        connection.end((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
};
