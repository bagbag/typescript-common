import { effect, ErrorHandler, inject, resource, ResourceStatus, type ResourceOptions, type ResourceRef } from '@angular/core';
import { isNotNullOrUndefined } from '@tstdl/base/utils';

export function errorHandledResource<T, R>(options: ResourceOptions<T, R>): ResourceRef<T> {
  const errorHandler = inject(ErrorHandler);
  const ref = resource(options);

  effect(() => {
    if (ref.status() != ResourceStatus.Error) {
      return;
    }

    const error = ref.error();

    if (isNotNullOrUndefined(error)) {
      errorHandler.handleError(error);
    }
  });

  return ref;
}
