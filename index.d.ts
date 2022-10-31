export declare type GenerateWorkflowOptions = {
  generator: {
    pathParams: boolean,
    requestBody: boolean,
    optionalParams: boolean,
    useExampleValues: boolean,
    useDefaultValues: boolean
  },
  check: {
    status: boolean,
    examples: boolean,
    schema: boolean
  },
  contentType: 'application/json' | 'application/xml'
}

export declare function generateWorkflow(file: any, options: GenerateWorkflowOptions): Promise<object>
