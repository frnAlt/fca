import formatMod from "../../../utils/format";

const { getType } = formatMod;

export interface AddExternalModuleCommandDeps {
  defaultFuncs: Loose;
  api: Loose;
  ctx: Loose;
}

export function createAddExternalModuleCommand(deps: AddExternalModuleCommandDeps) {
  const { defaultFuncs, api, ctx } = deps;

  return function addExternalModule(moduleObj: Record<string, Loose>) {
    if (getType(moduleObj) !== "Object") {
      throw new Error(`moduleObj must be an object, not ${getType(moduleObj)}!`);
    }

    for (const apiName in moduleObj) {
      if (getType(moduleObj[apiName]) === "Function") {
        api[apiName] = moduleObj[apiName](defaultFuncs, api, ctx);
      } else {
        throw new Error(
          `Item "${apiName}" in moduleObj must be a function, not ${getType(moduleObj[apiName])}!`
        );
      }
    }
  };
}
