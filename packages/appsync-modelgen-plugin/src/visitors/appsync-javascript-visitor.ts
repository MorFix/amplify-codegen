import { DEFAULT_SCALARS, NormalizedScalarsMap } from '@graphql-codegen/visitor-plugin-common';
import { GraphQLSchema } from 'graphql';
import { AppSyncModelTypeScriptVisitor } from './appsync-typescript-visitor';
import { CodeGenEnum, CodeGenModel, ParsedAppSyncModelConfig, RawAppSyncModelConfig } from './appsync-visitor';
import { pascalCase } from 'change-case';

export interface RawAppSyncModelJavaScriptConfig extends RawAppSyncModelConfig {
  /**
   * @name isDeclaration
   * @type boolean
   * @description required, the language target for generated code
   *
   * @example
   * ```yml
   * generates:
   * Models:
   * config:
   *    target: 'javascript'
   *    isDelcaration: true
   *  plugins:
   *    - amplify-codegen-appsync-model-plugin
   * ```
   * isDeclaration: true| false
   */
  isDeclaration?: boolean;
}

export interface ParsedAppSyncModelJavaScriptConfig extends ParsedAppSyncModelConfig {
  isDeclaration: boolean;
}

export class AppSyncModelJavascriptVisitor<
  TRawConfig extends RawAppSyncModelJavaScriptConfig = RawAppSyncModelJavaScriptConfig,
  TPluginConfig extends ParsedAppSyncModelJavaScriptConfig = ParsedAppSyncModelJavaScriptConfig
> extends AppSyncModelTypeScriptVisitor<TRawConfig, TPluginConfig> {
  constructor(
    schema: GraphQLSchema,
    rawConfig: TRawConfig,
    additionalConfig: Partial<TPluginConfig>,
    defaultScalars: NormalizedScalarsMap = DEFAULT_SCALARS,
  ) {
    super(schema, rawConfig, additionalConfig, defaultScalars);
    this._parsedConfig.isDeclaration = rawConfig.isDeclaration || false;
  }

  generate(): string {
    // TODO: Remove us, leaving in to be explicit on why this flag is here.
    const shouldUseModelNameFieldInHasManyAndBelongsTo = false;
    // This flag is going to be used to tight-trigger on JS implementations only.
    const shouldImputeKeyForUniDirectionalHasMany = true;
    const shouldUseFieldsInAssociatedWithInHasOne = true;
    this.processDirectives(
      shouldUseModelNameFieldInHasManyAndBelongsTo,
      shouldImputeKeyForUniDirectionalHasMany,
      shouldUseFieldsInAssociatedWithInHasOne
    );

    if (this._parsedConfig.isDeclaration) {
      const enumDeclarations = Object.values(this.enumMap)
        .map(enumObj => this.generateEnumDeclarations(enumObj, true))
        .join('\n\n');

      const modelDeclarations = Object.values(this.modelMap)
        .map(typeObj => this.generateModelDeclaration(typeObj, true))
        .join('\n\n');

      const nonModelDeclarations = Object.values(this.nonModelMap)
        .map(typeObj => this.generateModelDeclaration(typeObj, true, false))
        .join('\n\n');

      const imports = this.generateImports();

      if (!this.isCustomPKEnabled()) {
        const modelMetaData = Object.values(this.modelMap)
          .map(typeObj => this.generateModelMetaData(typeObj))
          .join('\n\n');
        return [imports, enumDeclarations, nonModelDeclarations, modelMetaData, modelDeclarations].filter(b => b).join('\n\n');
      }

      return [imports, enumDeclarations, nonModelDeclarations, modelDeclarations].join('\n\n');
    } else {
      const imports = this.generateImportsJavaScriptImplementation();
      const enumDeclarations = Object.values(this.enumMap)
        .map((e: CodeGenEnum) => this.generateEnumObject(e))
        .join('\n\n');

      const modelInitialization = this.generateModelInitialization(
        [...Object.values(this.modelMap), ...Object.values(this.nonModelMap)],
        false,
      );

      const modelExports = this.generateExports([
        ...Object.values(this.modelMap),
        ...Object.values(this.enumMap),
        ...Object.values(this.nonModelMap),
      ]);
      return [imports, enumDeclarations, modelInitialization, modelExports].join('\n\n');
    }
  }

  /**
   * Generate JavaScript object for enum. The generated objet. For an enum with value
   * enum status {
   * pending
   * done
   * }
   * the generated object would be
   * const Status = {
   *    "PENDING": "pending",
   *    "DONE": "done",
   * }
   * @param enumObj: CodeGenEnun codegen enum object
   * @param exportEnum: boolean export the enum object
   */
  protected generateEnumObject(enumObj: CodeGenEnum, exportEnum: boolean = false): string {
    const enumName = pascalCase(this.getEnumName(enumObj));
    const header = [exportEnum ? 'export' : null, 'const', enumName].filter(h => h).join(' ');

    return `${header} = ${JSON.stringify(enumObj.values, null, 2)};`;
  }

  /**
   * Generate import statements to be used in the JavaScript model file
   */
  protected generateImportsJavaScriptImplementation(): string {
    return ['// @ts-check', "import { initSchema } from '@aws-amplify/datastore';", "import { schema } from './schema';"].join('\n');
  }

  protected generateModelTypeDeclarationName(model: CodeGenModel): string {
    return `${this.getModelName(model)}`;
  }

  protected generateImports(): string {
    const baseImportComponents = Array.from(this.BASE_DATASTORE_IMPORT);
    const baseImport = `import { ${baseImportComponents.join(', ')} } from "@aws-amplify/datastore";`;
    if (this.TS_IGNORE_DATASTORE_IMPORT.size) {
      const tsIgnoreImportComponents = Array.from(this.TS_IGNORE_DATASTORE_IMPORT);
      const tsIgnoreImport = `// @ts-ignore\nimport { ${tsIgnoreImportComponents.join(', ')} } from "@aws-amplify/datastore";`;
      return [baseImport, tsIgnoreImport].join('\n');
    }
    return baseImport;
  }
}
