import { decode } from "jwt-simple";

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

  if ("exp" in token) {
    return new Date(token.exp * 1000).getTime() < Date.now();
  }

  throw new Error("Token has no expiration attribute");
};

export { splitFullUserId, isTokenExpired };
