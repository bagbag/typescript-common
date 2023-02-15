/* eslint-disable max-classes-per-file */
import type { ApiController, ApiRequestContext, ApiServerResult } from '#/api';
import { defineApi } from '#/api';
import { compileClient } from '#/api/client';
import { apiController, configureApiServer } from '#/api/server';
import { Application } from '#/application';
import { container } from '#/container';
import { configureUndiciHttpClientAdapter } from '#/http/client/adapters/undici-http-client.adapter';
import { configureHttpClient } from '#/http/client/module';
import { configureNodeHttpServer } from '#/http/server/node';
import { WebServerModule } from '#/module/modules';
import { array, boolean, number, object, Property } from '#/schema';
import { timeout } from '#/utils/timing';
import { Agent } from 'undici';

class User {
  @Property({ coerce: true })
  id: number;

  @Property()
  name: string;
}

const users: User[] = [
  { id: 1, name: 'Alice' },
  { id: 3, name: 'Bob' }
];

type UsersApiDefinition = typeof usersApiDefinition;

const usersApiDefinition = defineApi({
  resource: 'users', // /api/:version/users
  endpoints: {
    load: {
      method: 'GET', // GET is default
      resource: ':id', // => /api/v1/users/:id
      version: 1,
      parameters: object({
        id: number({ coerce: true })
      }),
      result: User
    },
    loadAll: { // => /api/v1/users
      result: array(User)
    },
    delete: {
      method: 'DELETE',
      resource: ':id', // => /api/v1/users/:id
      parameters: object({
        id: number({ coerce: true })
      }),
      result: boolean()
    }
  }
});

@apiController(usersApiDefinition)
class UserApi implements ApiController<UsersApiDefinition> {
  load({ parameters }: ApiRequestContext<UsersApiDefinition, 'load'>): ApiServerResult<UsersApiDefinition, 'load'> {
    return users.find((user) => user.id == parameters.id)!;
  }

  loadAll(this: UserApi): ApiServerResult<UsersApiDefinition, 'loadAll'> {
    return users;
  }

  delete({ parameters }: ApiRequestContext<UsersApiDefinition, 'delete'>): ApiServerResult<UsersApiDefinition, 'delete'> {
    const index = users.findIndex((user) => user.id == parameters.id);

    if (index == -1) {
      return false;
    }

    users.splice(index, 1);
    return true;
  }
}

const UserApiClient = compileClient(usersApiDefinition);

async function clientTest(): Promise<void> {
  await timeout(250); // allow server to start

  const userApiClient = container.resolve(UserApiClient);

  const allUsers = await userApiClient.loadAll();
  console.log(allUsers);

  await userApiClient.delete({ id: allUsers[0]!.id });

  const allUsersAfterDelete = await userApiClient.loadAll();
  console.log(allUsersAfterDelete);
}

async function main(): Promise<void> {
  configureNodeHttpServer();
  configureApiServer({ controllers: [UserApi] });
  configureUndiciHttpClientAdapter({ dispatcher: new Agent({ keepAliveMaxTimeout: 1 }) });
  configureHttpClient({ baseUrl: 'http://localhost:8000' });

  Application.registerModule(WebServerModule);
  await Application.run();
}

void main();
void clientTest().catch((error) => console.error(error)).then(async () => timeout(1000)).then(async () => Application.shutdown());
