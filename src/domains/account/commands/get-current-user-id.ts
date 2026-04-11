export interface GetCurrentUserIdCommandDeps {
  ctx: {
    userID?: string;
  };
}

export function createGetCurrentUserIdCommand(deps: GetCurrentUserIdCommandDeps) {
  const { ctx } = deps;

  return function getCurrentUserID() {
    return ctx.userID;
  };
}
