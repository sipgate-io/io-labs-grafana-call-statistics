import { decode } from "jwt-simple";
import * as fs from "fs";

interface WebUserInformation {
  masterSipId: string;
  userExtension: string;
}

const splitFullUserId = (fullUserId: string): WebUserInformation => {
  const index = fullUserId.search("w");
  return {
    masterSipId: fullUserId.slice(0, index),
    userExtension: fullUserId.slice(index),
  };
};

const isTokenExpired = (token: any): boolean => {
  const decodedToken = decode(token, "", true);

  if ("exp" in decodedToken) {
    return new Date(decodedToken.exp * 1000).getTime() < Date.now();
  }

  throw new Error("Token has no expiration attribute");
};

const readFile = async (path: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    fs.readFile(path, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data.toString());
      }
    });
  });
};

export { splitFullUserId, isTokenExpired, readFile };
