import type { Injectable } from '#/container';
import { injectArg, resolveArgumentType, singleton } from '#/container';
import { BadRequestError } from '#/error/bad-request.error';
import { Schema } from '#/schema';
import * as path from 'path';
import { Template } from '../template.model';
import { TemplateProvider } from '../template.provider';

export type FileTemplateProviderConfig = {
  basePath?: string
};

export type FileTemplateProviderArgument = string;

export const fileTemplateProviderConfig: FileTemplateProviderConfig = {};

const keyPattern = /^[\w\-/]+$/u;

@singleton({
  defaultArgumentProvider: () => fileTemplateProviderConfig.basePath
})
export class FileTemplateProvider extends TemplateProvider implements Injectable<FileTemplateProviderArgument> {
  private readonly basePath: string;

  readonly [resolveArgumentType]: FileTemplateProviderArgument;
  constructor(@injectArg() basePath: string) {
    super();

    this.basePath = path.resolve(basePath);
  }

  async get<T extends Template = Template>(key: string): Promise<T> {
    if (!keyPattern.test(key)) {
      throw new BadRequestError('Illegal template key. Only a-z, A-Z, 0-9, _ and - are allowed.');
    }

    const filePath = path.resolve(this.basePath, `${key}.js`);

    if (!filePath.startsWith(this.basePath)) {
      throw new BadRequestError(`Illegal file path. Must be inside "${this.basePath}".`);
    }

    const templateModule = await import(filePath) as { template?: unknown, default?: unknown };
    const fileContent = templateModule.template ?? templateModule.default;

    return Schema.parse(Template, fileContent) as T;
  }
}

export function configureFileTemplateProvider(config: Partial<FileTemplateProviderConfig> = {}): void {
  fileTemplateProviderConfig.basePath = config.basePath ?? fileTemplateProviderConfig.basePath;
}
