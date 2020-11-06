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

export { splitFullUserId };
