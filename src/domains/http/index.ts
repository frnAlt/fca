import { createHttpGetQuery, type HttpGetQueryDeps } from "./queries/http-get";
import { createHttpPostCommand, type HttpPostCommandDeps } from "./commands/http-post";
import { createPostFormDataCommand, type PostFormDataCommandDeps } from "./commands/post-form-data";

export interface HttpDomainDeps {
  get: HttpGetQueryDeps;
  post: HttpPostCommandDeps;
  postFormData: PostFormDataCommandDeps;
}

export function createHttpDomain(deps: HttpDomainDeps) {
  return {
    get: createHttpGetQuery(deps.get),
    post: createHttpPostCommand(deps.post),
    postFormData: createPostFormDataCommand(deps.postFormData)
  };
}

export * from "./queries/http-get";
export * from "./commands/http-post";
export * from "./commands/post-form-data";
