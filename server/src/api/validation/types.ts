export type ValidationFunction<Input, Output = Input> = (object: Input) => ValidationResult<Output>;

export type ValidationResult<Output> =
  | { valid: true, value: Output, error?: undefined }
  | { valid: false, value?: undefined, error: NonNullable<any> };
